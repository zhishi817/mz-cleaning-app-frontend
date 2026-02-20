# API 接口与对接说明（MZStay App）

## 目标

移动端复用现有后台系统的认证体系，做到：

- 后台直接创建/维护用户
- 用户用同一套账号密码登录 App
- App 持久化保存 JWT，并在启动时自动校验登录态

## 环境变量

- `EXPO_PUBLIC_API_BASE_URL`：后端服务基地址
  - 示例：`http://localhost:3001`
  - 允许写为 `.../api` 或 `.../auth`，App 会自动尝试候选路径组合

## 鉴权 Header

App 使用 Bearer Token：

```
Authorization: Bearer <jwt>
```

## 认证接口

### 1) 登录

- 方法：`POST /auth/login`
- Body：

```json
{ "username": "admin", "password": "xxxx" }
```

- 返回：

```json
{ "token": "<jwt>" }
```

备注：

- 与后台 Web 登录一致，支持 username/email（以及后端静态账号）。

### 2) 获取当前用户

- 方法：`GET /auth/me`
- Header：`Authorization: Bearer <jwt>`
- 返回：

```json
{ "username": "admin", "role": "admin" }
```

用途：

- App 启动自动登录校验
- “我”页面展示用户信息

### 3) 找回密码（占位）

- 方法：`POST /auth/forgot`
- Body：

```json
{ "email": "name@example.com" }
```

- 返回：

```json
{ "ok": true }
```

备注：

- 当前后端实现为占位逻辑：若用户存在会写入 `reset_requested_at` 时间戳提示。

## Token 生命周期与刷新

后端当前没有 refresh token 或 `/auth/refresh`，因此 App 采用策略：

- 启动时：读取本地 JWT → 调用 `/auth/me` 验证
- 验证失败（例如过期/撤销）：清理本地 token → 回到登录页

如后续增加 refresh 接口，可在 `src/lib/auth.tsx` 的启动校验与请求失败处理处接入刷新逻辑。


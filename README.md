# MZStay 线下应用（移动端）

本目录为 MZStay 线下应用的移动端前端工程，使用 Expo + React Native + TypeScript 构建，并复用现有后台系统的用户认证接口（`/auth/login`、`/auth/me`、`/auth/forgot`）。

## 技术栈

- Expo / React Native
- TypeScript
- React Navigation（Stack + Bottom Tabs）
- Token 安全存储：`expo-secure-store`（失败时回退到 AsyncStorage）
- 测试：Jest（`jest-expo`）
- 代码规范：ESLint（`eslint-config-expo`）

## 目录结构

```
MZStay_app/
  src/
    app/                路由与导航容器
    screens/            页面（登录/找回/主界面 tabs）
    lib/                认证、存储、API 调用封装
    config/             环境配置（API_BASE_URL）
  docs/
    api.md              接口与对接说明
```

## 开发环境准备

1. 安装依赖

```bash
cd MZStay_app
npm install
```

2. 配置后端地址

Expo 推荐使用 `EXPO_PUBLIC_` 前缀环境变量。

- 复制环境变量模板：

```bash
cp .env.example .env
```

- 修改 `.env`：

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001
```

3. 启动开发

```bash
npm run start
```

## 本地登录（仅用于快速测试 UI）

当后端未启动或想快速预览登录后页面时，可启用本地测试账号（不请求后端）：

```
EXPO_PUBLIC_LOCAL_LOGIN_ENABLED=1
EXPO_PUBLIC_LOCAL_LOGIN_USERNAME=demo
EXPO_PUBLIC_LOCAL_LOGIN_PASSWORD=demo1234
EXPO_PUBLIC_LOCAL_LOGIN_ROLE=cleaner
```

## 登录与认证说明

- 登录：`POST /auth/login`，请求体 `{ username, password }`，返回 `{ token }`
- 用户信息：`GET /auth/me`，Header `Authorization: Bearer <token>`，返回 `{ username, role }`
- 找回密码：`POST /auth/forgot`，请求体 `{ email }`（当前实现为占位行为：若用户存在会写入时间戳提示）

### Token 机制

- App 启动会从安全存储读取 JWT，调用 `/auth/me` 验证登录态（自动登录）。
- 后端当前未提供 refresh token / `/auth/refresh` 接口；JWT 过期后会要求重新登录（App 会在校验失败时清理 token 并回到登录页）。

## 常用脚本

- `npm run start`：启动 Expo 开发
- `npm run lint`：ESLint 检查
- `npm run test`：Jest 测试
- `npm run typecheck`：TypeScript 类型检查

## iOS/Android 原生工程（可选）

本工程默认为 Expo Managed Workflow。如需生成 `ios/`、`android/`（包含 `Podfile` 等原生文件）：

```bash
npx expo prebuild
```

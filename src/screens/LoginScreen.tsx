import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAuth } from '../lib/auth'
import {
  getRememberedBiometricPassword,
  getRememberedLoginHint,
  getRememberedPlainPassword,
  pruneExpiredRememberedLogin,
  type RememberedLoginHint,
} from '../lib/authStorage'
import * as SecureStore from 'expo-secure-store'
import { validateLoginForm } from '../lib/validators'
import type { AuthStackParamList } from '../navigation/RootNavigator'

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>

export default function LoginScreen(props: Props) {
  const { signIn, isSigningIn, authIssue, clearAuthIssue } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [rememberedHint, setRememberedHint] = useState<(RememberedLoginHint & { expired: boolean }) | null>(null)
  const [biometricReady, setBiometricReady] = useState(false)

  const canSubmit = useMemo(() => !!username.trim() && !!password.trim() && !isSigningIn, [isSigningIn, password, username])
  const biometricLabel = Platform.OS === 'ios' ? '面容识别' : '生物识别'
  const canUseBiometricLogin = !!rememberedHint?.biometric_enabled && biometricReady && !isSigningIn

  useEffect(() => {
    if (!authIssue) return
    Alert.alert('登录已失效', authIssue, [{ text: '确定', onPress: clearAuthIssue }])
  }, [authIssue, clearAuthIssue])

  useEffect(() => {
    let alive = true
    ;(async () => {
      await pruneExpiredRememberedLogin()
      const hint = await getRememberedLoginHint()
      const secureBiometricReady = SecureStore.canUseBiometricAuthentication()
      if (!alive) return
      setRememberedHint(hint)
      setBiometricReady(secureBiometricReady)
      if (!hint || hint.expired) return
      setUsername(hint.username)
      const plainPassword = hint.remember_password ? await getRememberedPlainPassword() : null
      if (!alive) return
      if (plainPassword) setPassword(plainPassword)
    })().catch(() => null)
    return () => {
      alive = false
    }
  }, [])

  function alertAsync(title: string, message: string, buttons: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; value: string }>) {
    return new Promise<string>((resolve) => {
      Alert.alert(
        title,
        message,
        buttons.map((button) => ({
          text: button.text,
          style: button.style,
          onPress: () => resolve(button.value),
        })),
      )
    })
  }

  async function askRememberPreferences(normalizedUsername: string) {
    const currentHint = rememberedHint && !rememberedHint.expired ? rememberedHint : null
    const sameUser = currentHint ? currentHint.username === normalizedUsername : false
    if (sameUser) {
      return {
        rememberPassword: currentHint?.remember_password !== false,
        biometricEnabled: currentHint?.biometric_enabled === true && biometricReady,
      }
    }

    const rememberChoice = await alertAsync(
      '记住密码',
      '是否记住当前账号密码，方便下次自动填充登录？',
      [
        { text: '不记住', style: 'cancel', value: 'no' },
        { text: '确认', value: 'yes' },
      ],
    )
    if (rememberChoice !== 'yes') {
      return { rememberPassword: false, biometricEnabled: false }
    }

    if (!biometricReady) {
      return { rememberPassword: true, biometricEnabled: false }
    }

    const biometricChoice = await alertAsync(
      `${biometricLabel}登录`,
      `是否授权使用${biometricLabel}快速登录？`,
      [
        { text: '暂不启用', style: 'cancel', value: 'no' },
        { text: '确认', value: 'yes' },
      ],
    )
    return {
      rememberPassword: true,
      biometricEnabled: biometricChoice === 'yes',
    }
  }

  async function refreshRememberedState() {
    const hint = await getRememberedLoginHint()
    setRememberedHint(hint)
    if (hint?.remember_password && !hint.biometric_enabled) {
      const plainPassword = await getRememberedPlainPassword()
      if (plainPassword) setPassword(plainPassword)
    } else if (hint?.biometric_enabled) {
      setPassword('')
    }
  }

  async function onSubmit() {
    const { username: u, password: p, errors: e } = validateLoginForm({ username, password })
    setErrors(e)
    if (e.username || e.password) return
    try {
      const preferences = await askRememberPreferences(String(u || '').trim())
      await signIn({ username: u, password: p, ...preferences })
      await refreshRememberedState()
    } catch (err: any) {
      Alert.alert('登录失败', err?.message || '请稍后重试')
    }
  }

  async function onBiometricLogin() {
    const hint = rememberedHint
    if (!hint || hint.expired || !hint.biometric_enabled) return
    try {
      const rememberedPassword = await getRememberedBiometricPassword()
      if (!rememberedPassword) {
        Alert.alert(`${biometricLabel}不可用`, `未读取到已保存的${biometricLabel}登录信息，请先使用密码登录一次。`)
        return
      }
      await signIn({
        username: hint.username,
        password: rememberedPassword,
        rememberPassword: true,
        biometricEnabled: true,
      })
      await refreshRememberedState()
    } catch (err: any) {
      Alert.alert(`${biometricLabel}登录失败`, err?.message || `请先使用账号密码登录，重新启用${biometricLabel}。`)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={styles.brandTitle}>MZ Cleaning</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>用户名 / 手机号</Text>
          <TextInput
            value={username}
            onChangeText={t => {
              setUsername(t)
              if (errors.username) setErrors(prev => ({ ...prev, username: undefined }))
            }}
            placeholder="admin / cs / cleaner"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            textContentType="username"
            autoComplete="username"
            importantForAutofill="yes"
            returnKeyType="next"
            style={[styles.input, errors.username ? styles.inputError : null]}
            editable={!isSigningIn}
          />
          {!!errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>密码</Text>
          <TextInput
            value={password}
            onChangeText={t => {
              setPassword(t)
              if (errors.password) setErrors(prev => ({ ...prev, password: undefined }))
            }}
            placeholder="请输入密码"
            secureTextEntry
            textContentType="password"
            autoComplete="current-password"
            importantForAutofill="yes"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            style={[styles.input, errors.password ? styles.inputError : null]}
            editable={!isSigningIn}
          />
          {!!errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>

        <Pressable
          style={({ pressed }) => [styles.submitBtn, !canSubmit ? styles.submitBtnDisabled : null, pressed && canSubmit ? styles.submitBtnPressed : null]}
          disabled={!canSubmit}
          onPress={onSubmit}
        >
          <Text style={styles.submitText}>{isSigningIn ? '登录中…' : '登录'}</Text>
        </Pressable>

        {canUseBiometricLogin ? (
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed ? styles.secondaryBtnPressed : null]}
            disabled={isSigningIn}
            onPress={onBiometricLogin}
          >
            <Text style={styles.secondaryBtnText}>{`${biometricLabel}登录`}</Text>
          </Pressable>
        ) : null}

        {rememberedHint?.username ? (
          <Text style={styles.hintText}>
            {rememberedHint.biometric_enabled
              ? `已为 ${rememberedHint.username} 启用${biometricLabel}登录`
              : rememberedHint.remember_password
                ? `已记住 ${rememberedHint.username} 的登录信息`
                : `已保存账号 ${rememberedHint.username}`}
          </Text>
        ) : null}

        <Pressable onPress={() => props.navigation.navigate('ForgotPassword')} disabled={isSigningIn} style={styles.forgotBtn}>
          <Text style={styles.forgotText}>忘记密码？</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F6F7FB',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6E9F2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0B0B0B',
  },
  brandTitle: {
    marginLeft: 12,
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
    textAlign: 'center',
  },
  subTitle: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 13,
    color: '#6B7280',
  },
  field: {
    marginTop: 12,
  },
  label: {
    marginBottom: 6,
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    marginTop: 6,
    color: '#EF4444',
    fontSize: 12,
  },
  submitBtn: {
    marginTop: 18,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  submitBtnPressed: {
    opacity: 0.9,
  },
  submitBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryBtn: {
    marginTop: 10,
    minHeight: 46,
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
  },
  secondaryBtnPressed: {
    opacity: 0.92,
  },
  secondaryBtnText: {
    color: '#1D4ED8',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  hintText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
  },
  forgotBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  forgotText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },
})

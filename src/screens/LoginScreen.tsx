import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAuth } from '../lib/auth'
import { validateLoginForm } from '../lib/validators'
import type { AuthStackParamList } from '../navigation/RootNavigator'

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>

export default function LoginScreen(props: Props) {
  const { signIn, isSigningIn, authIssue, clearAuthIssue } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null)
  const biometricLabel = Platform.OS === 'ios' ? 'Face ID' : '指纹/面容'

  const canSubmit = useMemo(() => !!username.trim() && !!password.trim() && !isSigningIn, [isSigningIn, password, username])

  useEffect(() => {
    if (!authIssue) return
    Alert.alert('登录已失效', authIssue, [{ text: '确定', onPress: clearAuthIssue }])
  }, [authIssue, clearAuthIssue])

  async function onSubmit() {
    const { username: u, password: p, errors: e } = validateLoginForm({ username, password })
    setErrors(e)
    if (e.username || e.password) return
    try {
      await signIn({ username: u, password: p })
    } catch (err: any) {
      Alert.alert('登录失败', err?.message || '请稍后重试')
    }
  }

  const focusHint =
    focusedField === 'username'
      ? '如果系统已保存账号，键盘上方通常会直接出现已保存账号建议，点一下即可带入。'
      : focusedField === 'password'
        ? `如果系统已保存密码，可直接点键盘建议，并用 ${biometricLabel} 或系统验证完成自动填充。`
        : null

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
            onFocus={() => setFocusedField('username')}
            onBlur={() => setFocusedField(current => (current === 'username' ? null : current))}
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
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(current => (current === 'password' ? null : current))}
            style={[styles.input, errors.password ? styles.inputError : null]}
            editable={!isSigningIn}
          />
          {!!errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>

        {focusHint ? (
          <View style={styles.focusHintBox}>
            <Text style={styles.focusHintText}>{focusHint}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.submitBtn, !canSubmit ? styles.submitBtnDisabled : null, pressed && canSubmit ? styles.submitBtnPressed : null]}
          disabled={!canSubmit}
          onPress={onSubmit}
        >
          <Text style={styles.submitText}>{isSigningIn ? '登录中…' : '登录'}</Text>
        </Pressable>

        <Text style={styles.systemHint}>如已在系统密码管理器中保存账号，可直接使用 {biometricLabel} 或系统自动填充登录。</Text>

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
  focusHintBox: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  focusHintText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#1D4ED8',
  },
  submitBtn: {
    marginTop: 18,
    paddingVertical: 14,
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
  },
  systemHint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
    textAlign: 'center',
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

import React, { useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../navigation/RootNavigator'
import { useAuth } from '../lib/auth'
import { validateEmail } from '../lib/validators'

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>

export default function ForgotPasswordScreen(props: Props) {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canSubmit = useMemo(() => !!email.trim() && !loading, [email, loading])

  async function onSubmit() {
    const { email: e, errors } = validateEmail({ email })
    const msg = errors.email || null
    setError(msg)
    if (msg) return
    try {
      setLoading(true)
      await requestPasswordReset({ email: e })
      Alert.alert('已提交', '若邮箱存在，将收到重置密码的指引。', [{ text: '返回登录', onPress: () => props.navigation.goBack() }])
    } catch (err: any) {
      Alert.alert('提交失败', err?.message || '请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>找回密码</Text>
        <Text style={styles.subTitle}>输入注册邮箱，我们会发送重置指引</Text>

        <View style={styles.field}>
          <Text style={styles.label}>邮箱</Text>
          <TextInput
            value={email}
            onChangeText={t => {
              setEmail(t)
              if (error) setError(null)
            }}
            placeholder="name@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={[styles.input, error ? styles.inputError : null]}
            editable={!loading}
          />
          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        <Pressable
          style={({ pressed }) => [styles.submitBtn, !canSubmit ? styles.submitBtnDisabled : null, pressed && canSubmit ? styles.submitBtnPressed : null]}
          disabled={!canSubmit}
          onPress={onSubmit}
        >
          <Text style={styles.submitText}>{loading ? '提交中…' : '提交'}</Text>
        </Pressable>
      </View>
    </View>
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
  title: {
    fontSize: 20,
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
})

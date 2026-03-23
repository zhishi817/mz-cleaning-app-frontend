import React, { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth'
import { changeMyPassword } from '../../lib/api'
import { hairline, moderateScale } from '../../lib/scale'
import { useI18n } from '../../lib/i18n'

export default function ChangePasswordScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [newPwd2, setNewPwd2] = useState('')
  const [saving, setSaving] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showNew2, setShowNew2] = useState(false)

  async function onSubmit() {
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    const a = oldPwd.trim()
    const b = newPwd.trim()
    const c = newPwd2.trim()
    if (!a || !b || !c) {
      Alert.alert(t('common_error'), '请填写完整')
      return
    }
    if (b.length < 6) {
      Alert.alert(t('common_error'), '新密码至少 6 位')
      return
    }
    if (b !== c) {
      Alert.alert(t('common_error'), '两次新密码不一致')
      return
    }
    try {
      setSaving(true)
      await changeMyPassword(token, { old_password: a, new_password: b })
      setOldPwd('')
      setNewPwd('')
      setNewPwd2('')
      Alert.alert(t('common_ok'), '密码已更新')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '修改失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>旧密码</Text>
          <View style={styles.inputWrap}>
            <TextInput value={oldPwd} onChangeText={setOldPwd} style={styles.input} secureTextEntry={!showOld} placeholder="旧密码" />
            <Pressable onPress={() => setShowOld(v => !v)} style={({ pressed }) => [styles.eyeBtn, pressed ? styles.pressed : null]} hitSlop={8}>
              <Ionicons name={showOld ? 'eye-off-outline' : 'eye-outline'} size={moderateScale(18)} color="#6B7280" />
            </Pressable>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>新密码</Text>
          <View style={styles.inputWrap}>
            <TextInput value={newPwd} onChangeText={setNewPwd} style={styles.input} secureTextEntry={!showNew} placeholder="新密码（至少 6 位）" />
            <Pressable onPress={() => setShowNew(v => !v)} style={({ pressed }) => [styles.eyeBtn, pressed ? styles.pressed : null]} hitSlop={8}>
              <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={moderateScale(18)} color="#6B7280" />
            </Pressable>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>确认新密码</Text>
          <View style={styles.inputWrap}>
            <TextInput value={newPwd2} onChangeText={setNewPwd2} style={styles.input} secureTextEntry={!showNew2} placeholder="再次输入新密码" />
            <Pressable onPress={() => setShowNew2(v => !v)} style={({ pressed }) => [styles.eyeBtn, pressed ? styles.pressed : null]} hitSlop={8}>
              <Ionicons name={showNew2 ? 'eye-off-outline' : 'eye-outline'} size={moderateScale(18)} color="#6B7280" />
            </Pressable>
          </View>
        </View>

        <Pressable onPress={onSubmit} disabled={saving} style={({ pressed }) => [styles.btn, pressed ? styles.pressed : null, saving ? styles.btnDisabled : null]}>
          <Text style={styles.btnText}>保存</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, backgroundColor: '#F6F7FB' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#EEF0F6' },
  field: { marginTop: 12 },
  label: { marginBottom: 6, color: '#374151', fontWeight: '900' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, backgroundColor: '#FFFFFF' },
  input: { flex: 1, height: 44, color: '#111827', fontSize: moderateScale(14), fontWeight: '700' },
  eyeBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btn: { marginTop: 16, height: 46, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { backgroundColor: '#93C5FD' },
  btnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  pressed: { opacity: 0.92 },
})

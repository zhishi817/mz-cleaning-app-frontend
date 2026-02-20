import React from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { clearAppLocalData } from '../../lib/appReset'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline } from '../../lib/scale'

export default function AccountScreen() {
  const { t } = useI18n()
  const { signOut } = useAuth()

  async function onLogout() {
    const ok = await new Promise<boolean>(resolve => {
      Alert.alert(t('me_logout'), '确定退出当前账号？', [
        { text: t('common_cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('common_confirm'), style: 'destructive', onPress: () => resolve(true) },
      ])
    })
    if (!ok) return
    await signOut()
  }

  async function onClear() {
    const ok = await new Promise<boolean>(resolve => {
      Alert.alert(t('account_clear'), '将清除语言设置、个人信息与公告缓存，并退出登录。继续？', [
        { text: t('common_cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('common_confirm'), style: 'destructive', onPress: () => resolve(true) },
      ])
    })
    if (!ok) return
    await clearAppLocalData()
    await signOut()
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Pressable style={({ pressed }) => [styles.btn, pressed ? styles.pressed : null]} onPress={onLogout}>
          <Text style={styles.btnText}>{t('me_logout')}</Text>
        </Pressable>
        <View style={styles.sep} />
        <Pressable style={({ pressed }) => [styles.btn, styles.btnDanger, pressed ? styles.pressed : null]} onPress={onClear}>
          <Text style={styles.btnText}>{t('account_clear')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, backgroundColor: '#F6F7FB' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    overflow: 'hidden',
  },
  btn: { paddingVertical: 14, paddingHorizontal: 14, backgroundColor: '#FFFFFF' },
  btnDanger: { backgroundColor: '#FEF2F2' },
  btnText: { fontSize: 15, fontWeight: '900', color: '#111827' },
  sep: { height: hairline(), backgroundColor: '#EEF0F6' },
  pressed: { opacity: 0.92 },
})

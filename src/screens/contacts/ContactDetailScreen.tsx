import React, { useMemo } from 'react'
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { contacts } from '../../data/contacts'
import { normalizeAuMobile } from '../../lib/phone'
import { hairline, moderateScale } from '../../lib/scale'
import type { ContactsStackParamList } from '../../navigation/RootNavigator'

type Props = NativeStackScreenProps<ContactsStackParamList, 'ContactDetail'>

function initials(name: string) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
  const a = (parts[0] || '?')[0] || '?'
  const b = parts.length > 1 ? (parts[parts.length - 1] || '')[0] || '' : ''
  return `${a}${b}`.toUpperCase()
}

export default function ContactDetailScreen(props: Props) {
  const contact = useMemo(() => contacts.find(c => c.id === props.route.params.id) || null, [props.route.params.id])

  async function call() {
    if (!contact) return
    const url = `tel:${normalizeAuMobile(contact.mobileAu)}`
    try {
      const supported = await Linking.canOpenURL(url)
      if (!supported) throw new Error('not supported')
      await Linking.openURL(url)
    } catch {
      Alert.alert('无法拨打', `请检查设备拨号功能或号码：${contact.mobileAu}`)
    }
  }

  if (!contact) {
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Not found</Text>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(contact.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{contact.name}</Text>
            <Text style={styles.meta}>
              {contact.department} · {contact.title}
            </Text>
          </View>
        </View>

        <View style={styles.line} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Mobile</Text>
          <Text style={styles.infoValue}>{contact.mobileAu}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="call-contact" onPress={call} style={({ pressed }) => [styles.callBtn, pressed ? styles.pressed : null]}>
          <Ionicons name="call" size={moderateScale(18)} color="#FFFFFF" />
          <Text style={styles.callText}>Call</Text>
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
    padding: 14,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#1D4ED8', fontWeight: '900', fontSize: 18 },
  name: { fontSize: 18, fontWeight: '900', color: '#111827' },
  meta: { marginTop: 6, color: '#6B7280', fontWeight: '700' },
  line: { marginTop: 14, height: hairline(), backgroundColor: '#EEF0F6' },
  infoRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { color: '#9CA3AF', fontWeight: '900' },
  infoValue: { color: '#111827', fontWeight: '900' },
  callBtn: {
    marginTop: 14,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pressed: { opacity: 0.92 },
  callText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  title: { fontSize: 16, fontWeight: '800', color: '#111827' },
})

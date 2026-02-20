import React, { useMemo, useRef, useState } from 'react'
import { Alert, Linking, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { contacts, type Contact } from '../../data/contacts'
import { normalizeAuMobile } from '../../lib/phone'
import { hairline, moderateScale } from '../../lib/scale'
import type { ContactsStackParamList } from '../../navigation/RootNavigator'
import { useI18n } from '../../lib/i18n'

type Props = NativeStackScreenProps<ContactsStackParamList, 'ContactsList'>

function initialOf(name: string) {
  const s = String(name || '').trim()
  if (!s) return '#'
  const ch = s[0] || '#'
  const up = ch.toUpperCase()
  return /[A-Z]/.test(up) ? up : '#'
}

function initials(name: string) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
  const a = (parts[0] || '?')[0] || '?'
  const b = parts.length > 1 ? (parts[parts.length - 1] || '')[0] || '' : ''
  return `${a}${b}`.toUpperCase()
}

export default function ContactsScreen(props: Props) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const listRef = useRef<SectionList<Contact>>(null)

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? contacts.filter(c => c.name.toLowerCase().includes(q)) : contacts
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    const map = new Map<string, Contact[]>()
    for (const c of sorted) {
      const key = initialOf(c.name)
      const arr = map.get(key) || []
      arr.push(c)
      map.set(key, arr)
    }
    const keys = Array.from(map.keys()).sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
    return keys.map(k => ({ title: k, data: map.get(k) || [] }))
  }, [query])

  const indexLetters = useMemo(() => sections.map(s => s.title), [sections])

  async function call(mobileAu: string) {
    const phone = normalizeAuMobile(mobileAu)
    const url = `tel:${phone}`
    try {
      const supported = await Linking.canOpenURL(url)
      if (!supported) throw new Error('not supported')
      await Linking.openURL(url)
    } catch {
      Alert.alert('无法拨打', `请检查设备拨号功能或号码：${mobileAu}`)
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={moderateScale(18)} color="#9CA3AF" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('contacts_search')}
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <View style={styles.listWrap}>
        <SectionList
          ref={listRef as any}
          sections={sections as any}
          keyExtractor={item => item.id}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{(section as any).title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => props.navigation.navigate('ContactDetail', { id: item.id })}
              style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item.name)}</Text>
              </View>
              <View style={styles.rowMain}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.mobile}>{item.mobileAu}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`call-${item.id}`}
                onPress={() => call(item.mobileAu)}
                style={({ pressed }) => [styles.callBtn, pressed ? styles.rowPressed : null]}
                hitSlop={10}
              >
                <Ionicons name="call" size={moderateScale(18)} color="#2563EB" />
              </Pressable>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={styles.content}
          stickySectionHeadersEnabled
        />

        {indexLetters.length > 0 && (
          <View style={styles.index}>
            {indexLetters.map((l, idx) => (
              <Pressable
                key={l}
                onPress={() => {
                  try {
                    listRef.current?.scrollToLocation({ sectionIndex: idx, itemIndex: 0, animated: true, viewPosition: 0 })
                  } catch {}
                }}
                style={({ pressed }) => [styles.indexItem, pressed ? styles.rowPressed : null]}
              >
                <Text style={styles.indexText}>{l}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  searchWrap: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  listWrap: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  sectionHeader: { paddingTop: 10, paddingBottom: 6, paddingHorizontal: 2 },
  sectionHeaderText: { color: '#9CA3AF', fontSize: 12, fontWeight: '900' },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowPressed: { opacity: 0.92 },
  sep: { height: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#1D4ED8', fontWeight: '900', fontSize: 14 },
  rowMain: { flex: 1 },
  name: { fontSize: moderateScale(15), fontWeight: '900', color: '#111827' },
  mobile: { marginTop: 4, color: '#6B7280', fontWeight: '700' },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline(),
    borderColor: '#DBEAFE',
  },
  index: {
    position: 'absolute',
    right: 6,
    top: 80,
    bottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    width: 28,
  },
  indexItem: { paddingVertical: 2, paddingHorizontal: 4, borderRadius: 6 },
  indexText: { fontSize: 11, fontWeight: '900', color: '#2563EB' },
})

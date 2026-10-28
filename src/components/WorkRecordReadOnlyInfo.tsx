import React from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import GuestLuggageCard from './GuestLuggageCard'
import { moderateScale, hairline } from '../lib/scale'
import { guestRequestForDisplay } from '../lib/turnoverDisplay'
import { normalizeHttpUrl } from '../lib/urls'

type Props = {
  task: any
  token?: string | null
  showGuestLuggage?: boolean
}

function cleanText(value: any) {
  return String(value ?? '').trim()
}

function InfoRow({ icon, text }: { icon: any; text: string }) {
  if (!text) return null
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={moderateScale(15)} color="#64748B" />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  )
}

export default function WorkRecordReadOnlyInfo({ task, token, showGuestLuggage = true }: Props) {
  if (task?.work_record_read_only !== true) return null
  const views = task?.read_only_views || {}
  const propertyAccess = views.property_access === true
  const guestContext = views.guest_context === true
  const lockCodes = views.lock_codes === true
  const relationIds: string[] = Array.isArray(views.media_source_ids)
    ? Array.from(new Set<string>(views.media_source_ids.map(cleanText).filter(Boolean)))
    : []
  const wifiSsid = propertyAccess ? cleanText(task?.property?.wifi_ssid) : ''
  const wifiPassword = propertyAccess ? cleanText(task?.property?.wifi_password) : ''
  const routerLocation = propertyAccess ? cleanText(task?.property?.router_location || task?.property?.wifi_router_location) : ''
  const guideUrl = propertyAccess ? normalizeHttpUrl(task?.property?.access_guide_link) : null
  const guestRequest = guestContext ? guestRequestForDisplay(task) : ''
  const orderNote = guestContext ? cleanText(task?.order_note) : ''
  const oldCode = lockCodes ? cleanText(task?.old_code || task?.turnover_display?.old_code) : ''
  const newCode = lockCodes ? cleanText(task?.new_code || task?.turnover_display?.new_code) : ''
  const recordDate = cleanText(task?.actual_date || task?.date || task?.completed_at).slice(0, 10)
  const originalDate = cleanText(task?.original_scheduled_date || task?.scheduled_date).slice(0, 10)

  return (
    <View testID="work-record-read-only-info" style={styles.card}>
      <Text style={styles.title}>任务资料（只读）</Text>
      <Text style={styles.hint}>只恢复本工作记录原有授权资料，不开放原任务编辑或重做。</Text>
      {recordDate ? <InfoRow icon="calendar-outline" text={`工作记录日期：${recordDate}`} /> : null}
      {originalDate && originalDate !== recordDate ? <InfoRow icon="time-outline" text={`原计划日期：${originalDate}`} /> : null}
      {propertyAccess ? (
        <>
          <InfoRow icon="wifi-outline" text={`Wi‑Fi：${wifiSsid || '-'}  密码：${wifiPassword || '-'}`} />
          {routerLocation ? <InfoRow icon="navigate-outline" text={`路由器位置：${routerLocation}`} /> : null}
          {guideUrl ? (
            <Pressable testID="work-record-access-guide" onPress={() => void Linking.openURL(guideUrl)} style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null]}>
              <Ionicons name="book-outline" size={moderateScale(15)} color="#2563EB" />
              <Text style={styles.linkText}>查看入住指南</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {lockCodes ? <InfoRow icon="lock-closed-outline" text={`旧密码：${oldCode || '-'}  新密码：${newCode || '-'}`} /> : null}
      {guestRequest ? <InfoRow icon="chatbubble-ellipses-outline" text={`客人需求：${guestRequest}`} /> : null}
      {orderNote ? <InfoRow icon="document-text-outline" text={`订单备注：${orderNote}`} /> : null}
      {guestContext && showGuestLuggage ? (
        <GuestLuggageCard
          notice={task?.guest_luggage || null}
          token={token}
          accessWorkTaskId={cleanText(task?.id) || null}
          accessSourceIds={relationIds}
          showAcknowledge={false}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 16, borderWidth: hairline(), borderColor: '#DCE6F5', backgroundColor: '#FFFFFF', gap: 9 },
  title: { color: '#111827', fontSize: 15, fontWeight: '900' },
  hint: { color: '#64748B', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowText: { flex: 1, minWidth: 0, color: '#334155', fontWeight: '700', lineHeight: 20 },
  linkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  linkText: { color: '#2563EB', fontWeight: '900' },
  pressed: { opacity: 0.82 },
})

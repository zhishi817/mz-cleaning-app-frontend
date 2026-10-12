import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  AppState,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import AppButton from '../../components/ui/AppButton'
import AppIconButton from '../../components/ui/AppIconButton'
import { API_BASE_URL } from '../../config/env'
import { useAuth } from '../../lib/auth'
import {
  confirmMyPersonnelSettlement,
  createMyPersonnelClaim,
  disputeMyPersonnelSettlement,
  downloadMyPersonnelSettlementDocument,
  getMyPersonnelClaim,
  getMyPersonnelClaimEstimate,
  getMyPersonnelClaimOptions,
  getMyPersonnelSettlement,
  getMyPersonnelSettlementSubmissionPreview,
  listMyPersonnelClaims,
  listMyPersonnelSettlements,
  submitMyPersonnelClaim,
  submitMyPersonnelSettlementWeek,
  submitMyPersonnelSettlementClaimForReconciliation,
  updateMyPersonnelClaim,
  uploadMyPersonnelClaimEvidence,
  type PersonnelClaimOption,
  type PersonnelClaimEstimate,
  type PersonnelClaimType,
  type PersonnelSettlementPendingPricingItem,
  type PersonnelSettlementSubmissionPreview,
  type PersonnelSettlementWorkItem,
  type PersonnelWeeklySettlement,
  type PersonnelWorkloadClaim,
} from '../../lib/api'
import {
  addPersonnelClaimDraftPhoto,
  assertPersonnelClaimDraftTarget,
  clearPersonnelClaimDraft,
  emptyPersonnelClaimDraft,
  loadPersonnelClaimDraft,
  loadPersonnelClaimDraftForTarget,
  personnelClaimDraftMatchesTarget,
  personnelClaimDraftMissingMedia,
  personnelClaimDraftScopeForTarget,
  personnelClaimPayloadFromDraft,
  removePersonnelClaimDraftPhoto,
  savePersonnelClaimDraft,
  type PersonnelClaimDraft,
  type PersonnelClaimDraftTarget,
} from '../../lib/personnelClaimDraft'
import { buildPersonnelClaimEvidenceImageSource } from '../../lib/personnelClaimEvidenceMedia'
import { hairline } from '../../lib/scale'
import { layoutTokens } from '../../lib/theme'

type TabKey = 'claims' | 'settlements'
type SettlementDocument = NonNullable<PersonnelWeeklySettlement['documents']>[number]
type SettlementLine = NonNullable<PersonnelWeeklySettlement['lines']>[number]
type SettlementWorkItem = PersonnelSettlementWorkItem
type DateParts = { year: number; month: number; day: number }
type DatePickerTarget = 'claim' | 'supplement'
type ClaimTimePickerTarget = 'started_at' | 'ended_at'
type SettlementIssueMode = 'supplement' | 'calculation'
type PersonnelSettlementNavigation = {
  setOptions?: (options: { headerRight?: (() => React.ReactNode) | undefined }) => void
}
type PersonnelSettlementScreenProps = {
  navigation?: PersonnelSettlementNavigation
}
type ClaimFormSession = {
  target: PersonnelClaimDraftTarget
  scope: string
  generation: number
  initialDraft: PersonnelClaimDraft
}

export type PersonnelCalendarDay = {
  key: string
  ymd: string
  day: number
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  isSunday: boolean
  disabled: boolean
}

const CLAIM_TYPE_LABELS: Record<PersonnelClaimType, string> = {
  warehouse_hour: '仓管工作',
  overtime_hour: '加班',
  subsidy_amount: '补贴',
  new_property_task: '上新房',
  trial_task: '试工（历史）',
  trial_day: '试工（历史）',
  trial_hour: '试工（历史）',
  external_task: '编外合作',
  external_day: '编外合作',
  external_hour: '编外合作',
  custom_amount: '其他费用',
}
const HISTORICAL_CUSTOM_AMOUNT_OPTION: PersonnelClaimOption = {
  business_type: 'custom',
  claim_type: 'custom_amount',
  label: '其他费用（历史）',
  calculation_label: '按填写金额提交，公司核对后决定是否计入',
  input_mode: 'amount',
  evidence_required: true,
  property_required: false,
  rule_configured: true,
}
const SETTLEMENT_COMPONENT_LABELS: Record<string, string> = {
  inspection_day: 'Inspection',
  warehouse_hour: 'Warehouse',
  trial_task: 'Trial shift',
  trial_day: 'Trial shift',
  trial_hour: 'Trial shift',
  external_task: 'External work',
  external_day: 'External work',
  external_hour: 'External work',
  weekly_fixed: 'Weekly fee',
  subsidy_amount: 'Subsidy',
  overtime_hour: 'Overtime',
  new_property_task: 'New property setup',
  custom_amount: 'Other',
  finance_adjustment: 'Adjustment',
}

export type PersonnelSettlementDailySummary = {
  service_date: string
  description: string
  base_description: string
  base_subtotal_cents: number
  base_gst_cents: number
  base_total_cents: number
  base_evidence_count: number
  extra_work: SettlementLine[]
  extra_subtotal_cents: number
  extra_gst_cents: number
  extra_total_cents: number
  subsidies: SettlementLine[]
  subsidy_subtotal_cents: number
  subsidy_gst_cents: number
  subsidy_total_cents: number
  subtotal_cents: number
  gst_cents: number
  total_cents: number
  evidence_count: number
  work_items: SettlementWorkItem[]
}

export function selectCurrentSettlementDocuments(
  settlement: Pick<PersonnelWeeklySettlement, 'status' | 'documents'> | null | undefined,
): SettlementDocument[] {
  if (!settlement) return []
  return [...(settlement.documents || [])]
    .filter((document) => document.document_stage === settlement.status)
    .sort((left, right) => {
      const generatedDifference = Date.parse(right.generated_at || '') - Date.parse(left.generated_at || '')
      if (Number.isFinite(generatedDifference) && generatedDifference !== 0) return generatedDifference
      return Number(right.version || 0) - Number(left.version || 0)
    })
    .slice(0, 1)
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function isCleaningSettlementLine(line: SettlementLine) {
  return cleanText(line.component_type) === 'cleaning_task'
    || /^cleaning(?:\s|[·:-]|$)/i.test(cleanText(line.description))
}

function personnelSettlementLineCategory(line: SettlementLine): 'base' | 'extra' | 'subsidy' {
  const componentType = cleanText(line.component_type)
  if (componentType === 'subsidy_amount') return 'subsidy'
  if (['cleaning_task', 'inspection_day', 'weekly_fixed'].includes(componentType) || isCleaningSettlementLine(line)) return 'base'
  return 'extra'
}

function cleaningPropertyLabel(line: SettlementLine) {
  const raw = cleanText(line.description)
  const parts = raw.split(/\s*·\s*/).filter(Boolean)
  if (/^cleaning(?:\s+task)?$/i.test(parts[0] || '') && parts[1]) return parts[1]
  return raw.match(/^cleaning(?:\s+task)?\s*[-:]\s*([^;·]+)/i)?.[1]?.trim() || ''
}

function settlementLineDescription(line: SettlementLine) {
  const raw = cleanText(line.description)
  const componentType = cleanText(line.component_type)
  const label = SETTLEMENT_COMPONENT_LABELS[componentType]
    || componentType.replace(/_/g, ' ').replace(/^./, (value) => value.toUpperCase())
    || 'Other'
  if (!raw || raw === componentType) return label
  const normalizedRaw = raw.toLocaleLowerCase('en-AU')
  const normalizedLabel = label.toLocaleLowerCase('en-AU')
  if (normalizedRaw === normalizedLabel || normalizedRaw.startsWith(`${normalizedLabel} -`)
    || normalizedRaw.startsWith(`${normalizedLabel} ·`) || normalizedRaw.startsWith(`${normalizedLabel}:`)
    || normalizedRaw.startsWith(`${normalizedLabel} `)) return raw
  return `${label} - ${raw}`
}

function appendCountedDescription(target: Map<string, number>, value: string) {
  const normalized = cleanText(value)
  if (!normalized) return
  target.set(normalized, (target.get(normalized) || 0) + 1)
}

function countedDescriptions(values: Map<string, number>) {
  return Array.from(values.entries()).map(([value, count]) => count > 1 ? `${value} ×${count}` : value)
}

export function summarizePersonnelSettlementLinesByDate(lines: readonly SettlementLine[]): PersonnelSettlementDailySummary[] {
  const days = new Map<string, {
    cleaningProperties: Map<string, number>
    unlabelledCleaningCount: number
    descriptions: Map<string, number>
    baseDescriptions: Map<string, number>
    base_subtotal_cents: number
    base_gst_cents: number
    base_total_cents: number
    base_evidence_count: number
    extra_work: SettlementLine[]
    extra_subtotal_cents: number
    extra_gst_cents: number
    extra_total_cents: number
    subsidies: SettlementLine[]
    subsidy_subtotal_cents: number
    subsidy_gst_cents: number
    subsidy_total_cents: number
    subtotal_cents: number
    gst_cents: number
    total_cents: number
    evidence_count: number
    workItems: Map<string, SettlementWorkItem>
  }>()
  const seen = new Set<string>()
  for (const line of lines) {
    const identity = cleanText(line.id)
      || [cleanText(line.source_type), cleanText(line.source_id), cleanText(line.component_type)].join(':')
    if (identity && seen.has(identity)) continue
    if (identity) seen.add(identity)
    const serviceDate = cleanText(line.service_date)
    const day = days.get(serviceDate) || {
      cleaningProperties: new Map<string, number>(),
      unlabelledCleaningCount: 0,
      descriptions: new Map<string, number>(),
      baseDescriptions: new Map<string, number>(),
      base_subtotal_cents: 0,
      base_gst_cents: 0,
      base_total_cents: 0,
      base_evidence_count: 0,
      extra_work: [],
      extra_subtotal_cents: 0,
      extra_gst_cents: 0,
      extra_total_cents: 0,
      subsidies: [],
      subsidy_subtotal_cents: 0,
      subsidy_gst_cents: 0,
      subsidy_total_cents: 0,
      subtotal_cents: 0,
      gst_cents: 0,
      total_cents: 0,
      evidence_count: 0,
      workItems: new Map<string, SettlementWorkItem>(),
    }
    const category = personnelSettlementLineCategory(line)
    if (isCleaningSettlementLine(line)) {
      const propertyLabel = cleaningPropertyLabel(line)
      if (propertyLabel) appendCountedDescription(day.cleaningProperties, propertyLabel)
      else day.unlabelledCleaningCount += 1
    } else {
      appendCountedDescription(day.descriptions, settlementLineDescription(line))
      if (category === 'base') appendCountedDescription(day.baseDescriptions, settlementLineDescription(line))
    }
    if (category === 'base') {
      day.base_subtotal_cents += Number(line.subtotal_cents || 0)
      day.base_gst_cents += Number(line.gst_cents || 0)
      day.base_total_cents += Number(line.total_cents || 0)
      day.base_evidence_count += Number(line.evidence_count || 0)
    } else if (category === 'extra') {
      day.extra_work.push(line)
      day.extra_subtotal_cents += Number(line.subtotal_cents || 0)
      day.extra_gst_cents += Number(line.gst_cents || 0)
      day.extra_total_cents += Number(line.total_cents || 0)
    } else {
      day.subsidies.push(line)
      day.subsidy_subtotal_cents += Number(line.subtotal_cents || 0)
      day.subsidy_gst_cents += Number(line.gst_cents || 0)
      day.subsidy_total_cents += Number(line.total_cents || 0)
    }
    day.subtotal_cents += Number(line.subtotal_cents || 0)
    day.gst_cents += Number(line.gst_cents || 0)
    day.total_cents += Number(line.total_cents || 0)
    day.evidence_count += Number(line.evidence_count || 0)
    for (const item of line.calculation_snapshot?.work_items || []) {
      const workItemKey = cleanText(item.execution_key || item.audit_id || item.task_id)
      if (workItemKey && !day.workItems.has(workItemKey)) day.workItems.set(workItemKey, item)
    }
    days.set(serviceDate, day)
  }
  return Array.from(days.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([serviceDate, day]) => {
      const descriptions: string[] = []
      const properties = countedDescriptions(day.cleaningProperties)
      if (properties.length) descriptions.push(`Cleaning - ${properties.join(' / ')}`)
      if (day.unlabelledCleaningCount) descriptions.push(day.unlabelledCleaningCount > 1 ? `Cleaning ×${day.unlabelledCleaningCount}` : 'Cleaning')
      descriptions.push(...countedDescriptions(day.descriptions))
      const baseDescriptions: string[] = []
      if (properties.length) baseDescriptions.push(`Cleaning - ${properties.join(' / ')}`)
      if (day.unlabelledCleaningCount) baseDescriptions.push(day.unlabelledCleaningCount > 1 ? `Cleaning ×${day.unlabelledCleaningCount}` : 'Cleaning')
      baseDescriptions.push(...countedDescriptions(day.baseDescriptions))
      return {
        service_date: serviceDate,
        description: descriptions.join('; '),
        base_description: baseDescriptions.join('; '),
        base_subtotal_cents: day.base_subtotal_cents,
        base_gst_cents: day.base_gst_cents,
        base_total_cents: day.base_total_cents,
        base_evidence_count: day.base_evidence_count,
        extra_work: day.extra_work,
        extra_subtotal_cents: day.extra_subtotal_cents,
        extra_gst_cents: day.extra_gst_cents,
        extra_total_cents: day.extra_total_cents,
        subsidies: day.subsidies,
        subsidy_subtotal_cents: day.subsidy_subtotal_cents,
        subsidy_gst_cents: day.subsidy_gst_cents,
        subsidy_total_cents: day.subsidy_total_cents,
        subtotal_cents: day.subtotal_cents,
        gst_cents: day.gst_cents,
        total_cents: day.total_cents,
        evidence_count: day.evidence_count,
        work_items: Array.from(day.workItems.values()),
      }
    })
}

export function personnelSettlementSubsidyTotalCents(lines: readonly SettlementLine[]) {
  return lines.reduce(
    (total, line) => total + (cleanText(line.component_type) === 'subsidy_amount' ? Number(line.total_cents || 0) : 0),
    0,
  )
}

function SettlementWorkItems({ day, testIdPrefix }: { day: PersonnelSettlementDailySummary; testIdPrefix: string }) {
  if (!day.work_items.length) return null
  const workItemsByProperty = new Map<string, PersonnelSettlementWorkItem>()
  for (const item of day.work_items) {
    const propertyKey = cleanText(item.property_id || item.property_label)
      || cleanText(item.execution_key || item.audit_id || item.task_id)
    const existing = workItemsByProperty.get(propertyKey)
    if (!existing) {
      workItemsByProperty.set(propertyKey, item)
      continue
    }
    workItemsByProperty.set(propertyKey, {
      ...existing,
      evidence_count: Number(existing.evidence_count || 0) + Number(item.evidence_count || 0),
    })
  }
  const workItems = Array.from(workItemsByProperty.values())
  return (
    <View style={styles.executionList}>
      <Text style={styles.executionListTitle}>已完成房源（{workItems.length}）</Text>
      {workItems.map((item, index) => {
        const itemKey = cleanText(item.execution_key || item.audit_id || item.task_id) || `${day.service_date}-${index}`
        const actualDate = cleanText(item.service_date) || day.service_date
        const scheduledDate = cleanText(item.scheduled_service_date)
        const inspectionDueDate = cleanText(item.inspection_due_date)
        const performer = cleanText(item.performed_by_name)
        return (
          <View key={itemKey} testID={`${testIdPrefix}-work-item-${index}`} style={styles.executionRow}>
            <View style={styles.cardHeader}>
              <Text style={styles.executionProperty}>{cleanText(item.property_label) || '已完成房源'}</Text>
              <Text style={styles.executionStatus}>已完成</Text>
            </View>
            <Text style={styles.muted}>实际工作日 {formatPersonnelDate(actualDate)}{performer ? ` · 执行人 ${performer}` : ''}</Text>
            {scheduledDate || inspectionDueDate ? (
              <Text style={styles.muted}>
                {scheduledDate ? `原安排日 ${formatPersonnelDate(scheduledDate)}` : ''}
                {scheduledDate && inspectionDueDate ? ' · ' : ''}
                {inspectionDueDate ? `延期检查日 ${formatPersonnelDate(inspectionDueDate)}` : ''}
              </Text>
            ) : null}
            <Text style={styles.muted}>完成证据 {Number(item.evidence_count || 0)} 项</Text>
          </View>
        )
      })}
    </View>
  )
}

const SETTLEMENT_WORK_STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  rescheduled: '改期/跨日',
  incomplete: '未完成',
  management_closed: '管理关闭',
  legacy_completed_unverified: '历史完成待核实',
  cancelled: '已取消',
}

export function settlementWorkReasonLabel(reason: unknown) {
  const value = cleanText(reason)
  if (value === 'completed_with_execution_audit') return '真实执行审计已确认'
  if (value === 'completed_on_different_service_date') return '实际完成日在原安排日之外'
  if (value === 'rescheduled_after_plan') return '原安排日后已改期，原任务不自动计费'
  if (value === 'reassigned_after_plan') return '原安排后已更换执行人，原执行人不自动计费'
  if (value === 'arrangement_changed_after_plan') return '安排已变更，需按真实执行结果结算'
  if (value === 'inspection_plan_changed_after_plan') return '检查计划或延期日期已变更，原安排不自动计费'
  if (value === 'executed_by_different_performer') return '任务由其他执行人完成，原执行人不计费'
  if (value === 'deferred_replaced_by_completed_checkin') return '延期检查已由实际完成的入住检查替代，不重复计费'
  if (value === 'management_closed_without_execution') return '仅关闭管理流程，不代表真实执行完成，不计费'
  if (value === 'legacy_completed_status_without_execution_audit') return '历史任务为完成态，但缺少执行审计'
  if (value === 'legacy_settlement_amount_preserved_without_execution_audit') return '保留历史结算金额，执行事实待核实'
  if (value === 'legacy_execution_audit_without_mz031_snapshot') return '历史执行审计存在，缺少新版冻结快照'
  if (value === 'execution_recorded_after_task_cancelled') return '任务取消后仍记录到执行，需要人工核实'
  if (value === 'legacy_execution_task_later_cancelled') return '历史执行后任务被取消，需要人工核实'
  if (value === 'cleaning_action_without_done_status') return '已记录清洁执行，但任务状态未完成，需要人工核实'
  if (value === 'inspection_action_without_submission_status') return '已记录检查执行，但提交状态不完整，需要人工核实'
  if (value === 'task_cancelled_without_payment') return '任务取消，不计入金额'
  if (value.startsWith('task_cancelled_after:')) return '任务在原安排后取消，不计入金额'
  if (value.startsWith('task_not_completed:')) return `任务状态 ${value.split(':')[1] || 'unknown'}，尚无完成审计`
  return value || '状态原因待核实'
}

function SettlementWorkChecklist({ items, testIdPrefix }: {
  items: readonly SettlementWorkItem[]
  testIdPrefix: string
}) {
  if (!items.length) return null
  return (
    <View style={styles.checklistCard}>
      <Text style={styles.executionListTitle}>本周房源工作清单（{items.length}）</Text>
      <Text style={styles.muted}>未完成、改期和历史待核实房源会保留显示；“已计入金额”表示本期真实执行，或为兼容历史已冻结结算而保留的原金额。</Text>
      {items.map((item, index) => {
        const itemKey = cleanText(item.execution_key || item.audit_id || item.task_id) || `${testIdPrefix}-${index}`
        const status = cleanText(item.status) || 'incomplete'
        const scheduledDate = cleanText(item.scheduled_service_date)
        const currentScheduledDate = cleanText(item.current_scheduled_service_date)
        const actualDate = cleanText(item.service_date)
        const inspectionDueDate = cleanText(item.inspection_due_date)
        const performer = cleanText(item.performed_by_name)
        return (
          <View key={itemKey} testID={`${testIdPrefix}-item-${index}`} style={styles.executionRow}>
            <View style={styles.cardHeader}>
              <Text style={styles.executionProperty}>{cleanText(item.property_label) || cleanText(item.task_id) || '房源任务'}</Text>
              <Text style={status === 'completed' ? styles.executionStatus : styles.executionStatusWarning}>
                {SETTLEMENT_WORK_STATUS_LABELS[status] || status}
              </Text>
            </View>
            {scheduledDate ? <Text style={styles.muted}>原安排日 {formatPersonnelDate(scheduledDate)}</Text> : null}
            {currentScheduledDate && currentScheduledDate !== scheduledDate ? (
              <Text style={styles.muted}>当前安排日 {formatPersonnelDate(currentScheduledDate)}</Text>
            ) : null}
            {actualDate ? <Text style={styles.muted}>实际工作日 {formatPersonnelDate(actualDate)}{performer ? ` · 执行人 ${performer}` : ''}</Text> : null}
            {inspectionDueDate ? <Text style={styles.muted}>延期检查日 {formatPersonnelDate(inspectionDueDate)}</Text> : null}
            <Text style={styles.muted}>{settlementWorkReasonLabel(item.status_reason)}</Text>
            <Text style={item.included_in_amount ? styles.includedAmount : styles.notIncludedAmount}>
              {item.included_in_amount ? '已计入金额' : '未计费'} · 完成证据 {Number(item.evidence_count || 0)} 项
            </Text>
          </View>
        )
      })}
    </View>
  )
}

function todayYmd() {
  const date = new Date()
  return ymdFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function previousCompletedPersonnelSettlementWeekStart() {
  const date = new Date()
  const weekday = date.getDay()
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1) - 7)
  return ymdFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function personnelSettlementWeekForDate(serviceDate: string) {
  const parts = parseYmdParts(serviceDate)
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const daysSinceMonday = (value.getUTCDay() + 6) % 7
  value.setUTCDate(value.getUTCDate() - daysSinceMonday)
  const weekStart = value.toISOString().slice(0, 10)
  value.setUTCDate(value.getUTCDate() + 6)
  return { week_start: weekStart, week_end: value.toISOString().slice(0, 10) }
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function normalizeDateParts(year: number, month: number, day: number): DateParts {
  const safeMonth = Math.min(12, Math.max(1, month))
  const safeDay = Math.min(daysInMonth(year, safeMonth), Math.max(1, day))
  return { year, month: safeMonth, day: safeDay }
}

function ymdFromParts(year: number, month: number, day: number) {
  const normalized = normalizeDateParts(year, month, day)
  return `${normalized.year}-${pad2(normalized.month)}-${pad2(normalized.day)}`
}

function parseYmdParts(raw: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw || '').trim())
  if (match) {
    const candidate = normalizeDateParts(Number(match[1]), Number(match[2]), Number(match[3]))
    if (ymdFromParts(candidate.year, candidate.month, candidate.day) === match[0]) return candidate
  }
  const fallback = new Date()
  return { year: fallback.getFullYear(), month: fallback.getMonth() + 1, day: fallback.getDate() }
}

function shiftCalendarMonth(year: number, month: number, offset: number) {
  const shifted = new Date(year, month - 1 + offset, 1)
  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1 }
}

function isCalendarDateDisabled(ymd: string, minDate?: string, maxDate?: string) {
  return Boolean((minDate && ymd < minDate) || (maxDate && ymd > maxDate))
}

export function buildPersonnelCalendarMonth(
  year: number,
  month: number,
  selectedYmd: string,
  currentYmd = todayYmd(),
  minDate?: string,
  maxDate?: string,
): PersonnelCalendarDay[] {
  const firstDay = new Date(year, month - 1, 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const calendarStart = new Date(year, month - 1, 1 - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart.getFullYear(), calendarStart.getMonth(), calendarStart.getDate() + index)
    const ymd = ymdFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate())
    return {
      key: ymd,
      ymd,
      day: date.getDate(),
      inMonth: date.getFullYear() === year && date.getMonth() + 1 === month,
      isToday: ymd === currentYmd,
      isSelected: ymd === selectedYmd,
      isSunday: date.getDay() === 0,
      disabled: isCalendarDateDisabled(ymd, minDate, maxDate),
    }
  })
}

export function formatPersonnelDate(raw: string | null | undefined) {
  const text = String(raw || '').trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return '--'
  const parts = parseYmdParts(text)
  if (ymdFromParts(parts.year, parts.month, parts.day) !== text) return '--'
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`
}

export function formatPersonnelDateWithWeekday(raw: string | null | undefined) {
  const text = String(raw || '').slice(0, 10)
  const formatted = formatPersonnelDate(text)
  if (formatted === '--') return '--'
  const parts = parseYmdParts(text)
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date(parts.year, parts.month - 1, parts.day).getDay()]
  return `${formatted}  周${weekday}`
}

export type PersonnelClaimDateGroup = {
  service_date: string
  claims: PersonnelWorkloadClaim[]
}

export function groupPersonnelClaimsByDate(claims: PersonnelWorkloadClaim[]): PersonnelClaimDateGroup[] {
  const grouped = new Map<string, PersonnelWorkloadClaim[]>()
  claims.forEach((claim) => {
    const serviceDate = String(claim.service_date || '').slice(0, 10)
    grouped.set(serviceDate, [...(grouped.get(serviceDate) || []), claim])
  })
  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([service_date, groupedClaims]) => ({ service_date, claims: groupedClaims }))
}

export function formatPersonnelTime(raw: string | null | undefined) {
  const parsed = new Date(String(raw || '').trim())
  if (!Number.isFinite(parsed.getTime())) return '--:--'
  return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`
}

export function buildPersonnelServiceTime(serviceDate: string, hour: number, minute: number) {
  const parts = parseYmdParts(serviceDate)
  const parsed = new Date(parts.year, parts.month - 1, parts.day, hour, minute, 0, 0)
  return parsed.toISOString()
}

export function rebasePersonnelServiceTime(raw: string | null | undefined, serviceDate: string) {
  const parsed = new Date(String(raw || '').trim())
  if (!Number.isFinite(parsed.getTime())) return ''
  return buildPersonnelServiceTime(serviceDate, parsed.getHours(), parsed.getMinutes())
}

export function personnelClaimTimeRangeMinutes(startedAt: string, endedAt: string) {
  const start = Date.parse(String(startedAt || ''))
  const end = Date.parse(String(endedAt || ''))
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return Math.round((end - start) / 60_000)
}

export function formatPersonnelDuration(totalMinutes: number | null | undefined) {
  const roundedMinutes = Math.round(Number(totalMinutes))
  if (!Number.isFinite(roundedMinutes) || roundedMinutes <= 0) return '--'
  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours} 小时 ${minutes} 分钟`
  if (hours > 0) return `${hours} 小时`
  return `${minutes} 分钟`
}

function money(cents: number | null | undefined) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(cents || 0) / 100)
}

export function personnelPricingIssueLabel(code: string) {
  return ({
    missing_effective_profile: '工作日期缺少有效结算资料',
    ambiguous_effective_profile: '工作日期存在重叠结算资料',
    gst_status_unconfirmed: 'GST 状态尚未确认',
    missing_effective_rule: '工作日期缺少有效费用规则',
    ambiguous_effective_rule: '工作日期存在重叠费用规则',
    missing_rule_item: '费用规则缺少该工作类型单价',
    ambiguous_rule_item: '该工作类型匹配到多个单价',
    missing_cleaning_property_type_rate: '清洁房型缺少对应单价',
    missing_or_unsupported_property_type: '房型资料缺失或暂不支持',
    approved_quantity_or_amount_missing: '工作量或金额资料不完整',
  } as Record<string, string>)[cleanText(code)] || '暂时无法计价，请公司核对资料'
}

export function SettlementDailySummaryCard(props: {
  dateLabel: string
  line: PersonnelSettlementDailySummary
  testID: string
}) {
  const { dateLabel, line, testID } = props
  const hasBase = Boolean(line.base_description)
  const hasExtra = line.extra_work.length > 0
  const hasSubsidy = line.subsidies.length > 0
  return (
    <View testID={testID} style={styles.card}>
      <Text style={styles.cardTitle}>{dateLabel}</Text>
      {hasBase ? (
        <View testID={`${testID}-base`} style={styles.dailyBreakdownSection}>
          <View style={styles.dailyBreakdownHeader}><Text style={styles.dailyBreakdownTitle}>基础工作</Text><Text style={styles.dailyTotal}>{money(line.base_total_cents)}</Text></View>
          <Text style={styles.body}>{line.base_description}</Text>
          <Text style={styles.muted}>税前 {money(line.base_subtotal_cents)} · GST {money(line.base_gst_cents)}{line.base_evidence_count ? ` · 证明 ${line.base_evidence_count} 张` : ''}</Text>
        </View>
      ) : null}
      {hasExtra ? (
        <View testID={`${testID}-extra`} style={styles.extraBreakdownSection}>
          <View style={styles.dailyBreakdownHeader}><Text style={styles.extraBreakdownTitle}>额外工作</Text><Text style={styles.extraBreakdownTotal}>{money(line.extra_total_cents)}</Text></View>
          {line.extra_work.map((item, index) => (
            <View key={item.id || `${line.service_date}-extra-${index}`} style={styles.breakdownLine}>
              <View style={styles.breakdownLineText}><Text style={styles.body}>{settlementLineDescription(item)}</Text><Text style={styles.muted}>税前 {money(item.subtotal_cents)} · GST {money(item.gst_cents)}{item.evidence_count ? ` · 证明 ${item.evidence_count} 张` : ''}</Text></View>
              <Text style={styles.extraBreakdownTotal}>{money(item.total_cents)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {hasSubsidy ? (
        <View testID={`${testID}-subsidy`} style={styles.subsidyBreakdownSection}>
          <View style={styles.dailyBreakdownHeader}><Text style={styles.subsidyBreakdownTitle}>补贴</Text><Text style={styles.subsidyBreakdownTotal}>{money(line.subsidy_total_cents)}</Text></View>
          {line.subsidies.map((item, index) => (
            <View key={item.id || `${line.service_date}-subsidy-${index}`} style={styles.breakdownLine}>
              <View style={styles.breakdownLineText}><Text style={styles.body}>{settlementLineDescription(item)}</Text><Text style={styles.muted}>税前 {money(item.subtotal_cents)} · GST {money(item.gst_cents)}{item.evidence_count ? ` · 证明 ${item.evidence_count} 张` : ''}</Text></View>
              <Text style={styles.subsidyBreakdownTotal}>{money(item.total_cents)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <SettlementWorkItems day={line} testIdPrefix={testID} />
      {[hasBase, hasExtra, hasSubsidy].filter(Boolean).length > 1 ? (
        <View testID={`${testID}-payable-total`} style={styles.dailyPayableRow}><Text style={styles.dailyPayableLabel}>当日已计小计</Text><Text style={styles.dailyPayableValue}>{money(line.total_cents)}</Text></View>
      ) : null}
    </View>
  )
}

function PendingPricingItemsCard(props: { items: PersonnelSettlementPendingPricingItem[] }) {
  if (!props.items.length) return null
  return (
    <View testID="weekly-submission-pending-pricing" style={styles.pendingPricingCard}>
      <Text style={styles.cardTitle}>待计价项目 {props.items.length} 项</Text>
      <Text style={styles.help}>这些工作已记录在本周明细，但尚未计入已计小计；公司补齐资料或单价后会请你重新确认完整总额。</Text>
      {props.items.map((item) => (
        <View key={item.id} style={styles.pendingPricingLine}>
          <View style={styles.breakdownLineText}>
            <Text style={styles.body}>{formatPersonnelDateWithWeekday(item.service_date)} · {CLAIM_TYPE_LABELS[item.component_type as PersonnelClaimType] || SETTLEMENT_COMPONENT_LABELS[item.component_type] || item.component_type}</Text>
            <Text style={styles.muted}>{item.description}</Text>
            <Text style={styles.warning}>{personnelPricingIssueLabel(item.code)}</Text>
          </View>
          <Text style={styles.pendingPricingAmount}>待计价</Text>
        </View>
      ))}
    </View>
  )
}

type PersonnelClaimEstimateParams = Parameters<typeof getMyPersonnelClaimEstimate>[1]

export function personnelClaimEstimateParams(claim: PersonnelWorkloadClaim): PersonnelClaimEstimateParams | null {
  const base = { service_date: claim.service_date, claim_type: claim.claim_type }
  const durationMinutes = claim.approved_duration_minutes ?? claim.duration_minutes
  const requestedQuantity = claim.approved_quantity ?? claim.requested_quantity
  const requestedAmountCents = claim.approved_amount_cents ?? claim.requested_amount_cents

  if (['warehouse_hour', 'overtime_hour', 'new_property_task', 'external_hour'].includes(claim.claim_type)) {
    return Number(durationMinutes) > 0 ? { ...base, duration_minutes: Number(durationMinutes) } : null
  }
  if (claim.claim_type === 'external_task') {
    return Number(requestedQuantity) > 0 ? { ...base, requested_quantity: String(requestedQuantity) } : null
  }
  if (['subsidy_amount', 'custom_amount'].includes(claim.claim_type)) {
    return Number(requestedAmountCents) > 0 ? { ...base, requested_amount_cents: Number(requestedAmountCents) } : null
  }
  if (claim.claim_type === 'external_day') return base
  return null
}

function personnelClaimEstimateRateText(claimType: PersonnelClaimType, estimate: PersonnelClaimEstimate) {
  const priceBasis = estimate.price_basis === 'inclusive_gst'
    ? '已含 GST'
    : estimate.price_basis === 'exclusive_gst'
      ? '未含 GST'
      : 'GST 口径待确认'
  if (['subsidy_amount', 'custom_amount'].includes(claimType)) return `按提交金额 · ${priceBasis}`
  const unit = ['warehouse_hour', 'overtime_hour', 'new_property_task', 'external_hour'].includes(claimType)
    ? '小时'
    : claimType === 'external_day'
      ? '天'
      : '次'
  return `${money(estimate.unit_rate_cents)} / ${unit} · ${priceBasis}`
}

function settlementDraftScope(settlementId: string) {
  return `settlement-${settlementId}`
}

function isDateWithinSettlement(date: string, settlement: PersonnelWeeklySettlement) {
  const normalized = String(date || '').slice(0, 10)
  return normalized >= settlement.week_start && normalized <= settlement.week_end
}

function claimAmountCents(claim: PersonnelWorkloadClaim) {
  return claim.approved_amount_cents == null
    ? Number(claim.requested_amount_cents || 0)
    : Number(claim.approved_amount_cents || 0)
}

function personnelClaimListMeta(claim: PersonnelWorkloadClaim) {
  const items: string[] = []
  const durationMinutes = claim.approved_duration_minutes ?? claim.duration_minutes
  const quantity = claim.approved_quantity ?? claim.requested_quantity
  const amountCents = claim.approved_amount_cents ?? claim.requested_amount_cents
  if (Number(durationMinutes) > 0) items.push(formatPersonnelDuration(durationMinutes))
  if (!(Number(durationMinutes) > 0) && !['subsidy_amount', 'custom_amount'].includes(claim.claim_type) && Number(quantity) > 0) {
    items.push(`${Number(quantity).toLocaleString('en-AU')} 次`)
  }
  if (amountCents != null) items.push(money(amountCents))
  items.push(`证明 ${claim.evidence_count || 0} 张`)
  return items.join(' · ')
}

export function pendingSettlementClaims(
  settlement: PersonnelWeeklySettlement,
  claims: PersonnelWorkloadClaim[],
) {
  const includedClaimIds = new Set(
    (settlement.lines || [])
      .filter((line) => line.source_type === 'workload_claim' && line.source_id)
      .map((line) => String(line.source_id)),
  )
  return claims.filter((claim) => (
    isDateWithinSettlement(claim.service_date, settlement)
    && ['submitted', 'approved'].includes(claim.status)
    && !includedClaimIds.has(claim.id)
  ))
}

export function unincludedSubmissionClaims(
  preview: PersonnelSettlementSubmissionPreview,
  claims: PersonnelWorkloadClaim[],
) {
  const includedClaimIds = new Set(
    [
      ...(preview.lines || [])
        .filter((line) => line.source_type === 'workload_claim' && line.source_id)
        .map((line) => String(line.source_id)),
      ...(preview.pending_pricing_items || [])
        .filter((item) => item.source_type === 'workload_claim' && item.source_id)
        .map((item) => String(item.source_id)),
    ],
  )
  return claims.filter((claim) => (
    claim.service_date >= preview.week_start
    && claim.service_date <= preview.week_end
    && ['draft', 'submitted', 'approved', 'returned'].includes(claim.status)
    && !includedClaimIds.has(claim.id)
  ))
}

export function estimatedSettlementClaimTotalCents(_settlement: PersonnelWeeklySettlement, amountCents: number) {
  const safeAmount = Number.isFinite(amountCents) ? Math.max(0, Math.round(amountCents)) : 0
  return safeAmount
}

export function personnelClaimStatusLabel(status: string) {
  return ({ draft: '草稿', submitted: '待公司核对', approved: '已确认计入', returned: '需要补充资料', rejected: '本次不纳入结算' } as Record<string, string>)[status] || status
}

export function personnelSettlementStatusLabel(status: string) {
  return ({
    draft: '历史草稿',
    awaiting_confirmation: '待你再次确认',
    confirmed: '已提交，待财务核对',
    disputed: '财务重新核对中',
    finance_approved: '财务已确认',
    paid: '已付款',
    void: '已作废',
  } as Record<string, string>)[status] || status
}

export function personnelClaimSaveErrorMessage(error: unknown) {
  const code = cleanText((error as any)?.code || (error as any)?.message || error)
  return ({
    claim_edit_revision_required: '这条反馈缺少最新版本信息，请刷新后再修改。',
    claim_edit_conflict: '这条反馈已在其他设备或页面更新，请刷新后核对最新内容再修改。',
    claim_period_locked: '这条反馈所属周已进入财务核准或付款阶段，不能再修改。',
    claim_not_editable: '这条反馈当前状态不能修改，请刷新后查看。',
    claim_draft_scope_mismatch: '当前表单与草稿不一致，已阻止修改旧反馈。请关闭后重新打开。',
  } as Record<string, string>)[code] || code || '提交失败'
}

export function claimToDraft(claim: PersonnelWorkloadClaim): PersonnelClaimDraft {
  return {
    request_id: claim.id,
    claim_id: claim.id,
    expected_updated_at: claim.updated_at || null,
    original_service_date: String(claim.service_date || '').slice(0, 10),
    evidence_addition_locked: claim.status === 'submitted',
    service_date: String(claim.service_date || '').slice(0, 10),
    claim_type: claim.claim_type,
    property_id: String(claim.property_id || ''),
    started_at: String(claim.started_at || ''),
    ended_at: String(claim.ended_at || ''),
    duration_minutes: claim.duration_minutes ? String(Number(claim.duration_minutes) / 60) : '',
    requested_quantity: String(claim.requested_quantity || ''),
    requested_amount: claim.requested_amount_cents == null ? '' : String(Number(claim.requested_amount_cents) / 100),
    note: String(claim.note || ''),
    media: (claim.evidence || []).map((evidence) => ({
      media_id: String(evidence.media_id || evidence.id),
      local_uri: '',
      name: String(evidence.original_file_name || '已上传证明照片'),
      mime_type: String(evidence.mime_type || 'image/jpeg'),
      state: 'associated' as const,
      evidence_id: String(evidence.id),
      error: null,
    })),
    updated_at: new Date().toISOString(),
  }
}

function draftForClaimOption(current: PersonnelClaimDraft, option: PersonnelClaimOption) {
  return {
    ...current,
    claim_type: option.claim_type,
    property_id: option.property_required ? current.property_id : '',
    started_at: option.input_mode === 'time_range' ? current.started_at : '',
    ended_at: option.input_mode === 'time_range' ? current.ended_at : '',
    duration_minutes: '',
    requested_quantity: option.input_mode === 'quantity' ? current.requested_quantity : '',
    requested_amount: option.input_mode === 'amount' ? current.requested_amount : '',
  }
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, style, ...inputProps } = props
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} style={[styles.input, style]} placeholderTextColor="#9CA3AF" />
    </View>
  )
}

function DateSelector(props: { testID: string; label: string; value: string; onPress: () => void }) {
  const displayValue = formatPersonnelDate(props.value)
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <Pressable
        testID={props.testID}
        accessibilityRole="button"
        accessibilityLabel={`${props.label}，当前 ${displayValue}`}
        onPress={props.onPress}
        style={({ pressed }) => [styles.dateSelector, pressed ? styles.dateSelectorPressed : null]}
      >
        <Text testID={`${props.testID}-value`} style={styles.dateSelectorText}>{displayValue}</Text>
        <Ionicons name="calendar-outline" size={20} color="#6B7280" />
      </Pressable>
    </View>
  )
}

function TimeSelector(props: { testID: string; label: string; value: string; onPress: () => void }) {
  const displayValue = formatPersonnelTime(props.value)
  return (
    <View style={[styles.field, styles.timeSelectorField]}>
      <Text style={styles.label}>{props.label}</Text>
      <Pressable
        testID={props.testID}
        accessibilityRole="button"
        accessibilityLabel={`${props.label}，当前 ${displayValue}`}
        onPress={props.onPress}
        style={({ pressed }) => [styles.dateSelector, pressed ? styles.dateSelectorPressed : null]}
      >
        <Text testID={`${props.testID}-value`} style={styles.dateSelectorText}>{displayValue}</Text>
        <Ionicons name="time-outline" size={20} color="#6B7280" />
      </Pressable>
    </View>
  )
}

const TIME_WHEEL_ITEM_HEIGHT = 44
const TIME_WHEEL_VISIBLE_ITEMS = 3
const TIME_WHEEL_SIDE_PADDING = Math.floor(TIME_WHEEL_VISIBLE_ITEMS / 2) * TIME_WHEEL_ITEM_HEIGHT
const TIME_WHEEL_HOURS = Array.from({ length: 24 }, (_, index) => index)
const TIME_WHEEL_MINUTES = Array.from({ length: 12 }, (_, index) => index * 5)
const SETTLEMENT_LIFECYCLE_REFRESH_DEDUPE_MS = 10_000

export function personnelTimeWheelIndexFromOffset(offsetY: number, itemCount: number) {
  if (!Number.isFinite(offsetY) || itemCount <= 0) return 0
  return Math.max(0, Math.min(itemCount - 1, Math.round(Math.max(0, offsetY) / TIME_WHEEL_ITEM_HEIGHT)))
}

export function normalizePersonnelTimeWheelMinute(value: number) {
  if (!Number.isFinite(value)) return 0
  return TIME_WHEEL_MINUTES.reduce((closest, candidate) => (
    Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest
  ), TIME_WHEEL_MINUTES[0])
}

function TimeWheel(props: {
  testID: string
  label: string
  values: number[]
  value: number
  onChange: (value: number) => void
}) {
  const listRef = useRef<FlatList<number>>(null)
  const selectedIndex = Math.max(0, props.values.indexOf(props.value))

  const settle = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = personnelTimeWheelIndexFromOffset(event.nativeEvent.contentOffset.y, props.values.length)
    const nextValue = props.values[nextIndex]
    if (nextValue !== undefined && nextValue !== props.value) props.onChange(nextValue)
  }, [props])

  const adjust = useCallback((direction: 'increment' | 'decrement') => {
    const delta = direction === 'increment' ? 1 : -1
    const nextIndex = Math.max(0, Math.min(props.values.length - 1, selectedIndex + delta))
    const nextValue = props.values[nextIndex]
    if (nextValue === undefined) return
    props.onChange(nextValue)
    listRef.current?.scrollToOffset({ offset: nextIndex * TIME_WHEEL_ITEM_HEIGHT, animated: true })
  }, [props, selectedIndex])

  return (
    <FlatList
      ref={listRef}
      testID={props.testID}
      accessibilityRole="adjustable"
      accessibilityLabel={`${props.label}，当前 ${pad2(props.value)}`}
      accessibilityValue={{ text: pad2(props.value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const action = event.nativeEvent.actionName
        if (action === 'increment' || action === 'decrement') adjust(action)
      }}
      data={props.values}
      keyExtractor={(item) => `${props.testID}-${item}`}
      renderItem={({ item, index }) => {
        const distance = Math.abs(index - selectedIndex)
        return (
          <View style={styles.timeWheelItem}>
            <Text
              style={[
                styles.timeWheelItemText,
                distance === 0 ? styles.timeWheelItemTextSelected : null,
                distance === 1 ? styles.timeWheelItemTextNear : null,
                distance >= 2 ? styles.timeWheelItemTextFar : null,
              ]}
            >
              {pad2(item)}
            </Text>
          </View>
        )
      }}
      initialScrollIndex={selectedIndex}
      getItemLayout={(_data, index) => ({ length: TIME_WHEEL_ITEM_HEIGHT, offset: TIME_WHEEL_ITEM_HEIGHT * index, index })}
      contentContainerStyle={styles.timeWheelContent}
      style={styles.timeWheelColumn}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      snapToInterval={TIME_WHEEL_ITEM_HEIGHT}
      snapToAlignment="start"
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScrollEndDrag={settle}
      onMomentumScrollEnd={settle}
    />
  )
}

function TimePickerSheet(props: {
  testID: string
  target: ClaimTimePickerTarget
  value: string
  serviceDate: string
  bottomInset: number
  onCancel: () => void
  onConfirm: (value: string) => void
}) {
  const parsed = new Date(String(props.value || ''))
  const fallbackHour = props.target === 'started_at' ? 9 : 17
  const [hour, setHour] = useState(Number.isFinite(parsed.getTime()) ? parsed.getHours() : fallbackHour)
  const [minute, setMinute] = useState(normalizePersonnelTimeWheelMinute(Number.isFinite(parsed.getTime()) ? parsed.getMinutes() : 0))
  const label = props.target === 'started_at' ? '开始时间' : '结束时间'
  return (
    <View testID={props.testID} style={styles.datePickerOverlay}>
      <Pressable
        testID={`${props.testID}-backdrop`}
        accessibilityRole="button"
        accessibilityLabel={`关闭${label}选择`}
        onPress={props.onCancel}
        style={styles.datePickerBackdrop}
      />
      <View testID={`${props.testID}-sheet`} style={[styles.timePickerSheet, { paddingBottom: Math.max(props.bottomInset, 14) }]}>
        <View style={styles.datePickerHandleWrap}><View style={styles.datePickerHandle} /></View>
        <View style={styles.timePickerHeader}>
          <Text style={styles.timePickerTitle}>选择{label}</Text>
          <Text testID={`${props.testID}-selected-value`} style={styles.timePickerValue}>
            {pad2(hour)}:{pad2(minute)}
          </Text>
        </View>
        <View style={styles.timeWheelLabels}>
          <Text style={styles.timeWheelLabel}>小时</Text>
          <View style={styles.timeWheelColonSpace} />
          <Text style={styles.timeWheelLabel}>分钟</Text>
        </View>
        <View style={styles.timeWheelFrame}>
          <View pointerEvents="none" style={styles.timeWheelSelectionBand} />
          <TimeWheel testID={`${props.testID}-hour-wheel`} label="小时" values={TIME_WHEEL_HOURS} value={hour} onChange={setHour} />
          <Text pointerEvents="none" style={styles.timeWheelColon}>:</Text>
          <TimeWheel testID={`${props.testID}-minute-wheel`} label="分钟" values={TIME_WHEEL_MINUTES} value={minute} onChange={setMinute} />
        </View>
        <View style={styles.datePickerActions}>
          <AppButton label="取消" tone="secondary" onPress={props.onCancel} style={styles.datePickerAction} />
          <AppButton
            testID={`${props.testID}-confirm`}
            label="确认时间"
            onPress={() => props.onConfirm(buildPersonnelServiceTime(props.serviceDate, hour, minute))}
            style={styles.datePickerAction}
          />
        </View>
      </View>
    </View>
  )
}

function DatePickerSheet(props: {
  testID: string
  value: string
  bottomInset: number
  minDate?: string
  maxDate?: string
  onCancel: () => void
  onConfirm: (value: string) => void
}) {
  const initialValue = /^\d{4}-\d{2}-\d{2}$/.test(props.value)
    ? props.value
    : props.maxDate || props.minDate || todayYmd()
  const initialParts = useMemo(() => parseYmdParts(initialValue), [initialValue])
  const [selectedYmd, setSelectedYmd] = useState(() => ymdFromParts(initialParts.year, initialParts.month, initialParts.day))
  const [visibleMonth, setVisibleMonth] = useState(() => ({ year: initialParts.year, month: initialParts.month }))
  const currentYmd = todayYmd()
  const calendarDays = useMemo(
    () => buildPersonnelCalendarMonth(
      visibleMonth.year,
      visibleMonth.month,
      selectedYmd,
      currentYmd,
      props.minDate,
      props.maxDate,
    ),
    [currentYmd, props.maxDate, props.minDate, selectedYmd, visibleMonth.month, visibleMonth.year],
  )
  const todayDisabled = isCalendarDateDisabled(currentYmd, props.minDate, props.maxDate)
  const selectedDisabled = isCalendarDateDisabled(selectedYmd, props.minDate, props.maxDate)

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => shiftCalendarMonth(current.year, current.month, offset))
  }

  const selectDate = (ymd: string) => {
    if (isCalendarDateDisabled(ymd, props.minDate, props.maxDate)) return
    setSelectedYmd(ymd)
    const selectedParts = parseYmdParts(ymd)
    if (selectedParts.year !== visibleMonth.year || selectedParts.month !== visibleMonth.month) {
      setVisibleMonth({ year: selectedParts.year, month: selectedParts.month })
    }
  }

  const selectToday = () => {
    if (todayDisabled) return
    const todayParts = parseYmdParts(currentYmd)
    setSelectedYmd(currentYmd)
    setVisibleMonth({ year: todayParts.year, month: todayParts.month })
  }

  return (
    <View testID={props.testID} style={styles.datePickerOverlay}>
      <Pressable
        testID={`${props.testID}-backdrop`}
        accessibilityRole="button"
        accessibilityLabel="关闭工作日期选择"
        onPress={props.onCancel}
        style={styles.datePickerBackdrop}
      />
      <View
        style={[styles.datePickerSheet, { paddingBottom: Math.max(props.bottomInset, 14) }]}
      >
        <View style={styles.datePickerHandleWrap}><View style={styles.datePickerHandle} /></View>
        <ScrollView
          style={styles.datePickerContentScroll}
          contentContainerStyle={styles.datePickerContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.datePickerHeader}>
            <Text style={styles.datePickerTitle}>选择工作日期</Text>
            <Text testID={`${props.testID}-selected-value`} style={styles.datePickerValue}>{formatPersonnelDate(selectedYmd)}</Text>
          </View>
          <View style={styles.datePickerNavigation}>
            <View style={styles.datePickerMonthControls}>
              <AppIconButton
                testID={`${props.testID}-previous-month`}
                accessibilityLabel="上一个月"
                onPress={() => moveMonth(-1)}
                visualStyle={styles.datePickerNavigationIcon}
              >
                <Ionicons name="chevron-back" size={20} color="#374151" />
              </AppIconButton>
              <Text testID={`${props.testID}-month-label`} style={styles.datePickerMonthLabel}>
                {visibleMonth.year}年{visibleMonth.month}月
              </Text>
              <AppIconButton
                testID={`${props.testID}-next-month`}
                accessibilityLabel="下一个月"
                onPress={() => moveMonth(1)}
                visualStyle={styles.datePickerNavigationIcon}
              >
                <Ionicons name="chevron-forward" size={20} color="#374151" />
              </AppIconButton>
            </View>
            <AppButton
              testID={`${props.testID}-today`}
              label="今天"
              tone="outline"
              size="compact"
              minHeight={44}
              disabled={todayDisabled}
              onPress={selectToday}
              style={styles.datePickerTodayButton}
            />
          </View>
          <View style={styles.datePickerWeekdays}>
            {['一', '二', '三', '四', '五', '六', '日'].map((label) => (
              <Text key={label} style={[styles.datePickerWeekday, label === '日' ? styles.datePickerSundayText : null]}>{label}</Text>
            ))}
          </View>
          <View style={styles.datePickerGrid}>
            {calendarDays.map((day) => (
              <Pressable
                key={day.key}
                testID={`${props.testID}-date-${day.ymd}`}
                accessibilityRole="button"
                accessibilityLabel={`${formatPersonnelDate(day.ymd)}${day.isToday ? '，今天' : ''}`}
                accessibilityState={{ selected: day.isSelected, disabled: day.disabled }}
                disabled={day.disabled}
                onPress={() => selectDate(day.ymd)}
                style={({ pressed }) => [
                  styles.datePickerDayCell,
                  !day.inMonth ? styles.datePickerDayOutside : null,
                  day.isToday && !day.isSelected ? styles.datePickerDayToday : null,
                  day.isSelected ? styles.datePickerDaySelected : null,
                  day.disabled ? styles.datePickerDayDisabled : null,
                  pressed && !day.disabled ? styles.datePickerDayPressed : null,
                ]}
              >
                <Text style={[
                  styles.datePickerDayText,
                  day.isSunday ? styles.datePickerSundayText : null,
                  !day.inMonth ? styles.datePickerDayOutsideText : null,
                  day.isSelected ? styles.datePickerDaySelectedText : null,
                  day.disabled ? styles.datePickerDayDisabledText : null,
                ]}>
                  {day.day}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <View style={styles.datePickerActions}>
          <AppButton label="取消" tone="secondary" onPress={props.onCancel} style={styles.datePickerAction} />
          <AppButton testID={`${props.testID}-confirm`} label="确认日期" disabled={selectedDisabled} onPress={() => props.onConfirm(selectedYmd)} style={styles.datePickerAction} />
        </View>
      </View>
    </View>
  )
}

export default function PersonnelSettlementScreen({ navigation }: PersonnelSettlementScreenProps = {}) {
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()
  const userId = String(user?.id || '').trim()
  const [activeTab, setActiveTab] = useState<TabKey>('claims')
  const [claimFormOpen, setClaimFormOpen] = useState(false)
  const [claimFormSession, setClaimFormSession] = useState<ClaimFormSession | null>(null)
  const [claimDraftHydrated, setClaimDraftHydrated] = useState(false)
  const [claimSubmissionReviewOpen, setClaimSubmissionReviewOpen] = useState(false)
  const [claimFormError, setClaimFormError] = useState('')
  const [draft, setDraft] = useState<PersonnelClaimDraft>(() => emptyPersonnelClaimDraft(''))
  const [claimOptions, setClaimOptions] = useState<PersonnelClaimOption[]>([])
  const [claimOptionsLoading, setClaimOptionsLoading] = useState(false)
  const [claimOptionsError, setClaimOptionsError] = useState('')
  const [claimEstimate, setClaimEstimate] = useState<PersonnelClaimEstimate | null>(null)
  const [claimEstimateLoading, setClaimEstimateLoading] = useState(false)
  const [claimEstimateError, setClaimEstimateError] = useState('')
  const [claims, setClaims] = useState<PersonnelWorkloadClaim[]>([])
  const [settlements, setSettlements] = useState<PersonnelWeeklySettlement[]>([])
  const [submissionPreview, setSubmissionPreview] = useState<PersonnelSettlementSubmissionPreview | null>(null)
  const [submissionPreviewError, setSubmissionPreviewError] = useState('')
  const [submissionReviewPreview, setSubmissionReviewPreview] = useState<PersonnelSettlementSubmissionPreview | null>(null)
  const [submissionReviewLoadingWeek, setSubmissionReviewLoadingWeek] = useState('')
  const [submissionReviewOpen, setSubmissionReviewOpen] = useState(false)
  const [submissionReviewStep, setSubmissionReviewStep] = useState<1 | 2>(1)
  const [submissionAcknowledged, setSubmissionAcknowledged] = useState(false)
  const [submissionReviewToken, setSubmissionReviewToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [claimDetail, setClaimDetail] = useState<PersonnelWorkloadClaim | null>(null)
  const [claimDetailEstimate, setClaimDetailEstimate] = useState<PersonnelClaimEstimate | null>(null)
  const [claimDetailEstimateLoading, setClaimDetailEstimateLoading] = useState(false)
  const [claimDetailEstimateError, setClaimDetailEstimateError] = useState('')
  const [settlementDetail, setSettlementDetail] = useState<PersonnelWeeklySettlement | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [settlementIssueMode, setSettlementIssueMode] = useState<SettlementIssueMode | null>(null)
  const [documentBusy, setDocumentBusy] = useState<string | null>(null)
  const [pdfPreview, setPdfPreview] = useState<{ document: SettlementDocument; uri: string } | null>(null)
  const pdfSheetProgress = useRef(new Animated.Value(0)).current
  const [supplementDraft, setSupplementDraft] = useState<PersonnelClaimDraft | null>(null)
  const [supplementSaving, setSupplementSaving] = useState(false)
  const [supplementPicking, setSupplementPicking] = useState(false)
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget | null>(null)
  const [claimTimePickerTarget, setClaimTimePickerTarget] = useState<ClaimTimePickerTarget | null>(null)
  const settlementDetailRequestRef = useRef(0)
  const claimOptionsRequestRef = useRef(0)
  const claimEstimateRequestRef = useRef(0)
  const claimDetailEstimateRequestRef = useRef(0)
  const claimSubmissionInFlightRef = useRef(false)
  const settlementListRefreshInFlightRef = useRef<Promise<void> | null>(null)
  const settlementListHasLoadedRef = useRef(false)
  const settlementListLastRefreshAtRef = useRef(0)
  const claimFormGenerationRef = useRef(0)
  const claimFormSessionRef = useRef<ClaimFormSession | null>(null)
  const claimDraftHydratedRef = useRef(false)
  const claimDraftRef = useRef(draft)

  useEffect(() => { claimDraftRef.current = draft }, [draft])
  useEffect(() => { claimFormSessionRef.current = claimFormSession }, [claimFormSession])
  useEffect(() => { claimDraftHydratedRef.current = claimDraftHydrated }, [claimDraftHydrated])

  const openClaimFormForTarget = useCallback(async (
    target: PersonnelClaimDraftTarget,
    initialDraft: PersonnelClaimDraft,
  ) => {
    if (!userId) return
    const generation = claimFormGenerationRef.current + 1
    claimFormGenerationRef.current = generation
    const session: ClaimFormSession = {
      target,
      scope: personnelClaimDraftScopeForTarget(target),
      generation,
      initialDraft,
    }
    claimFormSessionRef.current = session
    claimDraftHydratedRef.current = false
    claimDraftRef.current = initialDraft
    setClaimFormSession(session)
    setClaimDraftHydrated(false)
    setDraft(initialDraft)
    setClaimFormError('')
    setClaimSubmissionReviewOpen(false)
    setDatePickerTarget(null)
    setClaimTimePickerTarget(null)
    setClaimFormOpen(true)

    let stored: PersonnelClaimDraft | null = null
    let restoreError = ''
    try {
      stored = await loadPersonnelClaimDraftForTarget(userId, target)
    } catch (error: any) {
      restoreError = String(error?.message || '草稿暂时无法恢复')
    }
    if (claimFormGenerationRef.current !== generation || claimFormSessionRef.current?.generation !== generation) return
    const next = stored && personnelClaimDraftMatchesTarget(stored, target) ? stored : initialDraft
    claimDraftRef.current = next
    claimDraftHydratedRef.current = true
    setDraft(next)
    setClaimDraftHydrated(true)
    if (restoreError) setClaimFormError(`草稿恢复失败：${restoreError}`)
  }, [userId])

  const openCreateClaimForm = useCallback(() => {
    void openClaimFormForTarget({ mode: 'create' }, emptyPersonnelClaimDraft(''))
  }, [openClaimFormForTarget])

  const closeClaimForm = useCallback(async () => {
    if (saving) return
    const session = claimFormSessionRef.current
    const currentDraft = claimDraftRef.current
    if (userId && session && claimDraftHydratedRef.current && personnelClaimDraftMatchesTarget(currentDraft, session.target)) {
      try {
        await savePersonnelClaimDraft(userId, currentDraft, session.scope)
      } catch (error: any) {
        Alert.alert('草稿保存失败', String(error?.message || '请稍后重试'))
        return
      }
    }
    claimFormGenerationRef.current += 1
    claimFormSessionRef.current = null
    claimDraftHydratedRef.current = false
    setClaimFormSession(null)
    setClaimDraftHydrated(false)
    setClaimSubmissionReviewOpen(false)
    setDatePickerTarget(null)
    setClaimTimePickerTarget(null)
    setClaimFormOpen(false)
  }, [saving, userId])

  useLayoutEffect(() => {
    if (!navigation?.setOptions) return
    navigation.setOptions({
      headerRight: activeTab === 'claims'
        ? () => (
          <AppButton
            testID="personnel-claim-add"
            accessibilityLabel="新增工作量反馈"
            hitSlop={4}
            onPress={openCreateClaimForm}
            label="＋ 新增"
            minHeight={layoutTokens.button.height}
            size="compact"
            style={styles.headerAddButton}
          />
        )
        : undefined,
    })
    return () => navigation.setOptions?.({ headerRight: undefined })
  }, [activeTab, navigation, openCreateClaimForm])

  const refreshSubmissionPreview = useCallback(async () => {
    if (!token) return
    try {
      const preview = await getMyPersonnelSettlementSubmissionPreview(
        token,
        previousCompletedPersonnelSettlementWeekStart(),
      )
      setSubmissionPreview(preview)
      setSubmissionPreviewError('')
    } catch {
      setSubmissionPreview(null)
      setSubmissionPreviewError('上一完整周暂时无法预览，请稍后重试。')
    }
  }, [token])

  const loadAll = useCallback(async (silent = false) => {
    if (!token) return
    if (!silent) setLoading(true)
    try {
      const [claimRows, settlementRows] = await Promise.all([
        listMyPersonnelClaims(token),
        listMyPersonnelSettlements(token),
        refreshSubmissionPreview(),
      ])
      setClaims(Array.isArray(claimRows) ? claimRows : [])
      setSettlements(Array.isArray(settlementRows) ? settlementRows : [])
    } catch (error: any) {
      if (!silent) Alert.alert('加载失败', String(error?.message || '费用结算资料加载失败'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [refreshSubmissionPreview, token])

  const refreshSettlementLists = useCallback((force = false) => {
    if (!token) return Promise.resolve()
    if (settlementListRefreshInFlightRef.current) return settlementListRefreshInFlightRef.current

    const now = Date.now()
    const elapsed = now - settlementListLastRefreshAtRef.current
    if (
      !force
      && settlementListHasLoadedRef.current
      && elapsed >= 0
      && elapsed < SETTLEMENT_LIFECYCLE_REFRESH_DEDUPE_MS
    ) {
      return Promise.resolve()
    }

    let request: Promise<void>
    request = loadAll(settlementListHasLoadedRef.current).finally(() => {
      settlementListHasLoadedRef.current = true
      settlementListLastRefreshAtRef.current = Date.now()
      if (settlementListRefreshInFlightRef.current === request) {
        settlementListRefreshInFlightRef.current = null
      }
    })
    settlementListRefreshInFlightRef.current = request
    return request
  }, [loadAll, token])

  const loadClaimOptions = useCallback(async (serviceDate: string) => {
    if (!token || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      setClaimOptions([])
      setClaimOptionsError('')
      setClaimOptionsLoading(false)
      return
    }
    const requestId = claimOptionsRequestRef.current + 1
    claimOptionsRequestRef.current = requestId
    setClaimOptionsLoading(true)
    setClaimOptionsError('')
    try {
      const response = await getMyPersonnelClaimOptions(token, serviceDate)
      if (claimOptionsRequestRef.current !== requestId) return
      const nextOptions = Array.isArray(response?.options) ? response.options : []
      setClaimOptions(nextOptions)
      setDraft((current) => {
        if (current.service_date !== serviceDate || current.claim_id) return current
        if (current.claim_type === 'custom_amount') {
          const subsidyOption = nextOptions.find((option) => option.claim_type === 'subsidy_amount')
          return subsidyOption ? draftForClaimOption(current, subsidyOption) : current
        }
        if (nextOptions.some((option) => option.claim_type === current.claim_type)) return current
        const fallback = nextOptions.find((option) => option.claim_type === 'subsidy_amount')
          || nextOptions.find((option) => option.claim_type !== 'custom_amount')
        return fallback ? draftForClaimOption(current, fallback) : current
      })
    } catch (error: any) {
      if (claimOptionsRequestRef.current !== requestId) return
      setClaimOptions([])
      setClaimOptionsError(String(error?.message || '无法加载可反馈类型'))
    } finally {
      if (claimOptionsRequestRef.current === requestId) setClaimOptionsLoading(false)
    }
  }, [token])

  useFocusEffect(useCallback(() => {
    let focused = true
    const refreshForLifecycle = () => {
      if (focused) void refreshSettlementLists()
    }

    refreshForLifecycle()
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refreshForLifecycle()
    })

    return () => {
      focused = false
      subscription.remove()
    }
  }, [refreshSettlementLists]))

  useEffect(() => {
    if (!claimFormOpen || !claimDraftHydrated) return
    loadClaimOptions(draft.service_date)
  }, [claimDraftHydrated, claimFormOpen, draft.service_date, loadClaimOptions])

  useEffect(() => {
    const session = claimFormSession
    if (!userId || !claimFormOpen || !claimDraftHydrated || !session) return
    if (!personnelClaimDraftMatchesTarget(draft, session.target)) return
    const timer = setTimeout(() => {
      if (claimFormSessionRef.current?.generation !== session.generation) return
      savePersonnelClaimDraft(userId, draft, session.scope).catch(() => null)
    }, 250)
    return () => clearTimeout(timer)
  }, [claimDraftHydrated, claimFormOpen, claimFormSession, draft, userId])

  useEffect(() => {
    if (!submissionReviewOpen || !submissionReviewPreview || submissionReviewPreview.status !== 'not_submitted') return
    if (submissionReviewToken === submissionReviewPreview.confirmation_token) return
    setSubmissionReviewToken(submissionReviewPreview.confirmation_token)
    setSubmissionReviewStep(1)
    setSubmissionAcknowledged(false)
  }, [submissionReviewOpen, submissionReviewPreview, submissionReviewToken])

  useEffect(() => {
    if (!submissionReviewOpen || !submissionPreview || !submissionReviewPreview) return
    if (submissionPreview.week_start !== submissionReviewPreview.week_start) return
    if (submissionPreview.confirmation_token === submissionReviewPreview.confirmation_token) return
    setSubmissionReviewPreview(submissionPreview)
  }, [submissionPreview, submissionReviewOpen, submissionReviewPreview])

  useEffect(() => {
    if (!userId || !settlementDetail || !supplementDraft) return
    const scope = settlementDraftScope(settlementDetail.id)
    const timer = setTimeout(() => { savePersonnelClaimDraft(userId, supplementDraft, scope).catch(() => null) }, 250)
    return () => clearTimeout(timer)
  }, [settlementDetail, supplementDraft, userId])

  useEffect(() => {
    if (!pdfPreview) return
    pdfSheetProgress.setValue(0)
    const animation = Animated.spring(pdfSheetProgress, {
      toValue: 1,
      damping: 22,
      stiffness: 220,
      mass: 0.8,
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [pdfPreview, pdfSheetProgress])

  const setDraftField = useCallback(<K extends keyof PersonnelClaimDraft>(field: K, value: PersonnelClaimDraft[K]) => {
    setClaimFormError('')
    setDraft((current) => ({ ...current, [field]: value }))
  }, [])

  const resetDraft = useCallback(async () => {
    const session = claimFormSessionRef.current
    if (!userId || !session || !claimDraftHydratedRef.current) return
    await clearPersonnelClaimDraft(userId, draft, session.scope)
    const next = session.target.mode === 'edit' ? session.initialDraft : emptyPersonnelClaimDraft('')
    claimDraftRef.current = next
    setClaimFormError('')
    setClaimSubmissionReviewOpen(false)
    setDraft(next)
  }, [draft, userId])

  const addPhoto = useCallback(async (source: 'camera' | 'library') => {
    const session = claimFormSessionRef.current
    if (!userId || !session || !claimDraftHydratedRef.current || picking) return
    if (!personnelClaimDraftMatchesTarget(draft, session.target)) return
    if (draft.evidence_addition_locked) {
      return Alert.alert('原证明已保留', '待核对反馈不能追加证明；如需补充照片，请联系公司退回后再修改。')
    }
    if (draft.media.length >= 5) return Alert.alert('最多 5 张', '每次工作量反馈最多上传 5 张证明照片。')
    try {
      setPicking(true)
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) return Alert.alert('需要照片权限', `请允许${source === 'camera' ? '相机' : '相册'}权限后重试。`)
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images })
      if (result.canceled || !result.assets?.length) return
      const asset = result.assets[0]
      const next = await addPersonnelClaimDraftPhoto(userId, draft, {
        uri: String(asset.uri || ''),
        name: asset.fileName || `claim-proof-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      }, session.scope)
      claimDraftRef.current = next
      setDraft(next)
    } catch (error: any) {
      Alert.alert('照片保存失败', String(error?.message || '请重新拍摄或选择照片'))
    } finally {
      setPicking(false)
    }
  }, [draft, picking, userId])

  const removePhoto = useCallback(async (mediaId: string) => {
    const session = claimFormSessionRef.current
    if (!userId || !session || !claimDraftHydratedRef.current) return
    if (!personnelClaimDraftMatchesTarget(draft, session.target)) return
    try {
      const next = await removePersonnelClaimDraftPhoto(userId, draft, mediaId, session.scope)
      claimDraftRef.current = next
      setDraft(next)
    } catch (error: any) {
      Alert.alert('无法删除', String(error?.message || '照片无法删除'))
    }
  }, [draft, userId])

  const validateClaimDraft = useCallback((candidate: PersonnelClaimDraft, option?: PersonnelClaimOption) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.service_date)) throw new Error('请输入 YYYY-MM-DD 格式的工作日期')
    if (!candidate.note.trim()) {
      throw new Error(candidate.claim_type === 'subsidy_amount' ? '请填写补贴内容' : '请填写工作说明')
    }
    if (option?.property_required && !candidate.property_id.trim()) throw new Error('请填写房源编号')
    if (option?.input_mode === 'time_range') {
      if (!candidate.started_at || !candidate.ended_at) throw new Error('请选择开始时间和结束时间')
      if (!(personnelClaimTimeRangeMinutes(candidate.started_at, candidate.ended_at) > 0)) {
        throw new Error('结束时间必须晚于开始时间')
      }
    }
    if (option?.input_mode === 'quantity' && !(Number(candidate.requested_quantity) > 0)) {
      throw new Error('请输入大于 0 的工作量')
    }
    if ((option?.input_mode === 'amount' || (!option && ['subsidy_amount', 'custom_amount'].includes(candidate.claim_type)))
      && !(Number(candidate.requested_amount) > 0)) {
      throw new Error('请输入大于 0 的费用金额')
    }
    if ((option?.evidence_required ?? true) && !candidate.claim_id && !candidate.media.length) {
      throw new Error('请至少上传 1 张照片或截图证明')
    }
    const missing = personnelClaimDraftMissingMedia(candidate)
    if (missing.length) throw new Error('有证明照片已从本机丢失，请删除后重新选择')
  }, [])

  const persistAndSubmitClaim = useCallback(async (
    candidate: PersonnelClaimDraft,
    scope: string,
    onChange: (next: PersonnelClaimDraft) => void,
    finalize?: (claimId: string) => Promise<unknown>,
  ) => {
    if (!token || !userId) throw new Error('请重新登录后重试')
    let working = await savePersonnelClaimDraft(userId, candidate, scope)
    const payload = personnelClaimPayloadFromDraft(working)
    const savedClaim = working.claim_id
      ? await updateMyPersonnelClaim(token, working.claim_id, payload)
      : await createMyPersonnelClaim(token, payload)
    const claimId = String(savedClaim.id || working.request_id)
    working = await savePersonnelClaimDraft(userId, { ...working, claim_id: claimId }, scope)
    onChange(working)

    if (!['draft', 'returned'].includes(savedClaim.status)) {
      const finalized = finalize ? await finalize(claimId) : savedClaim
      await clearPersonnelClaimDraft(userId, working, scope)
      return finalized
    }

    for (const item of working.media) {
      if (item.state === 'associated') continue
      working = await savePersonnelClaimDraft(userId, {
        ...working,
        media: working.media.map((media) => media.media_id === item.media_id ? { ...media, state: 'uploading', error: null } : media),
      }, scope)
      onChange(working)
      try {
        const evidence = await uploadMyPersonnelClaimEvidence(token, claimId, item.media_id, {
          uri: item.local_uri,
          name: item.name,
          mimeType: item.mime_type,
        })
        working = await savePersonnelClaimDraft(userId, {
          ...working,
          media: working.media.map((media) => media.media_id === item.media_id
            ? { ...media, state: 'associated', evidence_id: evidence.id, error: null }
            : media),
        }, scope)
        onChange(working)
      } catch (error: any) {
        working = await savePersonnelClaimDraft(userId, {
          ...working,
          media: working.media.map((media) => media.media_id === item.media_id
            ? { ...media, state: 'local_only', error: String(error?.message || '上传失败') }
            : media),
        }, scope)
        onChange(working)
        throw error
      }
    }
    const submitted = finalize
      ? await finalize(claimId)
      : await submitMyPersonnelClaim(token, claimId)
    await clearPersonnelClaimDraft(userId, working, scope)
    return submitted
  }, [token, userId])

  const requestSubmitClaim = useCallback(() => {
    try {
      setClaimFormError('')
      const session = claimFormSessionRef.current
      if (!session || !claimDraftHydratedRef.current) throw new Error('草稿仍在恢复，请稍后重试')
      assertPersonnelClaimDraftTarget(draft, session.target)
      const option = claimOptions.find((item) => item.claim_type === draft.claim_type)
        || (draft.claim_id && draft.claim_type === 'custom_amount' ? HISTORICAL_CUSTOM_AMOUNT_OPTION : null)
      if (!option) throw new Error(draft.service_date ? '当前反馈类型暂不可用，请刷新后重新选择' : '请先选择工作日期')
      if (draft.evidence_addition_locked && draft.media.some((item) => item.state !== 'associated')) {
        throw new Error('待核对反馈不能追加证明；请删除尚未上传的照片后再核对')
      }
      validateClaimDraft(draft, option)
      Keyboard.dismiss()
      setClaimSubmissionReviewOpen(true)
    } catch (error: any) {
      const message = String(error?.message || '请检查工作量反馈')
      setClaimFormError(message)
      Alert.alert('请先核对', message)
    }
  }, [claimOptions, draft, validateClaimDraft])

  const submitClaim = useCallback(async () => {
    if (!token || !userId || saving || claimSubmissionInFlightRef.current) return
    claimSubmissionInFlightRef.current = true
    try {
      const session = claimFormSessionRef.current
      if (!session || !claimDraftHydratedRef.current) throw new Error('草稿仍在恢复，请稍后重试')
      assertPersonnelClaimDraftTarget(draft, session.target)
      const option = claimOptions.find((item) => item.claim_type === draft.claim_type)
        || (draft.claim_id && draft.claim_type === 'custom_amount' ? HISTORICAL_CUSTOM_AMOUNT_OPTION : null)
      if (!option) throw new Error('当前反馈类型暂不可用，请刷新后重新选择')
      validateClaimDraft(draft, option)
      setSaving(true)
      await persistAndSubmitClaim(draft, session.scope, (next) => {
        claimDraftRef.current = next
        setDraft(next)
      })
      const emptyDraft = emptyPersonnelClaimDraft('')
      claimDraftRef.current = emptyDraft
      claimFormGenerationRef.current += 1
      claimFormSessionRef.current = null
      claimDraftHydratedRef.current = false
      setDraft(emptyDraft)
      setClaimFormSession(null)
      setClaimDraftHydrated(false)
      setClaimFormError('')
      await loadAll(true)
      setClaimSubmissionReviewOpen(false)
      setClaimFormOpen(false)
      Alert.alert('提交成功', option.evidence_required ? '工作量和证明已提交公司核对。' : '工作量已提交公司核对。')
    } catch (error: any) {
      const message = `${personnelClaimSaveErrorMessage(error)}\n\n草稿和照片已保留，可稍后重试。`
      setClaimSubmissionReviewOpen(false)
      setClaimFormError(message)
      Alert.alert('暂未提交', message)
    } finally {
      claimSubmissionInFlightRef.current = false
      setSaving(false)
    }
  }, [claimOptions, draft, loadAll, persistAndSubmitClaim, saving, token, userId, validateClaimDraft])

  const openClaim = useCallback(async (claim: PersonnelWorkloadClaim) => {
    if (!token) return
    const requestId = claimDetailEstimateRequestRef.current + 1
    claimDetailEstimateRequestRef.current = requestId
    setDetailLoading(true)
    setClaimDetailEstimate(null)
    setClaimDetailEstimateError('')
    setClaimDetailEstimateLoading(false)
    try {
      const detail = await getMyPersonnelClaim(token, claim.id)
      if (claimDetailEstimateRequestRef.current !== requestId) return
      setClaimDetail(detail)
      const estimateParams = personnelClaimEstimateParams(detail)
      if (!estimateParams) return
      setClaimDetailEstimateLoading(true)
      try {
        const estimate = await getMyPersonnelClaimEstimate(token, estimateParams)
        if (claimDetailEstimateRequestRef.current === requestId) setClaimDetailEstimate(estimate)
      } catch {
        if (claimDetailEstimateRequestRef.current === requestId) {
          setClaimDetailEstimateError('预计金额暂时不可用，最终金额由公司核对。')
        }
      } finally {
        if (claimDetailEstimateRequestRef.current === requestId) setClaimDetailEstimateLoading(false)
      }
    } catch (error: any) {
      Alert.alert('加载失败', String(error?.message || '无法查看工作量反馈'))
    } finally {
      if (claimDetailEstimateRequestRef.current === requestId) setDetailLoading(false)
    }
  }, [token])

  const closeClaimDetail = useCallback(() => {
    claimDetailEstimateRequestRef.current += 1
    setClaimDetail(null)
    setClaimDetailEstimate(null)
    setClaimDetailEstimateError('')
    setClaimDetailEstimateLoading(false)
  }, [])

  const editClaim = useCallback(async (claim: PersonnelWorkloadClaim) => {
    if (!userId) return
    if (claim.claim_type.startsWith('trial_')) {
      Alert.alert('历史试工记录', '试工已从工作量反馈中移除；历史记录仍可查看，但不能在这里继续修改。')
      return
    }
    const next = claimToDraft(claim)
    closeClaimDetail()
    setActiveTab('claims')
    await openClaimFormForTarget({ mode: 'edit', claimId: claim.id }, next)
  }, [closeClaimDetail, openClaimFormForTarget, userId])

  const openSettlement = useCallback(async (settlement: PersonnelWeeklySettlement) => {
    if (!token || !userId) return
    const requestId = settlementDetailRequestRef.current + 1
    settlementDetailRequestRef.current = requestId
    setSettlementDetail(settlement)
    setSupplementDraft(null)
    setDisputeReason('')
    setSettlementIssueMode(null)
    setPdfPreview(null)
    setDatePickerTarget(null)
    setDetailLoading(true)
    try {
      const [detail, storedSupplement] = await Promise.all([
        getMyPersonnelSettlement(token, settlement.id),
        loadPersonnelClaimDraft(userId, settlementDraftScope(settlement.id)).catch(() => null),
      ])
      if (settlementDetailRequestRef.current !== requestId) return
      setSettlementDetail(detail)
      setSupplementDraft(storedSupplement
        ? { ...storedSupplement, claim_type: 'subsidy_amount' }
        : emptyPersonnelClaimDraft(''))
    } catch (error: any) {
      if (settlementDetailRequestRef.current !== requestId) return
      setSettlementDetail(null)
      setSupplementDraft(null)
      Alert.alert('加载失败', String(error?.message || '无法查看周结算'))
    } finally {
      if (settlementDetailRequestRef.current === requestId) setDetailLoading(false)
    }
  }, [token, userId])

  const closeSettlement = useCallback(() => {
    settlementDetailRequestRef.current += 1
    setDetailLoading(false)
    setDatePickerTarget(null)
    setPdfPreview(null)
    setSettlementDetail(null)
    setSupplementDraft(null)
    setSettlementIssueMode(null)
  }, [])

  const setSupplementDraftField = useCallback(<K extends keyof PersonnelClaimDraft>(field: K, value: PersonnelClaimDraft[K]) => {
    setSupplementDraft((current) => current ? { ...current, [field]: value } : current)
  }, [])

  const addSupplementPhoto = useCallback(async (source: 'camera' | 'library') => {
    if (!userId || !settlementDetail || !supplementDraft || supplementPicking) return
    if (supplementDraft.media.length >= 5) return Alert.alert('最多 5 张', '每次补充内容最多上传 5 张证明照片。')
    try {
      setSupplementPicking(true)
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) return Alert.alert('需要照片权限', `请允许${source === 'camera' ? '相机' : '相册'}权限后重试。`)
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images })
      if (result.canceled || !result.assets?.length) return
      const asset = result.assets[0]
      const next = await addPersonnelClaimDraftPhoto(userId, supplementDraft, {
        uri: String(asset.uri || ''),
        name: asset.fileName || `settlement-supplement-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      }, settlementDraftScope(settlementDetail.id))
      setSupplementDraft(next)
    } catch (error: any) {
      Alert.alert('照片保存失败', String(error?.message || '请重新拍摄或选择照片'))
    } finally {
      setSupplementPicking(false)
    }
  }, [settlementDetail, supplementDraft, supplementPicking, userId])

  const removeSupplementPhoto = useCallback(async (mediaId: string) => {
    if (!userId || !settlementDetail || !supplementDraft) return
    try {
      setSupplementDraft(await removePersonnelClaimDraftPhoto(
        userId,
        supplementDraft,
        mediaId,
        settlementDraftScope(settlementDetail.id),
      ))
    } catch (error: any) {
      Alert.alert('无法删除', String(error?.message || '照片无法删除'))
    }
  }, [settlementDetail, supplementDraft, userId])

  const submitSettlementSupplement = useCallback(async () => {
    if (!token || !userId || !settlementDetail || !supplementDraft || supplementSaving) return
    try {
      if (!['awaiting_confirmation', 'disputed'].includes(settlementDetail.status)) {
        throw new Error('当前结算已确认或已进入付款流程，请联系财务重新打开后再补充。')
      }
      if (supplementDraft.claim_type !== 'subsidy_amount') {
        throw new Error('本区域只补充需要财务核对的补贴')
      }
      if (!isDateWithinSettlement(supplementDraft.service_date, settlementDetail)) {
        throw new Error(`工作日期必须在 ${settlementDetail.week_start} 至 ${settlementDetail.week_end} 内`)
      }
      if (!(Number(supplementDraft.requested_amount) > 0)) throw new Error('请输入大于 0 的补充费用金额')
      validateClaimDraft(supplementDraft)
      setSupplementSaving(true)
      const refreshed = await persistAndSubmitClaim(
        supplementDraft,
        settlementDraftScope(settlementDetail.id),
        setSupplementDraft,
        (claimId) => submitMyPersonnelSettlementClaimForReconciliation(
          token,
          settlementDetail.id,
          claimId,
          `已补充本周工作或费用，请公司核对并重新计算：${supplementDraft.note.trim()}`,
        ),
      ) as PersonnelWeeklySettlement
      setSupplementDraft(emptyPersonnelClaimDraft(settlementDetail.week_end))
      setSettlementDetail(refreshed)
      setSettlementIssueMode(null)
      await loadAll(true)
      Alert.alert('补充内容已提交', '公司会核对相关内容和证明；正式金额会在核对完成后更新。')
    } catch (error: any) {
      Alert.alert('暂未提交', `${String(error?.message || '提交失败')}\n\n草稿和照片已保留，可稍后重试。`)
    } finally {
      setSupplementSaving(false)
    }
  }, [loadAll, persistAndSubmitClaim, settlementDetail, supplementDraft, supplementSaving, token, userId, validateClaimDraft])

  const openSubmissionReview = useCallback(() => {
    if (!submissionPreview || submissionPreview.status !== 'not_submitted') return
    setSubmissionReviewPreview(submissionPreview)
    setSubmissionReviewToken(submissionPreview.confirmation_token)
    setSubmissionReviewStep(1)
    setSubmissionAcknowledged(false)
    setSubmissionReviewOpen(true)
  }, [submissionPreview])

  const openVoidedSettlementSubmissionReview = useCallback(async (settlement: PersonnelWeeklySettlement) => {
    if (!token || settlement.status !== 'void' || submissionReviewLoadingWeek) return
    try {
      setSubmissionReviewLoadingWeek(settlement.week_start)
      const preview = await getMyPersonnelSettlementSubmissionPreview(token, settlement.week_start)
      if (
        preview.status !== 'not_submitted'
        || preview.settlement?.status !== 'void'
        || String(preview.settlement?.id || '') !== String(settlement.id)
      ) {
        throw new Error('该周当前无法重新提交，请刷新后重试')
      }
      setSubmissionReviewPreview(preview)
      setSubmissionReviewToken(preview.confirmation_token)
      setSubmissionReviewStep(1)
      setSubmissionAcknowledged(false)
      setSubmissionReviewOpen(true)
    } catch (error: any) {
      Alert.alert('暂时无法重新提交', String(error?.message || '请稍后重试'))
    } finally {
      setSubmissionReviewLoadingWeek('')
    }
  }, [submissionReviewLoadingWeek, token])

  const closeSubmissionReview = useCallback(() => {
    if (saving) return
    setSubmissionReviewOpen(false)
    setSubmissionReviewPreview(null)
    setSubmissionReviewToken('')
    setSubmissionReviewStep(1)
    setSubmissionAcknowledged(false)
  }, [saving])

  const submitWeeklyWorkload = useCallback(async () => {
    if (!token || !submissionReviewPreview || saving) return
    const unincludedClaims = unincludedSubmissionClaims(submissionReviewPreview, claims)
    if (
      !submissionAcknowledged
      || submissionReviewToken !== submissionReviewPreview.confirmation_token
      || unincludedClaims.length > 0
    ) return
    try {
      setSaving(true)
      await submitMyPersonnelSettlementWeek(
        token,
        submissionReviewPreview.week_start,
        submissionReviewPreview.confirmation_token,
      )
      setSubmissionReviewOpen(false)
      setSubmissionReviewPreview(null)
      setSubmissionReviewToken('')
      setSubmissionReviewStep(1)
      setSubmissionAcknowledged(false)
      await loadAll(true)
      Alert.alert(
        '提交成功',
        submissionReviewPreview.pending_pricing_count > 0
          ? '本周工作量与已计小计已提交；待计价项目由公司补齐后会请你重新确认完整总额。'
          : '本周工作量已提交，等待财务核对。',
      )
    } catch (error: any) {
      setSubmissionReviewStep(1)
      setSubmissionAcknowledged(false)
      try {
        const refreshed = await getMyPersonnelSettlementSubmissionPreview(token, submissionReviewPreview.week_start)
        setSubmissionReviewPreview(refreshed)
        if (submissionPreview?.week_start === refreshed.week_start) setSubmissionPreview(refreshed)
      } catch {}
      Alert.alert('暂未提交', String(error?.message || '请稍后重试'))
    } finally {
      setSaving(false)
    }
  }, [claims, loadAll, saving, submissionAcknowledged, submissionPreview?.week_start, submissionReviewPreview, submissionReviewToken, token])

  const respondSettlement = useCallback(async (action: 'confirm' | 'dispute') => {
    if (!token || !settlementDetail || saving) return
    if (action === 'dispute' && !disputeReason.trim()) return Alert.alert('请说明问题', '请输入需要财务核对的原因。')
    try {
      setSaving(true)
      const updated = action === 'confirm'
        ? await confirmMyPersonnelSettlement(token, settlementDetail.id)
        : await disputeMyPersonnelSettlement(token, settlementDetail.id, disputeReason.trim())
      setSettlementDetail(updated)
      setSettlementIssueMode(null)
      await loadAll(true)
      Alert.alert(action === 'confirm' ? '重新提交成功' : '已发送', action === 'confirm' ? '你已确认最新工作量及金额，等待财务核对。' : '公司会重新核对。')
    } catch (error: any) {
      Alert.alert('操作失败', String(error?.message || '请稍后重试'))
    } finally {
      setSaving(false)
    }
  }, [disputeReason, loadAll, saving, settlementDetail, token])

  const openSettlementDocument = useCallback(async (document: SettlementDocument) => {
    if (!token || !settlementDetail || documentBusy) return
    try {
      setDocumentBusy(document.id)
      const uri = await downloadMyPersonnelSettlementDocument(token, settlementDetail.id, document)
      setPdfPreview({ document, uri })
    } catch (error: any) {
      Alert.alert('文件打开失败', String(error?.message || '请稍后重试'))
    } finally {
      setDocumentBusy(null)
    }
  }, [documentBusy, settlementDetail, token])

  const shareSettlementDocument = useCallback(async () => {
    if (!pdfPreview) return
    try {
      await Share.share({
        title: pdfPreview.document.file_name,
        url: pdfPreview.uri,
        message: pdfPreview.document.document_label,
      })
    } catch (error: any) {
      Alert.alert('分享失败', String(error?.message || '请稍后重试'))
    }
  }, [pdfPreview])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refreshSettlementLists(true), loadClaimOptions(draft.service_date)])
    setRefreshing(false)
  }, [draft.service_date, loadClaimOptions, refreshSettlementLists])

  const selectedClaimOption = useMemo(
    () => claimOptions.find((item) => item.claim_type === draft.claim_type)
      || (claimFormSession?.target.mode === 'edit' && draft.claim_type === 'custom_amount' ? HISTORICAL_CUSTOM_AMOUNT_OPTION : null),
    [claimFormSession?.target.mode, claimOptions, draft.claim_type],
  )
  const claimFormIsEdit = claimFormSession?.target.mode === 'edit'
  const selectableClaimOptions = useMemo(
    () => claimOptions.filter((item) => item.claim_type !== 'custom_amount'),
    [claimOptions],
  )
  const selectedTypeLabel = selectedClaimOption?.label || CLAIM_TYPE_LABELS[draft.claim_type] || draft.claim_type
  const claimDraftWeek = useMemo(
    () => /^\d{4}-\d{2}-\d{2}$/.test(draft.service_date) ? personnelSettlementWeekForDate(draft.service_date) : null,
    [draft.service_date],
  )
  const claimDraftOriginalWeek = useMemo(
    () => /^\d{4}-\d{2}-\d{2}$/.test(draft.original_service_date || '')
      ? personnelSettlementWeekForDate(String(draft.original_service_date))
      : null,
    [draft.original_service_date],
  )
  const claimDraftCrossWeekEdit = Boolean(
    draft.claim_id
    && claimDraftWeek
    && claimDraftOriginalWeek
    && claimDraftWeek.week_start !== claimDraftOriginalWeek.week_start,
  )
  const claimDraftIsOutsideCurrentSubmissionWeek = Boolean(
    claimDraftWeek && claimDraftWeek.week_start !== previousCompletedPersonnelSettlementWeekStart(),
  )
  const claimEstimateParams = useMemo(() => {
    if (!selectedClaimOption?.rule_configured) return null
    const base = { service_date: draft.service_date, claim_type: selectedClaimOption.claim_type }
    if (selectedClaimOption.input_mode === 'time_range') {
      const durationMinutes = personnelClaimTimeRangeMinutes(draft.started_at, draft.ended_at)
      return durationMinutes > 0 ? { ...base, duration_minutes: durationMinutes } : null
    }
    if (selectedClaimOption.input_mode === 'quantity') {
      return Number(draft.requested_quantity) > 0 ? { ...base, requested_quantity: draft.requested_quantity } : null
    }
    if (selectedClaimOption.input_mode === 'amount') {
      const requestedAmountCents = Math.round(Number(draft.requested_amount) * 100)
      return requestedAmountCents > 0 ? { ...base, requested_amount_cents: requestedAmountCents } : null
    }
    return base
  }, [draft.ended_at, draft.requested_amount, draft.requested_quantity, draft.service_date, draft.started_at, selectedClaimOption])

  useEffect(() => {
    const requestId = claimEstimateRequestRef.current + 1
    claimEstimateRequestRef.current = requestId
    setClaimEstimate(null)
    setClaimEstimateError('')
    if (!token || !claimEstimateParams) {
      setClaimEstimateLoading(false)
      return
    }
    setClaimEstimateLoading(true)
    getMyPersonnelClaimEstimate(token, claimEstimateParams)
      .then((response) => {
        if (claimEstimateRequestRef.current === requestId) setClaimEstimate(response)
      })
      .catch((error: any) => {
        if (claimEstimateRequestRef.current === requestId) {
          setClaimEstimateError(String(error?.message || '暂时无法计算预计金额'))
        }
      })
      .finally(() => {
        if (claimEstimateRequestRef.current === requestId) setClaimEstimateLoading(false)
      })
  }, [claimEstimateParams, token])
  const pendingClaims = useMemo(
    () => settlementDetail ? pendingSettlementClaims(settlementDetail, claims) : [],
    [claims, settlementDetail],
  )
  const pendingClaimsTotal = useMemo(
    () => settlementDetail
      ? pendingClaims.reduce((sum, claim) => sum + estimatedSettlementClaimTotalCents(settlementDetail, claimAmountCents(claim)), 0)
      : 0,
    [pendingClaims, settlementDetail],
  )
  const currentSupplementTotal = useMemo(() => {
    if (!settlementDetail || !supplementDraft) return 0
    return estimatedSettlementClaimTotalCents(
      settlementDetail,
      Math.round(Math.max(0, Number(supplementDraft.requested_amount || 0)) * 100),
    )
  }, [settlementDetail, supplementDraft])
  const dailySettlementLines = useMemo(
    () => summarizePersonnelSettlementLinesByDate(settlementDetail?.lines || []),
    [settlementDetail],
  )
  const settlementDetailSubsidyTotal = useMemo(
    () => personnelSettlementSubsidyTotalCents(settlementDetail?.lines || []),
    [settlementDetail],
  )
  const submissionPreviewDailyLines = useMemo(
    () => summarizePersonnelSettlementLinesByDate(submissionReviewPreview?.lines || []),
    [submissionReviewPreview],
  )
  const submissionReviewSubsidyTotal = useMemo(
    () => personnelSettlementSubsidyTotalCents(submissionReviewPreview?.lines || []),
    [submissionReviewPreview],
  )
  const submissionPreviewUnincludedClaims = useMemo(
    () => submissionReviewPreview ? unincludedSubmissionClaims(submissionReviewPreview, claims) : [],
    [claims, submissionReviewPreview],
  )
  const submissionPreviewIncludedPendingClaims = useMemo(() => {
    const includedIds = new Set(
      [
        ...(submissionReviewPreview?.lines || [])
          .filter((line) => line.source_type === 'workload_claim' && line.source_id)
          .map((line) => String(line.source_id)),
        ...(submissionReviewPreview?.pending_pricing_items || [])
          .filter((item) => item.source_type === 'workload_claim' && item.source_id)
          .map((item) => String(item.source_id)),
      ],
    )
    return claims.filter((claim) => claim.status === 'submitted' && includedIds.has(claim.id))
  }, [claims, submissionReviewPreview])
  const submissionReviewMatchesPreview = Boolean(
    submissionReviewPreview
    && submissionReviewPreview.status === 'not_submitted'
    && submissionReviewToken === submissionReviewPreview.confirmation_token,
  )
  const submissionReviewReady = submissionReviewMatchesPreview
    && submissionPreviewUnincludedClaims.length === 0
  const currentSettlementDocuments = useMemo(
    () => selectCurrentSettlementDocuments(settlementDetail),
    [settlementDetail],
  )
  const groupedClaims = useMemo(() => groupPersonnelClaimsByDate(claims), [claims])
  const pendingClaimCount = useMemo(
    () => claims.filter((claim) => claim.status === 'submitted').length,
    [claims],
  )
  const visibleSettlements = useMemo(
    () => settlements.filter((settlement) => !(
      settlement.status === 'void'
      && submissionPreview?.status === 'not_submitted'
      && String(submissionPreview.settlement?.id || '') === String(settlement.id)
    )),
    [settlements, submissionPreview],
  )

  return (
    <View style={styles.page}>
      <View style={styles.tabs}>
        <AppButton testID="personnel-claims-tab" label="工作量反馈" size="compact" tone={activeTab === 'claims' ? 'primary' : 'secondary'} onPress={() => setActiveTab('claims')} style={styles.tabButton} />
        <AppButton testID="personnel-settlements-tab" label="周结算" size="compact" tone={activeTab === 'settlements' ? 'primary' : 'secondary'} onPress={() => setActiveTab('settlements')} style={styles.tabButton} />
      </View>
      {loading ? <View style={styles.loadingBar}><ActivityIndicator size="small" /><Text style={styles.muted}>正在更新费用结算…</Text></View> : null}

      <ScrollView
        contentContainerStyle={activeTab === 'claims' ? styles.claimsContent : styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'claims' ? (
          <>
            <Modal
              visible={claimFormOpen}
              animationType="slide"
              onRequestClose={() => {
                if (saving) return
                if (claimSubmissionReviewOpen) setClaimSubmissionReviewOpen(false)
                else if (datePickerTarget === 'claim') setDatePickerTarget(null)
                else if (claimTimePickerTarget) setClaimTimePickerTarget(null)
                else void closeClaimForm()
              }}
            >
              {claimFormOpen ? (
                <SafeAreaView style={styles.modalPage} edges={['left', 'right', 'bottom']}>
                  <View testID="claim-form-header" style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 12) }]}>
                    <Text style={styles.modalTitle}>{claimFormIsEdit ? '修改工作量反馈' : '新增工作量反馈'}</Text>
                    <AppIconButton
                      testID="claim-form-close"
                      accessibilityLabel="关闭工作量反馈表单"
                      disabled={saving}
                      onPress={() => {
                        if (saving) return
                        void closeClaimForm()
                      }}
                    >
                      <Ionicons name="close" size={24} color="#111827" />
                    </AppIconButton>
                  </View>
                  {!claimDraftHydrated ? (
                    <View testID="claim-draft-loading" style={styles.loadingBar}><ActivityIndicator size="small" /><Text style={styles.muted}>正在恢复当前草稿…</Text></View>
                  ) : null}
                  <ScrollView pointerEvents={claimDraftHydrated ? 'auto' : 'none'} contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.help}>先选择工作日期，再反馈需要公司核对的工作或补贴。按时、按次工作采用费用规则；补贴按填写金额提交，由财务决定是否计入。</Text>
              <DateSelector testID="claim-service-date" label="工作日期" value={draft.service_date} onPress={() => setDatePickerTarget('claim')} />
              {claimDraftWeek ? (
                <View testID="claim-service-week" style={styles.selectionBox}>
                  <Text style={styles.selection}>所属周：{formatPersonnelDate(claimDraftWeek.week_start)} 至 {formatPersonnelDate(claimDraftWeek.week_end)}</Text>
                </View>
              ) : (
                <View style={styles.notice}><Text style={styles.warning}>请先确认工作日期；系统不会自动使用今天。</Text></View>
              )}
              <Text style={styles.label}>工作或费用类型</Text>
              {!draft.service_date ? (
                <View style={styles.notice}><Text style={styles.help}>确认日期后再选择工作或费用类型。</Text></View>
              ) : claimOptionsLoading ? (
                <View style={styles.inlineLoading}><ActivityIndicator size="small" /><Text style={styles.muted}>正在准备可反馈类型…</Text></View>
              ) : claimOptionsError ? (
                <View style={styles.inlineError}>
                  <Text style={styles.errorText}>{claimOptionsError}</Text>
                  <AppButton label="重新加载" tone="outline" size="compact" onPress={() => loadClaimOptions(draft.service_date)} />
                </View>
              ) : selectableClaimOptions.length ? (
                <View style={styles.typeGrid}>
                {selectableClaimOptions.map((item) => (
                  <AppButton
                    key={item.business_type}
                    testID={`claim-type-${item.business_type}`}
                    label={item.label}
                    size="compact"
                    minHeight={44}
                    tone={draft.claim_type === item.claim_type ? 'primary' : 'outline'}
                    onPress={() => setDraft((current) => draftForClaimOption(current, item))}
                    style={styles.typeButton}
                  />
                ))}
                </View>
              ) : (
                <View style={styles.inlineError}><Text style={styles.muted}>暂时无法读取可反馈类型，请重新加载。</Text></View>
              )}
              {selectedClaimOption ? (
                <View style={styles.selectionBox}>
                  <Text style={styles.selection}>当前选择：{selectedTypeLabel}</Text>
                  <Text style={styles.muted}>{selectedClaimOption.calculation_label}</Text>
                </View>
              ) : claimFormIsEdit ? (
                <Text style={styles.warning}>当前历史类型已不在当天可反馈范围，不能继续提交；历史内容仍可查看。</Text>
              ) : null}
              {selectedClaimOption?.property_required ? (
                <Field testID="claim-property" label="房源编号" value={draft.property_id} placeholder="例如 3001" onChangeText={(value) => setDraftField('property_id', value)} />
              ) : null}
              {selectedClaimOption?.input_mode === 'time_range' ? (
                <>
                  <View style={styles.timeSelectorRow}>
                    <TimeSelector testID="claim-start-time" label="开始时间" value={draft.started_at} onPress={() => setClaimTimePickerTarget('started_at')} />
                    <TimeSelector testID="claim-end-time" label="结束时间" value={draft.ended_at} onPress={() => setClaimTimePickerTarget('ended_at')} />
                  </View>
                  {personnelClaimTimeRangeMinutes(draft.started_at, draft.ended_at) > 0 ? (
                    <Text testID="claim-duration-summary" style={styles.selection}>
                      工作时长：{formatPersonnelDuration(personnelClaimTimeRangeMinutes(draft.started_at, draft.ended_at))}
                    </Text>
                  ) : null}
                </>
              ) : null}
              {selectedClaimOption?.input_mode === 'quantity' ? (
                <Field testID="claim-quantity" label="工作量" value={draft.requested_quantity} placeholder="例如 1" keyboardType="decimal-pad" onChangeText={(value) => setDraftField('requested_quantity', value.replace(/[^\d.]/g, ''))} />
              ) : null}
              {selectedClaimOption?.input_mode === 'amount' ? (
                <Field testID="claim-amount" label={selectedClaimOption.claim_type === 'subsidy_amount' ? '补贴金额 AUD' : '费用金额 AUD'} value={draft.requested_amount} placeholder="例如 35.00" keyboardType="decimal-pad" onChangeText={(value) => setDraftField('requested_amount', value.replace(/[^\d.]/g, ''))} />
              ) : null}
              {selectedClaimOption?.input_mode === 'day' ? (
                <View style={styles.notice}><Text style={styles.help}>本次按所选工作日期计 1 天，实际金额由当天生效规则计算。</Text></View>
              ) : null}
              {selectedClaimOption?.rule_configured && claimEstimateParams ? (
                claimEstimateLoading ? (
                  <View testID="claim-estimate-loading" style={styles.estimateCard}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={styles.muted}>正在计算预计金额…</Text>
                  </View>
                ) : claimEstimate?.available ? (
                  <View testID="claim-estimate-card" style={styles.estimateCard}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.muted}>{selectedClaimOption.input_mode === 'amount' ? '提交口径' : '结算规则'}</Text>
                      <Text testID="claim-estimate-rate" style={styles.summaryValue}>
                        {selectedClaimOption.input_mode === 'time_range'
                          ? `${money(claimEstimate.unit_rate_cents)} / 小时`
                          : selectedClaimOption.input_mode === 'day'
                            ? `${money(claimEstimate.unit_rate_cents)} / 天`
                            : selectedClaimOption.input_mode === 'quantity'
                              ? `${money(claimEstimate.unit_rate_cents)} / 次`
                              : '按填写金额'}
                        {claimEstimate.price_basis === 'inclusive_gst' ? ' · 已含 GST' : ' · 未含 GST'}
                      </Text>
                    </View>
                    <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                      <Text style={styles.summaryTotalLabel}>预计结算金额</Text>
                      <Text testID="claim-estimate-total" style={styles.summaryTotalValue}>{money(claimEstimate.total_cents)}</Text>
                    </View>
                    {Number(claimEstimate.gst_cents || 0) > 0 ? (
                      <Text testID="claim-estimate-gst" style={styles.muted}>其中 GST {money(claimEstimate.gst_cents)}</Text>
                    ) : null}
                    <Text style={styles.muted}>最终以公司核对结果为准</Text>
                  </View>
                ) : (
                  <View style={styles.notice}><Text style={styles.help}>暂时无法按当前资料计算预计金额，仍可提交给公司核对。</Text></View>
                )
              ) : null}
              {claimEstimateError ? (
                <View style={styles.notice}><Text style={styles.help}>预计金额暂时不可用，不影响提交工作反馈。</Text></View>
              ) : null}
              {selectedClaimOption ? (
                <>
              <Field
                testID="claim-note"
                label={selectedClaimOption.claim_type === 'subsidy_amount' ? '补贴内容' : '工作说明'}
                value={draft.note}
                placeholder={selectedClaimOption.claim_type === 'subsidy_amount' ? '请填写具体补贴内容' : '说明工作内容和时间'}
                multiline
                onChangeText={(value) => setDraftField('note', value)}
                style={styles.multiline}
              />

              <Text testID="claim-photo-label" style={styles.label}>
                照片或截图证明{selectedClaimOption?.evidence_required === false ? '（选填）' : '（必填）'}（{draft.media.length}/5）
              </Text>
              <View style={styles.photoGrid}>
                {draft.media.map((item) => {
                  const source = item.state === 'associated'
                    ? buildPersonnelClaimEvidenceImageSource(API_BASE_URL, token, draft.claim_id, item.evidence_id)
                    : item.local_uri ? { uri: item.local_uri } : null
                  return (
                  <View key={item.media_id} testID={`claim-draft-photo-${item.media_id}`} style={styles.photoWrap}>
                    {source ? (
                      <Image testID={item.state === 'associated' ? 'claim-draft-existing-evidence' : 'claim-draft-local-evidence'} source={source} style={styles.photo} />
                    ) : (
                      <View style={[styles.photo, styles.photoUnavailable]}><Ionicons name="image-outline" size={24} color="#6B7280" /></View>
                    )}
                    {item.state !== 'associated' ? (
                      <AppIconButton accessibilityLabel="删除证明照片" onPress={() => removePhoto(item.media_id)} style={styles.removePhoto} visualStyle={styles.removePhotoVisual}>
                        <Ionicons name="close" size={18} color="#FFFFFF" />
                      </AppIconButton>
                    ) : null}
                    <Text style={[styles.photoState, item.error ? styles.errorText : null]} numberOfLines={2}>
                      {item.error || (item.state === 'associated' ? '已上传，修改时保留' : item.state === 'uploading' ? '上传中' : '待上传')}
                    </Text>
                  </View>
                  )
                })}
              </View>
              {draft.evidence_addition_locked ? (
                <View testID="claim-evidence-locked" style={styles.notice}>
                  <Text style={styles.help}>原证明会继续保留。待核对反馈不能追加证明；如需补充照片，请联系公司退回后再修改。</Text>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <AppButton label="拍照" tone="outline" size="compact" loading={picking} onPress={() => addPhoto('camera')} style={styles.flexButton} />
                  <AppButton label="从相册选择" tone="outline" size="compact" loading={picking} onPress={() => addPhoto('library')} style={styles.flexButton} />
                </View>
              )}
              <View style={styles.actionRow}>
                <AppButton testID="claim-submit" label={claimFormIsEdit ? '核对修改内容' : '核对并提交'} loading={saving} disabled={!claimDraftHydrated || claimOptionsLoading || !selectedClaimOption} onPress={requestSubmitClaim} style={styles.flexButton} />
                <AppButton label="清空草稿" tone="secondary" disabled={saving} onPress={resetDraft} style={styles.flexButton} />
              </View>
              {claimFormError ? <View testID="claim-form-error" style={styles.inlineError}><Text style={styles.errorText}>{claimFormError}</Text></View> : null}
              <Text style={styles.help}>网络中断时不会丢失：原有证明会继续保留；草稿和新增的本地照片也会保留，重新打开本页即可继续。</Text>
                </>
              ) : null}
            </View>
                  </ScrollView>

                  {datePickerTarget === 'claim' ? (
                    <DatePickerSheet
                      testID="claim-date-picker"
                      value={draft.service_date}
                      bottomInset={insets.bottom}
                      maxDate={todayYmd()}
                      onCancel={() => setDatePickerTarget(null)}
                      onConfirm={(value) => {
                        setDraft((current) => ({
                          ...current,
                          service_date: value,
                          started_at: rebasePersonnelServiceTime(current.started_at, value),
                          ended_at: rebasePersonnelServiceTime(current.ended_at, value),
                        }))
                        setDatePickerTarget(null)
                      }}
                    />
                  ) : null}

                  {claimTimePickerTarget ? (
                    <TimePickerSheet
                      key={`${claimTimePickerTarget}-${draft.service_date}`}
                      testID="claim-time-picker"
                      target={claimTimePickerTarget}
                      value={draft[claimTimePickerTarget]}
                      serviceDate={draft.service_date}
                      bottomInset={insets.bottom}
                      onCancel={() => setClaimTimePickerTarget(null)}
                      onConfirm={(value) => {
                        setDraftField(claimTimePickerTarget, value)
                        setClaimTimePickerTarget(null)
                      }}
                    />
                  ) : null}

                  {claimSubmissionReviewOpen ? (
                    <View accessibilityViewIsModal style={styles.confirmOverlay}>
                      <View testID="claim-submit-review" style={styles.confirmCard}>
                        <Text style={styles.modalTitle}>{claimFormIsEdit ? '确认修改工作量反馈' : '确认提交工作量反馈'}</Text>
                        <View style={styles.summaryBox}>
                          <View style={styles.summaryRow}><Text style={styles.body}>工作日期</Text><Text testID="claim-submit-review-date" style={styles.summaryValue}>{formatPersonnelDate(draft.service_date)}</Text></View>
                          <View style={styles.summaryRow}><Text style={styles.body}>所属周</Text><Text testID="claim-submit-review-week" style={styles.summaryValue}>{claimDraftWeek ? `${formatPersonnelDate(claimDraftWeek.week_start)}–${formatPersonnelDate(claimDraftWeek.week_end)}` : '--'}</Text></View>
                          <View style={styles.summaryRow}><Text style={styles.body}>类型</Text><Text style={styles.summaryValue}>{selectedTypeLabel}</Text></View>
                          {selectedClaimOption?.input_mode === 'time_range' ? <View style={styles.summaryRow}><Text style={styles.body}>时长</Text><Text style={styles.summaryValue}>{formatPersonnelDuration(personnelClaimTimeRangeMinutes(draft.started_at, draft.ended_at))}</Text></View> : null}
                          {selectedClaimOption?.input_mode === 'quantity' ? <View style={styles.summaryRow}><Text style={styles.body}>工作量</Text><Text style={styles.summaryValue}>{draft.requested_quantity}</Text></View> : null}
                          {selectedClaimOption?.input_mode === 'amount' ? <View style={styles.summaryRow}><Text style={styles.body}>金额</Text><Text style={styles.summaryValue}>{money(Math.round(Number(draft.requested_amount || 0) * 100))}</Text></View> : null}
                        </View>
                        <Text style={styles.body}>{draft.note}</Text>
                        {claimDraftCrossWeekEdit || claimDraftIsOutsideCurrentSubmissionWeek ? (
                          <View testID={claimDraftCrossWeekEdit ? 'claim-submit-cross-week-warning' : 'claim-submit-outside-week-warning'} style={styles.notice}>
                            <Text style={styles.warning}>{claimDraftCrossWeekEdit && claimDraftOriginalWeek && claimDraftWeek
                              ? `工作日期已跨周：原周 ${formatPersonnelDate(claimDraftOriginalWeek.week_start)}–${formatPersonnelDate(claimDraftOriginalWeek.week_end)}，修改后进入 ${formatPersonnelDate(claimDraftWeek.week_start)}–${formatPersonnelDate(claimDraftWeek.week_end)}。原周将不再包含该反馈。`
                              : '该日期不属于当前“上一完整周”，会按上述所属周进入结算。'}</Text>
                          </View>
                        ) : null}
                        <View style={styles.actionRow}>
                          <AppButton testID="claim-submit-review-cancel" label="返回修改" tone="secondary" disabled={saving} onPress={() => setClaimSubmissionReviewOpen(false)} style={styles.flexButton} />
                          <AppButton testID="claim-submit-review-confirm" label={claimFormIsEdit ? '确认修改' : '确认提交'} loading={saving} onPress={submitClaim} style={styles.flexButton} />
                        </View>
                      </View>
                    </View>
                  ) : null}
                </SafeAreaView>
              ) : null}
            </Modal>

            <View style={styles.claimListSummary}>
              <Text style={styles.claimListSummaryText}>共 {claims.length} 条反馈</Text>
              {pendingClaimCount ? <Text style={styles.claimListSummaryPending}>· {pendingClaimCount} 条待核对</Text> : null}
            </View>
            {groupedClaims.length ? groupedClaims.map((group) => (
              <View key={group.service_date} testID={`claim-date-group-${group.service_date}`} style={styles.claimDateGroup}>
                <View style={styles.claimDateHeader}>
                  <Text style={styles.claimDateTitle}>{formatPersonnelDateWithWeekday(group.service_date)}</Text>
                  <Text style={styles.claimDateCount}>{group.claims.length} 条</Text>
                </View>
                <View style={styles.claimListSurface}>
                  {group.claims.map((claim, index) => (
                    <Pressable
                      key={claim.id}
                      testID={`claim-row-${claim.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`查看${CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type}反馈详情`}
                      onPress={() => openClaim(claim)}
                      style={({ pressed }) => [
                        styles.claimRow,
                        index < group.claims.length - 1 ? styles.claimRowDivider : null,
                        pressed ? styles.claimRowPressed : null,
                      ]}
                    >
                      <View style={styles.claimRowContent}>
                        <View style={styles.claimRowHeader}>
                          <Text style={styles.claimRowTitle}>{CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type}</Text>
                          <Text style={[styles.claimRowStatus, claim.status === 'submitted' ? styles.claimRowStatusPending : null]}>
                            {personnelClaimStatusLabel(claim.status)}
                          </Text>
                        </View>
                        <Text style={styles.claimRowDescription}>{claim.note}</Text>
                        <Text style={styles.claimRowMeta}>{personnelClaimListMeta(claim)}</Text>
                        {claim.review_note ? <Text style={styles.claimRowReviewNote}>核对说明：{claim.review_note}</Text> : null}
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </Pressable>
                  ))}
                </View>
              </View>
            )) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>暂无工作量反馈</Text>
                <Text style={styles.muted}>点击右上角“新增”开始填写</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>提交每周工作量</Text>
              <Text style={styles.help}>请核对上一完整周的基础工作量、已提交补贴和最终总额，再一次性提交给财务。只有财务调整内容或金额时才需要你再次确认。</Text>
            </View>
            {submissionPreviewError ? (
              <View testID="weekly-submission-preview-error" style={styles.inlineError}>
                <Text style={styles.errorText}>{submissionPreviewError}</Text>
                <AppButton
                  testID="weekly-submission-preview-retry"
                  label="重新加载周预览"
                  tone="outline"
                  size="compact"
                  onPress={refreshSubmissionPreview}
                />
              </View>
            ) : null}
            {submissionPreview?.status === 'not_submitted' ? (
              <View testID="weekly-submission-preview" style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{submissionPreview.week_start} 至 {submissionPreview.week_end}</Text>
                  <Text style={styles.status}>{submissionPreview.settlement?.status === 'void' ? '待重新提交' : '待提交'}</Text>
                </View>
                <Text style={styles.total}>{money(submissionPreview.total_cents)}</Text>
                <Text style={styles.muted}>{submissionPreview.pending_pricing_count > 0 ? '已计小计' : '总额'} · 税前 {money(submissionPreview.subtotal_cents)} · GST {money(submissionPreview.gst_cents)} · 已计价 {submissionPreview.line_count} 项</Text>
                {submissionPreview.pending_pricing_count > 0 ? <Text testID="weekly-submission-pending-count" style={styles.claimRowReviewNote}>另有 {submissionPreview.pending_pricing_count} 项待计价；不会按 $0 计入。</Text> : null}
                {submissionPreview.amount_state === 'historical_frozen_pending_verification' ? (
                  <Text style={styles.claimRowReviewNote}>当前显示历史已冻结金额；执行凭证待核实，系统未将金额重算为 0。</Text>
                ) : null}
                {submissionPreview.settlement?.status === 'void' ? (
                  <Text style={styles.claimRowReviewNote}>原结算已作废。请重新核对本周完整工作量和总额后提交。</Text>
                ) : null}
                {submissionPreview.blocking_issues.length ? (
                  <Text style={styles.claimRowReviewNote}>本周总额暂未计算完整；可先提交已计小计和待计价项目，公司补齐后会请你重新确认。</Text>
                ) : null}
                <AppButton
                  testID="weekly-submission-review"
                  label={submissionPreview.settlement?.status === 'void' ? '重新核对并提交' : '查看明细并核对'}
                  onPress={openSubmissionReview}
                  fullWidth
                  style={styles.singleButton}
                />
              </View>
            ) : null}
            {visibleSettlements.length ? visibleSettlements.map((settlement) => (
              <View key={settlement.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{settlement.week_start} 至 {settlement.week_end}</Text>
                  <Text style={styles.status}>{personnelSettlementStatusLabel(settlement.status)}</Text>
                </View>
                <Text style={styles.total}>{money(settlement.total_cents)}</Text>
                <Text style={styles.muted}>税前 {money(settlement.subtotal_cents)} · GST {money(settlement.gst_cents)} · {settlement.line_count || 0} 项</Text>
                <AppButton
                  testID={settlement.status === 'void' ? `voided-settlement-resubmit-${settlement.id}` : undefined}
                  label={settlement.status === 'void' ? '重新核对并提交' : settlement.status === 'awaiting_confirmation' ? '查看并再次确认' : '查看详情'}
                  tone={['void', 'awaiting_confirmation'].includes(settlement.status) ? 'primary' : 'outline'}
                  loading={settlement.status === 'void' && submissionReviewLoadingWeek === settlement.week_start}
                  disabled={settlement.status === 'void' && Boolean(submissionReviewLoadingWeek)}
                  onPress={() => settlement.status === 'void'
                    ? openVoidedSettlementSubmissionReview(settlement)
                    : openSettlement(settlement)}
                  fullWidth
                  style={styles.singleButton}
                />
              </View>
            )) : submissionPreview?.status !== 'not_submitted' ? <View style={styles.empty}><Text style={styles.muted}>暂无周结算单</Text></View> : null}
          </>
        )}
      </ScrollView>

      <Modal
        visible={submissionReviewOpen && submissionReviewPreview?.status === 'not_submitted'}
        animationType="slide"
        onRequestClose={closeSubmissionReview}
      >
        <SafeAreaView style={styles.modalPage} edges={['left', 'right', 'bottom']}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <View style={styles.submissionReviewTitleWrap}>
              <Text style={styles.modalTitle}>核对本周工作量</Text>
              <Text style={styles.muted}>第 {submissionReviewStep} 步，共 2 步</Text>
            </View>
            <AppIconButton
              testID="weekly-submission-review-close"
              accessibilityLabel="关闭本周工作量核对"
              disabled={saving}
              onPress={closeSubmissionReview}
            >
              <Ionicons name="close" size={24} color="#111827" />
            </AppIconButton>
          </View>
          <View style={styles.submissionSteps}>
            <View style={[styles.submissionStep, styles.submissionStepActive]}>
              <Text style={styles.submissionStepText}>1  核对明细</Text>
            </View>
            <View style={[styles.submissionStep, submissionReviewStep === 2 ? styles.submissionStepActive : null]}>
              <Text style={[styles.submissionStepText, submissionReviewStep === 1 ? styles.submissionStepTextMuted : null]}>2  确认提交</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}>
            {submissionReviewPreview && submissionReviewStep === 1 ? (
              <>
                <View testID="weekly-submission-review-detail" style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.submissionReviewTitleWrap}>
                      <Text style={styles.cardTitle}>{formatPersonnelDate(submissionReviewPreview.week_start)} 至 {formatPersonnelDate(submissionReviewPreview.week_end)}</Text>
                      <Text style={styles.muted}>{submissionReviewPreview.pending_pricing_count > 0 ? '以下为已计价项目；待计价工作单独列出且未按零元合并' : '以下基础工作量、额外工作和补贴均已计入本次确认总额'}</Text>
                    </View>
                    <Text style={styles.status}>{submissionReviewPreview.line_count} 项</Text>
                  </View>
                  <View style={styles.summaryBox}>
                    <View style={styles.summaryRow}><Text style={styles.body}>税前金额</Text><Text style={styles.summaryValue}>{money(submissionReviewPreview.subtotal_cents)}</Text></View>
                    <View testID="weekly-submission-subsidy-total" style={styles.summaryRow}><Text style={styles.body}>补贴（已包含）</Text><Text style={styles.subsidyBreakdownTotal}>{money(submissionReviewSubsidyTotal)}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.body}>GST</Text><Text style={styles.summaryValue}>{money(submissionReviewPreview.gst_cents)}</Text></View>
                    <View style={[styles.summaryRow, styles.summaryTotalRow]}><Text style={styles.summaryTotalLabel}>{submissionReviewPreview.pending_pricing_count > 0 ? '已计小计' : '预计总额'}</Text><Text style={styles.summaryTotalValue}>{money(submissionReviewPreview.total_cents)}</Text></View>
                    {submissionReviewPreview.pending_pricing_count > 0 ? <View style={styles.summaryRow}><Text style={styles.body}>待计价</Text><Text style={styles.summaryValue}>{submissionReviewPreview.pending_pricing_count} 项</Text></View> : null}
                  </View>
                  {submissionReviewPreview.amount_state === 'historical_frozen_pending_verification' ? (
                    <Text style={styles.claimRowReviewNote}>此金额来自历史冻结结算，执行凭证待核实；不会自动改为 0 或重新计费。</Text>
                  ) : null}
                </View>
                <SettlementWorkChecklist
                  items={submissionReviewPreview.work_checklist || []}
                  testIdPrefix="weekly-submission-checklist"
                />
                {submissionPreviewDailyLines.length ? submissionPreviewDailyLines.map((line) => (
                  <SettlementDailySummaryCard key={line.service_date} testID={`weekly-submission-day-${line.service_date}`} dateLabel={formatPersonnelDateWithWeekday(line.service_date)} line={line} />
                )) : (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>{submissionReviewPreview.pending_pricing_count > 0 ? '本周暂无已计价项目' : '本周暂无可提交项目'}</Text>
                    <Text style={styles.muted}>{submissionReviewPreview.pending_pricing_count > 0 ? '本周工作均列在下方待计价项目中，未按 $0 计入。' : '请先检查工作量和补贴反馈。'}</Text>
                  </View>
                )}
                <PendingPricingItemsCard items={submissionReviewPreview.pending_pricing_items || []} />
                {submissionPreviewIncludedPendingClaims.length ? (
                  <View testID="weekly-submission-included-pending-claims" style={styles.notice}>
                    <Text style={styles.noticeTitle}>已包含 {submissionPreviewIncludedPendingClaims.length} 条待财务审核反馈</Text>
                    <Text style={styles.help}>这些申报金额已经计入上方总额；财务按原内容确认时不会要求你再次确认。</Text>
                  </View>
                ) : null}
                {submissionPreviewUnincludedClaims.length ? (
                  <View testID="weekly-submission-unincluded-claims" style={styles.card}>
                    <Text style={styles.cardTitle}>尚未进入本次提交</Text>
                    <Text style={styles.warning}>以下草稿或待补充反馈未进入本次总额，请确认是否需要先处理。</Text>
                    <View style={styles.pendingList}>
                      {submissionPreviewUnincludedClaims.map((claim) => (
                        <View key={claim.id} style={styles.pendingRow}>
                          <View style={styles.claimRowContent}>
                            <View style={styles.cardHeader}>
                              <Text style={styles.body}>{CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type}</Text>
                              <Text style={styles.claimRowStatus}>{personnelClaimStatusLabel(claim.status)}</Text>
                            </View>
                            <Text style={styles.muted}>{formatPersonnelDateWithWeekday(claim.service_date)} · {claim.note}</Text>
                            <Text style={styles.claimRowMeta}>{personnelClaimListMeta(claim)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
                {submissionReviewPreview.blocking_issues.length ? (
                  <View style={styles.notice}>
                    <Text style={styles.noticeTitle}>本周总额暂未计算完整</Text>
                    <Text style={styles.help}>你可以提交已计小计和待计价项目供公司核对；在费用规则、GST 或结算资料补齐前，本周不能作为完整最终金额确认或付款。</Text>
                  </View>
                ) : null}
                <AppButton
                  testID="weekly-submission-next"
                  label="我已核对，下一步"
                  disabled={submissionPreviewUnincludedClaims.length > 0}
                  onPress={() => setSubmissionReviewStep(2)}
                  fullWidth
                />
              </>
            ) : submissionReviewPreview ? (
              <>
                <View testID="weekly-submission-confirmation" style={styles.card}>
                  <Text style={styles.cardTitle}>确认提交给财务核对</Text>
                  <Text style={styles.help}>{submissionReviewPreview.pending_pricing_count > 0 ? '本次确认的是工作明细、已计小计和待计价项目；公司补齐单价或资料后必须退回请你确认完整总额。' : '提交后，财务会按你确认的明细和总额核对；全部一致可直接付款，只有发生调整才会退回请你再次确认。'}</Text>
                  <View style={styles.summaryBox}>
                    <View style={styles.summaryRow}><Text style={styles.body}>结算周期</Text><Text style={styles.summaryValue}>{formatPersonnelDate(submissionReviewPreview.week_start)} 至 {formatPersonnelDate(submissionReviewPreview.week_end)}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.body}>已计入项目</Text><Text style={styles.summaryValue}>{submissionReviewPreview.line_count} 项</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.body}>待计价项目</Text><Text style={styles.summaryValue}>{submissionReviewPreview.pending_pricing_count} 项</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.body}>其中待财务审核反馈</Text><Text style={styles.summaryValue}>{submissionPreviewIncludedPendingClaims.length} 项（已包含）</Text></View>
                    <View testID="weekly-submission-confirmation-subsidy-total" style={styles.summaryRow}><Text style={styles.body}>补贴（已包含）</Text><Text style={styles.subsidyBreakdownTotal}>{money(submissionReviewSubsidyTotal)}</Text></View>
                    <View style={[styles.summaryRow, styles.summaryTotalRow]}><Text style={styles.summaryTotalLabel}>{submissionReviewPreview.pending_pricing_count > 0 ? '确认已计小计' : '确认总额'}</Text><Text style={styles.summaryTotalValue}>{money(submissionReviewPreview.total_cents)}</Text></View>
                  </View>
                  <Pressable
                    testID="weekly-submission-acknowledgement"
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: submissionAcknowledged && submissionReviewReady, disabled: saving || !submissionReviewReady }}
                    disabled={saving || !submissionReviewReady}
                    onPress={() => setSubmissionAcknowledged((checked) => submissionReviewReady && !checked)}
                    style={({ pressed }) => [styles.submissionAcknowledgement, pressed ? styles.claimRowPressed : null]}
                  >
                    <View testID="weekly-submission-checkbox" style={[styles.submissionCheckbox, submissionAcknowledged && submissionReviewReady ? styles.submissionCheckboxChecked : null]}>
                      {submissionAcknowledged && submissionReviewReady ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
                    </View>
                    <Text style={[styles.body, styles.submissionConsentCopy]}>确认：工作量及金额正确。{submissionReviewPreview.pending_pricing_count > 0 ? '我已核对基础工作、额外工作、补贴、已计小计和待计价项目；公司补齐或修改金额后必须请我重新确认。' : '我已核对上述基础工作量、额外工作、申报补贴和确认总额；财务只有在修改内容或金额时才需要我再次确认。'}</Text>
                  </Pressable>
                </View>
                <View style={styles.submissionActionRow}>
                  <AppButton
                    testID="weekly-submission-back"
                    label="返回核对"
                    tone="secondary"
                    disabled={saving}
                    onPress={() => {
                      setSubmissionAcknowledged(false)
                      setSubmissionReviewStep(1)
                    }}
                    style={styles.submissionActionButton}
                  />
                  <AppButton
                    testID="weekly-submission-submit"
                    label="确认提交"
                    loading={saving}
                    disabled={!submissionAcknowledged || !submissionReviewReady}
                    onPress={submitWeeklyWorkload}
                    style={styles.submissionActionButton}
                  />
                </View>
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={!!claimDetail} animationType="slide" onRequestClose={closeClaimDetail}>
        <SafeAreaView style={styles.modalPage} edges={['left', 'right', 'bottom']}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <Text style={styles.modalTitle}>工作量反馈详情</Text>
            <AppIconButton testID="claim-detail-close" accessibilityLabel="关闭工作量反馈详情" onPress={closeClaimDetail}><Ionicons name="close" size={24} color="#111827" /></AppIconButton>
          </View>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}>
            {claimDetail ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{CLAIM_TYPE_LABELS[claimDetail.claim_type] || claimDetail.claim_type}</Text>
                <Text style={styles.body}>{claimDetail.service_date} · {personnelClaimStatusLabel(claimDetail.status)}</Text>
                <Text style={styles.body}>{claimDetail.note}</Text>
                {claimDetail.duration_minutes ? <Text style={styles.body}>时长：{formatPersonnelDuration(claimDetail.duration_minutes)}</Text> : null}
                {claimDetail.requested_amount_cents != null ? <Text style={styles.body}>提交金额：{money(claimDetail.requested_amount_cents)}</Text> : null}
                {claimDetailEstimateLoading ? (
                  <View testID="claim-detail-estimate-loading" style={styles.estimateCard}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={styles.muted}>正在计算预计金额…</Text>
                  </View>
                ) : claimDetailEstimate?.available ? (
                  <View testID="claim-detail-estimate-card" style={styles.estimateCard}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.muted}>结算规则</Text>
                      <Text testID="claim-detail-estimate-rate" style={styles.summaryValue}>
                        {personnelClaimEstimateRateText(claimDetail.claim_type, claimDetailEstimate)}
                      </Text>
                    </View>
                    <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                      <Text style={styles.summaryTotalLabel}>预计结算金额</Text>
                      <Text testID="claim-detail-estimate-total" style={styles.summaryTotalValue}>{money(claimDetailEstimate.total_cents)}</Text>
                    </View>
                    <Text testID="claim-detail-estimate-gst" style={styles.muted}>其中 GST {money(claimDetailEstimate.gst_cents)}</Text>
                    <Text style={styles.muted}>最终以公司核对结果为准</Text>
                  </View>
                ) : claimDetailEstimate ? (
                  <View style={styles.notice}><Text style={styles.help}>暂时无法按当天规则计算预计金额，最终由公司核对。</Text></View>
                ) : null}
                {claimDetailEstimateError ? (
                  <View style={styles.notice}><Text style={styles.help}>{claimDetailEstimateError}</Text></View>
                ) : null}
                {claimDetail.review_note ? <Text style={styles.warning}>核对说明：{claimDetail.review_note}</Text> : null}
                <View style={styles.photoGrid}>
                  {(claimDetail.evidence || []).map((item) => {
                    const source = buildPersonnelClaimEvidenceImageSource(API_BASE_URL, token, claimDetail.id, item.id)
                    return source ? <Image key={item.id} testID="claim-evidence-image" source={source} style={styles.detailPhoto} resizeMode="cover" /> : null
                  })}
                </View>
                {(claimDetail.available_actions?.includes('edit') || ['draft', 'returned'].includes(claimDetail.status)) && !claimDetail.claim_type.startsWith('trial_') ? (
                  <AppButton testID="claim-detail-edit" label={claimDetail.status === 'submitted' ? '修改待核对反馈' : '继续修改'} onPress={() => editClaim(claimDetail)} fullWidth />
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={!!settlementDetail}
        animationType="slide"
        onRequestClose={() => {
          if (datePickerTarget === 'supplement') setDatePickerTarget(null)
          else if (pdfPreview) setPdfPreview(null)
          else closeSettlement()
        }}
      >
        <SafeAreaView style={styles.modalPage} edges={['left', 'right', 'bottom']}>
          <View testID="settlement-detail-header" style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <Text style={styles.modalTitle}>周结算详情</Text>
            <AppIconButton testID="settlement-detail-close" accessibilityLabel="关闭周结算详情" onPress={closeSettlement}><Ionicons name="close" size={24} color="#111827" /></AppIconButton>
          </View>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}>
            {settlementDetail ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{settlementDetail.week_start} 至 {settlementDetail.week_end}</Text>
                  <Text style={styles.status}>{personnelSettlementStatusLabel(settlementDetail.status)}</Text>
                  <View style={styles.totalBox}>
                    <Text style={styles.total}>{money(settlementDetail.total_cents)}</Text>
                    <Text style={styles.muted}>税前 {money(settlementDetail.subtotal_cents)} + GST {money(settlementDetail.gst_cents)}</Text>
                    <Text testID="settlement-detail-subsidy-total" style={styles.subsidyBreakdownTotal}>其中补贴 {money(settlementDetailSubsidyTotal)}（已包含）</Text>
                  </View>
                </View>
                {detailLoading ? (
                  <View testID="settlement-detail-loading" style={styles.detailLoadingCard}>
                    <ActivityIndicator color="#2563EB" />
                    <Text style={styles.body}>正在加载结算明细…</Text>
                    <Text style={styles.muted}>页面已打开，请稍候。</Text>
                  </View>
                ) : (
                  <>
                    {currentSettlementDocuments.length ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>结算文件</Text>
                    {currentSettlementDocuments.map((document) => (
                      <View key={document.id} style={styles.documentRow}>
                        <View style={styles.documentText}>
                          <Text style={styles.body}>{document.document_label} · v{document.version}</Text>
                          <Text style={styles.muted}>{document.invoice_number || '待确认草稿'}</Text>
                        </View>
                        <AppButton
                          label="查看 PDF"
                          size="compact"
                          tone="outline"
                          loading={documentBusy === document.id}
                          disabled={!!documentBusy && documentBusy !== document.id}
                          onPress={() => openSettlementDocument(document)}
                        />
                      </View>
                    ))}
                  </View>
                    ) : settlementDetail.phase5_schema_ready === false ? (
                      <View style={styles.notice}><Text style={styles.help}>PDF 功能等待阶段 5 数据库启用。</Text></View>
                    ) : null}
                    <SettlementWorkChecklist
                      items={settlementDetail.work_checklist || []}
                      testIdPrefix="settlement-checklist"
                    />
                    {dailySettlementLines.map((line) => (
                  <SettlementDailySummaryCard key={line.service_date} testID={`settlement-day-${line.service_date}`} dateLabel={formatPersonnelDate(line.service_date)} line={line} />
                    ))}
                    <PendingPricingItemsCard items={settlementDetail.pending_pricing_items || []} />
                    {['awaiting_confirmation', 'disputed'].includes(settlementDetail.status) ? (
                  <View testID="settlement-reconciliation-card" style={styles.card}>
                    <Text style={styles.cardTitle}>{settlementDetail.status === 'awaiting_confirmation' ? '确认本周结算' : '本周结算重新核对中'}</Text>
                    {settlementDetail.status === 'awaiting_confirmation' ? (
                      <>
                        {settlementDetail.dispute_note ? <View style={styles.notice}>
                          <Text style={styles.noticeTitle}>财务退回说明</Text>
                          <Text style={styles.help}>{settlementDetail.dispute_note}</Text>
                        </View> : null}
                        <Text style={styles.help}>请核对本周工作内容和结算金额。</Text>
                        <AppButton testID="settlement-confirm" label="确认并重新提交" loading={saving} onPress={() => respondSettlement('confirm')} fullWidth />
                      </>
                    ) : (
                      <View style={styles.notice}>
                        <Text style={styles.noticeTitle}>已发送公司重新核对</Text>
                        <Text style={styles.help}>{settlementDetail.dispute_note || '公司正在重新核对本周工作内容和金额。'}</Text>
                      </View>
                    )}

                    <Text style={styles.label}>工作内容或金额有疑问？</Text>
                    <View style={styles.actionRow}>
                      <AppButton
                        testID="settlement-issue-supplement"
                        label="补充工作或费用"
                        size="compact"
                        minHeight={44}
                        tone={settlementIssueMode === 'supplement' ? 'primary' : 'outline'}
                        onPress={() => setSettlementIssueMode('supplement')}
                        style={styles.flexButton}
                      />
                      {settlementDetail.status === 'awaiting_confirmation' ? (
                        <AppButton
                          testID="settlement-issue-calculation"
                          label="现有结算需要核对"
                          size="compact"
                          minHeight={44}
                          tone={settlementIssueMode === 'calculation' ? 'danger' : 'outline'}
                          onPress={() => setSettlementIssueMode('calculation')}
                          style={styles.flexButton}
                        />
                      ) : null}
                    </View>

                    {settlementIssueMode === 'calculation' ? (
                      <View testID="settlement-calculation-issue">
                        <Field testID="settlement-dispute-reason" label="问题说明" value={disputeReason} placeholder="请写明日期、房号或金额问题" multiline onChangeText={setDisputeReason} style={styles.multiline} />
                        <AppButton testID="settlement-dispute-submit" label="发送给财务核对" tone="outline" loading={saving} onPress={() => respondSettlement('dispute')} fullWidth style={styles.reconciliationSubmit} />
                      </View>
                    ) : null}

                    {settlementIssueMode === 'supplement' && supplementDraft ? (
                      <View testID="settlement-supplement-card" style={styles.supplementForm}>
                        <Text style={styles.cardTitle}>补充本周补贴</Text>
                        <Text style={styles.help}>填写日期、补贴内容和金额，并上传照片或截图。提交后由财务核对是否计入，不会直接改写正式结算金额。</Text>
                        <View style={styles.summaryBox}>
                          <View style={styles.summaryRow}>
                            <Text style={styles.muted}>当前正式总额</Text>
                            <Text style={styles.summaryValue}>{money(settlementDetail.total_cents)}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.muted}>待公司核对</Text>
                            <Text testID="settlement-pending-total" style={styles.summaryValue}>+ {money(pendingClaimsTotal)}</Text>
                          </View>
                          {currentSupplementTotal > 0 ? (
                            <View style={styles.summaryRow}>
                              <Text style={styles.muted}>本次正在填写</Text>
                              <Text testID="settlement-current-supplement-total" style={styles.summaryValue}>+ {money(currentSupplementTotal)}</Text>
                            </View>
                          ) : null}
                          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                            <Text style={styles.summaryTotalLabel}>核对后的预计总额</Text>
                            <Text testID="settlement-projected-total" style={styles.summaryTotalValue}>
                              {money(settlementDetail.total_cents + pendingClaimsTotal + currentSupplementTotal)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.help}>补贴金额按填写的最终总额估算；公司可核对并调整金额，最终以重新生成的正式结算单为准。</Text>

                        {pendingClaims.length ? (
                          <View style={styles.pendingList}>
                            <Text style={styles.label}>本周待核对内容</Text>
                            {pendingClaims.map((claim) => (
                              <View key={claim.id} style={styles.pendingRow}>
                                <View style={styles.documentText}>
                                  <Text style={styles.body}>{CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type} · {String(claim.service_date).slice(0, 10)}</Text>
                                  <Text style={styles.muted}>{claim.note}</Text>
                                </View>
                                <Text style={styles.summaryValue}>{claimAmountCents(claim) > 0 ? money(estimatedSettlementClaimTotalCents(settlementDetail, claimAmountCents(claim))) : '待计价'}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}

                        <DateSelector testID="settlement-supplement-date" label="工作日期" value={supplementDraft.service_date} onPress={() => setDatePickerTarget('supplement')} />
                        <Field testID="settlement-supplement-amount" label="补贴金额 AUD" value={supplementDraft.requested_amount} placeholder="例如 35.00" keyboardType="decimal-pad" onChangeText={(value) => setSupplementDraftField('requested_amount', value.replace(/[^\d.]/g, ''))} />
                        <Field testID="settlement-supplement-note" label="补贴内容" value={supplementDraft.note} placeholder="请填写具体补贴内容" multiline onChangeText={(value) => setSupplementDraftField('note', value)} style={styles.multiline} />
                        <View style={styles.field}>
                          <Text style={styles.label}>照片或截图证明（{supplementDraft.media.length}/5）</Text>
                          <View style={styles.photoGrid}>
                            {supplementDraft.media.map((item) => (
                              <View key={item.media_id} style={styles.photoWrap}>
                                <Image source={{ uri: item.local_uri }} style={styles.photo} />
                                {item.state !== 'associated' ? (
                                  <AppIconButton accessibilityLabel="删除补充内容证明照片" onPress={() => removeSupplementPhoto(item.media_id)} style={styles.removePhoto} visualStyle={styles.removePhotoVisual}>
                                    <Ionicons name="close" size={18} color="#FFFFFF" />
                                  </AppIconButton>
                                ) : null}
                                <Text style={[styles.photoState, item.error ? styles.errorText : null]} numberOfLines={2}>
                                  {item.error || (item.state === 'associated' ? '已关联' : item.state === 'uploading' ? '上传中' : '待上传')}
                                </Text>
                              </View>
                            ))}
                          </View>
                          <View style={styles.actionRow}>
                            <AppButton label="拍照" tone="outline" size="compact" loading={supplementPicking} onPress={() => addSupplementPhoto('camera')} style={styles.flexButton} />
                            <AppButton label="上传照片/截图" tone="outline" size="compact" loading={supplementPicking} onPress={() => addSupplementPhoto('library')} style={styles.flexButton} />
                          </View>
                        </View>
                        <AppButton testID="settlement-supplement-submit" label="提交补充内容并请求重新核对" loading={supplementSaving} onPress={submitSettlementSupplement} fullWidth />
                        <Text style={styles.help}>提交成功后，本周结算会进入重新核对；正式金额在公司核对后更新。</Text>
                      </View>
                    ) : null}
                  </View>
                    ) : null}
                  </>
                )}
              </>
            ) : null}
          </ScrollView>
          {pdfPreview ? (
            <Animated.View
              testID="settlement-pdf-sheet-overlay"
              style={[styles.pdfSheetOverlay, { opacity: pdfSheetProgress }]}
            >
              <Pressable
                testID="settlement-pdf-backdrop"
                accessibilityRole="button"
                accessibilityLabel="关闭 PDF 预览"
                onPress={() => setPdfPreview(null)}
                style={styles.pdfSheetBackdrop}
              />
              <Animated.View
                testID="settlement-pdf-sheet"
                style={[
                  styles.pdfSheet,
                  { paddingBottom: Math.max(insets.bottom, 8) },
                  { transform: [{ translateY: pdfSheetProgress.interpolate({ inputRange: [0, 1], outputRange: [56, 0] }) }] },
                ]}
              >
                <View style={styles.pdfSheetHandleWrap}><View style={styles.pdfSheetHandle} /></View>
                <View testID="settlement-pdf-header" style={styles.pdfSheetHeader}>
                  <View style={styles.pdfTitleWrap}>
                    <Text style={styles.modalTitle}>PDF 预览</Text>
                    <Text style={styles.muted}>{pdfPreview.document.document_label}</Text>
                  </View>
                  <View style={styles.pdfHeaderActions}>
                    <AppIconButton testID="settlement-pdf-share" accessibilityLabel="分享 PDF" onPress={shareSettlementDocument} visualStyle={styles.pdfActionVisual}>
                      <Ionicons name="share-outline" size={22} color="#1D4ED8" />
                    </AppIconButton>
                    <AppIconButton testID="settlement-pdf-close" accessibilityLabel="关闭 PDF 预览" onPress={() => setPdfPreview(null)}>
                      <Ionicons name="close" size={24} color="#111827" />
                    </AppIconButton>
                  </View>
                </View>
                <WebView
                  testID="settlement-pdf-viewer"
                  source={{ uri: pdfPreview.uri }}
                  style={styles.pdfViewer}
                  originWhitelist={['*']}
                  allowFileAccess
                  allowingReadAccessToURL={pdfPreview.uri}
                  startInLoadingState
                  renderLoading={() => <View style={styles.pdfLoading}><ActivityIndicator /><Text style={styles.muted}>正在打开 PDF…</Text></View>}
                  onError={() => Alert.alert('预览失败', 'PDF 已下载，可点击右上角分享图标用其他应用打开。')}
                />
              </Animated.View>
            </Animated.View>
          ) : null}
          {datePickerTarget === 'supplement' && supplementDraft && settlementDetail ? (
            <DatePickerSheet
              testID="settlement-supplement-date-picker"
              value={supplementDraft.service_date}
              bottomInset={insets.bottom}
              minDate={settlementDetail.week_start}
              maxDate={settlementDetail.week_end}
              onCancel={() => setDatePickerTarget(null)}
              onConfirm={(value) => {
                setSupplementDraftField('service_date', value)
                setDatePickerTarget(null)
              }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  loadingBar: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EFF6FF' },
  tabs: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#FFFFFF', borderBottomWidth: hairline(), borderBottomColor: '#E5E7EB' },
  tabButton: { flex: 1 },
  headerAddButton: { minWidth: 82, flexShrink: 0 },
  content: { padding: 14, paddingBottom: 40, gap: 12 },
  claimsContent: { paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: hairline(), borderColor: '#E5E7EB', gap: 10 },
  notice: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, borderWidth: hairline(), borderColor: '#BFDBFE', gap: 6 },
  noticeTitle: { fontSize: 16, fontWeight: '900', color: '#1E40AF' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '900', color: '#111827' },
  sectionTitle: { marginTop: 4, fontSize: 18, fontWeight: '900', color: '#111827' },
  status: { color: '#1D4ED8', fontWeight: '800', fontSize: 13 },
  dailyTotal: { color: '#111827', fontSize: 16, fontWeight: '900' },
  help: { color: '#6B7280', fontSize: 13, lineHeight: 20 },
  body: { color: '#374151', fontSize: 14, lineHeight: 21 },
  muted: { color: '#6B7280', fontSize: 13, lineHeight: 19 },
  executionList: { marginTop: 10, borderTopWidth: hairline(), borderTopColor: '#E5E7EB', paddingTop: 8, gap: 8 },
  checklistCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, gap: 8, borderWidth: hairline(), borderColor: '#D1D5DB' },
  executionListTitle: { color: '#111827', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  executionRow: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, gap: 2 },
  executionProperty: { flex: 1, color: '#111827', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  executionStatus: { color: '#047857', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  executionStatusWarning: { color: '#B45309', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  includedAmount: { color: '#047857', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  notIncludedAmount: { color: '#6B7280', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  warning: { color: '#B45309', backgroundColor: '#FFFBEB', padding: 10, borderRadius: 8, lineHeight: 20 },
  errorText: { color: '#B91C1C' },
  field: { gap: 6 },
  inlineLoading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineError: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: '#F9FAFB' },
  label: { color: '#111827', fontSize: 14, fontWeight: '800' },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827', backgroundColor: '#FFFFFF', fontSize: 15 },
  dateSelector: { minHeight: 46, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  dateSelectorPressed: { backgroundColor: '#F3F4F6' },
  dateSelectorText: { flex: 1, minWidth: 0, color: '#111827', fontSize: 15 },
  multiline: { minHeight: 86, textAlignVertical: 'top' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeButton: { minWidth: 104, flexGrow: 1 },
  selectionBox: { gap: 3, padding: 10, borderRadius: 10, backgroundColor: '#EFF6FF' },
  estimateCard: { gap: 8, padding: 12, borderRadius: 12, borderWidth: hairline(), borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  selection: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  timeSelectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeSelectorField: { flex: 1, minWidth: 132 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { width: 96, gap: 4 },
  photo: { width: 96, height: 96, borderRadius: 10, backgroundColor: '#E5E7EB' },
  photoUnavailable: { alignItems: 'center', justifyContent: 'center' },
  detailPhoto: { width: 132, height: 132, borderRadius: 10, backgroundColor: '#E5E7EB' },
  removePhoto: { position: 'absolute', right: -7, top: -7 },
  removePhotoVisual: { borderRadius: 14, backgroundColor: '#111827' },
  photoState: { fontSize: 11, color: '#6B7280' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flexButton: { flex: 1, minWidth: 132 },
  singleButton: { marginTop: 2 },
  reconciliationSubmit: { marginTop: layoutTokens.button.rowGap },
  supplementForm: { gap: layoutTokens.button.rowGap },
  empty: { padding: 28, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#111827', fontSize: 16, lineHeight: 22, fontWeight: '800', marginBottom: 4 },
  claimListSummary: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, borderBottomWidth: hairline(), borderBottomColor: '#E5E7EB' },
  claimListSummaryText: { color: '#4B5563', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  claimListSummaryPending: { color: '#6B7280', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  claimDateGroup: { gap: 0 },
  claimDateHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, backgroundColor: '#F1F3F7' },
  claimDateTitle: { color: '#111827', fontSize: 16, lineHeight: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  claimDateCount: { color: '#9CA3AF', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  claimListSurface: { overflow: 'hidden', backgroundColor: '#FFFFFF', borderBottomWidth: hairline(), borderBottomColor: '#E5E7EB' },
  claimRow: { minHeight: 104, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  claimRowDivider: { borderBottomWidth: hairline(), borderBottomColor: '#E5E7EB' },
  claimRowPressed: { backgroundColor: '#F9FAFB' },
  claimRowContent: { flex: 1, minWidth: 0, gap: 5 },
  claimRowHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  claimRowTitle: { flex: 1, color: '#111827', fontSize: 16, lineHeight: 22, fontWeight: '900' },
  claimRowStatus: { color: '#2563EB', fontSize: 12, lineHeight: 18, fontWeight: '800' },
  claimRowStatusPending: { color: '#D97706' },
  claimRowDescription: { color: '#374151', fontSize: 14, lineHeight: 20 },
  claimRowMeta: { color: '#6B7280', fontSize: 12, lineHeight: 18 },
  claimRowReviewNote: { color: '#B45309', fontSize: 12, lineHeight: 18 },
  total: { color: '#111827', fontSize: 24, fontWeight: '900' },
  totalBox: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, gap: 4 },
  summaryBox: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, gap: 8 },
  summaryRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryValue: { color: '#111827', fontSize: 14, fontWeight: '800' },
  summaryTotalRow: { marginTop: 2, paddingTop: 10, borderTopWidth: hairline(), borderTopColor: '#D1D5DB' },
  summaryTotalLabel: { flex: 1, color: '#1D4ED8', fontSize: 14, fontWeight: '900' },
  summaryTotalValue: { color: '#1D4ED8', fontSize: 20, fontWeight: '900' },
  dailyBreakdownSection: { gap: 6 },
  dailyBreakdownHeader: { minHeight: 24, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  dailyBreakdownTitle: { flex: 1, minWidth: 0, color: '#374151', fontSize: 14, lineHeight: 20, fontWeight: '900' },
  extraBreakdownSection: { gap: 8, padding: 12, borderRadius: 12, borderWidth: hairline(), borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' },
  extraBreakdownTitle: { flex: 1, minWidth: 0, color: '#3730A3', fontSize: 15, lineHeight: 21, fontWeight: '900' },
  extraBreakdownTotal: { flexShrink: 0, color: '#4338CA', fontSize: 14, lineHeight: 21, fontWeight: '900' },
  subsidyBreakdownSection: { gap: 8, padding: 12, borderRadius: 12, borderWidth: hairline(), borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  subsidyBreakdownTitle: { flex: 1, minWidth: 0, color: '#1E40AF', fontSize: 15, lineHeight: 21, fontWeight: '900' },
  subsidyBreakdownTotal: { flexShrink: 0, color: '#1D4ED8', fontSize: 14, lineHeight: 21, fontWeight: '900' },
  breakdownLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8, borderTopWidth: hairline(), borderTopColor: '#CBD5E1' },
  breakdownLineText: { flex: 1, minWidth: 0, gap: 2 },
  dailyPayableRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 10, borderTopWidth: hairline(), borderTopColor: '#D1D5DB' },
  dailyPayableLabel: { flex: 1, minWidth: 0, color: '#111827', fontSize: 14, lineHeight: 20, fontWeight: '900' },
  dailyPayableValue: { flexShrink: 0, color: '#111827', fontSize: 16, lineHeight: 22, fontWeight: '900' },
  pendingPricingCard: { backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, borderWidth: hairline(), borderColor: '#FCD34D', gap: 10 },
  pendingPricingLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 10, borderTopWidth: hairline(), borderTopColor: '#FDE68A' },
  pendingPricingAmount: { flexShrink: 0, color: '#B45309', fontSize: 13, lineHeight: 19, fontWeight: '900' },
  pendingList: { gap: 8 },
  pendingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: hairline(), borderBottomColor: '#E5E7EB' },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  documentText: { flex: 1, gap: 2 },
  detailLoadingCard: { minHeight: 132, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  modalPage: { flex: 1, backgroundColor: '#F6F7FB' },
  modalHeader: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: hairline(), borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  confirmOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 30, elevation: 30, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(17, 24, 39, 0.48)' },
  confirmCard: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF', gap: 14 },
  submissionReviewTitleWrap: { flex: 1, minWidth: 0, gap: 2 },
  submissionSteps: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: hairline(), borderBottomColor: '#E5E7EB' },
  submissionStep: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F3F4F6' },
  submissionStepActive: { backgroundColor: '#DBEAFE' },
  submissionStepText: { color: '#1D4ED8', fontSize: 13, lineHeight: 18, fontWeight: '900' },
  submissionStepTextMuted: { color: '#9CA3AF' },
  submissionAcknowledgement: { minHeight: layoutTokens.button.height, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, backgroundColor: '#EFF6FF' },
  submissionConsentCopy: { flex: 1, minWidth: 0 },
  submissionCheckbox: { width: 24, height: 24, flexShrink: 0, borderWidth: 2, borderColor: '#93C5FD', borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  submissionCheckboxChecked: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  submissionActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: layoutTokens.button.rowGap },
  submissionActionButton: { flex: 1, minWidth: 132 },
  pdfTitleWrap: { flex: 1, minWidth: 0, gap: 2, paddingRight: 8 },
  pdfHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pdfActionVisual: { borderRadius: 12, backgroundColor: '#EFF6FF' },
  pdfSheetOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-end' },
  pdfSheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  pdfSheet: { height: '88%', maxHeight: 840, backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', elevation: 18, shadowColor: '#000000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: -4 } },
  pdfSheetHandleWrap: { height: 24, alignItems: 'center', justifyContent: 'center' },
  pdfSheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D1D5DB' },
  pdfSheetHeader: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: hairline(), borderBottomColor: '#E5E7EB' },
  pdfViewer: { flex: 1, backgroundColor: '#E5E7EB' },
  pdfLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F6F7FB' },
  datePickerOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 30, justifyContent: 'flex-end' },
  datePickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  datePickerSheet: { width: '100%', maxHeight: '90%', paddingHorizontal: 16, paddingTop: 4, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 10, elevation: 20, shadowColor: '#000000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: -4 } },
  datePickerHandleWrap: { height: 24, alignItems: 'center', justifyContent: 'center' },
  datePickerHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D1D5DB' },
  datePickerContentScroll: { flexShrink: 1 },
  datePickerContent: { gap: 10 },
  datePickerHeader: { gap: 4 },
  datePickerTitle: { color: '#111827', fontSize: 17, fontWeight: '900' },
  datePickerValue: { color: '#1D4ED8', fontSize: 15, fontWeight: '800' },
  datePickerNavigation: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  datePickerMonthControls: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 2 },
  datePickerNavigationIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6' },
  datePickerMonthLabel: { minWidth: 96, color: '#111827', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  datePickerTodayButton: { minWidth: 70, flexGrow: 0 },
  datePickerWeekdays: { minHeight: 24, flexDirection: 'row', alignItems: 'center' },
  datePickerWeekday: { width: '14.285714%', color: '#6B7280', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  datePickerGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  datePickerDayCell: { width: '14.285714%', minHeight: 44, borderWidth: 1, borderColor: 'transparent', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  datePickerDayText: { color: '#374151', fontSize: 15, fontWeight: '700' },
  datePickerSundayText: { color: '#DC2626' },
  datePickerDayOutside: { opacity: 0.52 },
  datePickerDayOutsideText: { color: '#9CA3AF' },
  datePickerDayToday: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  datePickerDaySelected: { borderColor: '#2563EB', backgroundColor: '#2563EB', opacity: 1 },
  datePickerDaySelectedText: { color: '#FFFFFF', fontWeight: '900' },
  datePickerDayDisabled: { opacity: 0.3, backgroundColor: '#F3F4F6' },
  datePickerDayDisabledText: { color: '#9CA3AF' },
  datePickerDayPressed: { opacity: 0.7 },
  datePickerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  datePickerAction: { flex: 1, minWidth: 132 },
  timePickerSheet: { width: '100%', paddingHorizontal: 20, paddingTop: 2, backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 8, elevation: 20, shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: -3 } },
  timePickerHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  timePickerTitle: { flex: 1, color: '#111827', fontSize: 18, lineHeight: 24, fontWeight: '900' },
  timePickerValue: { color: '#2563EB', fontSize: 21, lineHeight: 27, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timeWheelLabels: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  timeWheelLabel: { flex: 1, color: '#6B7280', fontSize: 12, lineHeight: 16, fontWeight: '800', textAlign: 'center' },
  timeWheelColonSpace: { width: 28 },
  timeWheelFrame: { height: TIME_WHEEL_ITEM_HEIGHT * TIME_WHEEL_VISIBLE_ITEMS, flexDirection: 'row', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  timeWheelSelectionBand: { position: 'absolute', left: 4, right: 4, top: TIME_WHEEL_SIDE_PADDING, height: TIME_WHEEL_ITEM_HEIGHT, borderRadius: 12, backgroundColor: '#EFF6FF' },
  timeWheelColumn: { flex: 1, height: TIME_WHEEL_ITEM_HEIGHT * TIME_WHEEL_VISIBLE_ITEMS, zIndex: 1 },
  timeWheelContent: { paddingVertical: TIME_WHEEL_SIDE_PADDING },
  timeWheelItem: { height: TIME_WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  timeWheelItemText: { color: '#111827', fontSize: 16, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeWheelItemTextSelected: { color: '#111827', fontSize: 24, lineHeight: 30, fontWeight: '900' },
  timeWheelItemTextNear: { color: '#6B7280', fontSize: 17, lineHeight: 24, fontWeight: '800', opacity: 0.72 },
  timeWheelItemTextFar: { color: '#9CA3AF', fontSize: 15, lineHeight: 20, fontWeight: '700', opacity: 0.3 },
  timeWheelColon: { width: 28, zIndex: 2, color: '#111827', fontSize: 26, lineHeight: 32, fontWeight: '900', textAlign: 'center' },
})

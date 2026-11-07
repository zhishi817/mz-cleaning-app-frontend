import { performance } from 'node:perf_hooks'

const runs = Math.max(1, Number(process.env.MZ110_BENCH_RUNS || 12))
const delays = {
  patch: 40,
  cachePersist: 15,
  listGet: 300,
  listPersist: 15,
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function measure(steps) {
  const startedAt = performance.now()
  for (const step of steps) await wait(delays[step])
  return performance.now() - startedAt
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    mean_ms: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(1)),
    min_ms: Number(sorted[0].toFixed(1)),
    max_ms: Number(sorted.at(-1).toFixed(1)),
  }
}

const baseline = []
const receipt = []
for (let run = 0; run < runs; run += 1) {
  baseline.push(await measure(['patch', 'cachePersist', 'listGet', 'listPersist']))
  receipt.push(await measure(['patch', 'cachePersist']))
}

const baselineSummary = summarize(baseline)
const receiptSummary = summarize(receipt)
const reduction = 100 * (baselineSummary.mean_ms - receiptSummary.mean_ms) / baselineSummary.mean_ms
const listPayload = Array.from({ length: 300 }, (_, index) => ({
  id: `synthetic-task-${index + 1}`,
  date: `2026-11-${String((index % 15) + 1).padStart(2, '0')}`,
  type: index % 2 ? 'checkin_clean' : 'checkout_clean',
  status: 'assigned',
  summary: 'synthetic benchmark task',
}))
const receiptPayload = {
  manager_fields_receipt_version: 1,
  authoritative_updates: [
    { task_id: 'synthetic-checkout', checkout_time: '11am', sequence_no: 101 },
    { task_id: 'synthetic-checkin', checkin_time: '3pm', sequence_no: 102 },
  ],
}

console.log(JSON.stringify({
  evidence: 'controlled_synthetic_delay_model_not_production_or_cpu_measurement',
  runs,
  configured_delay_ms: delays,
  baseline: {
    awaited_steps: ['PATCH', 'cache persist', '15-day list GET', 'list persist'],
    list_requests_per_save: 1,
    ...baselineSummary,
  },
  versioned_receipt: {
    awaited_steps: ['PATCH', 'cache persist'],
    list_requests_per_supported_password_guest_checkout_or_key_save: 0,
    ...receiptSummary,
  },
  modeled_spinner_reduction_percent: Number(reduction.toFixed(1)),
  synthetic_json_bytes: {
    list_300_tasks: Buffer.byteLength(JSON.stringify(listPayload)),
    receipt_2_updates: Buffer.byteLength(JSON.stringify(receiptPayload)),
  },
}, null, 2))

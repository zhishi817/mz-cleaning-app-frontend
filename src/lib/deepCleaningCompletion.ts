// Client-generated business identity, not an authentication token. Persist before requests.
export function createDeepCleaningRecordId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16)
    return (character === 'x' ? value : (value & 3) | 8).toString(16)
  })
}
export function deepCleaningRecordOperationId(recordId: string) {
  return `deep-report-${recordId}`
}

// Before evidence must never share the completion-only draft identity.
export function deepCleaningBeforeDraftKey(taskId: string, sourceId: string) {
  return `deep-cleaning-before:${JSON.stringify([taskId.trim(), sourceId.trim()])}`
}

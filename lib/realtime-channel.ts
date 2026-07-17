let sequence = 0

const instanceId =
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export function realtimeChannelName(base: string) {
  sequence += 1
  return `${base}:${instanceId}:${sequence}`
}

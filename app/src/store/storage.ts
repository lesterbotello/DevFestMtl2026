const PREFIX = 'dfm26:'

export type StorageName =
  | 'agenda'
  | 'registrations'
  | 'feedback'
  | 'questions'
  | 'role'
  | 'rooms'
  | 'panelSettings'

export function key(name: StorageName): string {
  return `${PREFIX}v1:${name}`
}

export function loadValue<T>(k: string): T | null {
  const raw = localStorage.getItem(k)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function saveValue<T>(k: string, value: T): void {
  localStorage.setItem(k, JSON.stringify(value))
}

/** Wipes every dfm26:* key (all versions) but leaves foreign keys alone. */
export function clearAll(): void {
  const doomed: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(PREFIX)) doomed.push(k)
  }
  doomed.forEach((k) => localStorage.removeItem(k))
}
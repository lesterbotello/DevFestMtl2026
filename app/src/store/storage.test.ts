import { clearAll, key, loadValue, saveValue } from '@/store/storage'

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('builds versioned keys', () => {
    expect(key('agenda')).toBe('dfm26:v1:agenda')
    expect(key('panelSettings')).toBe('dfm26:v1:panelSettings')
  })

  it('round-trips JSON values', () => {
    saveValue(key('agenda'), ['webgpu-beyond-the-port', 'kotlin-in-production'])
    expect(loadValue<string[]>(key('agenda'))).toEqual(['webgpu-beyond-the-port', 'kotlin-in-production'])
  })

  it('returns null for missing values', () => {
    expect(loadValue(key('registrations'))).toBeNull()
  })

  it('clearAll wipes dfm26 keys but leaves foreign keys', () => {
    localStorage.setItem(key('agenda'), '[]')
    localStorage.setItem('someone-elses-key', 'keep me')
    clearAll()
    expect(localStorage.getItem(key('agenda'))).toBeNull()
    expect(localStorage.getItem('someone-elses-key')).toBe('keep me')
  })
})
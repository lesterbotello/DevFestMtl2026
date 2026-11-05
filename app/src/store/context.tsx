import { createContext, useContext, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { createAppStore } from '@/store/store'
import type { AppState, AppStore } from '@/store/store'

interface StoreContextValue {
  state: AppState
  actions: AppStore
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [actions] = useState(() => createAppStore())
  const state = useSyncExternalStore(
    (onStoreChange) => actions.subscribe(onStoreChange),
    () => actions.getState(),
  )
  return <StoreContext.Provider value={{ state, actions }}>{children}</StoreContext.Provider>
}

export function useAppStore(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useAppStore must be used inside <StoreProvider>')
  return ctx
}
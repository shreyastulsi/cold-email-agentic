import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react'

const MAX_LOG_ENTRIES = 20

export type SidebarLogEntry = {
  id?: string
  message?: string
  type?: string
  emoji?: string
  timestamp?: string | number | Date
  [key: string]: unknown
}

type SidebarLoggerContextValue = {
  logs: SidebarLogEntry[]
  setLogs: (
    updater:
      | SidebarLogEntry[]
      | ((previous: SidebarLogEntry[]) => SidebarLogEntry[])
  ) => void
  appendLog: (entry: SidebarLogEntry) => void
  clearLogs: () => void
  isActive: boolean
  setIsActive: (active: boolean) => void
}

const SidebarLoggerContext = createContext<SidebarLoggerContextValue | null>(
  null
)

const normalizeEntry = (entry: SidebarLogEntry | null | undefined) => {
  if (!entry) return null

  const rawTimestamp = entry.timestamp ?? Date.now()
  const parsedTimestamp = new Date(rawTimestamp)
  const timestamp = Number.isNaN(parsedTimestamp.getTime())
    ? new Date().toISOString()
    : parsedTimestamp.toISOString()

  const rawMessage =
    entry.message ??
    entry.detail ??
    entry.text ??
    entry.statusMessage ??
    entry.title ??
    ''

  const message =
    typeof rawMessage === 'string'
      ? rawMessage
      : (() => {
          try {
            return JSON.stringify(rawMessage)
          } catch (_error) {
            return String(rawMessage)
          }
        })()

  return {
    ...entry,
    message,
    timestamp,
  }
}

const normalizeList = (entries: SidebarLogEntry[]) => {
  return entries
    .map(normalizeEntry)
    .filter(Boolean)
    .slice(-MAX_LOG_ENTRIES) as SidebarLogEntry[]
}

export function SidebarLoggerProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogState] = useState<SidebarLogEntry[]>([])
  const [isActive, setIsActiveState] = useState(false)

  const setLogs = useCallback<
    SidebarLoggerContextValue['setLogs']
  >((updater) => {
    setLogState((previous) => {
      const next =
        typeof updater === 'function' ? updater(previous) : updater
      if (!Array.isArray(next)) {
        return previous
      }
      return normalizeList(next)
    })
  }, [])

  const appendLog = useCallback<SidebarLoggerContextValue['appendLog']>(
    (entry) => {
      setLogState((previous) => normalizeList([...previous, entry]))
    },
    []
  )

  const clearLogs = useCallback(() => {
    setLogState([])
  }, [])

  const setIsActive = useCallback((active: boolean) => {
    setIsActiveState(active)
  }, [])

  const value = useMemo<SidebarLoggerContextValue>(
    () => ({
      logs,
      setLogs,
      appendLog,
      clearLogs,
      isActive,
      setIsActive,
    }),
    [logs, setLogs, appendLog, clearLogs, isActive, setIsActive]
  )

  return (
    <SidebarLoggerContext.Provider value={value}>
      {children}
    </SidebarLoggerContext.Provider>
  )
}

export function useSidebarLogger() {
  const context = useContext(SidebarLoggerContext)
  if (!context) {
    throw new Error(
      'useSidebarLogger must be used within a SidebarLoggerProvider'
    )
  }
  return context
}


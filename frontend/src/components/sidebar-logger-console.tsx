
import { useSidebar } from '@/components/ui/sidebar'
import { useSidebarLogger } from '@/context/sidebar-logger-context'
import { cn } from '@/libs/utils'

const resolveTimestamp = (value: unknown) => {
  const fallback = new Date()
  if (!value) {
    return fallback.toLocaleTimeString()
  }

  const parsed = new Date(value as number | string | Date)
  if (Number.isNaN(parsed.getTime())) {
    return fallback.toLocaleTimeString()
  }
  return parsed.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const resolveMessage = (log: Record<string, unknown>) => {
  const candidate =
    (log.message as string | undefined) ??
    (log.detail as string | undefined) ??
    (log.text as string | undefined) ??
    (log.statusMessage as string | undefined) ??
    ''

  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate
  }

  try {
    return JSON.stringify(candidate)
  } catch (_error) {
    return String(candidate)
  }
}

const resolveToneClass = (log: Record<string, unknown>) => {
  const rawType =
    (log.type as string | undefined) ??
    (log.level as string | undefined) ??
    (log.status as string | undefined) ??
    ''
  const type = rawType.toLowerCase()

  if (type.includes('error') || type.includes('fail')) {
    return 'text-red-400'
  }
  if (type.includes('success') || type.includes('done') || type.includes('complete')) {
    return 'text-green-400'
  }
  if (type.includes('warn') || type.includes('pending')) {
    return 'text-amber-300'
  }
  if (type.includes('info') || type.includes('start')) {
    return 'text-blue-300'
  }
  return 'text-gray-300'
}

export function SidebarLoggerConsole() {
  const { logs, clearLogs, isActive } = useSidebarLogger()
  const { state } = useSidebar()
  const hasLogs = logs.length > 0

  if (state === 'collapsed') {
    return null
  }

  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-900/70 p-3 shadow-lg shadow-black/10">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
            Activity Console
          </h3>
          {isActive && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={clearLogs}
          className="text-[10px] font-medium uppercase tracking-wide text-gray-500 transition-colors hover:text-gray-200"
        >
          Clear
        </button>
      </div>
      <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
        {hasLogs ? (
          logs.map((log, index) => (
            <div
              key={log.id ?? `${log.timestamp}-${index}`}
              className={cn(
                'text-[11px] font-mono leading-relaxed',
                resolveToneClass(log)
              )}
            >
              [{resolveTimestamp(log.timestamp)}]{' '}
              {log.emoji ? `${log.emoji} ` : ''}
              {resolveMessage(log)}
            </div>
          ))
        ) : (
          <p className="text-[11px] font-mono text-gray-500">
            No activity yet. Run an action to see real-time updates.
          </p>
        )}
      </div>
    </div>
  )
}


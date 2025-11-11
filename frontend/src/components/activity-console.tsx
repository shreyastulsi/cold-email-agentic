import { X, ChevronLeft, ChevronRight, Terminal, Zap, Minimize2, Maximize2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/libs/utils'

interface LogEntry {
  id?: string
  message?: string
  type?: string
  level?: string
  status?: string
  emoji?: string
  timestamp?: string | number | Date
  [key: string]: unknown
}

interface ActivityConsoleProps {
  logs: LogEntry[]
  onClear: () => void
  isActive: boolean
  onToggle?: () => void
  onWidthChange?: (width: number) => void
}

const resolveTimestamp = (value: unknown) => {
  const fallback = new Date()
  if (!value) {
    return fallback.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const parsed = new Date(value as number | string | Date)
  if (Number.isNaN(parsed.getTime())) {
    return fallback.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }
  return parsed.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const resolveMessage = (log: LogEntry) => {
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

const resolveToneClass = (log: LogEntry) => {
  const rawType =
    (log.type as string | undefined) ??
    (log.level as string | undefined) ??
    (log.status as string | undefined) ??
    ''
  const type = rawType.toLowerCase()

  if (type.includes('error') || type.includes('fail')) {
    return 'text-red-400 border-l-red-500'
  }
  if (type.includes('success') || type.includes('done') || type.includes('complete')) {
    return 'text-emerald-400 border-l-emerald-500'
  }
  if (type.includes('warn') || type.includes('pending')) {
    return 'text-amber-400 border-l-amber-500'
  }
  if (type.includes('info') || type.includes('start')) {
    return 'text-cyan-400 border-l-cyan-500'
  }
  return 'text-gray-300 border-l-gray-600'
}

export function ActivityConsole({ logs, onClear, isActive, onToggle, onWidthChange }: ActivityConsoleProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const consoleRef = useRef<HTMLDivElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const width = 380 // Fixed width, no resizing

  // Notify parent of width changes
  useEffect(() => {
    if (isOpen) {
      onWidthChange?.(isMinimized ? 60 : width)
    } else {
      onWidthChange?.(0)
    }
  }, [isOpen, isMinimized, onWidthChange])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isOpen && !isMinimized && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, isOpen, isMinimized])

  const toggleConsole = () => {
    setIsOpen(!isOpen)
    onToggle?.()
  }

  return (
    <>
      {/* Floating Toggle Button (when closed) */}
      {!isOpen && (
        <button
          onClick={toggleConsole}
          className="group fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-cyan-500/30 transition-all hover:scale-105 hover:shadow-cyan-500/50 hover:from-cyan-500 hover:to-blue-500"
        >
          <Terminal className="h-4 w-4 transition-transform group-hover:rotate-12" />
          Activity Console
          {isActive && (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-500 animate-pulse"></span>
            </span>
          )}
        </button>
      )}

      {/* Console Panel */}
      {isOpen && (
        <div
          ref={consoleRef}
          className="fixed right-0 top-0 z-40 flex h-screen flex-col border-l border-cyan-500/20 bg-gradient-to-br from-gray-900/98 via-gray-800/98 to-gray-900/98 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl transition-all duration-300"
          style={{ width: isMinimized ? '60px' : `${width}px` }}
        >

          {/* Header */}
          <div className="relative flex shrink-0 items-center justify-between border-b border-gray-700/50 bg-gradient-to-r from-gray-800/80 to-gray-900/80 px-4 py-3 backdrop-blur-sm">
            {!isMinimized ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30">
                    <Terminal className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Activity Console</h3>
                    <p className="text-[10px] text-gray-400">Real-time system updates</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isActive && (
                    <div className="flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2 py-1 ring-1 ring-cyan-500/30">
                      <Zap className="h-3 w-3 animate-pulse text-cyan-400" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                        Live
                      </span>
                    </div>
                  )}
                  
                  <button
                    onClick={onClear}
                    className="rounded-lg px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-white"
                    type="button"
                    title="Clear logs"
                  >
                    Clear
                  </button>

                  <button
                    onClick={() => setIsMinimized(true)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-cyan-400"
                    type="button"
                    title="Minimize console"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <button
                    onClick={toggleConsole}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-red-400"
                    type="button"
                    title="Close console"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex w-full flex-col items-center gap-2">
                <button
                  onClick={() => setIsMinimized(false)}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-cyan-400"
                  type="button"
                  title="Expand console"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30">
                  <Terminal className="h-4 w-4 text-white" />
                </div>
                {isActive && (
                  <div className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-500"></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Logs Container */}
          {!isMinimized && (
            <div className="relative flex-1 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="flex h-full items-center justify-center p-8">
                  <div className="text-center">
                    <Terminal className="mx-auto mb-3 h-12 w-12 text-gray-600 animate-pulse" />
                    <p className="text-sm font-medium text-gray-400">No activity yet</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Logs will appear here when you start a job search
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5 p-3">
                  {logs.map((log, index) => (
                    <div
                      key={log.id ?? `${log.timestamp}-${index}`}
                      className={cn(
                        'group relative animate-in fade-in slide-in-from-right-2 duration-300 rounded-lg border-l-2 bg-gray-800/40 px-3 py-2 text-xs font-mono leading-relaxed transition-all hover:bg-gray-800/60 hover:border-l-4',
                        resolveToneClass(log)
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {log.emoji && (
                          <span className="flex-shrink-0 text-base leading-none animate-in zoom-in duration-200">
                            {log.emoji}
                          </span>
                        )}
                        <div className="flex-1">
                          <span className="text-[10px] text-gray-500">
                            {resolveTimestamp(log.timestamp)}
                          </span>
                          <p className="mt-0.5">{resolveMessage(log)}</p>
                        </div>
                      </div>
                      
                      {/* Subtle glow effect on hover */}
                      <div className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/5 to-blue-500/5" />
                      </div>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}

              {/* Gradient fade at bottom */}
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-900/98 to-transparent" />
            </div>
          )}

          {/* Footer Stats */}
          {!isMinimized && (
            <div className="shrink-0 border-t border-gray-700/50 bg-gray-800/50 px-4 py-2 backdrop-blur-sm">
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span className="font-medium">{logs.length} {logs.length === 1 ? 'event' : 'events'}</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-medium text-emerald-400">Connected</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}


import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  Info,
  Loader2,
  Microscope,
  Pencil,
  Search,
  Sparkles,
  Terminal,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtHeader, ChainOfThoughtStep } from './ui/chain-of-thought'

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

const resolveLogVisual = (
  log: LogEntry,
  message: string
): { icon: LucideIcon; iconClassName?: string } => {
  const rawType =
    (log.type as string | undefined) ??
    (log.level as string | undefined) ??
    (log.status as string | undefined) ??
    ''
  const type = rawType.toLowerCase()
  const text = message.toLowerCase()

  const matches = (...keywords: string[]) =>
    keywords.some((keyword) => type.includes(keyword) || text.includes(keyword))

  if (matches('error', 'fail', 'failed', 'fatal')) {
    return { icon: AlertTriangle, iconClassName: 'text-red-400' }
  }
  if (matches('success', 'done', 'complete', 'completed', 'finished')) {
    return { icon: CheckCircle2, iconClassName: 'text-emerald-400' }
  }
  if (matches('warn', 'caution', 'alert')) {
    return { icon: AlertTriangle, iconClassName: 'text-amber-400' }
  }
  if (matches('pending', 'loading', 'waiting', 'queued')) {
    return { icon: Loader2, iconClassName: 'text-amber-300 animate-spin' }
  }
  if (matches('search', 'lookup', 'query', 'discover', 'scan', 'explore')) {
    return { icon: Search, iconClassName: 'text-sky-300' }
  }
  if (matches('scrap', 'crawl', 'fetch data', 'http', 'request', 'spider')) {
    return { icon: Pencil, iconClassName: 'text-blue-300' }
  }
  if (matches('extract', 'parse', 'collect', 'ingest', 'pull', 'harvest')) {
    return { icon: Pencil, iconClassName: 'text-blue-300' }
  }
  if (matches('analyz', 'analyse', 'inspect', 'interpret', 'reason about', 'diagnos')) {
    return { icon: Microscope, iconClassName: 'text-amber-300' }
  }
  if (matches('evaluate', 'score', 'rank', 'assess', 'compare', 'measure')) {
    return { icon: BarChart3, iconClassName: 'text-emerald-300' }
  }
  if (matches('validate', 'verify', 'confirm', 'check', 'test', 'experiment')) {
    return { icon: FlaskConical, iconClassName: 'text-rose-300' }
  }
  if (matches('generate', 'compose', 'draft', 'synthesiz', 'write', 'produce', 'create')) {
    return { icon: Sparkles, iconClassName: 'text-fuchsia-300' }
  }
  if (matches('final', 'ready', 'prepared', 'saved', 'complete output')) {
    return { icon: ClipboardCheck, iconClassName: 'text-emerald-300' }
  }

  if (type.includes('info') || type.includes('start') || type.includes('init')) {
    return { icon: Info, iconClassName: 'text-cyan-300' }
  }

  return { icon: Sparkles, iconClassName: 'text-white/70' }
}

export function ActivityConsole({ logs, onClear, isActive, onToggle, onWidthChange }: ActivityConsoleProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [width, setWidth] = useState(380) // Dynamic width, resizable
  const [isResizing, setIsResizing] = useState(false)
  const consoleRef = useRef<HTMLDivElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const resizeStartX = useRef<number>(0)
  const resizeStartWidth = useRef<number>(380)

  // Handle resize mouse down
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = width
  }

  // Handle resize mouse move
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = resizeStartX.current - e.clientX // Inverted because sidebar is on right
      // Calculate max width to ensure at least 600px remains for main content
      const viewportWidth = window.innerWidth
      const maxConsoleWidth = Math.min(800, viewportWidth - 600) // Leave at least 600px for content
      const newWidth = Math.max(200, Math.min(maxConsoleWidth, resizeStartWidth.current + deltaX))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // Prevent text selection and set cursor during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Recalculate max width on window resize to ensure console doesn't overlap content
  useEffect(() => {
    const handleResize = () => {
      const viewportWidth = window.innerWidth
      const maxConsoleWidth = Math.min(800, viewportWidth - 600)
      
      // Auto-minimize if viewport is too small (less than 900px)
      if (viewportWidth < 900 && !isMinimized) {
        setIsMinimized(true)
      }
      
      // Allow expansion if viewport is large enough
      if (viewportWidth >= 900 && isMinimized && isOpen) {
        // Don't auto-expand, let user manually expand
      }
      
      if (width > maxConsoleWidth) {
        setWidth(Math.max(280, maxConsoleWidth)) // Ensure minimum usable width
      }
    }
    
    // Run on mount
    handleResize()
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [width, isMinimized, isOpen])

  // Notify parent of width changes
  useEffect(() => {
    if (isOpen) {
      onWidthChange?.(isMinimized ? 60 : width)
    } else {
      onWidthChange?.(0)
    }
  }, [isOpen, isMinimized, width, onWidthChange])

  // Reset console width on unmount to prevent layout issues on other pages
  useEffect(() => {
    return () => {
      onWidthChange?.(0)
    }
  }, [onWidthChange])

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
          className={`fixed right-0 top-0 z-40 flex h-screen flex-col border-l border-cyan-500/20 bg-gradient-to-br from-gray-900/98 via-gray-800/98 to-gray-900/98 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl ${
            isResizing ? '' : 'transition-all duration-300'
          }`}
          style={{ width: isMinimized ? '60px' : `${width}px` }}
        >
          {/* Resize Handle */}
          {!isMinimized && (
            <div
              onMouseDown={handleResizeStart}
              className={`absolute left-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-cyan-500/40 transition-colors z-50 ${
                isResizing ? 'bg-cyan-500/60' : ''
              }`}
              style={{ cursor: 'col-resize' }}
              title={`Drag to resize (min: 200px, max: ${Math.min(800, window.innerWidth - 600)}px)`}
            >
              <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-16 rounded-full transition-opacity ${
                isResizing ? 'bg-cyan-400/80' : 'bg-cyan-400/20'
              }`} />
            </div>
          )}

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
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
                <div className="p-3 pb-20">
                  <ChainOfThought defaultOpen className="space-y-0">
                    <ChainOfThoughtHeader>Assistant reasoning</ChainOfThoughtHeader>
                    <ChainOfThoughtContent className="space-y-0">
                      {logs.map((log, index) => {
                        const message = resolveMessage(log)
                        // Remove timestamp from meta - only show log type/level if available
                        const meta = [
                          (log.type as string | undefined) ?? (log.level as string | undefined),
                        ]
                          .filter(Boolean)
                          .join(' • ')

                        const { icon, iconClassName } = resolveLogVisual(log, message)

                        return (
                          <ChainOfThoughtStep
                            key={log.id ?? `${log.timestamp}-${index}`}
                            status={index === logs.length - 1 ? 'active' : 'complete'}
                            icon={icon}
                            iconClassName={iconClassName}
                            className="text-sm leading-relaxed"
                            label={
                              <div className="flex items-start gap-2">
                                <span className="whitespace-pre-wrap break-words text-foreground">
                                  {message}
                                </span>
                              </div>
                            }
                            description={meta || undefined}
                          />
                        )
                      })}
                      <div ref={logsEndRef} className="h-8" />
                    </ChainOfThoughtContent>
                  </ChainOfThought>
                </div>
              )}
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


import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../utils/api'

export default function VerboseLogger({ active = true }) {
  const [logs, setLogs] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const logsEndRef = useRef(null)
  const eventSourceRef = useRef(null)

  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [logs, autoScroll])

  useEffect(() => {
    if (!active) return

    // Connect to SSE endpoint using fetch stream (supports auth headers)
    const connectSSE = async () => {
      try {
        const { getSessionToken } = await import('../utils/supabase')
        const token = await getSessionToken()
        
        if (!token) {
          console.error('No auth token available for verbose logger')
          setIsConnected(false)
          return
        }
        
        // Use fetch for streaming since EventSource doesn't support headers
        const response = await fetch(`${API_BASE_URL}/api/v1/verbose/stream`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
          },
          credentials: 'include'
        })
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText)
          console.error(`SSE connection failed: ${response.status} ${errorText}`)
          setIsConnected(false)
          // Try to reconnect after 3 seconds
          setTimeout(() => {
            if (active) {
              connectSSE()
            }
          }, 3000)
          return
        }
        
        setIsConnected(true)
        console.log('✅ Verbose logger connected')
        
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        
        const readStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read()
              
              if (done) {
                setIsConnected(false)
                break
              }
              
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const logEntry = JSON.parse(line.slice(6))
                    setLogs(prev => [...prev, logEntry])
                  } catch (error) {
                    console.error('Error parsing log entry:', error, line)
                    // Ignore parse errors for non-JSON lines (like heartbeat)
                  }
                } else if (line.trim() === ': heartbeat' || line.trim() === 'heartbeat') {
                  // Heartbeat received, connection is alive
                  // Could update a last heartbeat timestamp if needed
                }
              }
            }
          } catch (error) {
            console.error('Error reading stream:', error)
            setIsConnected(false)
            // Try to reconnect after 3 seconds
            setTimeout(() => {
              if (active) {
                console.log('🔄 Attempting to reconnect verbose logger...')
                connectSSE()
              }
            }, 3000)
          }
        }
        
        // Start reading the stream
        readStream().catch(error => {
          console.error('Stream read error:', error)
          setIsConnected(false)
          setTimeout(() => {
            if (active) {
              console.log('🔄 Attempting to reconnect verbose logger...')
              connectSSE()
            }
          }, 3000)
        })
        
        // Store connection for cleanup
        eventSourceRef.current = { close: () => reader.cancel() }
      } catch (error) {
        console.error('Error connecting to verbose logger:', error)
        setIsConnected(false)
      }
    }

    connectSSE()

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setIsConnected(false)
    }
  }, [active])

  const getLevelColor = (level) => {
    switch (level) {
      case 'success':
        return 'text-green-400'
      case 'warning':
        return 'text-yellow-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-cyan-400'
    }
  }

  const getLevelBg = (level) => {
    switch (level) {
      case 'success':
        return 'bg-green-500/10 border-green-500/30'
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30'
      case 'error':
        return 'bg-red-500/10 border-red-500/30'
      default:
        return 'bg-cyan-500/10 border-cyan-500/30'
    }
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }

  return (
    <div className="flex flex-col bg-gray-900 rounded-lg border border-cyan-500/20 overflow-hidden shadow-2xl h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-900/50 to-blue-900/50 border-b border-cyan-500/30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          <h3 className="text-sm font-mono font-semibold text-cyan-300 tracking-wider">
            AGENTIC PROCESSING LOG
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 text-xs font-mono rounded ${autoScroll ? 'bg-cyan-500/20 text-cyan-300' : 'bg-gray-700 text-gray-400'}`}
          >
            {autoScroll ? 'AUTO' : 'MANUAL'}
          </button>
          <button
            onClick={() => setLogs([])}
            className="px-2 py-1 text-xs font-mono rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
          >
            CLEAR
          </button>
        </div>
      </div>

      {/* Logs Container - Fixed height with scrolling */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2 scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-gray-800 min-h-0">
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="animate-pulse text-cyan-400/50">Waiting for logs...</div>
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={`p-2 rounded border-l-2 ${getLevelBg(log.level)} ${getLevelColor(log.level)} transition-all duration-200 hover:bg-opacity-20`}
            >
              <div className="flex items-start gap-2">
                <span className="text-gray-500 text-[10px] font-mono shrink-0 w-16">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className="text-lg shrink-0">{log.emoji || '•'}</span>
                <span className="flex-1 break-words">
                  {log.message}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-2 bg-gray-800/50 border-t border-cyan-500/20 text-xs font-mono text-gray-400 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span>Logs: {logs.length}</span>
          <span>Status: {isConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
        </div>
      </div>
    </div>
  )
}


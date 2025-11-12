import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '../utils/api'

export function JobContextModal({ jobUrl, buttonText = "View Job Context", buttonClassName = "" }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMiniView, setIsMiniView] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [jobContext, setJobContext] = useState(null)
  const [loading, setLoading] = useState(false)
  const [miniPosition, setMiniPosition] = useState({ x: 24, y: 24 })
  const [miniSize, setMiniSize] = useState({ width: 340, height: 420 })
  const margin = 8
  const miniViewRef = useRef(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragPointerIdRef = useRef(null)
  const dragPointerTargetRef = useRef(null)
  const isResizingRef = useRef(false)
  const resizeStartSizeRef = useRef({ width: 340, height: 420 })
  const resizeStartPointerRef = useRef({ x: 0, y: 0 })
  const miniSizeRef = useRef({ width: 340, height: 420 })
  const miniPositionRef = useRef({ x: 24, y: 24 })

  useEffect(() => {
    miniSizeRef.current = miniSize
  }, [miniSize])

  useEffect(() => {
    miniPositionRef.current = miniPosition
  }, [miniPosition])

  const fetchJobContext = useCallback(async () => {
    if (!jobUrl || loading || jobContext) return

    setLoading(true)
    try {
      const result = await apiRequest(`/api/v1/job-context?job_url=${encodeURIComponent(jobUrl)}`, {
        method: 'GET'
      })

      if (result.success && result.context) {
        setJobContext(result.context)
      }
    } catch (error) {
      console.error('Error fetching job context:', error)
    } finally {
      setLoading(false)
    }
  }, [jobContext, jobUrl, loading])

  const handleMiniDragMove = useCallback(
    (event) => {
      if (!isDraggingRef.current) return
      if (typeof window === 'undefined') return

      event.preventDefault()

      const width = miniSizeRef.current.width
      const height = miniSizeRef.current.height

      const maxLeft = Math.max(margin, window.innerWidth - width - margin)
      const maxTop = Math.max(margin, window.innerHeight - height - margin)

      const newX = event.clientX - dragOffsetRef.current.x
      const newY = event.clientY - dragOffsetRef.current.y

      setMiniPosition({
        x: Math.min(Math.max(margin, newX), maxLeft),
        y: Math.min(Math.max(margin, newY), maxTop),
      })
    },
    [margin]
  )

  const stopDragging = useCallback((event) => {
    if (typeof window === 'undefined') return
    window.removeEventListener('pointermove', handleMiniDragMove)
    window.removeEventListener('pointerup', stopDragging)

    const activePointerId = event?.pointerId ?? dragPointerIdRef.current
    const pointerTarget = dragPointerTargetRef.current

    if (pointerTarget instanceof Element && typeof activePointerId === 'number') {
      try {
        pointerTarget.releasePointerCapture(activePointerId)
      } catch (_error) {
        // ignore
      }
    }

    dragPointerIdRef.current = null
    dragPointerTargetRef.current = null
    isDraggingRef.current = false
    setIsDragging(false)
  }, [handleMiniDragMove])

  const handleMiniDragStart = useCallback(
    (event) => {
      if (!miniViewRef.current || (event.target instanceof HTMLElement && event.target.closest('button'))) {
        return
      }
      if (typeof window === 'undefined') return

      event.preventDefault()
      dragOffsetRef.current = {
        x: event.clientX - miniPositionRef.current.x,
        y: event.clientY - miniPositionRef.current.y,
      }
      dragPointerIdRef.current = event.pointerId
      dragPointerTargetRef.current = event.currentTarget
      if (event.currentTarget instanceof Element) {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      isDraggingRef.current = true
      setIsDragging(true)

      window.addEventListener('pointermove', handleMiniDragMove)
      window.addEventListener('pointerup', stopDragging)
    },
    [handleMiniDragMove, stopDragging]
  )

  const handleResizeMove = useCallback(
    (event) => {
      if (!isResizingRef.current) return
      if (typeof window === 'undefined') return

      event.preventDefault()
      const deltaX = event.clientX - resizeStartPointerRef.current.x
      const deltaY = event.clientY - resizeStartPointerRef.current.y

      const minWidth = 260
      const minHeight = 280
      const maxWidth = window.innerWidth - 48
      const maxHeight = window.innerHeight - 48

      const nextWidth = Math.min(
        Math.max(minWidth, resizeStartSizeRef.current.width + deltaX),
        maxWidth
      )
      const nextHeight = Math.min(
        Math.max(minHeight, resizeStartSizeRef.current.height + deltaY),
        maxHeight
      )

      setMiniSize({ width: nextWidth, height: nextHeight })
      setMiniPosition((prev) => {
        const maxLeft = Math.max(margin, window.innerWidth - nextWidth - margin)
        const maxTop = Math.max(margin, window.innerHeight - nextHeight - margin)

        return {
          x: Math.min(Math.max(margin, prev.x), maxLeft),
          y: Math.min(Math.max(margin, prev.y), maxTop),
        }
      })
    },
    [margin]
  )

  const stopResizing = useCallback(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('pointermove', handleResizeMove)
    window.removeEventListener('pointerup', stopResizing)
    isResizingRef.current = false
  }, [handleResizeMove])

  const handleResizeStart = useCallback(
    (event) => {
      if (typeof window === 'undefined') return
      event.preventDefault()
      isResizingRef.current = true
      resizeStartSizeRef.current = { ...miniSize }
      resizeStartPointerRef.current = { x: event.clientX, y: event.clientY }

      window.addEventListener('pointermove', handleResizeMove)
      window.addEventListener('pointerup', stopResizing)
    },
    [handleResizeMove, miniSize, stopResizing]
  )

  const handleOpen = () => {
    setIsOpen(true)
    setIsMiniView(false)
    if (!jobContext) {
      fetchJobContext()
    }
  }

  const handleClose = () => {
    stopDragging()
    stopResizing()
    setIsOpen(false)
    setIsMiniView(false)
  }

  const handleViewForEditing = () => {
    if (!jobContext) {
      fetchJobContext()
    }
    setIsMiniView(true)
    setIsOpen(false)
  }

  const handleMiniClose = () => {
    stopDragging()
    stopResizing()
    setIsMiniView(false)
  }

  const handleMiniExpand = () => {
    setIsMiniView(false)
    setIsOpen(true)
  }

  useEffect(() => {
    return () => {
      stopDragging()
      stopResizing()
    }
  }, [stopDragging, stopResizing])

  useEffect(() => {
    if (!isMiniView) {
      stopDragging()
      stopResizing()
    }
  }, [isMiniView, stopDragging, stopResizing])

  if (!jobUrl) return null

  return (
    <>
      {/* Button to open modal */}
      <button
        onClick={handleOpen}
        className={buttonClassName || "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"}
      >
        📋 {buttonText}
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-[6px] bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <div
            className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl"
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-700 p-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                📋 Job Context
              </h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="ml-3 text-gray-400">Loading job context...</p>
                </div>
              ) : jobContext ? (
                <div className="space-y-6">
                  {/* Job Info */}
                  {(jobContext.title || jobContext.company) && (
                    <div className="pb-4 border-b border-gray-700">
                      {jobContext.title && (
                        <h3 className="text-lg font-semibold text-white mb-1">{jobContext.title}</h3>
                      )}
                      {jobContext.company && (
                        <p className="text-gray-400">{jobContext.company}</p>
                      )}
                      {jobContext.employment_type && (
                        <span className="inline-block mt-2 px-3 py-1 bg-blue-900/30 text-blue-300 text-xs rounded-full">
                          {jobContext.employment_type}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Requirements */}
                  {jobContext.requirements?.length > 0 && (
                    <div>
                      <h4 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                        ✅ Requirements
                      </h4>
                      <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                        {jobContext.requirements.map((req, idx) => (
                          <li key={idx} className="leading-relaxed">{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Technologies */}
                  {jobContext.technologies?.length > 0 && (
                    <div>
                      <h4 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                        💻 Technologies
                      </h4>
                      <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                        {jobContext.technologies.map((tech, idx) => (
                          <li key={idx} className="leading-relaxed">{tech}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Responsibilities */}
                  {jobContext.responsibilities?.length > 0 && (
                    <div>
                      <h4 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                        🎯 Responsibilities
                      </h4>
                      <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                        {jobContext.responsibilities.map((resp, idx) => (
                          <li key={idx} className="leading-relaxed">{resp}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Empty State */}
                  {(!jobContext.requirements || jobContext.requirements.length === 0) &&
                   (!jobContext.technologies || jobContext.technologies.length === 0) &&
                   (!jobContext.responsibilities || jobContext.responsibilities.length === 0) && (
                    <div className="text-center py-8">
                      <p className="text-gray-400">No job context available for this position.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">No job context available.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-700 p-6">
              <button
                onClick={handleViewForEditing}
                className="text-sm font-medium text-blue-300 underline underline-offset-2 transition-colors hover:text-blue-200"
                type="button"
              >
                View for Editing
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isMiniView && (
        <div
          ref={miniViewRef}
          className="fixed z-50 flex max-w-[90vw] flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900/95 shadow-2xl backdrop-blur-lg"
          style={{
            top: miniPosition.y,
            left: miniPosition.x,
            width: miniSize.width,
            height: miniSize.height,
          }}
        >
          <div
            className={`flex items-center justify-between gap-3 border-b border-gray-800 bg-gray-800/70 px-4 py-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onPointerDown={handleMiniDragStart}
          >
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              📋 Job Context
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMiniExpand}
                className="text-xs font-medium text-blue-300 underline underline-offset-2 transition-colors hover:text-blue-200"
                type="button"
              >
                Expand
              </button>
              <button
                onClick={handleMiniClose}
                className="rounded-md p-1 transition-colors hover:bg-gray-700/70"
                type="button"
                aria-label="Close mini job context"
              >
                <X className="h-4 w-4 text-gray-300" />
              </button>
            </div>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto p-4 text-sm text-gray-200">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-gray-400">
                  Loading job context...
                </div>
              ) : jobContext ? (
                <div className="space-y-4">
                  {(jobContext.title || jobContext.company) && (
                    <div className="space-y-1">
                      {jobContext.title && <p className="font-semibold">{jobContext.title}</p>}
                      {jobContext.company && <p className="text-gray-400">{jobContext.company}</p>}
                    </div>
                  )}

                  {jobContext.requirements?.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-300">Requirements</p>
                      <ul className="mt-1 space-y-1 text-gray-400">
                        {jobContext.requirements.map((req, idx) => (
                          <li key={idx}>• {req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {jobContext.technologies?.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-300">Technologies</p>
                      <ul className="mt-1 space-y-1 text-gray-400">
                        {jobContext.technologies.map((tech, idx) => (
                          <li key={idx}>• {tech}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {jobContext.responsibilities?.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-300">Responsibilities</p>
                      <ul className="mt-1 space-y-1 text-gray-400">
                        {jobContext.responsibilities.map((resp, idx) => (
                          <li key={idx}>• {resp}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!jobContext.requirements?.length &&
                    !jobContext.technologies?.length &&
                    !jobContext.responsibilities?.length && (
                      <p className="text-gray-400">No additional context available.</p>
                    )}
                </div>
              ) : (
                <p className="text-gray-400">No job context available.</p>
              )}
            </div>
            <div
              className="absolute bottom-1 right-1 h-5 w-5 cursor-se-resize rounded-sm border border-gray-600/40 bg-gray-700/40"
              onPointerDown={(event) => {
                event.stopPropagation()
                handleResizeStart(event)
              }}
              aria-hidden="true"
            />
          </div>
        </div>
      )}
    </>
  )
}


import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { apiRequest } from '../utils/api'

export function JobContextModal({ jobUrl, buttonText = "View Job Context", buttonClassName = "" }) {
  const [isOpen, setIsOpen] = useState(false)
  const [jobContext, setJobContext] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchJobContext = async () => {
    if (!jobUrl || jobContext) return

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
  }

  const handleOpen = () => {
    setIsOpen(true)
    if (!jobContext) {
      fetchJobContext()
    }
  }

  const handleClose = () => {
    setIsOpen(false)
  }

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
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Modal Content */}
          <div 
            className="bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
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
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
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
            <div className="p-6 border-t border-gray-700 flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


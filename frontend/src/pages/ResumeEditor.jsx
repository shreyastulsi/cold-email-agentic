import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../utils/api'

export default function ResumeEditor() {
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [lastSaved, setLastSaved] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Upload state
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    loadResumeContent()
  }, [])

  useEffect(() => {
    // Check if content has changed from original
    setHasChanges(content !== originalContent)
  }, [content, originalContent])

  const loadResumeContent = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await apiRequest('/api/v1/resume/content')
      setContent(result.content || '')
      setOriginalContent(result.content || '')
      setLastSaved(result.updated_at || result.created_at)
      setShowUpload(false)
    } catch (error) {
      if (error.response?.status === 404) {
        // No resume content - show upload UI
        setShowUpload(true)
        setError(null)
      } else {
        setError(error.message || 'Failed to load resume content')
      }
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file')
        setFile(null)
        return
      }
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size must be less than 10MB')
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError(null)
      setUploadStatus(null)
    }
  }
  
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload')
      return
    }

    setUploading(true)
    setError(null)
    setUploadStatus(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
      
      // Get auth token helper
      const getAuthToken = async () => {
        try {
          const { getSessionToken } = await import('../utils/supabase')
          return await getSessionToken()
        } catch (error) {
          console.error('Error getting auth token:', error)
          return null
        }
      }
      
      const token = await getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/api/v1/resume/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }))
        throw new Error(errorData.detail || 'Upload failed')
      }

      const result = await response.json()
      setUploadStatus('success')
      setFile(null)
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]')
      if (fileInput) fileInput.value = ''
      
      // Reload resume content after upload
      if (result.content_extracted) {
        setTimeout(() => {
          loadResumeContent()
        }, 2000)
      } else {
        setTimeout(() => setUploadStatus(null), 3000)
      }
    } catch (error) {
      setError(error.message || 'Failed to upload resume')
      setUploadStatus('error')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!hasChanges) {
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const result = await apiRequest('/api/v1/resume/content', {
        method: 'PUT',
        body: JSON.stringify({ content })
      })
      
      setOriginalContent(content)
      setHasChanges(false)
      setLastSaved(result.updated_at || new Date().toISOString())
      
      // Show success message briefly
      const successMsg = document.createElement('div')
      successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      successMsg.textContent = '✅ Resume content saved successfully!'
      document.body.appendChild(successMsg)
      setTimeout(() => {
        document.body.removeChild(successMsg)
      }, 3000)
    } catch (error) {
      setError(error.message || 'Failed to save resume content')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (window.confirm('Are you sure you want to discard all changes and revert to the last saved version?')) {
      setContent(originalContent)
      setHasChanges(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete your resume content? This will clear all extracted bullets. You can upload a new resume to replace it.')) {
      return
    }

    setIsDeleting(true)
    setError(null)
    try {
      await apiRequest('/api/v1/resume/content', {
        method: 'DELETE'
      })
      
      setContent('')
      setOriginalContent('')
      setHasChanges(false)
      setLastSaved(null)
      setShowUpload(true) // Show upload UI after deletion
      
      // Show success message briefly
      const successMsg = document.createElement('div')
      successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      successMsg.textContent = '✅ Resume content deleted successfully!'
      document.body.appendChild(successMsg)
      setTimeout(() => {
        document.body.removeChild(successMsg)
      }, 3000)
    } catch (error) {
      setError(error.message || 'Failed to delete resume content')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-300">Loading resume content...</p>
        </div>
      </div>
    )
  }

  // Show upload UI when no resume exists
  if (showUpload && !content) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">📄 Resume Upload</h1>
            <p className="text-gray-300">
              Upload your resume PDF to extract key bullets. The extracted content will appear here for editing.
            </p>
          </div>
          
          <div className="rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-6 shadow-lg">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload Your Resume (PDF)
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={uploading}
                    />
                    <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-gray-700/50 p-4 hover:border-blue-500 transition-colors bg-gray-900/30">
                      <span className="text-sm text-gray-300">
                        {file ? file.name : 'Choose a PDF file'}
                      </span>
                      <span className="text-sm text-blue-400 hover:text-blue-300">
                        Browse
                      </span>
                    </div>
                  </label>
                </div>
                
                {file && (
                  <div className="mt-2 text-xs text-gray-400">
                    File: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-red-900/50 border border-red-700/50 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {uploadStatus === 'success' && (
                <div className="rounded-lg bg-green-900/50 border border-green-700/50 p-3 text-sm text-green-300">
                  ✅ Resume uploaded successfully!
                  <br />
                  <span className="text-xs text-green-400 mt-1 block">
                    Extracting content... This may take a moment.
                  </span>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload Resume'}
              </button>

              <div className="rounded-lg bg-yellow-900/50 border border-yellow-700/50 p-3 mt-4">
                <p className="text-xs text-yellow-300 font-medium mb-1">⚠️ Note:</p>
                <p className="text-xs text-yellow-200">
                  Uploading a new resume will replace your existing resume content. The old extracted bullets will be replaced with new ones from the uploaded PDF.
                </p>
              </div>
              
              <div className="text-xs text-gray-400 mt-4">
                <p className="text-gray-300">💡 Your resume will be used to:</p>
                <ul className="list-disc list-inside mt-1 space-y-1 ml-2 text-gray-400">
                  <li>Extract 7-8 key bullets using AI</li>
                  <li>Filter jobs by relevance to your background</li>
                  <li>Generate personalized messages for recruiters</li>
                  <li>Match you with the most relevant opportunities</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">📄 Resume Key Bullets Editor</h1>
            <p className="mt-2 text-gray-300">
              Edit your extracted resume key bullets. This version will be used for all message generation and job filtering.
            </p>
            {lastSaved && (
              <p className="mt-1 text-sm text-gray-400">
                Last saved: {new Date(lastSaved).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/dashboard/search')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Go to Search →
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-4 py-2 text-gray-200 hover:bg-gray-700/50"
            >
              Upload New Resume
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-900/50 border border-red-700/50 p-4">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Save/Reset/Delete Buttons */}
        <div className="mb-4 flex items-center justify-between bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving || !content}
              className={`rounded-lg px-6 py-2 text-white font-medium transition-colors ${
                hasChanges && !isSaving && content
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Saving...' : hasChanges ? '💾 Save Changes' : '✅ Saved'}
            </button>
            {hasChanges && content && (
              <button
                onClick={handleReset}
                className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-4 py-2 text-gray-200 hover:bg-gray-700/50"
              >
                Reset
              </button>
            )}
            {content && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : '🗑️ Delete Resume'}
              </button>
            )}
            {hasChanges && (
              <span className="text-sm text-orange-400">⚠️ You have unsaved changes</span>
            )}
          </div>
          <div className="text-sm text-gray-400">
            {content.length} characters
          </div>
        </div>

        {/* Upload Section (when showUpload is true) */}
        {showUpload && (
          <div className="mb-6 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Upload New Resume</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="text-sm text-gray-400 hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload Your Resume (PDF)
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={uploading}
                    />
                    <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-gray-700/50 p-4 hover:border-blue-500 transition-colors bg-gray-900/30">
                      <span className="text-sm text-gray-300">
                        {file ? file.name : 'Choose a PDF file'}
                      </span>
                      <span className="text-sm text-blue-400 hover:text-blue-300">
                        Browse
                      </span>
                    </div>
                  </label>
                </div>
                
                {file && (
                  <div className="mt-2 text-xs text-gray-400">
                    File: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </div>
                )}
              </div>

              {uploadStatus === 'success' && (
                <div className="rounded-lg bg-green-900/50 border border-green-700/50 p-3 text-sm text-green-300">
                  ✅ Resume uploaded successfully! Reloading content...
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : 'Upload Resume'}
                </button>
                <button
                  onClick={() => {
                    setShowUpload(false)
                    setFile(null)
                    setError(null)
                    setUploadStatus(null)
                  }}
                  className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-4 py-2 text-gray-200 hover:bg-gray-700/50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 shadow-lg">
          <div className="border-b border-gray-700/50 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Extracted Resume Key Bullets</h2>
            <p className="text-sm text-gray-400 mt-1">
              These are the key bullets extracted from your PDF resume using AI. You can edit them to improve accuracy or add custom information.
            </p>
          </div>
          {content ? (
            <div className="p-6">
              <textarea
                className="w-full min-h-[600px] rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-mono text-sm focus:border-blue-500 focus:outline-none resize-y"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Upload a resume PDF to extract key bullets. The extracted bullets will appear here for editing."
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="p-6 text-center text-gray-400">
              <p className="mb-4">No resume content found.</p>
              <button
                onClick={() => setShowUpload(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Upload Resume PDF
              </button>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 rounded-lg bg-blue-900/50 border border-blue-700/50 p-4">
          <h3 className="font-semibold text-blue-300 mb-2">💡 About Resume Key Bullets</h3>
          <ul className="text-sm text-blue-200 space-y-1 list-disc list-inside">
            <li>These are the 7-8 most important points extracted from your uploaded PDF resume using AI</li>
            <li>The bullets include: Education, Technical Skills, Work Experience, Projects, Certifications, and other highlights</li>
            <li>You can edit them to correct any extraction errors or add additional information</li>
            <li>This edited version will be used for all LinkedIn messages, emails, and job filtering</li>
            <li>Changes are saved permanently and used across all outreach activities</li>
            <li>You can re-upload your PDF at any time to regenerate the bullets</li>
          </ul>
        </div>
      </div>
    </div>
  )
}


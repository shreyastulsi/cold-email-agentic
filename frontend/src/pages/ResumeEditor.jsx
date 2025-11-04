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
    } catch (error) {
      if (error.response?.status === 404) {
        setError('No resume content found. Please upload a resume first.')
      } else {
        setError(error.message || 'Failed to load resume content')
      }
    } finally {
      setIsLoading(false)
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

  if (error && error.includes('No resume content found')) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg bg-yellow-900/50 border border-yellow-700/50 p-6 text-center">
            <h2 className="text-xl font-semibold text-yellow-300 mb-2">No Resume Content Found</h2>
            <p className="text-yellow-400 mb-4">
              Please upload a resume first. After uploading, the extracted content will appear here for editing.
            </p>
            <button
              onClick={() => navigate('/settings')}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
            >
              Go to Upload Resume
            </button>
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
              onClick={() => navigate('/search')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Go to Search →
            </button>
            <button
              onClick={() => navigate('/settings')}
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
                onClick={() => navigate('/settings')}
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


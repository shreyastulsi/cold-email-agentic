import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { FileUpload } from '../components/ui/file-upload'
import { apiRequest, API_BASE_URL } from '../utils/api'

export default function ResumeEditor() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [lastSaved, setLastSaved] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
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
  
  const handleFileChange = (files) => {
    if (files && files.length > 0) {
      const selectedFile = files[0]
      setFile(selectedFile)
      setError(null)
      setUploadStatus(null)
    }
  }

  const handleFileError = (errorMessage) => {
    setError(errorMessage)
    setFile(null)
    setUploadStatus(null)
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
      queryClient.invalidateQueries({ queryKey: ['onboardingStatus'] })
      
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
      setIsEditing(false)
      setLastSaved(result.updated_at || new Date().toISOString())
      queryClient.invalidateQueries({ queryKey: ['onboardingStatus'] })
      
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

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Discard changes and exit edit mode?')) {
        setContent(originalContent)
        setHasChanges(false)
        setIsEditing(false)
      }
    } else {
      setIsEditing(false)
    }
  }

  // Parse markdown-style formatting (like **bold**) and render as HTML
  const renderFormattedText = (text) => {
    if (!text) return 'N/A'
    
    // Trim trailing whitespace and split by lines
    const trimmedText = text.trimEnd()
    const lines = trimmedText.split('\n')
    
    // Filter out empty lines at the end
    let lastNonEmptyIndex = lines.length - 1
    while (lastNonEmptyIndex >= 0 && lines[lastNonEmptyIndex].trim() === '') {
      lastNonEmptyIndex--
    }
    const processedLines = lines.slice(0, lastNonEmptyIndex + 1)
    
    return processedLines.map((line, lineIndex) => {
      // Process bold markers **text** in each line
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      const processedLine = parts.map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          // Remove the ** markers and make it bold
          const boldText = part.slice(2, -2)
          return <strong key={`${lineIndex}-${partIndex}`} className="font-semibold text-white">{boldText}</strong>
        }
        return <span key={`${lineIndex}-${partIndex}`}>{part}</span>
      })
      
      // Return line with line break (except for the last line)
      return (
        <span key={lineIndex}>
          {processedLine}
          {lineIndex < processedLines.length - 1 && <br />}
        </span>
      )
    })
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
      queryClient.invalidateQueries({ queryKey: ['onboardingStatus'] })
      
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
                {/* <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload Your Resume (PDF)
                </label> */}
                <FileUpload
                  key={uploadStatus === 'success' ? 'upload-success' : 'upload-ready'}
                  onChange={handleFileChange}
                  onError={handleFileError}
                  accept="application/pdf"
                  maxSize={10 * 1024 * 1024}
                />
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

              {file && (
                <Button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  variant="default"
                  className="w-full"
                >
                  {uploading ? 'Uploading...' : 'Upload Resume'}
                </Button>
              )}

              <div className="rounded-lg bg-yellow-900/50 border border-yellow-700/50 p-3 mt-4">
                <p className="text-xs text-yellow-300 font-medium mb-1">⚠️ Note:</p>
                <p className="text-xs text-yellow-200">
                  Uploading a new resume will replace your existing resume content. The old extracted bullets will be replaced with new ones from the uploaded PDF.
                </p>
              </div>
              
              <div className="text-sm text-gray-400 mt-4">
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
            {/* <Button
              onClick={() => navigate('/dashboard/search')}
              variant="default"
            >
              Go to Search →
            </Button> */}
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
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

        {/* Upload Section (when showUpload is true) */}
        {showUpload && (
          <div className="mb-6 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-6 shadow-lg">
            {/* <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Upload New Resume</h2>
              <Button
                onClick={() => setShowUpload(false)}
                variant="ghost"
                size="sm"
              >
                Cancel
              </Button>
            </div> */}
            <div className="space-y-4">
              <div>
                {/* <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload Your Resume (PDF)
                </label> */}
                <FileUpload
                  key={uploadStatus === 'success' ? 'upload-success' : 'upload-ready'}
                  onChange={handleFileChange}
                  onError={handleFileError}
                  accept="application/pdf"
                  maxSize={10 * 1024 * 1024}
                />
              </div>

              {uploadStatus === 'success' && (
                <div className="rounded-lg bg-green-900/50 border border-green-700/50 p-3 text-sm text-green-300">
                  ✅ Resume uploaded successfully! Reloading content...
                </div>
              )}

              <div className="flex gap-3 justify-end">
                {file && (
                  <Button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    variant="default"
                  >
                    {uploading ? 'Uploading...' : 'Upload Resume'}
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setShowUpload(false)
                    setFile(null)
                    setError(null)
                    setUploadStatus(null)
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 shadow-lg relative">
          <div className="border-b border-gray-700/50 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Extracted Resume Key Bullets</h2>
            <p className="text-sm text-gray-400 mt-1">
              These are the key bullets extracted from your PDF resume using AI. You can edit them to improve accuracy or add custom information.
            </p>
          </div>
          {content ? (
            <div className={`p-6 ${isEditing ? 'space-y-3' : 'space-y-0'}`}>
              {isEditing ? (
                <>
                  <textarea
                    className="w-full min-h-[600px] rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-sans text-base focus:border-blue-500 focus:outline-none resize-y"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Upload a resume PDF to extract key bullets. The extracted bullets will appear here for editing."
                    spellCheck={false}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={handleCancelEdit}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={!hasChanges || isSaving}
                      variant="default"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-gray-300 text-base leading-relaxed pb-0 mb-0">
                    {renderFormattedText(content)}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleEdit}
                      variant="outline"
                    >
                      Edit ✏️
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-400">
              <p className="mb-4">No resume content found.</p>
              <Button
                onClick={() => setShowUpload(true)}
                variant="default"
              >
                Upload Resume PDF
              </Button>
            </div>
          )}
        </div>

        {/* Delete Button */}
        {!isEditing && content && (
          <div className="mt-4 flex items-center justify-end">
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? 'Deleting...' : 'Delete Resume 🗑️'}
            </Button>
          </div>
        )}

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


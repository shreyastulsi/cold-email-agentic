import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { FileUpload } from './ui/file-upload'
import { API_BASE_URL } from '../utils/api'

export default function ResumeUpload() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [error, setError] = useState(null)
  const [extractedContent, setExtractedContent] = useState(null)

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
      
      // If content was extracted, redirect to resume editor page
      if (result.content_extracted) {
        // Wait a moment, then redirect to resume editor to review extracted bullets
        setTimeout(() => {
          navigate('/resume')
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

  return (
    <div className="rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Resume Upload</h2>
        <button
          onClick={() => navigate('/search')}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Go to Search →
        </button>
      </div>
      
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
              Old resume content has been replaced. Redirecting to resume editor...
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
  )
}


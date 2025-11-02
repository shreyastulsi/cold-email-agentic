import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../utils/api'

export default function ResumeUpload() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [error, setError] = useState(null)
  const [extractedContent, setExtractedContent] = useState(null)

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
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Resume Upload</h2>
        <button
          onClick={() => navigate('/search')}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Go to Search →
        </button>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
              <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-gray-300 p-4 hover:border-blue-500 transition-colors">
                <span className="text-sm text-gray-600">
                  {file ? file.name : 'Choose a PDF file'}
                </span>
                <span className="text-sm text-blue-600 hover:text-blue-800">
                  Browse
                </span>
              </div>
            </label>
          </div>
          
          {file && (
            <div className="mt-2 text-xs text-gray-500">
              File: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {uploadStatus === 'success' && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
            ✅ Resume uploaded successfully!
            <br />
            <span className="text-xs text-green-700 mt-1 block">
              Old resume content has been replaced. Redirecting to resume editor...
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

        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 mt-4">
          <p className="text-xs text-yellow-800 font-medium mb-1">⚠️ Note:</p>
          <p className="text-xs text-yellow-700">
            Uploading a new resume will replace your existing resume content. The old extracted bullets will be replaced with new ones from the uploaded PDF.
          </p>
        </div>
        
        <div className="text-xs text-gray-500 mt-4">
          <p>💡 Your resume will be used to:</p>
          <ul className="list-disc list-inside mt-1 space-y-1 ml-2">
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


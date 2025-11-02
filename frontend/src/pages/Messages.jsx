import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiRequest } from '../utils/api'
import { trackLinkedInInvite, trackEmailSent } from '../utils/dashboardStats'

// API functions
async function sendLinkedInInvitation(linkedinUrl, message) {
  return apiRequest('/api/v1/outreach/linkedin/send', {
    method: 'POST',
    body: JSON.stringify({
      linkedin_url: linkedinUrl,
      message: message
    })
  })
}

async function sendEmail(to, subject, body) {
  return apiRequest('/api/v1/outreach/email/send', {
    method: 'POST',
    body: JSON.stringify({
      to: to,
      subject: subject,
      body: body
    })
  })
}

export default function Messages() {
  const navigate = useNavigate()
  const location = useLocation()
  const [messages, setMessages] = useState([])
  const [sendingStatus, setSendingStatus] = useState({})
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    // Get messages from location state or localStorage
    const data = location.state?.messages || JSON.parse(localStorage.getItem('outreachMessages') || '[]')
    
    if (data && data.length > 0) {
      // Initialize messages with editable content
      const initializedMessages = data.map(msg => {
        // Handle LinkedIn message - could be string or object with message property
        const linkedinMsg = typeof msg.linkedinMessage === 'string' 
          ? msg.linkedinMessage 
          : msg.linkedinMessage?.message || msg.linkedinMessage || ''
        
        // Handle email - could have different structures
        const emailSubject = msg.email?.subject || msg.email?.Subject || ''
        const emailBody = msg.email?.body || msg.email?.Body || msg.email?.content || msg.email?.Content || msg.email || ''
        
        return {
          ...msg,
          editedLinkedInMessage: linkedinMsg,
          editedEmailSubject: emailSubject,
          editedEmailBody: typeof emailBody === 'string' ? emailBody : JSON.stringify(emailBody)
        }
      })
      setMessages(initializedMessages)
    } else {
      // No messages found, redirect to search
      navigate('/search')
    }
  }, [location, navigate])

  const updateMessage = (index, field, value) => {
    setMessages(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value
      }
      return updated
    })
  }

  const handleSendLinkedIn = async (index) => {
    const messageData = messages[index]
    const linkedinUrl = messageData.recruiter?.profile_url || messageData.mapItem?.recruiter_profile_url
    
    if (!linkedinUrl) {
      alert('LinkedIn URL not found for this recruiter')
      return
    }

    const message = messageData.editedLinkedInMessage || messageData.linkedinMessage

    setSendingStatus(prev => ({
      ...prev,
      [index]: { ...prev[index], linkedin: 'sending' }
    }))
    setIsSending(true)

    try {
      const result = await sendLinkedInInvitation(linkedinUrl, message)
      if (result.success) {
        setSendingStatus(prev => ({
          ...prev,
          [index]: { ...prev[index], linkedin: 'sent' }
        }))
        
        // Track in dashboard stats
        const role = messageData.mapItem?.job_title || 'Unknown Role'
        const company = messageData.mapItem?.job_company || messageData.mapItem?.recruiter_company || 'Unknown Company'
        const recruiterName = messageData.recruiter?.name || messageData.mapItem?.recruiter_name || 'Unknown Recruiter'
        trackLinkedInInvite(role, company, recruiterName)
      } else {
        throw new Error(result.message || 'Failed to send LinkedIn message')
      }
    } catch (error) {
      setSendingStatus(prev => ({
        ...prev,
        [index]: { ...prev[index], linkedin: 'error', error: error.message }
      }))
      alert(`Failed to send LinkedIn message: ${error.message}`)
    } finally {
      setIsSending(false)
    }
  }

  const handleSendEmail = async (index) => {
    const messageData = messages[index]
    const email = messageData.recruiter?.extracted_email || messageData.recruiter?.email
    
    if (!email) {
      alert('Email address not found for this recruiter')
      return
    }

    const subject = messageData.editedEmailSubject || messageData.email?.subject || 'Outreach Message'
    const body = messageData.editedEmailBody || messageData.email?.body || messageData.email?.content || ''

    setSendingStatus(prev => ({
      ...prev,
      [index]: { ...prev[index], email: 'sending' }
    }))
    setIsSending(true)

    try {
      const result = await sendEmail(email, subject, body)
      if (result.success) {
        setSendingStatus(prev => ({
          ...prev,
          [index]: { ...prev[index], email: 'sent' }
        }))
        
        // Track in dashboard stats
        const role = messageData.mapItem?.job_title || 'Unknown Role'
        const company = messageData.mapItem?.job_company || messageData.mapItem?.recruiter_company || 'Unknown Company'
        const recruiterName = messageData.recruiter?.name || messageData.mapItem?.recruiter_name || 'Unknown Recruiter'
        trackEmailSent(role, company, recruiterName)
      } else {
        throw new Error(result.message || 'Failed to send email')
      }
    } catch (error) {
      setSendingStatus(prev => ({
        ...prev,
        [index]: { ...prev[index], email: 'error', error: error.message }
      }))
      alert(`Failed to send email: ${error.message}`)
    } finally {
      setIsSending(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return '✅'
      case 'sending':
        return '⏳'
      case 'error':
        return '❌'
      default:
        return ''
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800'
      case 'sending':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (messages.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600 mb-4">No messages found. Redirecting to search...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📨 Review & Send Messages</h1>
          <p className="mt-2 text-gray-600">
            Review and edit your LinkedIn messages and emails before sending to {messages.length} recruiter{messages.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/search')}
          className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
        >
          ← Back to Search
        </button>
      </div>

      <div className="space-y-6">
        {messages.map((messageData, index) => {
          const recruiter = messageData.recruiter || {}
          const mapItem = messageData.mapItem || {}
          const linkedinStatus = sendingStatus[index]?.linkedin
          const emailStatus = sendingStatus[index]?.email

          return (
            <div key={index} className="rounded-lg border border-gray-200 bg-white p-6 shadow">
              {/* Recruiter Info */}
              <div className="mb-6 border-b border-gray-200 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {recruiter.name || mapItem.recruiter_name || 'Unknown Recruiter'}
                    </h3>
                    <p className="text-gray-600">
                      {recruiter.company || mapItem.recruiter_company || 'Unknown Company'}
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-gray-500">
                      {recruiter.extracted_email && (
                        <p>📧 Email: {recruiter.extracted_email}</p>
                      )}
                      {mapItem.recruiter_profile_url && (
                        <p>
                          🔗 LinkedIn:{' '}
                          <a
                            href={mapItem.recruiter_profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View Profile
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-700">
                      Job: {mapItem.job_title || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {mapItem.job_company || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* LinkedIn Message Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-900">💼 LinkedIn Message</h4>
                    {linkedinStatus && (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(linkedinStatus)}`}>
                        {getStatusIcon(linkedinStatus)} {linkedinStatus}
                      </span>
                    )}
                  </div>
                  
                  <textarea
                    className="h-64 w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
                    value={messageData.editedLinkedInMessage || ''}
                    onChange={(e) => updateMessage(index, 'editedLinkedInMessage', e.target.value)}
                    placeholder="LinkedIn message will appear here..."
                  />
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSendLinkedIn(index)}
                      disabled={isSending || linkedinStatus === 'sending' || linkedinStatus === 'sent'}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {linkedinStatus === 'sending' ? 'Sending...' : linkedinStatus === 'sent' ? 'Sent ✓' : 'Send LinkedIn Message'}
                    </button>
                  </div>
                </div>

                {/* Email Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-900">📧 Email</h4>
                    {emailStatus && (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(emailStatus)}`}>
                        {getStatusIcon(emailStatus)} {emailStatus}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Subject</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                      value={messageData.editedEmailSubject || ''}
                      onChange={(e) => updateMessage(index, 'editedEmailSubject', e.target.value)}
                      placeholder="Email subject..."
                    />
                    
                    <label className="block text-sm font-medium text-gray-700">Body</label>
                    <textarea
                      className="h-48 w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
                      value={messageData.editedEmailBody || ''}
                      onChange={(e) => updateMessage(index, 'editedEmailBody', e.target.value)}
                      placeholder="Email body will appear here..."
                    />
                  </div>
                  
                  <button
                    onClick={() => handleSendEmail(index)}
                    disabled={isSending || emailStatus === 'sending' || emailStatus === 'sent'}
                    className="w-full rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {emailStatus === 'sending' ? 'Sending...' : emailStatus === 'sent' ? 'Sent ✓' : 'Send Email'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary Actions */}
      <div className="mt-8 rounded-lg bg-gray-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Batch Actions</h3>
            <p className="text-sm text-gray-600">Send all messages at once</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                messages.forEach((_, index) => {
                  if (!sendingStatus[index]?.linkedin) {
                    handleSendLinkedIn(index)
                  }
                })
              }}
              disabled={isSending || Object.values(sendingStatus).some(s => s.linkedin === 'sending')}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Send All LinkedIn Messages
            </button>
            <button
              onClick={() => {
                messages.forEach((_, index) => {
                  if (!sendingStatus[index]?.email) {
                    handleSendEmail(index)
                  }
                })
              }}
              disabled={isSending || Object.values(sendingStatus).some(s => s.email === 'sending')}
              className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Send All Emails
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


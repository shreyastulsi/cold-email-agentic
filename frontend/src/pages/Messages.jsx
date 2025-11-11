import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { JobContextModal } from '../components/JobContextModal'
import { apiRequest } from '../utils/api'
import { trackEmailSent, trackLinkedInInvite } from '../utils/dashboardStats'

// API functions
async function sendLinkedInInvitation(linkedinUrl, message, metadata = {}) {
  return apiRequest('/api/v1/outreach/linkedin/send', {
    method: 'POST',
    body: JSON.stringify({
      linkedin_url: linkedinUrl,
      message: message,
      recipient_name: metadata.recruiterName,
      company_name: metadata.companyName,
      job_title: metadata.jobTitle
    })
  })
}

async function sendEmail(to, subject, body, metadata = {}) {
  return apiRequest('/api/v1/outreach/email/send', {
    method: 'POST',
    body: JSON.stringify({
      to: to,
      subject: subject,
      body: body,
      recipient_name: metadata.recruiterName,
      company_name: metadata.companyName,
      job_title: metadata.jobTitle
    })
  })
}

async function saveDraft(draftData) {
  return apiRequest('/api/v1/drafts', {
    method: 'POST',
    body: JSON.stringify(draftData)
  })
}

export default function Messages() {
  const navigate = useNavigate()
  const location = useLocation()
  const [messages, setMessages] = useState([])
  const [sendingStatus, setSendingStatus] = useState({})
  const [isSending, setIsSending] = useState(false)
  const [savingStatus, setSavingStatus] = useState({}) // Track saving status for each message
  const [isSavingAll, setIsSavingAll] = useState(false)
  const savedDraftsRef = useRef(new Set()) // Track which messages we've already saved as drafts
  const messagesRef = useRef(messages)
  const sendingStatusRef = useRef(sendingStatus)

  // Keep refs updated with latest values
  useEffect(() => {
    messagesRef.current = messages
    sendingStatusRef.current = sendingStatus
  }, [messages, sendingStatus])

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
      navigate('/dashboard/search')
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
      // Gather metadata for tracking
      const role = messageData.mapItem?.job_title || 'Unknown Role'
      const company = messageData.mapItem?.job_company || messageData.recruiter?.company || messageData.mapItem?.recruiter_company || 'Unknown Company'
      const recruiterName = messageData.recruiter?.name || messageData.mapItem?.recruiter_name || 'Unknown Recruiter'
      
      const result = await sendLinkedInInvitation(linkedinUrl, message, {
        recruiterName: recruiterName,
        companyName: company,
        jobTitle: role
      })
      if (result.success) {
        setSendingStatus(prev => ({
          ...prev,
          [index]: { ...prev[index], linkedin: 'sent' }
        }))
        
        // Track in dashboard stats (trigger refresh event)
        trackLinkedInInvite(role, company, recruiterName)
      } else {
        const errorMsg = result.error || result.message || 'Failed to send LinkedIn message'
        throw new Error(errorMsg)
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to send LinkedIn message'
      setSendingStatus(prev => ({
        ...prev,
        [index]: { ...prev[index], linkedin: 'error', error: errorMessage }
      }))
      alert(`Failed to send LinkedIn message: ${errorMessage}`)
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
      // Gather metadata for tracking
      const role = messageData.mapItem?.job_title || 'Unknown Role'
      const company = messageData.mapItem?.job_company || messageData.recruiter?.company || messageData.mapItem?.recruiter_company || 'Unknown Company'
      const recruiterName = messageData.recruiter?.name || messageData.mapItem?.recruiter_name || 'Unknown Recruiter'
      
      const result = await sendEmail(email, subject, body, {
        recruiterName: recruiterName,
        companyName: company,
        jobTitle: role
      })
      if (result && result.success) {
        setSendingStatus(prev => ({
          ...prev,
          [index]: { ...prev[index], email: 'sent' }
        }))
        
        // Track in dashboard stats (trigger refresh event)
        trackEmailSent(role, company, recruiterName)
      } else {
        // Handle both error formats: string or object with message
        const errorMsg = typeof result?.error === 'string' 
          ? result.error 
          : result?.error?.message || result?.message || 'Failed to send email'
        throw new Error(errorMsg)
      }
    } catch (error) {
      const errorMessage = error.message || 'Failed to send email'
      setSendingStatus(prev => ({
        ...prev,
        [index]: { ...prev[index], email: 'error', error: errorMessage }
      }))
      alert(`Failed to send email: ${errorMessage}`)
    } finally {
      setIsSending(false)
    }
  }

  const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div')
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      'bg-blue-500 text-white'
    }`
    notification.textContent = message
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.style.opacity = '0'
      notification.style.transform = 'translateY(-20px)'
      setTimeout(() => {
        document.body.removeChild(notification)
      }, 300)
    }, 3000)
  }

  const saveDraftForMessage = async (messageData, index, silent = true) => {
    // Skip if we've already saved this draft
    if (savedDraftsRef.current.has(index)) {
      return true
    }
    
    const recruiter = messageData.recruiter || {}
    const mapItem = messageData.mapItem || {}
    
    // Skip if message has already been sent
    const linkedinSent = sendingStatus[index]?.linkedin === 'sent'
    const emailSent = sendingStatus[index]?.email === 'sent'
    
    // Skip if both messages are already sent
    if (linkedinSent && emailSent) {
      return true
    }
    
    // Only save if there's content that hasn't been sent
    const email = messageData.recruiter?.extracted_email || messageData.recruiter?.email
    const linkedinUrl = messageData.recruiter?.profile_url || mapItem.recruiter_profile_url
    const emailSubject = messageData.editedEmailSubject || messageData.email?.subject
    const emailBody = messageData.editedEmailBody || messageData.email?.body || messageData.email?.content
    const linkedinMessage = messageData.editedLinkedInMessage || messageData.linkedinMessage
    
    // Skip if nothing to save
    if ((!emailSubject && !emailBody && !linkedinMessage) || (!email && !linkedinUrl)) {
      return false
    }
    
    // Determine draft type
    let draftType = 'email'
    if (linkedinMessage && emailSubject) {
      draftType = 'both'
    } else if (linkedinMessage) {
      draftType = 'linkedin'
    }
    
    try {
      const draftData = {
        draft_type: draftType,
        recipient_name: recruiter.name || mapItem.recruiter_name || null,
        recipient_email: email || null,
        recipient_linkedin_url: linkedinUrl || null,
        email_subject: emailSubject || null,
        email_body: emailBody || null,
        linkedin_message: linkedinMessage || null,
        job_title: mapItem.job_title || null,
        company_name: mapItem.job_company || recruiter.company || mapItem.recruiter_company || null,
        recruiter_info: {
          ...recruiter,
          ...mapItem
        }
      }
      
      const result = await saveDraft(draftData)
      if (result.success) {
        savedDraftsRef.current.add(index)
        if (!silent) {
          showNotification('Draft saved successfully!', 'success')
        }
        return true
      }
      return false
    } catch (error) {
      console.error(`Failed to save draft: ${error.message}`)
      if (!silent) {
        showNotification(`Failed to save draft: ${error.message}`, 'error')
      }
      return false
    }
  }

  const handleSaveDraft = async (index) => {
    setSavingStatus(prev => ({
      ...prev,
      [index]: 'saving'
    }))

    try {
      const messageData = messages[index]
      const success = await saveDraftForMessage(messageData, index, false)
      
      if (success) {
        setSavingStatus(prev => ({
          ...prev,
          [index]: 'saved'
        }))
        // Reset the saved status after 2 seconds
        setTimeout(() => {
          setSavingStatus(prev => ({
            ...prev,
            [index]: null
          }))
        }, 2000)
      } else {
        setSavingStatus(prev => ({
          ...prev,
          [index]: 'error'
        }))
        setTimeout(() => {
          setSavingStatus(prev => ({
            ...prev,
            [index]: null
          }))
        }, 3000)
      }
    } catch (error) {
      setSavingStatus(prev => ({
        ...prev,
        [index]: 'error'
      }))
      setTimeout(() => {
        setSavingStatus(prev => ({
          ...prev,
          [index]: null
        }))
      }, 3000)
    }
  }

  const handleSaveAllDrafts = async () => {
    setIsSavingAll(true)
    
    try {
      const savePromises = messages.map(async (messageData, index) => {
        const linkedinSent = sendingStatus[index]?.linkedin === 'sent'
        const emailSent = sendingStatus[index]?.email === 'sent'
        
        // Only save if at least one message hasn't been sent
        if (!linkedinSent || !emailSent) {
          return await saveDraftForMessage(messageData, index, true)
        }
        return false
      })
      
      const results = await Promise.all(savePromises)
      const savedCount = results.filter(r => r === true).length
      
      if (savedCount > 0) {
        showNotification(`Saved ${savedCount} draft${savedCount !== 1 ? 's' : ''} successfully!`, 'success')
      } else {
        showNotification('No drafts to save', 'info')
      }
    } catch (error) {
      showNotification(`Failed to save some drafts: ${error.message}`, 'error')
    } finally {
      setIsSavingAll(false)
    }
  }

  const autoSaveAllDrafts = async () => {
    if (messages.length === 0) {
      return
    }
    
    console.log('Auto-saving drafts...')
    
    // Save all unsent messages as drafts
    const savePromises = messages.map(async (messageData, index) => {
      const linkedinSent = sendingStatus[index]?.linkedin === 'sent'
      const emailSent = sendingStatus[index]?.email === 'sent'
      
      // Only save if at least one message hasn't been sent
      if (!linkedinSent || !emailSent) {
        return await saveDraftForMessage(messageData, index, true)
      }
      return false
    })
    
    await Promise.all(savePromises)
    console.log('Auto-save complete')
  }

  // Auto-save drafts when leaving the page
  useEffect(() => {
    // Auto-save when component unmounts (navigating away)
    return () => {
      const doAutoSave = async () => {
        if (messagesRef.current.length === 0) {
          return
        }
        
        console.log('Auto-saving drafts on unmount...')
        
        // Save all unsent messages as drafts
        const savePromises = messagesRef.current.map(async (messageData, index) => {
          const linkedinSent = sendingStatusRef.current[index]?.linkedin === 'sent'
          const emailSent = sendingStatusRef.current[index]?.email === 'sent'
          
          // Only save if at least one message hasn't been sent
          if (!linkedinSent || !emailSent) {
            // Skip if we've already saved this draft
            if (savedDraftsRef.current.has(index)) {
              return true
            }
            
            const recruiter = messageData.recruiter || {}
            const mapItem = messageData.mapItem || {}
            const email = messageData.recruiter?.extracted_email || messageData.recruiter?.email
            const linkedinUrl = messageData.recruiter?.profile_url || mapItem.recruiter_profile_url
            const emailSubject = messageData.editedEmailSubject || messageData.email?.subject
            const emailBody = messageData.editedEmailBody || messageData.email?.body || messageData.email?.content
            const linkedinMessage = messageData.editedLinkedInMessage || messageData.linkedinMessage
            
            if ((!emailSubject && !emailBody && !linkedinMessage) || (!email && !linkedinUrl)) {
              return false
            }
            
            let draftType = 'email'
            if (linkedinMessage && emailSubject) {
              draftType = 'both'
            } else if (linkedinMessage) {
              draftType = 'linkedin'
            }
            
            try {
              const draftData = {
                draft_type: draftType,
                recipient_name: recruiter.name || mapItem.recruiter_name || null,
                recipient_email: email || null,
                recipient_linkedin_url: linkedinUrl || null,
                email_subject: emailSubject || null,
                email_body: emailBody || null,
                linkedin_message: linkedinMessage || null,
                job_title: mapItem.job_title || null,
                company_name: mapItem.job_company || recruiter.company || mapItem.recruiter_company || null,
                recruiter_info: {
                  ...recruiter,
                  ...mapItem
                }
              }
              
              const result = await saveDraft(draftData)
              if (result.success) {
                savedDraftsRef.current.add(index)
                console.log(`Draft saved for message ${index}`)
                return true
              }
              return false
            } catch (error) {
              console.error(`Failed to save draft ${index}:`, error)
              return false
            }
          }
          return false
        })
        
        await Promise.all(savePromises)
        console.log('Auto-save complete')
      }
      
      // Fire and forget - don't block navigation
      doAutoSave().catch(err => {
        console.error('Failed to auto-save drafts:', err)
      })
    }
  }, [messages, sendingStatus])

  // Also listen for beforeunload event (closing tab/window)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Note: beforeunload doesn't support async well, but we can try
      if (messagesRef.current.length > 0) {
        // Trigger the same auto-save logic
        const doAutoSave = async () => {
          const savePromises = messagesRef.current.map(async (messageData, index) => {
            const linkedinSent = sendingStatusRef.current[index]?.linkedin === 'sent'
            const emailSent = sendingStatusRef.current[index]?.email === 'sent'
            
            if ((!linkedinSent || !emailSent) && !savedDraftsRef.current.has(index)) {
              const recruiter = messageData.recruiter || {}
              const mapItem = messageData.mapItem || {}
              const email = messageData.recruiter?.extracted_email || messageData.recruiter?.email
              const linkedinUrl = messageData.recruiter?.profile_url || mapItem.recruiter_profile_url
              const emailSubject = messageData.editedEmailSubject || messageData.email?.subject
              const emailBody = messageData.editedEmailBody || messageData.email?.body || messageData.email?.content
              const linkedinMessage = messageData.editedLinkedInMessage || messageData.linkedinMessage
              
              if ((!emailSubject && !emailBody && !linkedinMessage) || (!email && !linkedinUrl)) {
                return false
              }
              
              let draftType = 'email'
              if (linkedinMessage && emailSubject) {
                draftType = 'both'
              } else if (linkedinMessage) {
                draftType = 'linkedin'
              }
              
              try {
                const draftData = {
                  draft_type: draftType,
                  recipient_name: recruiter.name || mapItem.recruiter_name || null,
                  recipient_email: email || null,
                  recipient_linkedin_url: linkedinUrl || null,
                  email_subject: emailSubject || null,
                  email_body: emailBody || null,
                  linkedin_message: linkedinMessage || null,
                  job_title: mapItem.job_title || null,
                  company_name: mapItem.job_company || recruiter.company || mapItem.recruiter_company || null,
                  recruiter_info: {
                    ...recruiter,
                    ...mapItem
                  }
                }
                
                const result = await saveDraft(draftData)
                if (result.success) {
                  savedDraftsRef.current.add(index)
                }
                return result.success
              } catch (error) {
                console.error(`Failed to save draft ${index}:`, error)
                return false
              }
            }
            return false
          })
          
          await Promise.all(savePromises)
        }
        
        doAutoSave().catch(err => {
          console.error('Failed to auto-save drafts on beforeunload:', err)
        })
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Handle navigation away with the "Back to Search" button
  const handleNavigateAway = async () => {
    await autoSaveAllDrafts()
    navigate('/dashboard/search')
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
        return 'bg-green-900/50 text-green-300 border border-green-700/50'
      case 'sending':
        return 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50'
      case 'error':
        return 'bg-red-900/50 text-red-300 border border-red-700/50'
      default:
        return 'bg-gray-800/50 text-gray-300 border border-gray-700/50'
    }
  }

  if (messages.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400 mb-4">No messages found. Redirecting to search...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">📨 Review & Send Messages</h1>
          <p className="mt-2 text-gray-300">
            Review and edit your LinkedIn messages and emails before sending to {messages.length} recruiter{messages.length !== 1 ? 's' : ''}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            💾 Save drafts manually or they will be automatically saved when you leave this page
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/dashboard/drafts')}
            className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-4 py-2 text-gray-200 hover:bg-gray-700/50"
          >
            📝 View Drafts
          </button>
          <button
            onClick={handleNavigateAway}
            className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-4 py-2 text-gray-200 hover:bg-gray-700/50"
          >
            ← Back to Search
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {messages.map((messageData, index) => {
          const recruiter = messageData.recruiter || {}
          const mapItem = messageData.mapItem || {}
          const jobUrl = mapItem.job_url || recruiter.job_url
          const linkedinStatus = sendingStatus[index]?.linkedin
          const emailStatus = sendingStatus[index]?.email
          const hasEmailChannel = Boolean(
            recruiter.extracted_email ||
            recruiter.email ||
            messageData.email ||
            messageData.email?.subject ||
            messageData.email?.body ||
            messageData.editedEmailSubject ||
            messageData.editedEmailBody
          )
          const hasLinkedInChannel = Boolean(
            mapItem.recruiter_profile_url ||
            recruiter.profile_url ||
            messageData.linkedinMessage ||
            messageData.editedLinkedInMessage
          )

          return (
            <div key={index} className="rounded-lg border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm p-6 shadow-lg">
              {/* Recruiter Info */}
              <div className="mb-6 border-b border-gray-700/50 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {recruiter.name || mapItem.recruiter_name || 'Unknown Recruiter'}
                    </h3>
                    <p className="text-gray-300">
                      {mapItem.job_company || recruiter.company || mapItem.recruiter_company || 'Unknown Company'}
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-gray-400">
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
                    <div className="text-sm font-medium text-gray-300">
                      Job: {mapItem.job_title || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-400">
                      {mapItem.job_company || 'N/A'}
                    </div>
                    <div className="mt-2">
                      <button
                        onClick={() => handleSaveDraft(index)}
                        disabled={savingStatus[index] === 'saving' || (sendingStatus[index]?.linkedin === 'sent' && sendingStatus[index]?.email === 'sent')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          savingStatus[index] === 'saved' 
                            ? 'bg-green-900/50 text-green-300 border border-green-700/50'
                            : savingStatus[index] === 'saving'
                            ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50'
                            : savingStatus[index] === 'error'
                            ? 'bg-red-900/50 text-red-300 border border-red-700/50'
                            : 'bg-gray-700/50 text-gray-300 border border-gray-600/50 hover:bg-gray-600/50'
                        } disabled:cursor-not-allowed`}
                      >
                        {savingStatus[index] === 'saving' ? '💾 Saving...' :
                         savingStatus[index] === 'saved' ? '✅ Saved' :
                         savingStatus[index] === 'error' ? '❌ Error' :
                         savedDraftsRef.current.has(index) ? '✅ Saved' : '💾 Save Draft'}
                      </button>
                    </div>
                  </div>
                </div>
                {(jobUrl || hasEmailChannel || hasLinkedInChannel) && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {jobUrl && (
                      <JobContextModal
                        jobUrl={jobUrl}
                        buttonText="View Job Context"
                        buttonClassName="px-3 py-1 text-xs bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg transition-colors"
                      />
                    )}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {hasEmailChannel && (
                        <span className={`px-2 py-1 rounded ${getStatusColor(emailStatus || '')}`}>
                          📧 {emailStatus === 'sent' ? 'Sent' : emailStatus === 'sending' ? 'Sending' : emailStatus === 'error' ? 'Error' : 'Email'}
                        </span>
                      )}
                      {hasLinkedInChannel && (
                        <span className={`px-2 py-1 rounded ${getStatusColor(linkedinStatus || '')}`}>
                          💼 {linkedinStatus === 'sent' ? 'Sent' : linkedinStatus === 'sending' ? 'Sending' : linkedinStatus === 'error' ? 'Error' : 'LinkedIn'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* LinkedIn Message Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-white">💼 LinkedIn Message</h4>
                    {linkedinStatus && (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(linkedinStatus)}`}>
                        {getStatusIcon(linkedinStatus)} {linkedinStatus}
                      </span>
                    )}
                  </div>
                  
                  <textarea
                    className="h-64 w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-sans text-sm focus:border-blue-500 focus:outline-none"
                    value={messageData.editedLinkedInMessage || ''}
                    onChange={(e) => updateMessage(index, 'editedLinkedInMessage', e.target.value)}
                    placeholder="LinkedIn message will appear here..."
                  />
                  
                  <button
                    onClick={() => handleSendLinkedIn(index)}
                    disabled={isSending || linkedinStatus === 'sending' || linkedinStatus === 'sent'}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {linkedinStatus === 'sending' ? 'Sending...' : linkedinStatus === 'sent' ? 'Sent ✓' : 'Send LinkedIn Message'}
                  </button>
                </div>

                {/* Email Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-white">📧 Email</h4>
                    {emailStatus && (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(emailStatus)}`}>
                        {getStatusIcon(emailStatus)} {emailStatus}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Subject</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
                      value={messageData.editedEmailSubject || ''}
                      onChange={(e) => updateMessage(index, 'editedEmailSubject', e.target.value)}
                      placeholder="Email subject..."
                    />
                    
                    <label className="block text-sm font-medium text-gray-300">Body</label>
                    <textarea
                      className="h-48 w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-sans text-sm focus:border-blue-500 focus:outline-none"
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
      <div className="mt-8 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Batch Actions</h3>
            <p className="text-sm text-gray-300">Save all drafts or send all messages at once.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSaveAllDrafts}
              disabled={isSavingAll}
              className="rounded-lg bg-gray-700 px-6 py-2 text-white hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSavingAll ? '💾 Saving...' : '💾 Save All Drafts'}
            </button>
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


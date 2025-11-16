import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { JobContextModal } from '../components/JobContextModal'
import { Button } from '../components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible'
import { apiRequest } from '../utils/api'
import { trackEmailSent, trackLinkedInInvite } from '../utils/dashboardStats'
import { useToast } from '../context/toast-context'

// API functions
async function fetchDrafts() {
  return apiRequest('/api/v1/drafts?include_sent=false', {
    method: 'GET'
  })
}

async function sendDraft(draftId, sendEmail, sendLinkedIn) {
  return apiRequest(`/api/v1/drafts/${draftId}/send`, {
    method: 'POST',
    body: JSON.stringify({
      send_email: sendEmail,
      send_linkedin: sendLinkedIn
    })
  })
}

async function deleteDraft(draftId) {
  return apiRequest(`/api/v1/drafts/${draftId}`, {
    method: 'DELETE'
  })
}

async function updateDraft(draftId, updateData) {
  return apiRequest(`/api/v1/drafts/${draftId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData)
  })
}

export default function Drafts() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sendingStatus, setSendingStatus] = useState({})
  const [editingDraft, setEditingDraft] = useState(null) // { draftId: number, part: 'email' | 'linkedin' }
  const [editValues, setEditValues] = useState({})
  const [selectedDrafts, setSelectedDrafts] = useState(new Set()) // Set of draft IDs
  const [expandedDrafts, setExpandedDrafts] = useState(new Set()) // Set of expanded draft IDs
  const selectAllCheckboxRef = useRef(null)
  const [linkedInAccount, setLinkedInAccount] = useState(null) // Store LinkedIn account info
  
  // Fetch LinkedIn account info to determine premium status
  useEffect(() => {
    const fetchLinkedInAccount = async () => {
      try {
        const result = await apiRequest('/api/v1/linkedin-accounts')
        const accounts = result.accounts || []
        if (accounts.length > 0) {
          setLinkedInAccount(accounts[0]) // Use first account
        }
      } catch (err) {
        console.error('Failed to fetch LinkedIn account:', err)
      }
    }
    fetchLinkedInAccount()
  }, [])
  
  // Determine character limit based on premium status
  // Default to 300 (premium) if unknown, 200 if free account
  const linkedInCharLimit = linkedInAccount?.is_premium === false ? 200 : 300

  useEffect(() => {
    loadDrafts()
  }, [])

  const loadDrafts = async () => {
    try {
      setLoading(true)
      const result = await fetchDrafts()
      if (result.drafts) {
        setDrafts(result.drafts)
      }
    } catch (error) {
      console.error('Error loading drafts:', error)
      showToast(`Failed to load drafts: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async (draftId) => {
    setSendingStatus(prev => ({
      ...prev,
      [draftId]: { ...prev[draftId], email: 'sending' }
    }))

    try {
      const result = await sendDraft(draftId, true, false)
      if (result.success) {
        setSendingStatus(prev => ({
          ...prev,
          [draftId]: { ...prev[draftId], email: 'sent' }
        }))
        
        // Track email sent
        const draft = drafts.find(d => d.id === draftId)
        if (draft) {
          trackEmailSent(
            draft.job_title || 'Unknown Role',
            draft.company_name || 'Unknown Company',
            draft.recipient_name || 'Unknown Recruiter'
          )
        }
        
        // Reload drafts to update status - but don't remove drafts that still have unsent parts
        await loadDrafts()
      } else {
        throw new Error(result.error || 'Failed to send email')
      }
    } catch (error) {
      setSendingStatus(prev => ({
        ...prev,
        [draftId]: { ...prev[draftId], email: 'error', error: error.message }
      }))
      showToast(`Failed to send email: ${error.message}`, 'error')
    }
  }

  const handleSendLinkedIn = async (draftId) => {
    setSendingStatus(prev => ({
      ...prev,
      [draftId]: { ...prev[draftId], linkedin: 'sending', error: null }
    }))

    try {
      const result = await sendDraft(draftId, false, true)
      
      // Check if LinkedIn send was successful
      const linkedinResult = result.results?.linkedin
      if (linkedinResult && linkedinResult.success) {
        setSendingStatus(prev => ({
          ...prev,
          [draftId]: { ...prev[draftId], linkedin: 'sent', error: null }
        }))
        
        // Track LinkedIn invite
        const draft = drafts.find(d => d.id === draftId)
        if (draft) {
          trackLinkedInInvite(
            draft.job_title || 'Unknown Role',
            draft.company_name || 'Unknown Company',
            draft.recipient_name || 'Unknown Recruiter'
          )
        }
        
        // Reload drafts to update status
        await loadDrafts()
      } else {
        // LinkedIn send failed - extract user-friendly error message
        const errorMsg = linkedinResult?.error || result.error || 'Failed to send LinkedIn message'
        setSendingStatus(prev => ({
          ...prev,
          [draftId]: { ...prev[draftId], linkedin: 'error', error: errorMsg }
        }))
        showToast(`Failed to send LinkedIn message: ${errorMsg}`, 'error')
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.response?.data?.detail || error.message || 'Failed to send LinkedIn message'
      setSendingStatus(prev => ({
        ...prev,
        [draftId]: { ...prev[draftId], linkedin: 'error', error: errorMessage }
      }))
      showToast(`Failed to send LinkedIn message: ${errorMessage}`, 'error')
    }
  }

  const handleDeleteDraft = async (draftId) => {
    if (!confirm('Are you sure you want to delete this draft?')) {
      return
    }

    try {
      await deleteDraft(draftId)
      await loadDrafts()
    } catch (error) {
      showToast(`Failed to delete draft: ${error.message}`, 'error')
    }
  }

  const handleSendBoth = async (draftId) => {
    const draft = drafts.find(d => d.id === draftId)
    if (!draft) return

    // Check if both are available
    const canSendEmail = (draft.draft_type === 'email' || draft.draft_type === 'both') && !draft.email_sent
    const canSendLinkedIn = (draft.draft_type === 'linkedin' || draft.draft_type === 'both') && !draft.linkedin_sent

    if (!canSendEmail && !canSendLinkedIn) {
      showToast('Both email and LinkedIn have already been sent for this draft', 'info')
      return
    }

    setSendingStatus(prev => ({
      ...prev,
      [draftId]: { ...prev[draftId], email: canSendEmail ? 'sending' : prev[draftId]?.email, linkedin: canSendLinkedIn ? 'sending' : prev[draftId]?.linkedin }
    }))

    try {
      const result = await sendDraft(draftId, canSendEmail, canSendLinkedIn)
      
      // Check individual results
      const emailResult = result.results?.email
      const linkedinResult = result.results?.linkedin
      
      const emailSuccess = canSendEmail && emailResult && emailResult.success
      const linkedinSuccess = canSendLinkedIn && linkedinResult && linkedinResult.success
      
      if (emailSuccess || linkedinSuccess) {
        setSendingStatus(prev => ({
          ...prev,
          [draftId]: { 
            ...prev[draftId], 
            email: emailSuccess ? 'sent' : (canSendEmail && !emailSuccess ? 'error' : prev[draftId]?.email),
            linkedin: linkedinSuccess ? 'sent' : (canSendLinkedIn && !linkedinSuccess ? 'error' : prev[draftId]?.linkedin),
            error: null
          }
        }))

        // Track sent messages
        if (emailSuccess) {
          trackEmailSent(
            draft.job_title || 'Unknown Role',
            draft.company_name || 'Unknown Company',
            draft.recipient_name || 'Unknown Recruiter'
          )
        }
        if (linkedinSuccess) {
          trackLinkedInInvite(
            draft.job_title || 'Unknown Role',
            draft.company_name || 'Unknown Company',
            draft.recipient_name || 'Unknown Recruiter'
          )
        }

        // Reload drafts to update status
        await loadDrafts()
      }
      
      // Show errors if any failed
      const errors = []
      if (canSendEmail && (!emailResult || !emailResult.success)) {
        errors.push(`Email: ${emailResult?.error || 'Failed to send email'}`)
      }
      if (canSendLinkedIn && (!linkedinResult || !linkedinResult.success)) {
        errors.push(`LinkedIn: ${linkedinResult?.error || 'Failed to send LinkedIn message'}`)
      }
      
      if (errors.length > 0) {
        const errorMsg = errors.join(' | ')
        setSendingStatus(prev => ({
          ...prev,
          [draftId]: { 
            ...prev[draftId], 
            email: canSendEmail && (!emailResult || !emailResult.success) ? 'error' : prev[draftId]?.email,
            linkedin: canSendLinkedIn && (!linkedinResult || !linkedinResult.success) ? 'error' : prev[draftId]?.linkedin,
            error: errorMsg
          }
        }))
        showToast(`Failed to send messages: ${errorMsg}`, 'error')
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to send messages'
      setSendingStatus(prev => ({
        ...prev,
        [draftId]: { 
          ...prev[draftId], 
          email: canSendEmail ? 'error' : prev[draftId]?.email,
          linkedin: canSendLinkedIn ? 'error' : prev[draftId]?.linkedin,
          error: errorMessage 
        }
      }))
      showToast(`Failed to send messages: ${errorMessage}`, 'error')
    }
  }

  const handleStartEdit = (draftId, part) => {
    // Don't allow editing parts that have already been sent
    const draft = drafts.find(d => d.id === draftId)
    if (!draft) return
    
    if (part === 'email' && draft.email_sent) {
      showToast('Email has already been sent. Cannot edit.', 'warning')
      return
    }
    if (part === 'linkedin' && draft.linkedin_sent) {
      showToast('LinkedIn message has already been sent. Cannot edit.', 'warning')
      return
    }
    
    setEditingDraft({ draftId, part })
    if (part === 'email') {
      setEditValues({
        email_subject: draft.email_subject || '',
        email_body: draft.email_body || ''
      })
    } else if (part === 'linkedin') {
      setEditValues({
        linkedin_message: draft.linkedin_message || ''
      })
    }
  }

  const handleCancelEdit = () => {
    setEditingDraft(null)
    setEditValues({})
  }

  const handleSaveEdit = async (draftId) => {
    try {
      await updateDraft(draftId, editValues)
      await loadDrafts()
      setEditingDraft(null)
      setEditValues({})
    } catch (error) {
      showToast(`Failed to update draft: ${error.message}`, 'error')
    }
  }

  const allSelected = drafts.length > 0 && selectedDrafts.size === drafts.length
  const someSelected = selectedDrafts.size > 0 && selectedDrafts.size < drafts.length

  // Update indeterminate state of select all checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someSelected
    }
  }, [someSelected])

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

  // Checkbox management
  const toggleDraftSelection = (draftId) => {
    setSelectedDrafts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(draftId)) {
        newSet.delete(draftId)
      } else {
        newSet.add(draftId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedDrafts.size === drafts.length) {
      setSelectedDrafts(new Set())
    } else {
      setSelectedDrafts(new Set(drafts.map(d => d.id)))
    }
  }

  const toggleExpand = (draftId) => {
    setExpandedDrafts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(draftId)) {
        newSet.delete(draftId)
      } else {
        newSet.add(draftId)
      }
      return newSet
    })
  }

  const getEligibleDrafts = (channel) =>
    drafts.filter((draft) => {
      if (!selectedDrafts.has(draft.id)) return false
      if (channel === 'email') {
        return (draft.draft_type === 'email' || draft.draft_type === 'both') && !draft.email_sent
      }
      if (channel === 'linkedin') {
        return (draft.draft_type === 'linkedin' || draft.draft_type === 'both') && !draft.linkedin_sent
      }
      return false
    })

  const handleSendEmailsToSelected = async () => {
    if (selectedDrafts.size === 0) {
      showToast('Please select at least one draft to send', 'warning')
      return
    }

    const draftsToSend = getEligibleDrafts('email')

    if (draftsToSend.length === 0) {
      showToast('No selected drafts have an unsent email to send', 'info')
      return
    }

    const confirmMessage = `Send emails for ${draftsToSend.length} selected draft${draftsToSend.length !== 1 ? 's' : ''}?`
    if (!confirm(confirmMessage)) {
      return
    }

    for (const draft of draftsToSend) {
      await handleSendEmail(draft.id)
    }
  }

  const handleSendLinkedInToSelected = async () => {
    if (selectedDrafts.size === 0) {
      showToast('Please select at least one draft to send', 'warning')
      return
    }

    const draftsToSend = getEligibleDrafts('linkedin')

    if (draftsToSend.length === 0) {
      showToast('No selected drafts have an unsent LinkedIn message to send', 'info')
      return
    }

    const confirmMessage = `Send LinkedIn messages for ${draftsToSend.length} selected draft${draftsToSend.length !== 1 ? 's' : ''}?`
    if (!confirm(confirmMessage)) {
      return
    }

    for (const draft of draftsToSend) {
      await handleSendLinkedIn(draft.id)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedDrafts.size === 0) {
      showToast('Please select at least one draft to delete', 'warning')
      return
    }

    const confirmMessage = `Are you sure you want to delete ${selectedDrafts.size} draft(s)? This action cannot be undone.`
    if (!confirm(confirmMessage)) {
      return
    }

    // Delete all selected drafts
    const deletePromises = Array.from(selectedDrafts).map(draftId => deleteDraft(draftId))
    
    try {
      await Promise.all(deletePromises)
      // Clear selection after deleting
      setSelectedDrafts(new Set())
      await loadDrafts()
    } catch (error) {
      showToast(`Failed to delete some drafts: ${error.message}`, 'error')
      await loadDrafts()
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Loading drafts...</p>
      </div>
    )
  }

  const isAnyEmailSending = Object.values(sendingStatus).some(status => status?.email === 'sending')
  const isAnyLinkedInSending = Object.values(sendingStatus).some(status => status?.linkedin === 'sending')
  const emailEligibleCount = getEligibleDrafts('email').length
  const linkedinEligibleCount = getEligibleDrafts('linkedin').length

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">📝 Drafts</h1>
          <p className="mt-2 text-gray-300">
            Manage your unsent outreach messages ({drafts.length} draft{drafts.length !== 1 ? 's' : ''})
          </p>
        </div>
        <Button
          onClick={() => navigate('/dashboard/search')}
          variant="outline"
        >
          ← Back to Search
        </Button>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm p-12 text-center">
          <p className="text-gray-400 text-lg mb-2">No drafts found</p>
          <p className="text-gray-500 text-sm mb-4">
            Drafts you save from the Messages page will appear here
          </p>
          <Button
            onClick={() => navigate('/dashboard/search')}
            variant="default"
          >
            Start Searching
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Email-like Toolbar */}
          <div className="flex items-center gap-4 rounded-lg border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                ref={selectAllCheckboxRef}
                checked={allSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">
                {allSelected ? 'Deselect All' : 'Select All'}
              </span>
            </label>
            
            {selectedDrafts.size > 0 && (
              <>
                <div className="h-6 w-px bg-gray-700/50" />
                <span className="text-sm text-gray-400">
                  {selectedDrafts.size} selected
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    onClick={handleSendEmailsToSelected}
                    size="sm"
                    disabled={emailEligibleCount === 0 || isAnyEmailSending}
                    className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    variant="ghost"
                  >
                    Send Emails to Selected ({emailEligibleCount})
                  </Button>
                  <Button
                    onClick={handleSendLinkedInToSelected}
                    size="sm"
                    disabled={linkedinEligibleCount === 0 || isAnyLinkedInSending}
                    className="bg-white text-gray-900 hover:bg-gray-100 border border-white/50 disabled:opacity-60"
                    variant="ghost"
                  >
                    Send Messages to Selected ({linkedinEligibleCount})
                  </Button>
                  <Button
                    onClick={handleDeleteSelected}
                    variant="destructive"
                    size="sm"
                  >
                    Delete All Selected ({selectedDrafts.size})
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Draft List - Email-like Interface */}
          <div className="space-y-1">
            {drafts.map((draft) => {
              const emailStatus = sendingStatus[draft.id]?.email
              const linkedinStatus = sendingStatus[draft.id]?.linkedin
              const isEditingEmail = editingDraft?.draftId === draft.id && editingDraft?.part === 'email'
              const isEditingLinkedIn = editingDraft?.draftId === draft.id && editingDraft?.part === 'linkedin'
              const isSelected = selectedDrafts.has(draft.id)
              const isExpanded = expandedDrafts.has(draft.id)

              return (
                <Collapsible
                  key={draft.id}
                  open={isExpanded}
                  onOpenChange={() => toggleExpand(draft.id)}
                >
                  <div className={`rounded-lg border ${
                    isSelected 
                      ? 'border-blue-500/50 bg-blue-900/10' 
                      : 'border-gray-700/50 bg-gray-800/50'
                  } backdrop-blur-sm transition-colors`}>
                    {/* Draft Header - Always Visible */}
                    <div className="flex items-center gap-3 p-4 hover:bg-gray-700/20 transition-colors">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleDraftSelection(draft.id)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                      />
                      
                      <CollapsibleTrigger asChild>
                        <div className="flex-1 flex items-center gap-4 text-left cursor-pointer">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-base font-semibold text-white truncate">
                                {draft.recipient_name || 'Unknown Recruiter'}
                              </h3>
                              <span className="text-xs text-gray-400">
                                {draft.recipient_email || 'No email'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-400 truncate">
                              {draft.company_name || 'Unknown Company'} • {draft.job_title || 'N/A'}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3 text-sm text-gray-400">
                            {/* View Job Context Button - Only visible when expanded */}
                            {isExpanded && draft.recruiter_info?.job_url && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <JobContextModal
                                  jobUrl={draft.recruiter_info.job_url}
                                  buttonText="View Job Context"
                                  buttonClassName="px-3 py-1 text-xs bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg transition-colors"
                                />
                              </div>
                            )}
                            <span className="text-xs">
                              {new Date(draft.created_at).toLocaleDateString()}
                            </span>
                            <div className="flex items-center gap-2">
                              {(draft.draft_type === 'email' || draft.draft_type === 'both') && (
                                <span className={`text-xs px-2 py-1 rounded ${
                                  draft.email_sent || emailStatus === 'sent' 
                                    ? 'bg-green-900/50 text-green-300' 
                                    : 'bg-blue-900/50 text-blue-300'
                                }`}>
                                  📧 {draft.email_sent || emailStatus === 'sent' ? 'Sent' : 'Email'}
                                </span>
                              )}
                              {(draft.draft_type === 'linkedin' || draft.draft_type === 'both') && (
                                <span className={`text-xs px-2 py-1 rounded ${
                                  draft.linkedin_sent || linkedinStatus === 'sent' 
                                    ? 'bg-green-900/50 text-green-300' 
                                    : 'bg-blue-900/50 text-blue-300'
                                }`}>
                                  💼 {draft.linkedin_sent || linkedinStatus === 'sent' ? 'Sent' : 'LinkedIn'}
                                </span>
                              )}
                            </div>
                            <svg
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                    </div>

                    {/* Expandable Content */}
                    <CollapsibleContent>
                      <div className="border-t border-gray-700/50 p-6 space-y-6">
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                          {/* Email Section */}
                          {(draft.draft_type === 'email' || draft.draft_type === 'both') && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-lg font-semibold text-white">📧 Email</h4>
                                {(emailStatus || draft.email_sent) && (
                                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(emailStatus || (draft.email_sent ? 'sent' : ''))}`}>
                                    {getStatusIcon(emailStatus || (draft.email_sent ? 'sent' : ''))} {emailStatus || (draft.email_sent ? 'sent' : '')}
                                  </span>
                                )}
                              </div>
                              
                              {isEditingEmail ? (
                                <>
                                  <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-300">Subject</label>
                                    <input
                                      type="text"
                                      className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
                                      value={editValues.email_subject}
                                      onChange={(e) => setEditValues({ ...editValues, email_subject: e.target.value })}
                                    />
                                    <label className="block text-sm font-medium text-gray-300">Body</label>
                                    <textarea
                                      ref={(textarea) => {
                                        if (textarea && isEditingEmail) {
                                          const measureDiv = document.createElement('div')
                                          measureDiv.style.cssText = 'position: absolute; visibility: hidden; white-space: pre-wrap; font-size: 0.875rem; line-height: 1.5; padding: 0.75rem 1rem; width: ' + textarea.offsetWidth + 'px;'
                                          measureDiv.textContent = draft.email_body || 'N/A'
                                          document.body.appendChild(measureDiv)
                                          
                                          setTimeout(() => {
                                            const displayHeight = measureDiv.offsetHeight
                                            if (displayHeight > 0) {
                                              textarea.style.height = `${Math.max(displayHeight, 192)}px`
                                            }
                                            document.body.removeChild(measureDiv)
                                          }, 0)
                                        }
                                      }}
                                      className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-sans text-sm focus:border-blue-500 focus:outline-none resize-y"
                                      value={editValues.email_body}
                                      onChange={(e) => setEditValues({ ...editValues, email_body: e.target.value })}
                                      style={{ 
                                        minHeight: '12rem',
                                        lineHeight: '1.5'
                                      }}
                                    />
                                    <div className="flex justify-end text-xs">
                                      <span className="text-gray-400">
                                        {(editValues.email_body || '').length} characters
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => handleSaveEdit(draft.id)}
                                      variant="default"
                                      className="flex-1"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      onClick={handleCancelEdit}
                                      variant="outline"
                                      className="flex-1"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="space-y-2">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-300 mb-1">Subject</label>
                                      <p className="text-gray-200 text-sm">{draft.email_subject || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-300 mb-1">Body</label>
                                      <p className="text-gray-300 text-sm whitespace-pre-wrap">{draft.email_body || 'N/A'}</p>
                                    </div>
                                    <br />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => handleSendEmail(draft.id)}
                                      disabled={emailStatus === 'sending' || emailStatus === 'sent' || draft.email_sent}
                                      variant="default"
                                      className="flex-1"
                                    >
                                      {emailStatus === 'sending' ? 'Sending...' : (emailStatus === 'sent' || draft.email_sent) ? 'Sent ✓' : 'Send Email'}
                                    </Button>
                                    {!draft.email_sent && (
                                      <Button
                                        onClick={() => handleStartEdit(draft.id, 'email')}
                                        variant="outline"
                                      >
                                        Edit ✏️
                                      </Button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* LinkedIn Section */}
                          {(draft.draft_type === 'linkedin' || draft.draft_type === 'both') && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-lg font-semibold text-white">💼 LinkedIn Message</h4>
                                {(linkedinStatus || draft.linkedin_sent) && (
                                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(linkedinStatus || (draft.linkedin_sent ? 'sent' : ''))}`}>
                                    {getStatusIcon(linkedinStatus || (draft.linkedin_sent ? 'sent' : ''))} {linkedinStatus || (draft.linkedin_sent ? 'sent' : '')}
                                  </span>
                                )}
                              </div>
                              
                              {isEditingLinkedIn ? (
                                <>
                                  <textarea
                                    ref={(textarea) => {
                                      if (textarea && isEditingLinkedIn) {
                                        const measureDiv = document.createElement('div')
                                        measureDiv.style.cssText = 'position: absolute; visibility: hidden; white-space: pre-wrap; font-size: 0.875rem; line-height: 1.5; padding: 0.75rem 1rem; width: ' + textarea.offsetWidth + 'px;'
                                        measureDiv.textContent = draft.linkedin_message || 'N/A'
                                        document.body.appendChild(measureDiv)
                                        
                                        setTimeout(() => {
                                          const displayHeight = measureDiv.offsetHeight
                                          if (displayHeight > 0) {
                                            textarea.style.height = `${Math.max(displayHeight, 256)}px`
                                          }
                                          document.body.removeChild(measureDiv)
                                        }, 0)
                                      }
                                    }}
                                    className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-sans text-sm focus:border-blue-500 focus:outline-none resize-y"
                                    value={editValues.linkedin_message}
                                    onChange={(e) => setEditValues({ ...editValues, linkedin_message: e.target.value })}
                                    style={{ 
                                      minHeight: '16rem',
                                      lineHeight: '1.5'
                                    }}
                                  />
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400">
                                      LinkedIn connection requests have a limit of {linkedInCharLimit} characters{linkedInAccount?.is_premium === false ? ' (free account)' : linkedInAccount?.is_premium === true ? ' (premium account)' : ''}
                                    </span>
                                    <span className={`font-medium ${
                                      (editValues.linkedin_message || '').length > linkedInCharLimit 
                                        ? 'text-red-400' 
                                        : (editValues.linkedin_message || '').length > (linkedInCharLimit * 0.83) 
                                        ? 'text-amber-400' 
                                        : 'text-gray-400'
                                    }`}>
                                      {(editValues.linkedin_message || '').length} / {linkedInCharLimit}
                                    </span>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => handleSaveEdit(draft.id)}
                                      variant="default"
                                      className="flex-1"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      onClick={handleCancelEdit}
                                      variant="outline"
                                      className="flex-1"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{draft.linkedin_message || 'N/A'}</p>
                                    <br />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => handleSendLinkedIn(draft.id)}
                                      disabled={linkedinStatus === 'sending' || linkedinStatus === 'sent' || draft.linkedin_sent}
                                      variant="default"
                                      className="flex-1"
                                    >
                                      {linkedinStatus === 'sending' ? 'Sending...' : (linkedinStatus === 'sent' || draft.linkedin_sent) ? 'Sent ✓' : 'Send LinkedIn Message'}
                                    </Button>
                                    {!draft.linkedin_sent && (
                                      <Button
                                        onClick={() => handleStartEdit(draft.id, 'linkedin')}
                                        variant="outline"
                                      >
                                        Edit ✏️
                                      </Button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Additional Info */}
                        <div className="pt-4 border-t border-gray-700/50">
                          <div className="flex items-center justify-between text-sm text-gray-400">
                            <div className="flex items-center gap-4">
                              {draft.recipient_email && (
                                <span>📧 {draft.recipient_email}</span>
                              )}
                              {draft.recipient_linkedin_url && (
                                <a
                                  href={draft.recipient_linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:underline"
                                >
                                  🔗 View LinkedIn Profile
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {draft.draft_type === 'both' && (!draft.email_sent || !draft.linkedin_sent) && (
                                <Button
                                  onClick={() => handleSendBoth(draft.id)}
                                  disabled={
                                    (sendingStatus[draft.id]?.email === 'sending' || sendingStatus[draft.id]?.linkedin === 'sending') ||
                                    (draft.email_sent && draft.linkedin_sent)
                                  }
                                  variant="default"
                                  size="sm"
                                >
                                  {(sendingStatus[draft.id]?.email === 'sending' || sendingStatus[draft.id]?.linkedin === 'sending') 
                                    ? 'Sending...' 
                                    : 'Send Email and Message'}
                                </Button>
                              )}
                              <Button
                                onClick={() => handleDeleteDraft(draft.id)}
                                variant="destructive"
                                size="sm"
                              >
                                Delete Draft
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}


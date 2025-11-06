import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../utils/api'
import { trackEmailSent, trackLinkedInInvite } from '../utils/dashboardStats'

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
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sendingStatus, setSendingStatus] = useState({})
  const [editingDraft, setEditingDraft] = useState(null) // { draftId: number, part: 'email' | 'linkedin' }
  const [editValues, setEditValues] = useState({})

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
      alert(`Failed to load drafts: ${error.message}`)
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
      alert(`Failed to send email: ${error.message}`)
    }
  }

  const handleSendLinkedIn = async (draftId) => {
    setSendingStatus(prev => ({
      ...prev,
      [draftId]: { ...prev[draftId], linkedin: 'sending' }
    }))

    try {
      const result = await sendDraft(draftId, false, true)
      if (result.success) {
        setSendingStatus(prev => ({
          ...prev,
          [draftId]: { ...prev[draftId], linkedin: 'sent' }
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
        throw new Error(result.error || 'Failed to send LinkedIn message')
      }
    } catch (error) {
      setSendingStatus(prev => ({
        ...prev,
        [draftId]: { ...prev[draftId], linkedin: 'error', error: error.message }
      }))
      alert(`Failed to send LinkedIn message: ${error.message}`)
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
      alert(`Failed to delete draft: ${error.message}`)
    }
  }

  const handleStartEdit = (draftId, part) => {
    // Don't allow editing parts that have already been sent
    const draft = drafts.find(d => d.id === draftId)
    if (!draft) return
    
    if (part === 'email' && draft.email_sent) {
      alert('Email has already been sent. Cannot edit.')
      return
    }
    if (part === 'linkedin' && draft.linkedin_sent) {
      alert('LinkedIn message has already been sent. Cannot edit.')
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
      alert(`Failed to update draft: ${error.message}`)
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
        return 'bg-green-900/50 text-green-300 border border-green-700/50'
      case 'sending':
        return 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50'
      case 'error':
        return 'bg-red-900/50 text-red-300 border border-red-700/50'
      default:
        return 'bg-gray-800/50 text-gray-300 border border-gray-700/50'
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Loading drafts...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">📝 Drafts</h1>
          <p className="mt-2 text-gray-300">
            Manage your unsent outreach messages ({drafts.length} draft{drafts.length !== 1 ? 's' : ''})
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard/search')}
          className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-4 py-2 text-gray-200 hover:bg-gray-700/50"
        >
          ← Back to Search
        </button>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm p-12 text-center">
          <p className="text-gray-400 text-lg mb-2">No drafts found</p>
          <p className="text-gray-500 text-sm mb-4">
            Drafts you save from the Messages page will appear here
          </p>
          <button
            onClick={() => navigate('/dashboard/search')}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Start Searching
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {drafts.map((draft) => {
            const emailStatus = sendingStatus[draft.id]?.email
            const linkedinStatus = sendingStatus[draft.id]?.linkedin
            const isEditingEmail = editingDraft?.draftId === draft.id && editingDraft?.part === 'email'
            const isEditingLinkedIn = editingDraft?.draftId === draft.id && editingDraft?.part === 'linkedin'

            return (
              <div key={draft.id} className="rounded-lg border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm p-6 shadow-lg">
                {/* Draft Header */}
                <div className="mb-6 border-b border-gray-700/50 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {draft.recipient_name || 'Unknown Recruiter'}
                      </h3>
                      <p className="text-gray-300">
                        {draft.company_name || 'Unknown Company'}
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-gray-400">
                        {draft.recipient_email && (
                          <p>📧 Email: {draft.recipient_email}</p>
                        )}
                        {draft.recipient_linkedin_url && (
                          <p>
                            🔗 LinkedIn:{' '}
                            <a
                              href={draft.recipient_linkedin_url}
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
                        Job: {draft.job_title || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-400">
                        Created: {new Date(draft.created_at).toLocaleDateString()}
                      </div>
                      <div className="mt-1">
                        <span className="rounded-full bg-blue-900/50 text-blue-300 px-2 py-1 text-xs">
                          {draft.draft_type === 'both' ? 'Email + LinkedIn' : draft.draft_type === 'email' ? 'Email' : 'LinkedIn'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

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
                              className="h-48 w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
                              value={editValues.email_body}
                              onChange={(e) => setEditValues({ ...editValues, email_body: e.target.value })}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(draft.id)}
                              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex-1 rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
                            >
                              Cancel
                            </button>
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
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSendEmail(draft.id)}
                              disabled={emailStatus === 'sending' || emailStatus === 'sent' || draft.email_sent}
                              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                              {emailStatus === 'sending' ? 'Sending...' : (emailStatus === 'sent' || draft.email_sent) ? 'Sent ✓' : 'Send Email'}
                            </button>
                            {!draft.email_sent && (
                              <button
                                onClick={() => handleStartEdit(draft.id, 'email')}
                                className="rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
                              >
                                ✏️
                              </button>
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
                            className="h-64 w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
                            value={editValues.linkedin_message}
                            onChange={(e) => setEditValues({ ...editValues, linkedin_message: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(draft.id)}
                              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex-1 rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <textarea
                            className="h-64 w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
                            value={draft.linkedin_message || ''}
                            readOnly
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSendLinkedIn(draft.id)}
                              disabled={linkedinStatus === 'sending' || linkedinStatus === 'sent' || draft.linkedin_sent}
                              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                              {linkedinStatus === 'sending' ? 'Sending...' : (linkedinStatus === 'sent' || draft.linkedin_sent) ? 'Sent ✓' : 'Send LinkedIn Message'}
                            </button>
                            {!draft.linkedin_sent && (
                              <button
                                onClick={() => handleStartEdit(draft.id, 'linkedin')}
                                className="rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => handleDeleteDraft(draft.id)}
                    className="rounded-lg bg-red-900/50 border border-red-700/50 px-4 py-2 text-red-300 hover:bg-red-800/50"
                  >
                    Delete Draft
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


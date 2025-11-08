import { useQuery } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { motion } from 'motion/react'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible'
import { LoaderOne } from '../components/ui/loader'
import { apiRequest } from '../utils/api'
import { trackEmailSent, trackLinkedInInvite } from '../utils/dashboardStats'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const steps = [
  'Find Companies',
  'Find Jobs',
  'Find Recruiters',
  'Map to Best Recruiters',
  'Outreach'
]

// API functions
async function searchCompany(name) {
  return apiRequest('/api/v1/search/company', {
    method: 'POST',
    body: JSON.stringify({ name })
  })
}

async function searchJobs(companyIds, jobTitles, jobType = 'full_time') {
  return apiRequest('/api/v1/search/jobs', {
    method: 'POST',
    body: JSON.stringify({
      company_ids: companyIds,
      job_titles: jobTitles,
      job_type: jobType,
      location_id: '102571732'
    })
  })
}

async function filterJobs(jobs) {
  return apiRequest('/api/v1/search/filter', {
    method: 'POST',
    body: JSON.stringify({
      jobs: jobs,
      resume_file: 'Resume-Tulsi,Shreyas.pdf'
    })
  })
}

async function searchRecruiters(companyIds) {
  return apiRequest('/api/v1/search/recruiters', {
    method: 'POST',
    body: JSON.stringify({
      company_ids: companyIds
    })
  })
}

async function mapJobsToRecruiters(jobs, recruiters, maxPairs = 2) {
  return apiRequest('/api/v1/search/map', {
    method: 'POST',
    body: JSON.stringify({
      jobs: jobs,
      recruiters: recruiters,
      max_pairs: maxPairs
    })
  })
}

async function extractEmails(recruiters) {
  return apiRequest('/api/v1/outreach/emails/extract', {
    method: 'POST',
    body: JSON.stringify({
      recruiters: recruiters
    })
  })
}

async function generateLinkedInMessage(recruiter, jobTitle, companyName) {
  return apiRequest('/api/v1/outreach/linkedin/generate', {
    method: 'POST',
    body: JSON.stringify({
      recruiter: recruiter,
      job_title: jobTitle,
      company_name: companyName,
      resume_file: 'Resume-Tulsi,Shreyas.pdf'
    })
  })
}

async function generateEmail(jobTitles, jobType, recruiter) {
  return apiRequest('/api/v1/outreach/email/generate', {
    method: 'POST',
    body: JSON.stringify({
      job_titles: jobTitles,
      job_type: jobType,
      recruiter: recruiter
    })
  })
}

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

async function saveDraft(draftData) {
  return apiRequest('/api/v1/drafts', {
    method: 'POST',
    body: JSON.stringify(draftData)
  })
}

// Floating GPT-like thinking component
function ThinkingIndicator({ logs, isActive }) {
  const latestLog = logs && logs.length > 0 ? logs[logs.length - 1] : null
  
  if (!isActive && !latestLog) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="fixed bottom-8 right-8 max-w-md bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4 shadow-2xl z-50"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
        </div>
        <div className="flex-1 min-w-0">
          {latestLog ? (
            <>
              <div className="text-xs text-cyan-400/70 font-mono mb-1">
                {latestLog.emoji || '•'} {latestLog.message}
              </div>
              <div className="text-[10px] text-gray-500 font-mono">
                {new Date(latestLog.timestamp).toLocaleTimeString()}
              </div>
            </>
          ) : (
            <div className="text-xs text-cyan-400/70 font-mono">
              Thinking...
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function Search() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedCompanies, setSelectedCompanies] = useState([]) // Array of company objects {name, id}
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTrigger, setSearchTrigger] = useState(null)
  const [jobTitle, setJobTitle] = useState('')
  const [jobType, setJobType] = useState('full_time')
  const [jobSearchTrigger, setJobSearchTrigger] = useState(null)
  const [isFiltering, setIsFiltering] = useState(false)
  const [jobResults, setJobResults] = useState(null)
  const [mappedJobs, setMappedJobs] = useState([]) // Jobs in recruiter mapping placeholders (dynamic slots)
  const [isMappingToRecruiters, setIsMappingToRecruiters] = useState(false)
  const [mapping, setMapping] = useState([])
  const [mappedRecruiters, setMappedRecruiters] = useState([])
  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false)
  const [thinkingLogs, setThinkingLogs] = useState([])
  const eventSourceRef = useRef(null)
  const [draggedJob, setDraggedJob] = useState(null)
  const [draggedOverIndex, setDraggedOverIndex] = useState(null)
  const [generatedMessages, setGeneratedMessages] = useState([])
  const [sendingStatus, setSendingStatus] = useState({})
  const [isSending, setIsSending] = useState(false)
  const [savingStatus, setSavingStatus] = useState({}) // Track saving status for each message
  const [isSavingAll, setIsSavingAll] = useState(false)
  const savedDraftsRef = useRef(new Set()) // Track which messages we've already saved as drafts
  const [expandedMessages, setExpandedMessages] = useState(new Set()) // Set of expanded message indices
  const [editingMessage, setEditingMessage] = useState(null) // { index: number, part: 'email' | 'linkedin' }
  const [editValues, setEditValues] = useState({}) // Temporary edit values

  // Connect to verbose logger stream for thinking indicator
  useEffect(() => {
    let isMounted = true
    const connectSSE = async () => {
      try {
        const { getSessionToken } = await import('../utils/supabase')
        const token = await getSessionToken()
        
        if (!token) {
          console.log('No token available for verbose logger')
          return
        }
        
        console.log('Connecting to verbose logger stream...')
        const response = await fetch(`${API_BASE_URL}/api/v1/verbose/stream`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
          },
          credentials: 'include'
        })
        
        if (!response.ok) {
          console.error('SSE connection failed:', response.status, response.statusText)
          return
        }
        
        console.log('SSE connection established')
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        
        const readStream = async () => {
          try {
            while (isMounted) {
              const { done, value } = await reader.read()
              if (done) {
                console.log('SSE stream ended')
                break
              }
              
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''
              
              for (const line of lines) {
                if (line.trim() === '' || line.trim() === ': heartbeat') continue
                
                if (line.startsWith('data: ')) {
                  try {
                    const logEntry = JSON.parse(line.slice(6))
                    if (isMounted) {
                      setThinkingLogs(prev => {
                        const newLogs = [...prev, logEntry]
                        // Keep only last 5 logs
                        return newLogs.slice(-5)
                      })
                    }
                  } catch (e) {
                    console.error('Error parsing log entry:', e, line)
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error reading stream:', error)
            if (isMounted) {
              // Try to reconnect after 3 seconds
              setTimeout(() => {
                if (isMounted) connectSSE()
              }, 3000)
            }
          }
        }
        
        readStream()
        eventSourceRef.current = { close: () => {
          isMounted = false
          reader.cancel()
        } }
      } catch (error) {
        console.error('Error connecting to verbose logger:', error)
        // Try to reconnect after 3 seconds
        if (isMounted) {
          setTimeout(() => {
            if (isMounted) connectSSE()
          }, 3000)
        }
      }
    }

    connectSSE()

    return () => {
      isMounted = false
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  // Search companies query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['searchCompanies', searchTrigger],
    queryFn: () => searchCompany(searchTrigger),
    enabled: !!searchTrigger,
    retry: false
  })

  // Search jobs query - limit to 5 jobs total
  const { data: jobsData, isLoading: isSearchingJobs, error: jobSearchError } = useQuery({
    queryKey: ['searchJobs', jobSearchTrigger],
    queryFn: async () => {
      if (!jobSearchTrigger) throw new Error('Job search trigger not set')
      const { companyIds, title, type } = jobSearchTrigger
      const result = await searchJobs(companyIds, [title], type)
      // Limit to 5 jobs total from unipile
      if (result?.jobs && result.jobs.length > 5) {
        return { ...result, jobs: result.jobs.slice(0, 5) }
      }
      return result
    },
    enabled: !!(jobSearchTrigger && jobSearchTrigger.companyIds && jobSearchTrigger.companyIds.length > 0 && jobSearchTrigger.title),
    retry: false
  })

  // Update step based on progress
  useEffect(() => {
    if (selectedCompanies.length > 0) setCurrentStep(0)
    if (jobResults) setCurrentStep(1)
    if (mappedJobs.length > 0) setCurrentStep(1)
    if (mapping.length > 0) setCurrentStep(3)
    if (generatedMessages.length > 0) setCurrentStep(4)
  }, [selectedCompanies, jobResults, mappedJobs, mapping, generatedMessages])

  // Handle company selection
  const handleSelectCompany = () => {
    if (searchResults?.company_id && searchResults?.company?.name) {
      const companyName = searchResults.company.name
      const companyId = searchResults.company_id
      
      // Check if already selected
      if (!selectedCompanies.find(c => c.id === companyId)) {
        setSelectedCompanies([...selectedCompanies, { name: companyName, id: companyId }])
        setSearchQuery('')
        setSearchTrigger(null)
      }
    }
  }

  // Remove company
  const handleRemoveCompany = (companyId) => {
    setSelectedCompanies(selectedCompanies.filter(c => c.id !== companyId))
  }

  // Handle job search
  const handleSearchJobs = () => {
    const companyIds = selectedCompanies.map(c => c.id)
    if (companyIds.length > 0 && jobTitle.trim()) {
      setJobSearchTrigger({
        companyIds: companyIds,
        title: jobTitle.trim(),
        type: jobType
      })
    }
  }

  // Update job results
  useEffect(() => {
    if (jobsData?.jobs) {
      setJobResults(jobsData)
      setCurrentStep(1)
      // Initialize mappedJobs array with nulls matching the number of jobs
      const jobCount = jobsData.jobs.length
      setMappedJobs(Array(jobCount).fill(null))
    }
  }, [jobsData])

  // Handle filter jobs
  const handleFilterJobs = async () => {
    if (!jobResults?.jobs || jobResults.jobs.length === 0) return

    setIsFiltering(true)
    try {
      const result = await filterJobs(jobResults.jobs)
      if (result.filtered_jobs && result.filtered_jobs.length > 0) {
        // Auto-place filtered jobs into mapping slots
        const filtered = result.filtered_jobs
        const newMappedJobs = Array(jobResults.jobs.length).fill(null)
        filtered.forEach((job, index) => {
          if (index < newMappedJobs.length) {
            newMappedJobs[index] = job
          }
        })
        setMappedJobs(newMappedJobs)
      }
    } catch (error) {
      console.error('Error filtering jobs:', error)
    } finally {
      setIsFiltering(false)
    }
  }

  // Handle select all jobs
  const handleSelectAll = () => {
    if (!jobResults?.jobs || jobResults.jobs.length === 0) return
    
    // Place all jobs into mapping slots
    const newMappedJobs = [...jobResults.jobs]
    setMappedJobs(newMappedJobs)
  }

  // Handle drag and drop - improved state management
  const handleDragStart = (e, job) => {
    console.log('Drag start', job)
    setDraggedJob(job)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(job))
    e.dataTransfer.setData('text/plain', '') // Required for some browsers
  }

  const handleDragEnd = (e) => {
    console.log('Drag end')
    // Don't clear immediately - let drop handler process first
    setTimeout(() => {
      setDraggedJob(null)
      setDraggedOverIndex(null)
    }, 100)
  }

  const handleDrop = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('Drop event triggered', { draggedJob, index })
    
    // Try to get data from dataTransfer first, then fall back to state
    let jobToDrop = draggedJob
    try {
      const data = e.dataTransfer.getData('application/json')
      if (data) {
        jobToDrop = JSON.parse(data)
      }
    } catch (err) {
      console.log('Could not parse drag data, using state', err)
    }
    
    // Check if it's a valid job object (has title or id, and is not our internal drag state object)
    // Internal drag state objects have type: 'job' or type: 'recruiter' (lowercase)
    // Actual job objects have type: 'JOB' (uppercase) or no type property
    const isInternalDragState = jobToDrop && (jobToDrop.type === 'job' || jobToDrop.type === 'recruiter')
    const isValidJob = jobToDrop && 
                       typeof jobToDrop === 'object' && 
                       !isInternalDragState &&
                       (jobToDrop.title || jobToDrop.id || jobToDrop.reference_id)
    
    if (isValidJob) {
      const newMappedJobs = [...mappedJobs]
      newMappedJobs[index] = jobToDrop
      setMappedJobs(newMappedJobs)
      setDraggedJob(null)
      setDraggedOverIndex(null)
      console.log('Job dropped successfully', newMappedJobs)
    } else {
      console.log('Invalid drop - jobToDrop:', jobToDrop, 'isInternalDragState:', isInternalDragState)
    }
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (draggedJob) {
      setDraggedOverIndex(index)
    }
  }

  const handleRemoveJob = (index) => {
    const newMappedJobs = [...mappedJobs]
    newMappedJobs[index] = null
    setMappedJobs(newMappedJobs)
  }

  // Handle clear all mapped jobs
  const handleClearAll = () => {
    const newMappedJobs = Array(mappedJobs.length).fill(null)
    setMappedJobs(newMappedJobs)
  }

  // Map to recruiters
  const handleMapToRecruiters = async () => {
    const jobsToMap = mappedJobs.filter(j => j !== null)
    if (jobsToMap.length === 0) return

    setIsMappingToRecruiters(true)
    setThinkingLogs([])

    try {
      // First get recruiters - use all selected company IDs
      const companyIds = selectedCompanies.map(c => c.id)
      const recruiterResult = await searchRecruiters(companyIds)
        if (!recruiterResult.recruiters || recruiterResult.recruiters.length === 0) {
        alert('No recruiters found')
        setIsMappingToRecruiters(false)
          return
        }
        
      // Then map jobs to recruiters
      const mapResult = await mapJobsToRecruiters(jobsToMap, recruiterResult.recruiters, jobsToMap.length)
      
      if (mapResult.mapping && mapResult.mapping.length > 0) {
        setMapping(mapResult.mapping)
        setMappedRecruiters(mapResult.selected_recruiters || mapResult.mapping.map(m => ({
            name: m.recruiter_name,
            company: m.recruiter_company,
          profile_url: m.recruiter_profile_url
        })))
        setCurrentStep(3)
      }
    } catch (error) {
      console.error('Error mapping to recruiters:', error)
      alert('Failed to map jobs to recruiters')
    } finally {
      setIsMappingToRecruiters(false)
    }
  }

  // Generate messages
  const handleGenerateMessages = async () => {
    if (mapping.length === 0) return

    setIsGeneratingMessages(true)
    setThinkingLogs([])

    try {
      // Extract emails
      const emailResult = await extractEmails(mappedRecruiters)
      const recruitersWithEmails = emailResult.recruiters || []

      // Generate messages for each mapping
      const messages = []
      for (let i = 0; i < mapping.length; i++) {
        const mapItem = mapping[i]
        const recruiter = recruitersWithEmails.find(r => 
            (r.name || r.profile_url) === mapItem.recruiter_name || 
            r.profile_url === mapItem.recruiter_profile_url
          ) || {}
          
            const linkedinResult = await generateLinkedInMessage(
          recruiter,
              mapItem.job_title || 'Position',
          mapItem.job_company || 'Company'
            )
            
            const emailResult_gen = await generateEmail(
              [mapItem.job_title || 'Position'],
              jobType,
          recruiter
            )
        
        // Handle LinkedIn message - could be string or object with message property
        const linkedinMsg = typeof linkedinResult === 'string' 
          ? linkedinResult 
          : linkedinResult?.message || linkedinResult || ''
        
        // Handle email - could have different structures
        const emailSubject = emailResult_gen?.subject || emailResult_gen?.Subject || ''
        const emailBody = emailResult_gen?.body || emailResult_gen?.Body || emailResult_gen?.content || emailResult_gen?.Content || emailResult_gen || ''
        
        messages.push({
          linkedinMessage: linkedinResult.message || linkedinResult,
          email: emailResult_gen,
          recruiter: recruiter,
          mapItem: mapItem,
          editedLinkedInMessage: linkedinMsg,
          editedEmailSubject: emailSubject,
          editedEmailBody: typeof emailBody === 'string' ? emailBody : JSON.stringify(emailBody)
        })
      }

      // Set messages in state and update step
      setGeneratedMessages(messages)
      setCurrentStep(4)
      localStorage.setItem('outreachMessages', JSON.stringify(messages))
    } catch (error) {
      console.error('Error generating messages:', error)
      alert(`Error generating messages: ${error.message}`)
    } finally {
      setIsGeneratingMessages(false)
    }
  }

  // Update message
  const updateMessage = (index, field, value) => {
    setGeneratedMessages(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value
      }
      return updated
    })
  }

  // Send LinkedIn message
  const handleSendLinkedIn = async (index) => {
    const messageData = generatedMessages[index]
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
        const company = messageData.mapItem?.job_company || messageData.recruiter?.company || messageData.mapItem?.recruiter_company || 'Unknown Company'
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

  // Send email
  const handleSendEmail = async (index) => {
    const messageData = generatedMessages[index]
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
      if (result && result.success) {
        setSendingStatus(prev => ({
          ...prev,
          [index]: { ...prev[index], email: 'sent' }
        }))
        
        // Track in dashboard stats
        const role = messageData.mapItem?.job_title || 'Unknown Role'
        const company = messageData.mapItem?.job_company || messageData.recruiter?.company || messageData.mapItem?.recruiter_company || 'Unknown Company'
        const recruiterName = messageData.recruiter?.name || messageData.mapItem?.recruiter_name || 'Unknown Recruiter'
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
      const messageData = generatedMessages[index]
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
      const savePromises = generatedMessages.map(async (messageData, index) => {
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

  // Status helpers
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

  // Rearrange jobs and recruiters
  const handleRearrangeJob = (fromIndex, toIndex) => {
    const newMappedJobs = [...mappedJobs]
    const temp = newMappedJobs[fromIndex]
    newMappedJobs[fromIndex] = newMappedJobs[toIndex]
    newMappedJobs[toIndex] = temp
    setMappedJobs(newMappedJobs)
  }

  const handleRearrangeRecruiter = (fromIndex, toIndex) => {
    const newMapping = [...mapping]
    const temp = newMapping[fromIndex]
    newMapping[fromIndex] = newMapping[toIndex]
    newMapping[toIndex] = temp
    setMapping(newMapping)
    
    const newRecruiters = [...mappedRecruiters]
    const tempRecruiter = newRecruiters[fromIndex]
    newRecruiters[fromIndex] = newRecruiters[toIndex]
    newRecruiters[toIndex] = tempRecruiter
    setMappedRecruiters(newRecruiters)
  }

  // Back button handlers
  const handleBackToCompanies = () => {
    // Reset to initial search state
    setJobResults(null)
    setMappedJobs([])
    setMapping([])
    setMappedRecruiters([])
    setGeneratedMessages([])
    setCurrentStep(0)
    setJobSearchTrigger(null)
    setSendingStatus({})
    setSavingStatus({})
    savedDraftsRef.current.clear()
    // Clear localStorage
    localStorage.removeItem('outreachMessages')
  }

  const handleBackToJobs = () => {
    // Go back to job selection, clear mapping and messages
    setMapping([])
    setMappedRecruiters([])
    setGeneratedMessages([])
    setCurrentStep(1)
    setSendingStatus({})
    setSavingStatus({})
    savedDraftsRef.current.clear()
    // Clear localStorage
    localStorage.removeItem('outreachMessages')
    // Reset mapped jobs to empty array but keep job results
    if (jobResults?.jobs) {
      setMappedJobs(Array(jobResults.jobs.length).fill(null))
    }
  }

  const handleBackToMapping = () => {
    // Go back to mapping view, clear messages
    setGeneratedMessages([])
    setCurrentStep(3)
    setSendingStatus({})
    setSavingStatus({})
    savedDraftsRef.current.clear()
    setExpandedMessages(new Set())
    setEditingMessage(null)
    setEditValues({})
    // Clear localStorage
    localStorage.removeItem('outreachMessages')
  }

  const toggleExpand = (index) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const handleStartEdit = (index, part) => {
    // Don't allow editing parts that have already been sent
    const messageData = generatedMessages[index]
    if (!messageData) return
    
    const emailStatus = sendingStatus[index]?.email
    const linkedinStatus = sendingStatus[index]?.linkedin
    
    if (part === 'email' && emailStatus === 'sent') {
      alert('Email has already been sent. Cannot edit.')
      return
    }
    if (part === 'linkedin' && linkedinStatus === 'sent') {
      alert('LinkedIn message has already been sent. Cannot edit.')
      return
    }
    
    setEditingMessage({ index, part })
    if (part === 'email') {
      setEditValues({
        email_subject: messageData.editedEmailSubject || messageData.email?.subject || '',
        email_body: messageData.editedEmailBody || messageData.email?.body || messageData.email?.content || ''
      })
    } else if (part === 'linkedin') {
      setEditValues({
        linkedin_message: messageData.editedLinkedInMessage || messageData.linkedinMessage || ''
      })
    }
  }

  const handleCancelEdit = () => {
    setEditingMessage(null)
    setEditValues({})
  }

  const handleSaveEdit = (index) => {
    const messageData = generatedMessages[index]
    if (!messageData) return
    
    if (editingMessage?.part === 'email') {
      updateMessage(index, 'editedEmailSubject', editValues.email_subject || '')
      updateMessage(index, 'editedEmailBody', editValues.email_body || '')
    } else if (editingMessage?.part === 'linkedin') {
      updateMessage(index, 'editedLinkedInMessage', editValues.linkedin_message || '')
    }
    
    setEditingMessage(null)
    setEditValues({})
  }

  return (
    <div className="space-y-6 min-h-screen pb-20">
      {/* Progressive Step Indicator */}
      <div className="flex items-center justify-center space-x-4 py-4">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            <span
              className={`text-sm font-medium transition-colors ${
                index === currentStep
                  ? 'text-blue-400'
                  : index < currentStep
                  ? 'text-green-400'
                  : 'text-gray-500'
              }`}
            >
              {step}
            </span>
            {index < steps.length - 1 && (
              <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Thinking Indicator */}
      <AnimatePresence>
        {(thinkingLogs.length > 0 || isMappingToRecruiters || isGeneratingMessages || isFiltering) && (
          <ThinkingIndicator 
            logs={thinkingLogs} 
            isActive={isMappingToRecruiters || isGeneratingMessages || isFiltering}
          />
        )}
      </AnimatePresence>

      {/* Initial Search Card - Keep visible during search */}
      {!jobResults && mapping.length === 0 && generatedMessages.length === 0 && (
        <div className="max-w-2xl mx-auto">
          <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50">
            <CardHeader>
              <CardTitle className="text-white">Search for Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Company Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Company Name</label>
                <div className="flex space-x-2">
              <input
                type="text"
                    placeholder="Enter company name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    setSearchTrigger(searchQuery.trim())
                  }
                }}
                    className="flex-1 rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  if (searchQuery.trim()) {
                    setSearchTrigger(searchQuery.trim())
                  }
                }}
                disabled={isSearching || !searchQuery.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                    {isSearching ? '...' : 'Search'}
              </button>
            </div>
                {searchResults?.company_id && (
                  <div className="mt-2 p-3 rounded-lg bg-gray-900/50 border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <span className="text-white">{searchResults.company.name}</span>
                    <button
                        onClick={handleSelectCompany}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        {selectedCompanies.find(c => c.id === searchResults.company_id) ? '✓ Selected' : '+ Add'}
                    </button>
              </div>
                </div>
                )}
                {selectedCompanies.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {selectedCompanies.map((company) => (
                      <div key={company.id} className="flex items-center justify-between p-2 rounded-lg bg-blue-900/50 border border-blue-700/50">
                        <span className="text-blue-300 text-sm">{company.name}</span>
                      <button
                          onClick={() => handleRemoveCompany(company.id)}
                          className="text-sm text-red-400 hover:text-red-300"
                      >
                          ×
                      </button>
                    </div>
                    ))}
                </div>
              )}
        </div>

              {/* Job Title */}
              {selectedCompanies.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Job Title</label>
                    <input
                      type="text"
                      placeholder="e.g., Software Engineer"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && jobTitle.trim() && selectedCompanies.length > 0) {
                        handleSearchJobs()
                      }
                    }}
                    className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
                  />
                    </div>
                  )}

              {/* Job Type */}
              {selectedCompanies.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Job Type</label>
                    <select
                      value={jobType}
                      onChange={(e) => setJobType(e.target.value)}
                    className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white px-4 py-2 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="full_time">Full Time</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>
              )}

              {/* Search Button */}
              {selectedCompanies.length > 0 && jobTitle.trim() && (
                  <button
                  onClick={handleSearchJobs}
                  disabled={isSearchingJobs || selectedCompanies.length === 0 || !jobTitle.trim()}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isSearchingJobs ? 'Searching...' : 'Search for Jobs'}
                  </button>
              )}
            </CardContent>
          </Card>
                </div>
      )}

      {/* Loading State - Show below search card when searching */}
      {isSearchingJobs && jobResults === null && !isMappingToRecruiters && (
        <div className="max-w-2xl mx-auto flex justify-center py-12">
          <LoaderOne />
                  </div>
                )}

      {/* Error Display */}
      {jobSearchError && !jobResults && (
        <div className="max-w-2xl mx-auto mt-4 p-4 rounded-lg bg-red-900/50 border border-red-700/50">
          <div className="text-sm text-red-300">
            Error: {jobSearchError.message || 'Failed to search jobs'}
                        </div>
                        </div>
      )}

      {/* Job Results and Mapping View */}
      {jobResults && mapping.length === 0 && !isMappingToRecruiters && generatedMessages.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto"
        >
            {/* Jobs List Card */}
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Jobs</CardTitle>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAll}
                      disabled={!jobResults?.jobs || jobResults.jobs.length === 0}
                      className="text-sm rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleFilterJobs}
                      disabled={isFiltering || !jobResults?.jobs}
                      className="text-sm rounded-lg bg-purple-600 px-3 py-1.5 text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {isFiltering ? 'Filtering...' : 'Filter'}
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {jobResults?.jobs?.map((job, index) => {
                        const companyName = typeof job.company === 'string' 
                          ? job.company 
                      : (job.company?.name || job.company_name || 'Unknown')
                    const isMapped = mappedJobs.some(m => m && m.url === job.url)
                        
                        return (
                      <div
                            key={index}
                        draggable
                        onDragStart={(e) => handleDragStart(e, job)}
                        onDragEnd={handleDragEnd}
                        className={`p-3 rounded-lg border cursor-move transition-all ${
                          isMapped 
                            ? 'bg-gray-700/50 border-gray-600/50' 
                            : 'bg-gray-900/50 border-gray-700/50 hover:bg-gray-800/50'
                        }`}
                          >
                            <div className="font-medium text-sm text-white">{job.title || 'Untitled'}</div>
                            <div className="text-xs text-gray-300 mt-1">{companyName}</div>
                            {job.location && (
                              <div className="text-xs text-gray-400 mt-1">
                            {typeof job.location === 'string' ? job.location : job.location?.name || ''}
                              </div>
                            )}
                      </div>
                    )
                  })}
                        </div>
                {/* Back button at bottom right */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleBackToCompanies}
                    className="text-sm rounded-lg bg-gray-700 px-3 py-1.5 text-white hover:bg-gray-600 transition-colors flex items-center gap-1"
                    title="Back to company search"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Recruiter Mapping Placeholders */}
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Recruiter Mapping</CardTitle>
                  {mappedJobs.some(j => j !== null) && (
                    <button
                      onClick={handleClearAll}
                      className="text-sm rounded-lg bg-red-600 px-3 py-1.5 text-white hover:bg-red-700"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {jobResults?.jobs?.map((_, index) => (
                    <div
                      key={index}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={() => setDraggedOverIndex(null)}
                      onDragEnter={(e) => {
                        e.preventDefault()
                        if (draggedJob) setDraggedOverIndex(index)
                      }}
                      className={`min-h-[100px] rounded-lg border-2 border-dashed p-4 transition-all ${
                        mappedJobs[index]
                          ? 'border-green-600/50 bg-green-900/20'
                          : draggedOverIndex === index
                          ? 'border-blue-500/50 bg-blue-900/20 scale-105'
                          : 'border-gray-600/50 bg-gray-900/20'
                      }`}
                    >
                      {mappedJobs[index] ? (
                        <div className="relative">
                          <div className="font-medium text-sm text-white">
                            {mappedJobs[index].title || 'Untitled'}
                    </div>
                          <div className="text-xs text-gray-300 mt-1">
                            {typeof mappedJobs[index].company === 'string' 
                              ? mappedJobs[index].company 
                              : mappedJobs[index].company?.name || 'Unknown'}
                    </div>
                          <button
                            onClick={() => handleRemoveJob(index)}
                            className="absolute top-0 right-0 text-gray-400 hover:text-red-400"
                          >
                            ×
                          </button>
                    </div>
            ) : (
                        <div className="text-sm text-gray-500 text-center py-4">
                          Drop job here
                        </div>
                      )}
                    </div>
                  ))}
          </div>
                {mappedJobs.some(j => j !== null) && (
                  <button
                    onClick={handleMapToRecruiters}
                    disabled={isMappingToRecruiters || mappedJobs.filter(j => j !== null).length === 0}
                    className="w-full mt-4 rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isMappingToRecruiters ? 'Mapping to Recruiters...' : 'Map to Best Recruiters'}
                  </button>
                )}
              </CardContent>
            </Card>
          </motion.div>
      )}

      {/* Mapping Loading State */}
      {isMappingToRecruiters && mapping.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="max-w-2xl mx-auto text-center py-20"
        >
          <LoaderOne />
        </motion.div>
      )}

      {/* Mapping Results View */}
      {mapping.length > 0 && !isMappingToRecruiters && generatedMessages.length === 0 && (
        <AnimatePresence>
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto"
          >
            {/* Jobs Section */}
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 relative">
                <CardHeader>
                  <CardTitle className="text-white">Selected Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mappedJobs.filter(j => j !== null).map((job, index) => (
                      <motion.div
                          key={index}
                        draggable
                        onDragStart={(e) => {
                          setDraggedJob({ type: 'job', data: job, index })
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => setDraggedJob(null)}
                        whileHover={{ scale: 1.02 }}
                        className="relative p-3 rounded-lg border border-gray-700/50 bg-gray-900/50 cursor-move min-h-[80px]"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm text-white">
                              {job.title || 'Untitled'}
                            </div>
                            <div className="text-xs text-gray-300 mt-1">
                              {typeof job.company === 'string' 
                                ? job.company 
                                : job.company?.name || 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-700/50">
                              Selected job
                            </div>
                          </div>
                        </div>
                        {index < mapping.length && (
                          <div className="absolute right-[-24px] top-1/2 -translate-y-1/2 hidden lg:flex items-center">
                            <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>
                        )}
                      </motion.div>
                      ))}
                    </div>
                    {/* Back button at bottom right */}
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={handleBackToJobs}
                        className="text-sm rounded-lg bg-gray-700 px-3 py-1.5 text-white hover:bg-gray-600 transition-colors flex items-center gap-1"
                        title="Back to job selection"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back
                      </button>
                    </div>
                </CardContent>
              </Card>

              {/* Recruiters Section */}
              <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Mapped Recruiters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mapping.map((mapItem, index) => {
                      const job = mappedJobs.filter(j => j !== null)[index]
                        return (
                      <motion.div
                            key={index}
                        draggable
                        onDragStart={(e) => {
                          setDraggedJob({ type: 'recruiter', data: mapItem, index })
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => setDraggedJob(null)}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (draggedJob && draggedJob.type === 'recruiter' && draggedJob.index !== index) {
                            handleRearrangeRecruiter(draggedJob.index, index)
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                        }}
                        whileHover={{ scale: 1.02 }}
                        className="relative p-3 rounded-lg border border-gray-700/50 bg-gray-900/50 cursor-move min-h-[80px]"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm text-white">
                                {mapItem.recruiter_name || 'Unknown Recruiter'}
                          </div>
                              <div className="text-xs text-gray-300 mt-1">
                                {mapItem.job_company || mapItem.recruiter_company || 'Unknown Company'}
                    </div>
                              <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-700/50">
                                💼 Matched for: <span className="font-medium">{mapItem.job_title}</span> at {mapItem.job_company}
                    </div>
                    </div>
                          {job && (
                            <div className="absolute left-[-32px] top-1/2 -translate-y-1/2 hidden lg:flex items-center">
                              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                              </svg>
                            </div>
                          )}
          </div>
                      </motion.div>
                    )})}
        </div>
                          <button
                    onClick={handleGenerateMessages}
                    disabled={isGeneratingMessages}
                    className="w-full mt-4 rounded-lg bg-green-600 px-4 py-3 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isGeneratingMessages ? 'Generating Messages...' : 'Generate Messages'}
                          </button>
                </CardContent>
              </Card>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Messages View - Show inline after generation */}
      {generatedMessages.length > 0 && !isGeneratingMessages && (
        <AnimatePresence>
          <motion.div
            key="messages"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="max-w-5xl mx-auto"
          >
            <div className="mb-6">
              <div>
                <h1 className="text-3xl font-bold text-white">📨 Review & Send Messages</h1>
                <p className="mt-2 text-gray-300">
                  Review and edit your LinkedIn messages and emails before sending to {generatedMessages.length} recruiter{generatedMessages.length !== 1 ? 's' : ''}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  💾 Save drafts manually or they will be automatically saved when you leave this page
                </p>
              </div>
            </div>

            {/* Message List - Email-like Interface */}
            <div className="space-y-1">
              {generatedMessages.map((messageData, index) => {
                const recruiter = messageData.recruiter || {}
                const mapItem = messageData.mapItem || {}
                const linkedinStatus = sendingStatus[index]?.linkedin
                const emailStatus = sendingStatus[index]?.email
                const isExpanded = expandedMessages.has(index)

                return (
                  <Collapsible
                    key={index}
                    open={isExpanded}
                    onOpenChange={() => toggleExpand(index)}
                  >
                    <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm transition-colors">
                      {/* Message Header - Always Visible */}
                      <div className="flex items-center gap-3 p-4 hover:bg-gray-700/20 transition-colors">
                        <CollapsibleTrigger asChild>
                          <button className="flex-1 flex items-center gap-4 text-left">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-semibold text-white truncate">
                                  {recruiter.name || mapItem.recruiter_name || 'Unknown Recruiter'}
                                </h3>
                                <span className="text-xs text-gray-400">
                                  {recruiter.extracted_email || recruiter.email || 'No email'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-400 truncate">
                                {mapItem.job_company || recruiter.company || mapItem.recruiter_company || 'Unknown Company'} • {mapItem.job_title || 'N/A'}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-3 text-sm text-gray-400">
                              <div className="flex items-center gap-2">
                                {recruiter.extracted_email || recruiter.email ? (
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    emailStatus === 'sent' 
                                      ? 'bg-green-900/50 text-green-300' 
                                      : emailStatus === 'sending'
                                      ? 'bg-yellow-900/50 text-yellow-300'
                                      : emailStatus === 'error'
                                      ? 'bg-red-900/50 text-red-300'
                                      : 'bg-blue-900/50 text-blue-300'
                                  }`}>
                                    📧 {emailStatus === 'sent' ? 'Sent' : emailStatus === 'sending' ? 'Sending' : emailStatus === 'error' ? 'Error' : 'Email'}
                                  </span>
                                ) : null}
                                {mapItem.recruiter_profile_url && (
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    linkedinStatus === 'sent' 
                                      ? 'bg-green-900/50 text-green-300' 
                                      : linkedinStatus === 'sending'
                                      ? 'bg-yellow-900/50 text-yellow-300'
                                      : linkedinStatus === 'error'
                                      ? 'bg-red-900/50 text-red-300'
                                      : 'bg-blue-900/50 text-blue-300'
                                  }`}>
                                    💼 {linkedinStatus === 'sent' ? 'Sent' : linkedinStatus === 'sending' ? 'Sending' : linkedinStatus === 'error' ? 'Error' : 'LinkedIn'}
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
                          </button>
                        </CollapsibleTrigger>
                      </div>

                      {/* Expandable Content */}
                      <CollapsibleContent>
                        <div className="border-t border-gray-700/50 p-6 space-y-6">
                          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            {/* Email Section */}
                            {(recruiter.extracted_email || recruiter.email) && (() => {
                              const isEditingEmail = editingMessage?.index === index && editingMessage?.part === 'email'
                              const emailSubject = messageData.editedEmailSubject || messageData.email?.subject || ''
                              const emailBody = messageData.editedEmailBody || messageData.email?.body || messageData.email?.content || ''
                              
                              return (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-lg font-semibold text-white">📧 Email</h4>
                                    {emailStatus && (
                                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(emailStatus)}`}>
                                        {getStatusIcon(emailStatus)} {emailStatus}
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
                                          value={editValues.email_subject || ''}
                                          onChange={(e) => setEditValues({ ...editValues, email_subject: e.target.value })}
                                        />
                                        <label className="block text-sm font-medium text-gray-300">Body</label>
                                        <textarea
                                          className="h-48 w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-sans text-sm focus:border-blue-500 focus:outline-none"
                                          value={editValues.email_body || ''}
                                          onChange={(e) => setEditValues({ ...editValues, email_body: e.target.value })}
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => handleSaveEdit(index)}
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
                                          <p className="text-gray-200 text-sm">{emailSubject || 'N/A'}</p>
                                        </div>
                                        <div>
                                          <label className="block text-sm font-medium text-gray-300 mb-1">Body</label>
                                          <p className="text-gray-300 text-sm whitespace-pre-wrap">{emailBody || 'N/A'}</p>
                                        </div>
                                        <br />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => handleSendEmail(index)}
                                          disabled={isSending || emailStatus === 'sending' || emailStatus === 'sent'}
                                          variant="default"
                                          className="flex-1"
                                        >
                                          {emailStatus === 'sending' ? 'Sending...' : emailStatus === 'sent' ? 'Sent ✓' : 'Send Email'}
                                        </Button>
                                        {emailStatus !== 'sent' && (
                                          <Button
                                            onClick={() => handleStartEdit(index, 'email')}
                                            variant="outline"
                                          >
                                            Edit ✏️
                                          </Button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )
                            })()}

                            {/* LinkedIn Section */}
                            {mapItem.recruiter_profile_url && (() => {
                              const isEditingLinkedIn = editingMessage?.index === index && editingMessage?.part === 'linkedin'
                              const linkedinMessage = messageData.editedLinkedInMessage || messageData.linkedinMessage || ''
                              
                              return (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-lg font-semibold text-white">💼 LinkedIn Message</h4>
                                    {linkedinStatus && (
                                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(linkedinStatus)}`}>
                                        {getStatusIcon(linkedinStatus)} {linkedinStatus}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {isEditingLinkedIn ? (
                                    <>
                                      <textarea
                                        className="h-64 w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-sans text-sm focus:border-blue-500 focus:outline-none"
                                        value={editValues.linkedin_message || ''}
                                        onChange={(e) => setEditValues({ ...editValues, linkedin_message: e.target.value })}
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => handleSaveEdit(index)}
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
                                        <p className="text-gray-300 text-sm whitespace-pre-wrap">{linkedinMessage || 'N/A'}</p>
                                        <br />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => handleSendLinkedIn(index)}
                                          disabled={isSending || linkedinStatus === 'sending' || linkedinStatus === 'sent'}
                                          variant="default"
                                          className="flex-1"
                                        >
                                          {linkedinStatus === 'sending' ? 'Sending...' : linkedinStatus === 'sent' ? 'Sent ✓' : 'Send LinkedIn Message'}
                                        </Button>
                                        {linkedinStatus !== 'sent' && (
                                          <Button
                                            onClick={() => handleStartEdit(index, 'linkedin')}
                                            variant="outline"
                                          >
                                            Edit ✏️
                                          </Button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )
                            })()}
                          </div>

                          {/* Additional Info */}
                          <div className="pt-4 border-t border-gray-700/50">
                            <div className="flex items-center justify-between text-sm text-gray-400">
                              <div className="flex items-center gap-4">
                                {recruiter.extracted_email && (
                                  <span>📧 {recruiter.extracted_email}</span>
                                )}
                                {mapItem.recruiter_profile_url && (
                                  <a
                                    href={mapItem.recruiter_profile_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline"
                                  >
                                    🔗 View LinkedIn Profile
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={() => handleSaveDraft(index)}
                                  disabled={savingStatus[index] === 'saving' || (emailStatus === 'sent' && linkedinStatus === 'sent')}
                                  variant={savingStatus[index] === 'saved' ? 'default' : 'outline'}
                                  size="sm"
                                  className={
                                    savingStatus[index] === 'saved' 
                                      ? 'bg-green-900/50 text-green-300 border-green-700/50' 
                                      : savingStatus[index] === 'saving'
                                      ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50'
                                      : savingStatus[index] === 'error'
                                      ? 'bg-red-900/50 text-red-300 border-red-700/50'
                                      : ''
                                  }
                                >
                                  {savingStatus[index] === 'saving' ? '💾 Saving...' :
                                   savingStatus[index] === 'saved' ? '✅ Saved' :
                                   savingStatus[index] === 'error' ? '❌ Error' :
                                   savedDraftsRef.current.has(index) ? '✅ Saved' : '💾 Save Draft'}
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

            {/* Back button at bottom right */}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                onClick={() => navigate('/dashboard/drafts')}
                variant="outline"
              >
                📝 View Drafts
              </Button>
              <Button
                onClick={handleBackToMapping}
                variant="outline"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Mapping
              </Button>
            </div>

            {/* Summary Actions */}
            <div className="mt-8 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Batch Actions</h3>
                  <p className="text-sm text-gray-300">Save all drafts or send all messages at once.</p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveAllDrafts}
                    disabled={isSavingAll}
                    variant="outline"
                  >
                    {isSavingAll ? '💾 Saving...' : '💾 Save All Drafts'}
                  </Button>
                  <Button
                    onClick={() => {
                      generatedMessages.forEach((_, index) => {
                        if (!sendingStatus[index]?.linkedin) {
                          handleSendLinkedIn(index)
                        }
                      })
                    }}
                    disabled={isSending || Object.values(sendingStatus).some(s => s?.linkedin === 'sending')}
                    variant="default"
                  >
                    Send All LinkedIn Messages
                  </Button>
                  <Button
                    onClick={() => {
                      generatedMessages.forEach((_, index) => {
                        if (!sendingStatus[index]?.email) {
                          handleSendEmail(index)
                        }
                      })
                    }}
                    disabled={isSending || Object.values(sendingStatus).some(s => s?.email === 'sending')}
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Send All Emails
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
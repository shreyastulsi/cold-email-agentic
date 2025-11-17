import { useQuery } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { AlertCircle, Bot, ChevronDown } from 'lucide-react'
import { motion } from 'motion/react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ActivityConsole } from '../components/activity-console'
import { JobContextModal } from '../components/JobContextModal'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible'
import { LoaderOne } from '../components/ui/loader'
import { WobbleCard } from '../components/ui/wobble-card'
import { useActivityConsole } from '../context/activity-console-context'
import { useSidebarLogger } from '../context/sidebar-logger-context'
import { useToast } from '../context/toast-context'
import { useOnboardingStatus } from '../hooks/useOnboardingStatus'
import { apiRequest, API_BASE_URL } from '../utils/api'
import { trackEmailSent, trackLinkedInInvite } from '../utils/dashboardStats'
import SearchMapping from './SearchMapping'

const steps = [
  'Find Companies',
  'Find Jobs',
  'Find Recruiters',
  'Map to Best Recruiters',
  'Outreach'
]

const CollapsibleSection = ({ title, description, defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="rounded-lg border border-gray-700/50 bg-gray-900/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {description && <p className="text-xs text-gray-400">{description}</p>}
        </div>
        <CollapsibleTrigger asChild>
          <button className="inline-flex items-center gap-2 rounded-md border border-gray-600/60 px-3 py-1 text-xs font-medium text-gray-300 hover:border-gray-500 hover:text-white transition-colors">
            {isOpen ? 'Close' : 'Expand'}
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="px-4 pb-4 pt-3 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

const JOB_TYPE_OPTIONS = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'internship', label: 'Internship' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'other', label: 'Other' }
]

const JOB_TITLE_OPTIONS = [
  'Software Engineer',
  'Data Scientist',
  'Machine Learning Engineer',
  'Product Manager',
  'Software Engineer Intern',
  'Full Stack Engineer'
]

const LOCATION_OPTIONS = [
  { value: 'San Francisco, CA', label: 'San Francisco, CA' },
  { value: 'Seattle, WA', label: 'Seattle, WA' },
  { value: 'Palo Alto, CA', label: 'Palo Alto, CA' },
  { value: 'San Jose, CA', label: 'San Jose, CA' },
  { value: 'Austin, TX', label: 'Austin, TX' },
  { value: 'Nashville, TN', label: 'Nashville, TN' },
  { value: 'Bellevue, WA', label: 'Bellevue, WA' },
  { value: 'New York, NY', label: 'New York, NY' },
  { value: 'Chicago, IL', label: 'Chicago, IL' },
  { value: 'Atlanta, GA', label: 'Atlanta, GA' },
  { value: 'Houston, TX', label: 'Houston, TX' },
  { value: 'Sunnyvale, CA', label: 'Sunnyvale, CA' },
  { value: 'Redmond, WA', label: 'Redmond, WA' }
]

const EXPERIENCE_LEVEL_OPTIONS = [
  { value: 'internship', label: 'Internship' },
  { value: 'entry level', label: 'Entry Level' },
  { value: 'associate', label: 'Associate' },
  { value: 'mid-senior level', label: 'Mid-Senior Level' },
  { value: 'director', label: 'Director' },
  { value: 'executive', label: 'Executive' }
]

const QUICK_COMPANIES = [
  'Amazon',
  'Apple',
  'Microsoft',
  'Meta',
  'Netflix',
  'Tesla',
  'Nvidia',
  'Intel',
  'AMD',
  'Salesforce',
  'Adobe',
  'Uber',
  'Airbnb',
  'DoorDash',
  'Snowflake',
  'Stripe',
  'Palantir',
  'ServiceNow',
  'Shopify'
]

// API functions
async function searchCompany(name) {
  return apiRequest('/api/v1/search/company', {
    method: 'POST',
    body: JSON.stringify({ name })
  })
}

const DEFAULT_LOCATION_ID = '102571732'

async function searchJobs(companyIds, jobTitles, jobTypes = ['full_time'], options = {}) {
  const payload = {
      company_ids: companyIds,
      job_titles: jobTitles,
  }

  if (Array.isArray(jobTypes) && jobTypes.length > 0) {
    payload.job_types = jobTypes
  } else {
    payload.job_types = ['full_time']
  }

  if (options.companyNames && Array.isArray(options.companyNames) && options.companyNames.length > 0) {
    payload.company_names = options.companyNames
  }

  if (Object.prototype.hasOwnProperty.call(options, 'locationId')) {
    if (options.locationId) {
      payload.location_id = options.locationId
    }
  } else {
    payload.location_id = DEFAULT_LOCATION_ID
  }

  if (options.location && options.location.trim()) {
    payload.location = options.location.trim()
  }

  if (options.locations && Array.isArray(options.locations) && options.locations.length > 0) {
    payload.locations = options.locations
  }

  if (options.experienceLevels && Array.isArray(options.experienceLevels) && options.experienceLevels.length > 0) {
    payload.experience_levels = options.experienceLevels
  } else if (options.experienceLevel && options.experienceLevel !== 'any') {
    payload.experience_levels = [options.experienceLevel]
  }

  const salaryMin = options.salaryMin
  const salaryMax = options.salaryMax
  if (salaryMin !== undefined && salaryMin !== null && salaryMin !== '') {
    const parsedMin = Number(salaryMin)
    if (!Number.isNaN(parsedMin)) {
      payload.salary_min = parsedMin
    }
  }
  if (salaryMax !== undefined && salaryMax !== null && salaryMax !== '') {
    const parsedMax = Number(salaryMax)
    if (!Number.isNaN(parsedMax)) {
      payload.salary_max = parsedMax
    }
  }

  return apiRequest('/api/v1/search/jobs', {
    method: 'POST',
    body: JSON.stringify(payload)
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

async function generateEmail(jobTitles, jobType, recruiter, jobUrl) {
  return apiRequest('/api/v1/outreach/email/generate', {
    method: 'POST',
    body: JSON.stringify({
      job_titles: jobTitles,
      job_type: jobType,
      recruiter: recruiter,
      job_url: jobUrl,
    })
  })
}

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

export default function Search() {
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { data: onboardingStatus, isLoading: onboardingStatusLoading } = useOnboardingStatus()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedCompanies, setSelectedCompanies] = useState([]) // Array of company objects {name, id}
  const [quickCompanyStatus, setQuickCompanyStatus] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTrigger, setSearchTrigger] = useState(null)
  const [selectedJobTitles, setSelectedJobTitles] = useState(new Set())
  const [customJobTitle, setCustomJobTitle] = useState('')
  const [jobTypes, setJobTypes] = useState(new Set(['full_time']))
  const [selectedLocations, setSelectedLocations] = useState(new Set())
  const [experienceLevels, setExperienceLevels] = useState(new Set())
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [jobSearchTrigger, setJobSearchTrigger] = useState(null)
  const [isFiltering, setIsFiltering] = useState(false)
  const [jobResults, setJobResults] = useState(null)
  const [mappedJobs, setMappedJobs] = useState([]) // Jobs in recruiter mapping placeholders (dynamic slots)
  const [visibleMappingSlots, setVisibleMappingSlots] = useState(5)
  const [isMappingToRecruiters, setIsMappingToRecruiters] = useState(false)
  const [mapping, setMapping] = useState([])
  const [mappedRecruiters, setMappedRecruiters] = useState([])
  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false)
  const {
    logs: sidebarLogs,
    setLogs: setSidebarLogs,
    clearLogs: clearSidebarLogs,
    setIsActive: setSidebarActive,
    isActive: sidebarIsActive,
    appendLog
  } = useSidebarLogger()
  const eventSourceRef = useRef(null)
  const [draggedJob, setDraggedJob] = useState(null)
  const [draggedOverIndex, setDraggedOverIndex] = useState(null)
  const [generatedMessages, setGeneratedMessages] = useState([])
  const isMappingView = location.pathname.endsWith('/mapping')
  const [sendingStatus, setSendingStatus] = useState({})
  const [isSending, setIsSending] = useState(false)
  const [savingStatus, setSavingStatus] = useState({}) // Track saving status for each message
  const [isSavingAll, setIsSavingAll] = useState(false)
  const savedDraftsRef = useRef(new Set()) // Track which messages we've already saved as drafts
  const [expandedMessages, setExpandedMessages] = useState(new Set()) // Set of expanded message indices
  const [editingMessage, setEditingMessage] = useState(null) // { index: number, part: 'email' | 'linkedin' }
  const [editValues, setEditValues] = useState({}) // Temporary edit values
  const { setConsoleWidth } = useActivityConsole()
  const salaryMinRef = useRef('')
  const salaryMaxRef = useRef('')
  const [linkedInAccount, setLinkedInAccount] = useState(null) // Store LinkedIn account info
  const onboardingReady = onboardingStatus?.isReadyForSearch ?? false
  const missingResume = onboardingStatus ? !onboardingStatus.hasResume : false
  const missingChannels = onboardingStatus ? !onboardingStatus.hasEmail && !onboardingStatus.hasLinkedIn : false
  
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

  const logFilterEvent = useCallback(
    (message, emoji = '🧩') => {
      if (!appendLog) return
      appendLog({
        id: `filter-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        message,
        type: 'info',
        emoji,
        timestamp: new Date().toISOString()
      })
    },
    [appendLog]
  )

  // Update global context
  const handleConsoleWidthChange = (width) => {
    setConsoleWidth(width)
  }

  useEffect(() => {
    if (!onboardingReady) return
    if (isMappingView && (!mapping || mapping.length === 0)) {
      navigate('/dashboard/search', { replace: true })
    }
  }, [isMappingView, mapping, navigate, onboardingReady])

  useEffect(() => {
    clearSidebarLogs()
    return () => {
      clearSidebarLogs()
      setSidebarActive(false)
    }
  }, [clearSidebarLogs, setSidebarActive])

  useEffect(() => {
    setSidebarActive(isMappingToRecruiters || isGeneratingMessages || isFiltering)
  }, [isMappingToRecruiters, isGeneratingMessages, isFiltering, setSidebarActive])

  // Connect to verbose logger stream for thinking indicator
  useEffect(() => {
    if (!onboardingReady) return

    let isMounted = true
    let reconnectTimeoutId = null
    
    const connectSSE = async () => {
      try {
        const { getSessionToken } = await import('../utils/supabase')
        const token = await getSessionToken()
        
        if (!token || !isMounted) {
          console.log('No token available for verbose logger or component unmounted')
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
                      setSidebarLogs(prev => {
                        const nextEntry = {
                          ...logEntry,
                          timestamp: logEntry.timestamp ?? Date.now()
                        }
                        const newLogs = [...prev, nextEntry]
                        return newLogs.slice(-30)
                      })
                    }
                  } catch (e) {
                    console.error('Error parsing log entry:', e, line)
                  }
                }
              }
            }
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log('Stream read cancelled')
              return
            }
            console.error('Error reading stream:', error)
            // Only reconnect if still mounted and no explicit cancellation
            if (isMounted) {
              reconnectTimeoutId = setTimeout(() => {
                if (isMounted) connectSSE()
              }, 3000)
            }
          }
        }
        
        readStream()
        eventSourceRef.current = { 
          close: () => {
            isMounted = false
            reader.cancel().catch(() => {}) // Ignore cancellation errors
          } 
        }
      } catch (error) {
        console.error('Error connecting to verbose logger:', error)
        // Only reconnect if still mounted
        if (isMounted) {
          reconnectTimeoutId = setTimeout(() => {
            if (isMounted) connectSSE()
          }, 3000)
        }
      }
    }

    connectSSE()

    return () => {
      console.log('Cleaning up SSE connection')
      isMounted = false
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId)
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [onboardingReady])

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
      const { companyIds, companyNames, titles, types, locations: selectedLocs, experienceLevels: expLevels, salaryMin: minSalary, salaryMax: maxSalary } = jobSearchTrigger
      const options = {
        locations: selectedLocs,
        experienceLevels: expLevels,
        salaryMin: minSalary,
        salaryMax: maxSalary,
        companyNames
      }
      if (!selectedLocs || selectedLocs.length === 0) {
        options.locationId = DEFAULT_LOCATION_ID
      }
      return await searchJobs(companyIds, titles, types, options)
    },
    enabled: !!(jobSearchTrigger && jobSearchTrigger.companyIds && jobSearchTrigger.companyIds.length > 0 && jobSearchTrigger.titles && jobSearchTrigger.titles.length > 0),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false
  })

  // Update step based on progress
  useEffect(() => {
    if (!onboardingReady) return
    if (selectedCompanies.length > 0) setCurrentStep(0)
    if (jobResults) setCurrentStep(1)
    if (mappedJobs.length > 0) setCurrentStep(1)
    if (mapping.length > 0) setCurrentStep(3)
    if (generatedMessages.length > 0) setCurrentStep(4)
  }, [selectedCompanies, jobResults, mappedJobs, mapping, generatedMessages, onboardingReady])

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
        logFilterEvent(`Added ${companyName} to company filters`, '🏢')
      }
    }
  }

  // Remove company
  const handleRemoveCompany = (companyId) => {
    const company = selectedCompanies.find(c => c.id === companyId)
    setSelectedCompanies(selectedCompanies.filter(c => c.id !== companyId))
    if (company) {
      logFilterEvent(`Removed ${company.name} from company filters`, '🏢')
    }
  }

  const handleToggleQuickCompany = async (companyName) => {
    const normalized = companyName.toLowerCase()
    const existing = selectedCompanies.find(
      (c) => c.name.toLowerCase() === normalized
    )

    if (existing) {
      setSelectedCompanies((prev) =>
        prev.filter((company) => company.id !== existing.id)
      )
      logFilterEvent(`Removed ${existing.name} from company filters`, '🏢')
      return
    }

    setQuickCompanyStatus((prev) => ({ ...prev, [companyName]: 'loading' }))
    try {
      const result = await searchCompany(companyName)
      if (result?.company_id) {
        const displayName =
          result.company?.name || result.company?.title || companyName
        const companyId = result.company_id

        let added = false
        setSelectedCompanies((prev) => {
          if (prev.some((company) => company.id === companyId)) {
            return prev
          }
          added = true
          return [...prev, { name: displayName, id: companyId }]
        })
        if (added) {
          logFilterEvent(`Added ${displayName} to company filters`, '🏢')
        }
      } else {
        showToast(`Could not find ${companyName}. Try searching manually.`, 'warning')
      }
    } catch (error) {
      console.error(`Error selecting ${companyName}:`, error)
      showToast(`Failed to add ${companyName}. Check logs for details.`, 'error')
    } finally {
      setQuickCompanyStatus((prev) => {
        const { [companyName]: _, ...rest } = prev
        return rest
      })
    }
  }

  const handleAddCustomJobTitle = () => {
    const normalized = customJobTitle.trim()
    if (!normalized) return
    let added = false
    setSelectedJobTitles(prev => {
      const next = new Set(prev)
      if (!next.has(normalized)) {
        next.add(normalized)
        added = true
      }
      return next
    })
    setCustomJobTitle('')
    if (added) {
      logFilterEvent(`Added ${normalized} to job title filters`, '💼')
    }
  }

  // Handle job search
  const handleSearchJobs = () => {
    const companyIds = selectedCompanies.map(c => c.id)
    const jobTitleArray = Array.from(selectedJobTitles).filter(Boolean)
    if (companyIds.length > 0 && jobTitleArray.length > 0) {
      const minSalary = salaryMin !== '' ? Number(salaryMin) : null
      const maxSalary = salaryMax !== '' ? Number(salaryMax) : null

      let safeMinSalary = Number.isFinite(minSalary) ? minSalary : null
      let safeMaxSalary = Number.isFinite(maxSalary) ? maxSalary : null

      if (safeMinSalary !== null && safeMaxSalary !== null && safeMinSalary > safeMaxSalary) {
        const temp = safeMinSalary
        safeMinSalary = safeMaxSalary
        safeMaxSalary = temp
      }

      const selectedJobTypes = Array.from(jobTypes).filter(Boolean)
      const finalJobTypes = selectedJobTypes.length > 0 ? selectedJobTypes : ['full_time']
      const locationList = Array.from(selectedLocations).filter(Boolean)
      const experienceList = Array.from(experienceLevels).filter(Boolean)

      setJobSearchTrigger({
        companyIds: companyIds,
        companyNames: selectedCompanies.map(c => c.name).filter(Boolean),
        titles: jobTitleArray,
        types: finalJobTypes,
        locations: locationList,
        experienceLevels: experienceList,
        salaryMin: safeMinSalary,
        salaryMax: safeMaxSalary
      })
    }
  }

  // Update job results
  useEffect(() => {
    if (!onboardingReady) return
    if (jobsData?.jobs) {
      setJobResults(jobsData)
      setCurrentStep(1)
      // Initialize mappedJobs array with nulls matching the number of jobs
      const jobCount = jobsData.jobs.length
      setMappedJobs(Array(jobCount).fill(null))
      setVisibleMappingSlots(Math.min(5, jobCount || 0))
    }
  }, [jobsData, onboardingReady])

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
    clearSidebarLogs()

    try {
      // First get recruiters - use all selected company IDs
      const companyIds = selectedCompanies.map(c => c.id)
      const recruiterResult = await searchRecruiters(companyIds)
        if (!recruiterResult.recruiters || recruiterResult.recruiters.length === 0) {
        showToast('No recruiters found', 'warning')
        setIsMappingToRecruiters(false)
          return
        }
        
      // Then map jobs to recruiters
      const mapResult = await mapJobsToRecruiters(jobsToMap, recruiterResult.recruiters, jobsToMap.length)
      
      if (mapResult.mapping && mapResult.mapping.length > 0) {
        const normalizeRecruiter = (recruiter) => {
          if (!recruiter) return null
          const name =
            recruiter.name ||
            recruiter.full_name ||
            recruiter.recruiter_name ||
            recruiter.display_name ||
            recruiter.profile_name ||
            ''
          const company =
            recruiter.company ||
            recruiter.company_name ||
            recruiter.organization ||
            recruiter.companyName ||
            recruiter.employer ||
            ''
          const profileUrl =
            recruiter.profile_url ||
            recruiter.linkedin_url ||
            recruiter.linkedin ||
            recruiter.url ||
            recruiter.profileUrl ||
            ''

          return {
            ...recruiter,
            name,
            company,
            profile_url: profileUrl
          }
        }

        const recruitersListRaw =
          (Array.isArray(mapResult.selected_recruiters) && mapResult.selected_recruiters.length > 0
            ? mapResult.selected_recruiters
            : mapResult.mapping?.map(m => ({
                name: m.recruiter_name,
                company: m.recruiter_company,
                profile_url: m.recruiter_profile_url
              }))) || []

        const recruitersList = recruitersListRaw
          .map(normalizeRecruiter)
          .filter(Boolean)

        const recruiterByProfile = new Map()
        const recruiterByName = new Map()
        recruitersList.forEach((rec) => {
          const profileKey = (rec?.profile_url || rec?.linkedin_url || rec?.url || '').trim().toLowerCase()
          const nameKey = (rec?.name || rec?.full_name || rec?.display_name || '').trim().toLowerCase()
          if (profileKey) recruiterByProfile.set(profileKey, rec)
          if (nameKey) recruiterByName.set(nameKey, rec)
        })

        const enrichedMapping = (mapResult.mapping || []).map((item) => {
          const profileKey = (item?.recruiter_profile_url || '').trim().toLowerCase()
          const nameKey = (item?.recruiter_name || '').trim().toLowerCase()
          const recruiterInfo =
            (profileKey && recruiterByProfile.get(profileKey)) ||
            (nameKey && recruiterByName.get(nameKey)) ||
            {}

          return {
            ...item,
            recruiter_name:
              item?.recruiter_name ||
              recruiterInfo?.name ||
              recruiterInfo?.full_name ||
              recruiterInfo?.display_name ||
              '',
            recruiter_company:
              item?.recruiter_company ||
              recruiterInfo?.company ||
              recruiterInfo?.company_name ||
              recruiterInfo?.organization ||
              recruiterInfo?.employer ||
              '',
            recruiter_profile_url:
              item?.recruiter_profile_url ||
              recruiterInfo?.profile_url ||
              recruiterInfo?.linkedin_url ||
              recruiterInfo?.url ||
              ''
          }
        })

        setMapping(enrichedMapping)
        setMappedRecruiters(recruitersList)
        setCurrentStep(3)

        navigate('/dashboard/search/mapping')
      } else {
        showToast('No mappings were created. Try selecting different jobs.', 'warning')
      }
    } catch (error) {
      console.error('Error mapping to recruiters:', error)
      const errorMessage = error.response?.data?.error || error.response?.data?.detail || error.message || 'Failed to map jobs to recruiters'
      showToast(`Failed to map jobs to recruiters: ${errorMessage}`, 'error')
    } finally {
      setIsMappingToRecruiters(false)
    }
  }

  // Generate messages
  const handleGenerateMessages = async () => {
    if (mapping.length === 0) return

    setIsGeneratingMessages(true)
    clearSidebarLogs()

      const selectedJobTypeArray = Array.from(jobTypes)
      const primaryJobType = selectedJobTypeArray.length > 0 ? selectedJobTypeArray[0] : 'full_time'

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
        const jobUrl = mapItem.job_url || mapItem.jobUrl || mapItem.url || mapItem.job?.url || mapItem.job_link || null
        const companyName = mapItem.job_company || mapItem.company || mapItem.company_name || jobResults?.jobs?.[i]?.company?.name || jobResults?.jobs?.[i]?.company_name || recruiter.company || recruiter.company_name || recruiter.org_name || 'Your company'

        if (jobUrl && recruiter && typeof recruiter === 'object') {
          recruiter.job_url = recruiter.job_url || jobUrl
        }
        if (recruiter && typeof recruiter === 'object') {
          recruiter.company = recruiter.company || recruiter.company_name || companyName
          recruiter.company_name = recruiter.company
        }
        
        const linkedinResult = await generateLinkedInMessage(
          recruiter,
              mapItem.job_title || 'Position',
          companyName
            )
            
        const emailResult_gen = await generateEmail(
          [mapItem.job_title || 'Position'],
          primaryJobType,
          recruiter,
          jobUrl
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
      const errorMessage = error.response?.data?.error || error.response?.data?.detail || error.message || 'Failed to generate messages'
      showToast(`Error generating messages: ${errorMessage}`, 'error')
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
      showToast('LinkedIn URL not found for this recruiter', 'error')
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
          [index]: { ...prev[index], linkedin: 'sent', error: null }
        }))
        
        // Track in dashboard stats (trigger refresh event)
        trackLinkedInInvite(role, company, recruiterName)
      } else {
        const errorMsg = result.error || result.message || 'Failed to send LinkedIn message'
        setSendingStatus(prev => ({
          ...prev,
          [index]: { ...prev[index], linkedin: 'error', error: errorMsg }
        }))
        showToast(`Failed to send LinkedIn message: ${errorMsg}`, 'error')
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.response?.data?.detail || error.message || 'Failed to send LinkedIn message'
      setSendingStatus(prev => ({
        ...prev,
        [index]: { ...prev[index], linkedin: 'error', error: errorMessage }
      }))
      showToast(`Failed to send LinkedIn message: ${errorMessage}`, 'error')
    } finally {
      setIsSending(false)
    }
  }

  // Send email
  const handleSendEmail = async (index) => {
    const messageData = generatedMessages[index]
    const email = messageData.recruiter?.extracted_email || messageData.recruiter?.email
    
    if (!email) {
      showToast('Email address not found for this recruiter', 'error')
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
      const errorMessage = error.response?.data?.error || error.response?.data?.detail || error.message || 'Failed to send email'
      setSendingStatus(prev => ({
        ...prev,
        [index]: { ...prev[index], email: 'error', error: errorMessage }
      }))
      showToast(`Failed to send email: ${errorMessage}`, 'error')
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
      showToast('Email has already been sent. Cannot edit.', 'warning')
      return
    }
    if (part === 'linkedin' && linkedinStatus === 'sent') {
      showToast('LinkedIn message has already been sent. Cannot edit.', 'warning')
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

  const handleClearFilters = () => {
    setSelectedCompanies([])
    setQuickCompanyStatus({})
    setSearchQuery('')
    setSearchTrigger(null)
    setSelectedJobTitles(new Set())
    setCustomJobTitle('')
    setJobTypes(new Set(['full_time']))
    setSelectedLocations(new Set())
    setExperienceLevels(new Set())
    setSalaryMin('')
    setSalaryMax('')
    setJobSearchTrigger(null)
    setJobResults(null)
    setMappedJobs([])
    setMapping([])
    setMappedRecruiters([])
    setGeneratedMessages([])
    setCurrentStep(0)
    setIsFiltering(false)
    setIsMappingToRecruiters(false)
    setIsGeneratingMessages(false)
    clearSidebarLogs()
    savedDraftsRef.current.clear()
  }

  const hasActiveFilters =
    selectedCompanies.length > 0 ||
    searchQuery.trim() !== '' ||
    selectedJobTitles.size > 0 ||
    jobTypes.size > 1 ||
    (jobTypes.size === 1 && !jobTypes.has('full_time')) ||
    selectedLocations.size > 0 ||
    experienceLevels.size > 0 ||
    salaryMin !== '' ||
    salaryMax !== ''

  if (onboardingStatusLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderOne />
      </div>
    )
  }

  if (!onboardingReady) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center space-y-6 text-center">
        <AlertCircle className="h-12 w-12 text-amber-400" />
        <h2 className="text-2xl font-semibold text-white">Complete Your Setup</h2>
        <p className="text-sm text-gray-300">
          Upload a resume and connect at least one outreach channel before using job search.
        </p>
        <div className="space-y-1 text-sm text-gray-300">
          {missingResume && <p>• Upload your resume in the Resume section.</p>}
          {missingChannels && <p>• Connect your email or LinkedIn account in Settings.</p>}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {missingResume && (
            <Button variant="secondary" onClick={() => navigate('/dashboard/resume')}>
              Go to Resume
            </Button>
          )}
          {missingChannels && (
            <Button onClick={() => navigate('/dashboard/settings')}>
              Connect Accounts
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Show Activity Console on search page and mapping view
  const showActivityConsole = true // Always show on this page and sub-pages

  if (isMappingView) {
    const jobsForMapping = jobResults?.jobs || mappedJobs.filter(Boolean)

    return (
      <>
        {showActivityConsole && (
          <ActivityConsole
            logs={sidebarLogs}
            onClear={clearSidebarLogs}
            isActive={sidebarIsActive}
            onWidthChange={handleConsoleWidthChange}
          />
        )}
        <div
          className="transition-all duration-300 overflow-hidden w-full"
          style={{
            maxWidth: '100%',
            minWidth: '560px'
          }}
        >
          <SearchMapping
            mapping={mapping}
            recruiters={mappedRecruiters}
            jobs={jobsForMapping}
            onBack={() => {
              setMapping([])
              setMappedRecruiters([])
              if (jobResults?.jobs) {
                setMappedJobs(Array(jobResults.jobs.length).fill(null))
              } else {
                setMappedJobs([])
              }
              navigate('/dashboard/search')
            }}
            onGenerate={async () => {
              if (isGeneratingMessages || mapping.length === 0) return
              await handleGenerateMessages()
              navigate('/dashboard/search')
            }}
            isGenerating={isGeneratingMessages}
          />
        </div>
      </>
    )
  }

  return (
    <>
      {showActivityConsole && (
        <ActivityConsole
          logs={sidebarLogs}
          onClear={clearSidebarLogs}
          isActive={sidebarIsActive}
          onWidthChange={handleConsoleWidthChange}
        />
      )}
      <div
        className="min-h-screen pb-20 transition-all duration-300 overflow-hidden w-full"
        style={{
          maxWidth: '100%',
          minWidth: '560px'
        }}
      >
        <div className="space-y-6" style={{ maxWidth: '100%' }}>
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

          {/* Initial Search Card - Keep visible during search */}
          {(!jobResults && mapping.length === 0 && generatedMessages.length === 0) && (
            <div className="mx-auto max-w-2xl">
              <WobbleCard
                minimal
                containerClassName="bg-transparent overflow-visible"
              >
                <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 overflow-hidden">
                  <CardHeader className="flex items-center justify-between gap-3">
                    <CardTitle className="text-white break-words">Search for Jobs</CardTitle>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleClearFilters}
                      disabled={!hasActiveFilters}
                    >
                      Clear
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                  <CollapsibleSection
                    title="Popular Companies"
                    description="Quick add companies from cache. Use search to add more."
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {QUICK_COMPANIES.map((company) => {
                        const normalized = company.toLowerCase()
                        const isSelected = selectedCompanies.some(
                          (c) => c.name.toLowerCase() === normalized
                        )
                        const isLoading = quickCompanyStatus[company] === 'loading'
                        return (
                          <label
                            key={company}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              isSelected
                                ? 'border-blue-500/60 bg-blue-900/40 text-blue-200'
                                : 'border-gray-700/50 bg-gray-900/40 text-gray-300 hover:border-gray-600/70'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                              checked={isSelected}
                              disabled={isLoading}
                              onChange={() => handleToggleQuickCompany(company)}
                            />
                            <span>{company}</span>
                            {isLoading && (
                              <span className="ml-auto text-xs text-gray-400 animate-pulse">
                                Loading...
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="Company Search"
                    description="Look up additional companies to add to your mapping pool."
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2 sm:flex-row">
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
                          className="flex-1 rounded-lg border border-gray-700/50 bg-gray-900/50 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            if (searchQuery.trim()) {
                              setSearchTrigger(searchQuery.trim())
                            }
                          }}
                          disabled={isSearching || !searchQuery.trim()}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSearching ? '...' : 'Search'}
                        </button>
                      </div>
                      {searchResults?.company_id && (
                        <div className="flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-900/50 p-3">
                          <span className="text-white">{searchResults.company.name}</span>
                          <button
                            onClick={handleSelectCompany}
                            className="text-sm text-blue-400 hover:text-blue-300"
                          >
                            {selectedCompanies.find(c => c.id === searchResults.company_id) ? '✓ Selected' : 'Add Company'}
                          </button>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                  {selectedCompanies.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedCompanies.map((company) => (
                        <span key={company.id} className="inline-flex items-center gap-2 rounded-full border border-blue-700/40 bg-blue-900/40 px-3 py-1 text-xs text-blue-200 max-w-full overflow-hidden">
                          <span className="break-words truncate">{company.name}</span>
                          <button
                            onClick={() => handleRemoveCompany(company.id)}
                            className="text-blue-300 hover:text-blue-100"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedCompanies.length > 0 && (
                    <CollapsibleSection
                      title="Job Titles"
                      description="Select or add titles you want to target."
                      defaultOpen
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {JOB_TITLE_OPTIONS.map((title) => {
                          const normalized = title.toLowerCase()
                          const isChecked = Array.from(selectedJobTitles).some(
                            (t) => t.toLowerCase() === normalized
                          )
                          return (
                            <label
                              key={title}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                isChecked
                                  ? 'border-blue-500/60 bg-blue-900/40 text-blue-200'
                                  : 'border-gray-700/50 bg-gray-900/40 text-gray-300 hover:border-gray-600/70'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedJobTitles(prev => {
                                    const next = new Set(prev)
                                    if (isChecked) {
                                      next.forEach(value => {
                                        if (value.toLowerCase() === normalized) {
                                          next.delete(value)
                                        }
                                      })
                                    } else {
                                      next.add(title)
                                    }
                                    return next
                                  })
                                  logFilterEvent(
                                    `${isChecked ? 'Removed' : 'Added'} ${title} ${isChecked ? 'from' : 'to'} job title filters`,
                                    '💼'
                                  )
                                }}
                              />
                              <span>{title}</span>
                            </label>
                          )
                        })}
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400">Add custom job title</label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={customJobTitle}
                            onChange={(e) => setCustomJobTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddCustomJobTitle()
                              }
                            }}
                            placeholder="e.g., Machine Learning Engineer"
                            className="flex-1 rounded-lg border border-gray-700/50 bg-gray-900/50 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            onClick={handleAddCustomJobTitle}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </CollapsibleSection>
                  )}
                  {selectedJobTitles.size > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Array.from(selectedJobTitles).map((title) => (
                        <span key={title} className="inline-flex items-center gap-2 rounded-full border border-blue-700/40 bg-blue-900/40 px-3 py-1 text-xs text-blue-200 max-w-full overflow-hidden">
                          <span className="break-words truncate">{title}</span>
                          <button
                            onClick={() => {
                              logFilterEvent(`Removed ${title} from job title filters`, '💼')
                              setSelectedJobTitles(prev => {
                                const next = new Set(prev)
                                next.delete(title)
                                return next
                              })
                            }}
                            className="text-blue-300 hover:text-blue-100"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedCompanies.length > 0 && (
                    <CollapsibleSection
                      title="Job Types"
                      description="Pick all employment types you want to consider."
                    >
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-2">Locations</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {LOCATION_OPTIONS.map(option => {
                          const isChecked = selectedLocations.has(option.value)
                          return (
                            <label
                              key={option.value}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                isChecked
                                  ? 'border-blue-500/60 bg-blue-900/40 text-blue-200'
                                  : 'border-gray-700/50 bg-gray-900/40 text-gray-300 hover:border-gray-600/70'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedLocations(prev => {
                                    const next = new Set(prev)
                                    if (next.has(option.value)) {
                                      next.delete(option.value)
                                    } else {
                                      next.add(option.value)
                                    }
                                    return next
                                  })
                                  logFilterEvent(
                                    `${isChecked ? 'Removed' : 'Added'} ${option.label} ${isChecked ? 'from' : 'to'} location filters`,
                                    '📍'
                                  )
                                }}
                              />
                              <span>{option.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-2">Experience Levels</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {EXPERIENCE_LEVEL_OPTIONS.map(option => {
                          const isChecked = experienceLevels.has(option.value)
                          return (
                            <label
                              key={option.value}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                isChecked
                                  ? 'border-blue-500/60 bg-blue-900/40 text-blue-200'
                                  : 'border-gray-700/50 bg-gray-900/40 text-gray-300 hover:border-gray-600/70'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                                checked={isChecked}
                                onChange={() => {
                                  setExperienceLevels(prev => {
                                    const next = new Set(prev)
                                    if (next.has(option.value)) {
                                      next.delete(option.value)
                                    } else {
                                      next.add(option.value)
                                    }
                                    return next
                                  })
                                  logFilterEvent(
                                    `${isChecked ? 'Removed' : 'Added'} ${option.label} ${isChecked ? 'from' : 'to'} experience level filters`,
                                    '📈'
                                  )
                                }}
                              />
                              <span>{option.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>
              )}
              {selectedCompanies.length > 0 && selectedLocations.size > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedLocations).map((loc) => (
                    <span key={loc} className="inline-flex items-center gap-2 rounded-full bg-blue-900/40 border border-blue-700/40 px-3 py-1 text-xs text-blue-200">
                      {loc}
                      <button
                        onClick={() => {
                          logFilterEvent(`Removed ${loc} from location filters`, '📍')
                          setSelectedLocations(prev => {
                            const next = new Set(prev)
                            next.delete(loc)
                            return next
                          })
                        }}
                        className="text-blue-300 hover:text-blue-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {selectedCompanies.length > 0 && experienceLevels.size > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Array.from(experienceLevels).map((level) => {
                    const label = EXPERIENCE_LEVEL_OPTIONS.find(o => o.value === level)?.label || level
                    return (
                      <span key={level} className="inline-flex items-center gap-2 rounded-full bg-blue-900/40 border border-blue-700/40 px-3 py-1 text-xs text-blue-200">
                        {label}
                        <button
                          onClick={() => {
                            logFilterEvent(`Removed ${label} from experience level filters`, '📈')
                            setExperienceLevels(prev => {
                              const next = new Set(prev)
                              next.delete(level)
                              return next
                            })
                          }}
                          className="text-blue-300 hover:text-blue-100"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              {selectedCompanies.length > 0 && (
                <CollapsibleSection
                  title="Salary Range"
                  description="Optional: provide salary expectations to influence matching."
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Minimum Salary ($)</label>
                      <input
                        type="number"
                        min="0"
                        value={salaryMin}
                        onChange={(e) => setSalaryMin(e.target.value)}
                        onBlur={() => {
                          if (salaryMin !== salaryMinRef.current) {
                            if (salaryMin) {
                              logFilterEvent(`Set minimum salary to $${salaryMin}`, '💰')
                            } else if (salaryMinRef.current) {
                              logFilterEvent('Cleared minimum salary filter', '💰')
                            }
                            salaryMinRef.current = salaryMin
                          }
                        }}
                        className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white px-3 py-2 focus:border-blue-500 focus:outline-none"
                        placeholder="e.g., 100000"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Maximum Salary ($)</label>
                      <input
                        type="number"
                        min="0"
                        value={salaryMax}
                        onChange={(e) => setSalaryMax(e.target.value)}
                        onBlur={() => {
                          if (salaryMax !== salaryMaxRef.current) {
                            if (salaryMax) {
                              logFilterEvent(`Set maximum salary to $${salaryMax}`, '💰')
                            } else if (salaryMaxRef.current) {
                              logFilterEvent('Cleared maximum salary filter', '💰')
                            }
                            salaryMaxRef.current = salaryMax
                          }
                        }}
                        className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white px-3 py-2 focus:border-blue-500 focus:outline-none"
                        placeholder="e.g., 200000"
                      />
                    </div>
                  </div>
                </CollapsibleSection>
              )}
              {selectedCompanies.length > 0 && (salaryMin !== '' || salaryMax !== '') && (
                <div className="flex flex-wrap gap-2">
                  {salaryMin !== '' && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-blue-900/40 border border-blue-700/40 px-3 py-1 text-xs text-blue-200">
                      Min ${salaryMin}
                      <button
                        onClick={() => setSalaryMin('')}
                        className="text-blue-300 hover:text-blue-100"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {salaryMax !== '' && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-blue-900/40 border border-blue-700/40 px-3 py-1 text-xs text-blue-200">
                      Max ${salaryMax}
                      <button
                        onClick={() => setSalaryMax('')}
                        className="text-blue-300 hover:text-blue-100"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </div>
              )}

              {selectedCompanies.length > 0 && selectedJobTitles.size > 0 && (
                <button
                  onClick={handleSearchJobs}
                  disabled={isSearchingJobs || selectedCompanies.length === 0 || selectedJobTitles.size === 0}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isSearchingJobs ? 'Searching...' : 'Search for Jobs'}
                </button>
              )}
                  </CardContent>
                </Card>
              </WobbleCard>
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
      {jobResults && !isMappingToRecruiters && generatedMessages.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto"
        >
            {/* Jobs List Card */}
            <WobbleCard
              minimal
              containerClassName="bg-transparent overflow-visible"
            >
              <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 relative overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white break-words">Jobs</CardTitle>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAll}
                        disabled={!jobResults?.jobs || jobResults.jobs.length === 0}
                        className="text-sm rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Select All
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
                    const jobUrl = job.job_url || job.url || job.link || job.jobUrl || job.jobLink
                    const isMapped = mappedJobs.some(m => m && m.url === job.url)
                        
                        return (
                      <div
                            key={index}
                        draggable
                        onDragStart={(e) => handleDragStart(e, job)}
                        onDragEnd={handleDragEnd}
                        className={`p-3 rounded-lg border cursor-move transition-all overflow-hidden ${
                          isMapped 
                            ? 'bg-gray-700/50 border-gray-600/50' 
                            : 'bg-gray-900/50 border-gray-700/50 hover:bg-gray-800/50'
                        }`}
                          >
                            <div className="font-medium text-sm text-white break-words line-clamp-2">{job.title || 'Untitled'}</div>
                            <div className="text-xs text-gray-300 mt-1 break-words">{companyName}</div>
                            {jobUrl && (
                              <a
                                href={jobUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-flex items-center gap-1"
                              >
                                View job posting
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7M10 14l11-11M21 21H3" />
                                </svg>
                              </a>
                            )}
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
                  <div className="mt-6 border-t border-gray-700/40 pt-4">
                    <button
                      onClick={handleFilterJobs}
                      disabled={isFiltering || !jobResults?.jobs}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-base font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Bot className="h-5 w-5" />
                      {isFiltering ? 'Filtering...' : 'AI Filter'}
                    </button>
                    <p className="mt-2 text-xs text-gray-400 text-center">
                      Let AI rank these jobs against your resume and preferences automatically.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </WobbleCard>

            {/* Recruiter Mapping Placeholders */}
            <WobbleCard
              minimal
              containerClassName="bg-transparent overflow-visible"
            >
              <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white break-words">Recruiter Mapping</CardTitle>
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
                  {mappedJobs.slice(0, visibleMappingSlots).map((_, index) => (
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
                        <div className="relative overflow-hidden">
                          <div className="font-medium text-sm text-white break-words line-clamp-2 pr-6">
                            {mappedJobs[index].title || 'Untitled'}
                    </div>
                          <div className="text-xs text-gray-300 mt-1 break-words">
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
                  {mappedJobs.length > visibleMappingSlots && (
                    <button
                      onClick={() =>
                        setVisibleMappingSlots((prev) =>
                          Math.min(prev + 1, mappedJobs.length)
                        )
                      }
                      className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-600/50 bg-gray-900/10 px-4 py-3 text-sm text-gray-300 hover:bg-gray-900/30 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add another slot
                    </button>
                  )}
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
          </WobbleCard>
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
      {mapping.length > 0 && !isMappingToRecruiters && generatedMessages.length === 0 && isMappingView && (
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
            <WobbleCard
              minimal
              containerClassName="bg-transparent overflow-visible"
            >
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
            </WobbleCard>

              {/* Recruiters Section */}
              <WobbleCard
                minimal
                containerClassName="bg-transparent overflow-visible"
              >
                <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50">
                  <CardHeader>
                    <CardTitle className="text-white">Mapped Recruiters</CardTitle>
                  </CardHeader>
                  <CardContent>
                  <div className="space-y-3">
                    {mapping.map((mapItem, index) => {
                      const job = mappedJobs.filter(j => j !== null)[index]
                      return (
                        <WobbleCard
                          key={index}
                          minimal
                          containerClassName="bg-gray-900/50 border border-gray-700/50 cursor-move min-h-[80px]"
                          className="p-3"
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
                        </WobbleCard>
                      )
                    })}
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
              </WobbleCard>
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
                          <div className="flex-1 flex items-center gap-4 text-left cursor-pointer">
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
                              {/* View Job Context Button - Only visible when expanded */}
                              {isExpanded && (mapItem.job_url || recruiter.job_url) && (
                                <div onClick={(e) => e.stopPropagation()}>
                                  <JobContextModal
                                    jobUrl={mapItem.job_url || recruiter.job_url}
                                    buttonText="View Job Context"
                                    buttonClassName="px-3 py-1 text-xs bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg transition-colors"
                                  />
                                </div>
                              )}
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
                            {(recruiter.extracted_email || recruiter.email) && (() => {
                              const isEditingEmail = editingMessage?.index === index && editingMessage?.part === 'email'
                              const emailSubject = messageData.editedEmailSubject || messageData.email?.subject || ''
                              const emailBody = messageData.editedEmailBody || messageData.email?.body || messageData.email?.content || ''
                              
                              // Measure display text height and sync to textarea
                              const handleTextareaRef = (textarea) => {
                                if (textarea && isEditingEmail) {
                                  // Create a hidden measurement div
                                  const measureDiv = document.createElement('div')
                                  measureDiv.style.cssText = 'position: absolute; visibility: hidden; white-space: pre-wrap; font-size: 0.875rem; line-height: 1.5; padding: 0.75rem 1rem; width: ' + textarea.offsetWidth + 'px;'
                                  measureDiv.textContent = emailBody || 'N/A'
                                  document.body.appendChild(measureDiv)
                                  
                                  setTimeout(() => {
                                    const displayHeight = measureDiv.offsetHeight
                                    if (displayHeight > 0) {
                                      textarea.style.height = `${Math.max(displayHeight, 192)}px` // min 12rem
                                    }
                                    document.body.removeChild(measureDiv)
                                  }, 0)
                                }
                              }
                              
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
                                          ref={handleTextareaRef}
                                          className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-sans text-sm focus:border-blue-500 focus:outline-none resize-y"
                                          value={editValues.email_body || ''}
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
                              
                              // Measure display text height and sync to textarea
                              const handleLinkedInTextareaRef = (textarea) => {
                                if (textarea && isEditingLinkedIn) {
                                  // Create a hidden measurement div
                                  const measureDiv = document.createElement('div')
                                  measureDiv.style.cssText = 'position: absolute; visibility: hidden; white-space: pre-wrap; font-size: 0.875rem; line-height: 1.5; padding: 0.75rem 1rem; width: ' + textarea.offsetWidth + 'px;'
                                  measureDiv.textContent = linkedinMessage || 'N/A'
                                  document.body.appendChild(measureDiv)
                                  
                                  setTimeout(() => {
                                    const displayHeight = measureDiv.offsetHeight
                                    if (displayHeight > 0) {
                                      textarea.style.height = `${Math.max(displayHeight, 256)}px` // min 16rem
                                    }
                                    document.body.removeChild(measureDiv)
                                  }, 0)
                                }
                              }
                              
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
                                        ref={handleLinkedInTextareaRef}
                                        className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-3 font-sans text-sm focus:border-blue-500 focus:outline-none resize-y"
                                        value={editValues.linkedin_message || ''}
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
                    className="rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
      </div>
    </>
  )
}
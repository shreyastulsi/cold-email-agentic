import { useQuery } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { motion } from 'motion/react'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { LoaderOne } from '../components/ui/loader'
import { apiRequest } from '../utils/api'

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
  }, [selectedCompanies, jobResults, mappedJobs, mapping])

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
            
        messages.push({
              linkedinMessage: linkedinResult.message || linkedinResult,
              email: emailResult_gen,
          recruiter: recruiter,
              mapItem: mapItem
        })
      }

      // Save and navigate
      localStorage.setItem('outreachMessages', JSON.stringify(messages))
        navigate('/messages', { 
        state: { messages },
          replace: false
        })
    } catch (error) {
      console.error('Error generating messages:', error)
      alert(`Error generating messages: ${error.message}`)
    } finally {
      setIsGeneratingMessages(false)
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
      {!jobResults && mapping.length === 0 && (
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
      {jobResults && mapping.length === 0 && !isMappingToRecruiters && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto"
        >
            {/* Jobs List Card */}
            <Card className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50">
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
      {mapping.length > 0 && !isMappingToRecruiters && (
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
                                {mapItem.recruiter_company || 'Unknown Company'}
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
    </div>
  )
}
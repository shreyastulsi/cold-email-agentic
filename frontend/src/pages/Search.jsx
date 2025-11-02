import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import VerboseLogger from '../components/VerboseLogger'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const steps = [
  'Find Companies',
  'Find Jobs',
  'Find Recruiters',
  'Map to Best Recruiters',
  'Outreach'
]

// API functions
import { apiRequest } from '../utils/api'

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
      location_id: '102571732' // Default to US
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

async function sendLinkedInInvitation(linkedinUrl, message) {
  return apiRequest('/api/v1/outreach/linkedin/send', {
    method: 'POST',
    body: JSON.stringify({
      linkedin_url: linkedinUrl,
      message: message
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

async function extractEmails(recruiters) {
  return apiRequest('/api/v1/outreach/emails/extract', {
    method: 'POST',
    body: JSON.stringify({
      recruiters: recruiters
    })
  })
}

export default function Search() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedCompanies, setSelectedCompanies] = useState([])
  const [selectedCompanyIds, setSelectedCompanyIds] = useState([]) // Store company IDs
  const [selectedJobs, setSelectedJobs] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTrigger, setSearchTrigger] = useState(null)
  const [jobTitle, setJobTitle] = useState('')
  const [jobTitles, setJobTitles] = useState([]) // List of job titles to search
  const [jobType, setJobType] = useState('full_time')
  const [jobSearchTrigger, setJobSearchTrigger] = useState(null)
  const [isFiltering, setIsFiltering] = useState(false)
  const [filterError, setFilterError] = useState(null)
  const [filteredJobResults, setFilteredJobResults] = useState(null) // Store filtered jobs separately
  const [recruiters, setRecruiters] = useState([])
  const [isSearchingRecruiters, setIsSearchingRecruiters] = useState(false)
  const [recruiterSearchError, setRecruiterSearchError] = useState(null)
  const [mappedRecruiters, setMappedRecruiters] = useState([])
  const [mapping, setMapping] = useState([])
  const [isMapping, setIsMapping] = useState(false)
  const [mappingError, setMappingError] = useState(null)
  
  // Message generation and sending state
  const [generatedMessages, setGeneratedMessages] = useState({}) // {index: {linkedinMessage, email}}
  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false)
  const [sendingStatus, setSendingStatus] = useState({}) // {index: {linkedin: 'pending'|'success'|'error', email: 'pending'|'success'|'error'}}
  const [recruitersWithEmails, setRecruitersWithEmails] = useState([])
  const [isExtractingEmails, setIsExtractingEmails] = useState(false)
  
  // Search companies query
  const { data: searchResults, isLoading: isSearching, error: searchError } = useQuery({
    queryKey: ['searchCompanies', searchTrigger],
    queryFn: () => searchCompany(searchTrigger),
    enabled: !!searchTrigger, // Only run when searchTrigger is set
    retry: false
  })

  // Helper function to evenly sample N jobs from all results
  // Examples: 10 jobs -> positions 1,3,5,7,9 (0-based: 0,2,4,6,8)
  //           20 jobs -> positions 1,5,9,13,17 (0-based: 0,4,8,12,16)
  const sampleJobsEvenly = (jobs, sampleSize = 5) => {
    if (!jobs || jobs.length === 0) return []
    if (jobs.length <= sampleSize) return jobs
    
    const totalJobs = jobs.length
    
    // Calculate evenly distributed indices across the array
    // Formula: index = Math.floor(i * (totalJobs - 1) / (sampleSize - 1))
    // This ensures we get evenly spaced positions
    const indices = []
    
    for (let i = 0; i < sampleSize; i++) {
      // Calculate position: evenly distribute across the array
      // For 10 jobs, 5 samples: 0, floor(9/4*1)=2, floor(9/4*2)=4, floor(9/4*3)=6, 9
      if (i === 0) {
        indices.push(0)
      } else if (i === sampleSize - 1) {
        indices.push(totalJobs - 1)
      } else {
        // Calculate step: how far apart each sample should be
        const step = (totalJobs - 1) / (sampleSize - 1)
        const index = Math.floor(i * step)
        indices.push(Math.min(index, totalJobs - 1))
      }
    }
    
    // Remove duplicates and sort
    const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b)
    
    // Sample jobs at these indices
    return uniqueIndices.slice(0, sampleSize).map(idx => jobs[idx])
  }

  // Search jobs query - search all companies, then evenly sample 5 for display
  const { data: jobResults, isLoading: isSearchingJobs, error: jobSearchError } = useQuery({
    queryKey: ['searchJobs', jobSearchTrigger],
    queryFn: async () => {
      const { companyIds, titles, type } = jobSearchTrigger
      const results = await searchJobs(companyIds, titles, type)
      // Search all companies, then evenly sample 5 jobs for display (before AI filtering)
      if (results?.jobs && results.jobs.length > 5) {
        const sampledJobs = sampleJobsEvenly(results.jobs, 5)
        return { ...results, jobs: sampledJobs, total_jobs_found: results.jobs.length }
      }
      return results
    },
    enabled: !!jobSearchTrigger && jobSearchTrigger.companyIds.length > 0 && jobSearchTrigger.titles.length > 0,
    retry: false
  })

  // Add job title to list
  const addJobTitle = () => {
    if (jobTitle.trim() && !jobTitles.includes(jobTitle.trim())) {
      setJobTitles([...jobTitles, jobTitle.trim()])
      setJobTitle('')
    }
  }

  // Remove job title from list
  const removeJobTitle = (title) => {
    setJobTitles(jobTitles.filter(t => t !== title))
  }

  // Search for jobs
  const handleJobSearch = () => {
    if (selectedCompanyIds.length > 0 && jobTitles.length > 0) {
      // Clear filtered results when starting new search
      setFilteredJobResults(null)
      setJobSearchTrigger({
        companyIds: selectedCompanyIds,
        titles: jobTitles,
        type: jobType
      })
    }
  }

  // Filter jobs using AI
  const handleFilterJobs = async () => {
    const jobsToFilter = filteredJobResults?.jobs || jobResults?.jobs
    if (!jobsToFilter || jobsToFilter.length === 0) {
      setFilterError('No jobs to filter. Please search for jobs first.')
      return
    }

    setIsFiltering(true)
    setFilterError(null)

    try {
      const result = await filterJobs(jobsToFilter)
      
      if (result.error) {
        // Include debug info in error message
        let errorMsg = result.error
        if (result.debug) {
          const debugStr = typeof result.debug === 'string' 
            ? result.debug 
            : JSON.stringify(result.debug, null, 2)
          errorMsg += `\n\nDebug Info:\n${debugStr}`
        }
        setFilterError(errorMsg)
      } else if (result.filtered_jobs) {
        // Update filtered job results (top 2 for testing)
        setFilteredJobResults({ jobs: result.filtered_jobs })
        // Automatically select the filtered jobs for next stage
        setSelectedJobs(result.filtered_jobs)
        setFilterError(null)
      }
    } catch (error) {
      setFilterError(error.message || 'Failed to filter jobs')
    } finally {
      setIsFiltering(false)
    }
  }

  // Update selected companies when company is added
  const handleAddCompany = () => {
    if (searchResults?.company_id && searchResults?.company?.name) {
      const companyName = searchResults.company.name
      const companyId = searchResults.company_id
      
      // Check if company is already selected (by ID, not just name, in case of name duplicates)
      if (!selectedCompanyIds.includes(companyId)) {
        setSelectedCompanies(prev => [...prev, companyName])
        setSelectedCompanyIds(prev => [...prev, companyId])
        // Clear search results after adding to show fresh search state
        setSearchTrigger(null)
        setSearchQuery('')
      } else {
        // Company already selected - could show a message
        console.log('Company already selected:', companyName)
      }
    }
  }

  // Search for recruiters
  const handleSearchRecruiters = async () => {
    if (selectedCompanyIds.length === 0) {
      setRecruiterSearchError('Please select companies first')
      return
    }

    setIsSearchingRecruiters(true)
    setRecruiterSearchError(null)

    try {
      const result = await searchRecruiters(selectedCompanyIds)
      
      if (result.recruiters) {
        setRecruiters(result.recruiters)
        setRecruiterSearchError(null)
      } else {
        setRecruiterSearchError('No recruiters found')
      }
    } catch (error) {
      setRecruiterSearchError(error.message || 'Failed to search recruiters')
    } finally {
      setIsSearchingRecruiters(false)
    }
  }

  // Map jobs to best recruiters
  const handleMapToRecruiters = async () => {
    if (selectedJobs.length === 0) {
      setMappingError('Please select jobs first')
      return
    }

    // Determine which recruiters to use (use state if available, otherwise fetch)
    let recruitersToUse = recruiters
    
    // First search for recruiters if we don't have them
    if (recruitersToUse.length === 0) {
      if (selectedCompanyIds.length === 0) {
        setMappingError('Please select companies and search for recruiters first')
        return
      }
      
      // Search for recruiters first
      setIsMapping(true)
      setMappingError(null)

      try {
        const recruiterResult = await searchRecruiters(selectedCompanyIds)
        
        if (!recruiterResult.recruiters || recruiterResult.recruiters.length === 0) {
          setMappingError('No recruiters found for selected companies')
          setIsMapping(false)
          return
        }
        
        // Use the newly fetched recruiters
        recruitersToUse = recruiterResult.recruiters
        setRecruiters(recruiterResult.recruiters)
      } catch (error) {
        setMappingError(error.message || 'Failed to search recruiters')
        setIsMapping(false)
        return
      }
    }

    // Validate we have recruiters to map
    if (recruitersToUse.length === 0) {
      setMappingError('No recruiters available for mapping. Please search for recruiters first.')
      setIsMapping(false)
      return
    }

    // Now map jobs to recruiters
    // Map top 2 jobs (testing mode)
    const jobsToMap = selectedJobs.slice(0, 2)
    
    if (jobsToMap.length === 0) {
      setMappingError('Please select at least one job')
      setIsMapping(false)
      return
    }
    
    setIsMapping(true)
    setMappingError(null)

      try {
      // Map top 2 jobs to 2 recruiters (1:1 mapping, testing mode)
      console.log('🔍 DEBUG: Attempting to map jobs to recruiters', {
        jobsCount: jobsToMap.length,
        recruitersCount: recruitersToUse.length,
        jobs: jobsToMap.map(j => ({ title: j.title, company: j.company?.name || j.company })),
        recruiters: recruitersToUse.slice(0, 3).map(r => ({ name: r.name, company: r.company }))
      })
      
      const result = await mapJobsToRecruiters(jobsToMap, recruitersToUse, jobsToMap.length)
      
      console.log('🔍 DEBUG: Mapping result received', {
        hasMapping: !!result.mapping,
        mappingLength: result.mapping?.length || 0,
        hasSelectedRecruiters: !!result.selected_recruiters,
        selectedRecruitersLength: result.selected_recruiters?.length || 0,
        resultKeys: Object.keys(result || {}),
        result: result
      })
      
      if (result.mapping && result.mapping.length > 0) {
        setMapping(result.mapping)
        
        let finalRecruitersList = []
        // Use selected_recruiters if available, otherwise extract from mapping
        if (result.selected_recruiters && result.selected_recruiters.length > 0) {
          // Ensure we only have the mapped recruiters (should be exactly 1 for testing)
          finalRecruitersList = result.selected_recruiters.slice(0, jobsToMap.length)
          setMappedRecruiters(finalRecruitersList)
        } else {
          // Extract unique recruiters from mapping (ensuring 1:1 with jobs)
          const mappedRecruitersList = result.mapping.map(m => ({
            name: m.recruiter_name,
            company: m.recruiter_company,
            profile_url: m.recruiter_profile_url,
            job_title: m.job_title,
            job_company: m.job_company
          }))
          finalRecruitersList = mappedRecruitersList
          setMappedRecruiters(mappedRecruitersList)
        }
        setMappingError(null)
        
        // Automatically extract emails and generate messages after mapping
        if (finalRecruitersList.length > 0) {
          handleExtractEmailsAndGenerateMessages(result.mapping, finalRecruitersList)
        }
      } else {
        // Better error message with debugging info
        const debugInfo = {
          jobsCount: jobsToMap.length,
          recruitersCount: recruitersToUse.length,
          resultType: typeof result,
          resultKeys: result ? Object.keys(result) : [],
          hasMapping: !!result?.mapping,
          mappingLength: result?.mapping?.length || 0
        }
        console.error('❌ DEBUG: Mapping returned empty results', debugInfo)
        setMappingError(
          `Failed to map jobs to recruiters. ` +
          `Tried to map ${jobsToMap.length} job(s) to ${recruitersToUse.length} recruiter(s), ` +
          `but got ${result?.mapping?.length || 0} mapping(s). ` +
          `Check console and server logs for details.`
        )
      }
    } catch (error) {
      console.error('❌ DEBUG: Error mapping jobs to recruiters', {
        error: error,
        message: error.message,
        stack: error.stack,
        response: error.response,
        jobsCount: jobsToMap.length,
        recruitersCount: recruitersToUse.length
      })
      
      let errorMessage = 'Failed to map jobs to recruiters'
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail
      } else if (error.message) {
        errorMessage = error.message
      }
      
      // Add debugging context
      errorMessage += ` (Jobs: ${jobsToMap.length}, Recruiters: ${recruitersToUse.length})`
      
      setMappingError(errorMessage)
    } finally {
      setIsMapping(false)
    }
  }

  // Extract emails and generate messages for mapped recruiter-job pairs
  const handleExtractEmailsAndGenerateMessages = async (mappingList, recruitersList) => {
    setIsExtractingEmails(true)
    setIsGeneratingMessages(true)
    
    try {
      // Extract emails for all mapped recruiters
      const emailResult = await extractEmails(recruitersList)
      if (emailResult.recruiters) {
        setRecruitersWithEmails(emailResult.recruiters)
        
        // Generate messages for each recruiter-job pair
        const messages = {}
        for (let i = 0; i < mappingList.length; i++) {
          const mapItem = mappingList[i]
          const recruiter = recruitersList.find(r => 
            (r.name || r.profile_url) === mapItem.recruiter_name || 
            r.profile_url === mapItem.recruiter_profile_url
          ) || {}
          
          const recruiterWithEmail = emailResult.recruiters.find(r => 
            (r.name || r.profile_url) === mapItem.recruiter_name || 
            r.profile_url === mapItem.recruiter_profile_url
          ) || recruiter
          
          try {
            // Generate LinkedIn message
            const linkedinResult = await generateLinkedInMessage(
              recruiterWithEmail,
              mapItem.job_title || 'Position',
              mapItem.job_company || mapItem.recruiter_company || 'Company'
            )
            
            // Generate email
            const emailResult_gen = await generateEmail(
              [mapItem.job_title || 'Position'],
              jobType,
              recruiterWithEmail
            )
            
            messages[i] = {
              linkedinMessage: linkedinResult.message || linkedinResult,
              email: emailResult_gen,
              recruiter: recruiterWithEmail,
              mapItem: mapItem
            }
          } catch (error) {
            console.error(`Error generating messages for pair ${i}:`, error)
            messages[i] = {
              linkedinMessage: null,
              email: null,
              error: error.message,
              recruiter: recruiterWithEmail,
              mapItem: mapItem
            }
          }
        }
        
        setGeneratedMessages(messages)
        
        // Convert messages object to array for navigation
        const messagesArray = Object.keys(messages).map(key => messages[key])
        
        // Save to localStorage as backup
        localStorage.setItem('outreachMessages', JSON.stringify(messagesArray))
        
        // Navigate to Messages page with the generated messages
        navigate('/messages', { 
          state: { messages: messagesArray },
          replace: false
        })
      }
    } catch (error) {
      console.error('Error extracting emails or generating messages:', error)
      alert(`Error generating messages: ${error.message}`)
    } finally {
      setIsExtractingEmails(false)
      setIsGeneratingMessages(false)
    }
  }

  // Send LinkedIn invitation
  const handleSendLinkedInInvitation = async (index, linkedinUrl, message) => {
    setSendingStatus(prev => ({
      ...prev,
      [index]: { ...prev[index], linkedin: 'pending' }
    }))
    
    try {
      const result = await sendLinkedInInvitation(linkedinUrl, message)
      if (result.success) {
        setSendingStatus(prev => ({
          ...prev,
          [index]: { ...prev[index], linkedin: 'success' }
        }))
      } else {
        setSendingStatus(prev => ({
          ...prev,
          [index]: { ...prev[index], linkedin: 'error', linkedinError: result.error }
        }))
      }
    } catch (error) {
      setSendingStatus(prev => ({
        ...prev,
        [index]: { ...prev[index], linkedin: 'error', linkedinError: error.message }
      }))
    }
  }

  // Send email
  const handleSendEmail = async (index, email, subject, body) => {
    setSendingStatus(prev => ({
      ...prev,
      [index]: { ...prev[index], email: 'pending' }
    }))
    
    try {
      const result = await sendEmail(email, subject, body)
      if (result.success) {
        setSendingStatus(prev => ({
          ...prev,
          [index]: { ...prev[index], email: 'success' }
        }))
      } else {
        setSendingStatus(prev => ({
          ...prev,
          [index]: { ...prev[index], email: 'error', emailError: result.error }
        }))
      }
    } catch (error) {
      setSendingStatus(prev => ({
        ...prev,
        [index]: { ...prev[index], email: 'error', emailError: error.message }
      }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header CTA Rail */}
      <div className="flex items-center space-x-2 overflow-x-auto">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            <button
              onClick={() => setCurrentStep(index)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                index === currentStep
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {step}
            </button>
            {index < steps.length - 1 && (
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Main Layout - Logger on left, panels on right */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Verbose Logger Panel - Left side, vertical, fixed width */}
        <div className="sticky top-4 z-40 h-[calc(100vh-120px)] w-full lg:w-[400px] lg:flex-shrink-0 lg:block hidden">
          <VerboseLogger active={true} />
        </div>
        
        {/* Mobile Logger - Show at top on small screens */}
        <div className="lg:hidden mb-6 w-full">
          <VerboseLogger active={true} />
        </div>

        {/* Right side - Main Grid with proper spacing */}
        <div className="flex-1 min-w-0 w-full grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Companies Panel */}
        <div className="rounded-lg bg-white p-6 shadow min-w-0 overflow-hidden">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Companies</h3>
          <div className="space-y-4 w-full">
            <div className="flex space-x-2 w-full min-w-0">
              <input
                type="text"
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    setSearchTrigger(searchQuery.trim())
                  }
                }}
                className="flex-1 min-w-0 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  if (searchQuery.trim()) {
                    setSearchTrigger(searchQuery.trim())
                  }
                }}
                disabled={isSearching || !searchQuery.trim()}
                className="flex-shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            {searchError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                Error: {searchError.message || 'Failed to search companies'}
                <br />
                <span className="text-xs text-red-600">
                  (Most endpoints require authentication. Check browser console for details.)
                </span>
              </div>
            )}
            {selectedCompanies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedCompanies.map((company, index) => (
                  <span
                    key={`${company}-${index}`}
                    className="flex items-center space-x-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                  >
                    <span>{company}</span>
                    <button
                      onClick={() => {
                        // Remove from both arrays at the same index
                        setSelectedCompanies(selectedCompanies.filter((c, i) => i !== index))
                        setSelectedCompanyIds(selectedCompanyIds.filter((id, i) => i !== index))
                      }}
                      className="ml-1 hover:text-blue-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="rounded-lg border border-gray-200">
              {isSearching ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
                  <div>Searching companies...</div>
                </div>
              ) : searchResults ? (
                <div className="p-4">
                  {searchResults.company_id ? (
                    <div className="space-y-2">
                      <div className="font-medium text-gray-900">
                        Found: {searchResults.company?.name || 'Company'}
                      </div>
                      <button
                        onClick={handleAddCompany}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        + Add to selection
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No companies found</div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-gray-500">
                  Enter a company name and click Search
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Jobs Panel */}
        <div className="rounded-lg bg-white p-6 shadow min-w-0 overflow-hidden">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Jobs</h3>
          <div className="space-y-4 w-full">
            {selectedCompanies.length > 0 ? (
              <>
                {/* Selected Companies */}
                <div className="flex flex-wrap gap-2">
                  {selectedCompanies.map((company, index) => (
                    <span
                      key={`${company}-${index}`}
                      className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                    >
                      {company}
                    </span>
                  ))}
                </div>

                {/* Job Title Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Job Title
                  </label>
                  <div className="flex space-x-2 w-full min-w-0">
                    <input
                      type="text"
                      placeholder="e.g., Software Engineer"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (jobTitle.trim() && !jobTitles.includes(jobTitle.trim())) {
                            addJobTitle()
                          } else if (jobTitles.length > 0 && selectedCompanyIds.length > 0) {
                            // If titles are already added, search for jobs
                            handleJobSearch()
                          }
                        }
                      }}
                      className="flex-1 min-w-0 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={addJobTitle}
                      disabled={!jobTitle.trim() || jobTitles.includes(jobTitle.trim())}
                      className="flex-shrink-0 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  
                  {/* Job Title Tags */}
                  {jobTitles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {jobTitles.map((title) => (
                        <span
                          key={title}
                          className="flex items-center space-x-1 rounded-full bg-green-100 px-3 py-1 text-sm text-green-800"
                        >
                          <span>{title}</span>
                          <button
                            onClick={() => removeJobTitle(title)}
                            className="ml-1 hover:text-green-900"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Job Type Selector */}
                  <div className="flex items-center space-x-4">
                    <label className="text-sm font-medium text-gray-700">Job Type:</label>
                    <select
                      value={jobType}
                      onChange={(e) => setJobType(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && jobTitles.length > 0 && selectedCompanyIds.length > 0) {
                          e.preventDefault()
                          handleJobSearch()
                        }
                      }}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="full_time">Full Time</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>

                  {/* Search Jobs Button */}
                  <button
                    type="button"
                    onClick={handleJobSearch}
                    disabled={selectedCompanyIds.length === 0 || jobTitles.length === 0 || isSearchingJobs}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.target.disabled) {
                        e.preventDefault()
                        handleJobSearch()
                      }
                    }}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {isSearchingJobs ? 'Searching Jobs...' : 'Search Jobs'}
                  </button>
                </div>

                {/* Error Display */}
                {jobSearchError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    Error: {jobSearchError.message || 'Failed to search jobs'}
                  </div>
                )}

                {/* AI Filter Option */}
                {(filteredJobResults?.jobs || jobResults?.jobs) && (filteredJobResults?.jobs?.length > 0 || jobResults?.jobs?.length > 0) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-purple-50 border border-purple-200 p-3">
                      <div>
                        <div className="text-sm font-medium text-purple-900">
                          🤖 AI Filter Available
                        </div>
                        <div className="text-xs text-purple-600 mt-1">
                          Filter to top 2 most relevant jobs based on your resume (testing mode)
                        </div>
                      </div>
                      <button
                        onClick={handleFilterJobs}
                        disabled={isFiltering || (!jobResults?.jobs && !filteredJobResults?.jobs)}
                        className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {isFiltering ? 'Filtering...' : 'Filter to Top 2'}
                      </button>
                    </div>
                         {filterError && (
                           <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                             <div className="whitespace-pre-wrap font-mono text-xs">{filterError}</div>
                           </div>
                         )}
                  </div>
                )}

                {/* Job Results */}
                <div className="rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
                  {isSearchingJobs ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
                      <div>Searching jobs...</div>
                    </div>
                  ) : (filteredJobResults?.jobs || jobResults?.jobs) ? (
                    <div className="p-4 space-y-3">
                      <div className="text-sm font-medium text-gray-900 mb-2">
                        {filteredJobResults?.jobs ? (
                          <>
                            🎯 Top {filteredJobResults.jobs.length} Most Relevant Job{filteredJobResults.jobs.length !== 1 ? 's' : ''}
                            <span className="text-xs text-gray-500 ml-2">(AI Filtered)</span>
                          </>
                        ) : (
                          <>Found {jobResults.total_jobs_found || jobResults.jobs.length} job{(jobResults.total_jobs_found || jobResults.jobs.length) !== 1 ? 's' : ''} (showing 5 evenly distributed samples)</>
                        )}
                      </div>
                      {(filteredJobResults?.jobs || jobResults.jobs).slice(0, 10).map((job, index) => {
                        // Safely extract company name (could be string or object)
                        const companyName = typeof job.company === 'string' 
                          ? job.company 
                          : (job.company?.name || job.company_name || 'Unknown Company')
                        
                        return (
                          <div
                            key={index}
                            className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0 cursor-pointer hover:bg-gray-50 p-2 rounded"
                            onClick={() => {
                              const existingJob = selectedJobs.find(j => 
                                j.title === job.title && 
                                (typeof j.company === 'string' ? j.company : j.company?.name) === companyName
                              )
                              if (!existingJob) {
                                setSelectedJobs([...selectedJobs, job])
                              }
                            }}
                          >
                            <div className="font-medium text-sm text-gray-900">{job.title || 'Untitled'}</div>
                            <div className="text-xs text-gray-600 mt-1">{companyName}</div>
                            {job.location && (
                              <div className="text-xs text-gray-500 mt-1">
                                {typeof job.location === 'string' ? job.location : job.location?.name || 'Unknown Location'}
                              </div>
                            )}
                            {job.url && (
                              <a
                                href={typeof job.url === 'string' ? job.url : job.url?.url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
                              >
                                View on LinkedIn →
                              </a>
                            )}
                          </div>
                        )
                      })}
                      {(filteredJobResults?.jobs || jobResults?.jobs)?.length > 10 && (
                        <div className="text-xs text-gray-500 text-center pt-2">
                          Showing first 10 of {(filteredJobResults?.jobs || jobResults?.jobs).length} jobs
                        </div>
                      )}
                    </div>
                  ) : jobSearchTrigger && !isSearchingJobs && !jobSearchError ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No jobs found. Try different job titles or companies.
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-gray-500">
                      Add job titles and click "Search Jobs" to find opportunities
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
                Select companies to find jobs
              </div>
            )}
          </div>
        </div>

        {/* Recruiters Panel */}
        <div className="rounded-lg bg-white p-6 shadow min-w-0 overflow-hidden">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Recruiters</h3>
          <div className="space-y-4 w-full">
            {selectedJobs.length > 0 || mappedRecruiters.length > 0 ? (
              <>
                {selectedJobs.length > 0 && mappedRecruiters.length === 0 && (
                  <button
                    onClick={handleMapToRecruiters}
                    disabled={isMapping || selectedJobs.length === 0}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMapping ? 'Mapping...' : 'Map to Best Recruiters'}
                  </button>
                )}

                {recruiterSearchError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    {recruiterSearchError}
                  </div>
                )}

                {mappingError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    {mappingError}
                  </div>
                )}

                {/* Show mapping results */}
                {mapping.length > 0 && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800 mb-4">
                    ✅ Mapped {mapping.length} job{mapping.length !== 1 ? 's' : ''} to {mappedRecruiters.length} recruiter{mappedRecruiters.length !== 1 ? 's' : ''} (1:1 mapping)
                  </div>
                )}

                <div className="rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
                  {isMapping || isSearchingRecruiters ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
                      <div>{isMapping ? 'Mapping jobs to recruiters...' : 'Searching recruiters...'}</div>
                    </div>
                  ) : mappedRecruiters.length > 0 ? (
                    <div className="p-4 space-y-3">
                      <div className="text-sm font-medium text-gray-900 mb-2">
                        🎯 {mappedRecruiters.length} Mapped Recruiter{mappedRecruiters.length !== 1 ? 's' : ''} (1 per job)
                      </div>
                      {mapping.slice(0, mappedRecruiters.length).map((mapItem, index) => (
                        <div
                          key={index}
                          className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-900">
                                {mapItem.recruiter_name || 'Unknown Recruiter'}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {mapItem.recruiter_company || 'Unknown Company'}
                              </div>
                              <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                                💼 Matched for: <span className="font-medium">{mapItem.job_title}</span> at {mapItem.job_company}
                              </div>
                            </div>
                            {mapItem.recruiter_profile_url && (
                              <a
                                href={mapItem.recruiter_profile_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 ml-2 whitespace-nowrap"
                              >
                                View →
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : recruiters.length > 0 ? (
                    <div className="p-4 space-y-3">
                      <div className="text-sm font-medium text-gray-900 mb-2">
                        Found {recruiters.length} recruiters
                      </div>
                      {recruiters.slice(0, 10).map((recruiter, index) => {
                        const recruiterName = recruiter.name || 'Unknown Recruiter'
                        const recruiterCompany = typeof recruiter.company === 'string' 
                          ? recruiter.company 
                          : (recruiter.company?.name || 'Unknown Company')
                        
                        return (
                          <div
                            key={index}
                            className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0"
                          >
                            <div className="font-medium text-sm text-gray-900">{recruiterName}</div>
                            <div className="text-xs text-gray-600 mt-1">{recruiterCompany}</div>
                            {recruiter.headline && (
                              <div className="text-xs text-gray-500 mt-1">{recruiter.headline}</div>
                            )}
                            {recruiter.profile_url && (
                              <a
                                href={recruiter.profile_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
                              >
                                View on LinkedIn →
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : selectedJobs.length > 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      Click "Map to Best Recruiters" to find the best recruiters for your selected jobs
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-gray-500">
                      Recruiter results will appear here
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
                Select jobs to find recruiters
              </div>
            )}
          </div>
        </div>

        {/* Messages & Outreach Section - Shows after mapping */}
        {mapping.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-900">📨 Generated Messages & Outreach</h2>
          
          {isExtractingEmails || isGeneratingMessages ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
              <div className="text-sm text-gray-600">
                {isExtractingEmails ? 'Extracting emails...' : 'Generating personalized messages...'}
              </div>
            </div>
          ) : Object.keys(generatedMessages).length > 0 ? (
            <div className="space-y-6">
              {mapping.map((mapItem, index) => {
                const messageData = generatedMessages[index]
                const status = sendingStatus[index] || {}
                const recruiterWithEmail = recruitersWithEmails.find(r => 
                  (r.name || r.profile_url) === mapItem.recruiter_name || 
                  r.profile_url === mapItem.recruiter_profile_url
                ) || {}
                
                if (!messageData) return null
                
                const linkedinMessage = typeof messageData.linkedinMessage === 'string' 
                  ? messageData.linkedinMessage 
                  : messageData.linkedinMessage?.message || ''
                const emailData = messageData.email || {}
                const emailAddress = recruiterWithEmail.extracted_email || ''
                
                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="mb-3">
                      <div className="font-semibold text-gray-900">
                        {mapItem.recruiter_name} @ {mapItem.recruiter_company}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        For: {mapItem.job_title} at {mapItem.job_company}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* LinkedIn Message Section */}
                      <div className="border border-gray-200 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-900">🔗 LinkedIn Message</span>
                          {status.linkedin === 'success' && (
                            <span className="text-xs text-green-600">✅ Sent</span>
                          )}
                          {status.linkedin === 'error' && (
                            <span className="text-xs text-red-600">❌ Failed</span>
                          )}
                        </div>
                        <div className="bg-gray-50 rounded p-2 mb-2 text-sm text-gray-700 whitespace-pre-wrap min-h-[100px] max-h-[150px] overflow-y-auto">
                          {linkedinMessage || 'Generating...'}
                        </div>
                        {mapItem.recruiter_profile_url && (
                          <button
                            onClick={() => handleSendLinkedInInvitation(
                              index,
                              mapItem.recruiter_profile_url, 
                              linkedinMessage
                            )}
                            disabled={!linkedinMessage || status.linkedin === 'pending' || status.linkedin === 'success'}
                            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {status.linkedin === 'pending' ? 'Sending...' : 
                             status.linkedin === 'success' ? '✅ Sent' :
                             status.linkedin === 'error' ? '❌ Retry' : 
                             'Send LinkedIn Invitation'}
                          </button>
                        )}
                        {status.linkedin === 'error' && status.linkedinError && (
                          <div className="text-xs text-red-600 mt-1">{status.linkedinError}</div>
                        )}
                      </div>
                      
                      {/* Email Section */}
                      <div className="border border-gray-200 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-900">📧 Email</span>
                          {status.email === 'success' && (
                            <span className="text-xs text-green-600">✅ Sent</span>
                          )}
                          {status.email === 'error' && (
                            <span className="text-xs text-red-600">❌ Failed</span>
                          )}
                        </div>
                        {emailAddress && (
                          <div className="text-xs text-gray-600 mb-2">
                            To: {emailAddress}
                          </div>
                        )}
                        {emailData.subject && (
                          <div className="bg-gray-50 rounded p-2 mb-2">
                            <div className="text-xs font-semibold text-gray-700 mb-1">Subject:</div>
                            <div className="text-sm text-gray-900">{emailData.subject}</div>
                          </div>
                        )}
                        <div className="bg-gray-50 rounded p-2 mb-2 text-sm text-gray-700 whitespace-pre-wrap min-h-[100px] max-h-[150px] overflow-y-auto">
                          {emailData.body || 'Generating...'}
                        </div>
                        {emailAddress && (
                          <button
                            onClick={() => handleSendEmail(
                              index,
                              emailAddress,
                              emailData.subject || '',
                              emailData.body || ''
                            )}
                            disabled={!emailData.body || status.email === 'pending' || status.email === 'success'}
                            className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {status.email === 'pending' ? 'Sending...' : 
                             status.email === 'success' ? '✅ Sent' :
                             status.email === 'error' ? '❌ Retry' : 
                             'Send Email'}
                          </button>
                        )}
                        {!emailAddress && (
                          <div className="text-xs text-gray-500 italic">Email address not found</div>
                        )}
                        {status.email === 'error' && status.emailError && (
                          <div className="text-xs text-red-600 mt-1">{status.emailError}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-gray-500">
              Generating messages... This may take a moment.
            </div>
          )}
        </div>
        )}
        </div>
      </div>
    </div>
  )
}


import { motion } from 'framer-motion'
import React, { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { WobbleCard } from '../components/ui/wobble-card'

const STEPS = ['Find Companies', 'Find Jobs', 'Find Recruiters', 'Map to Best Recruiters', 'Outreach']
const CURRENT_STEP_INDEX = 3

const getJobUrl = (job = {}) => {
  return (
    job.job_url ||
    job.url ||
    job.link ||
    job.jobUrl ||
    job.jobLink ||
    job?.job?.url ||
    null
  )
}

const normalizeString = (value) => (value || '').toLowerCase().trim()

const SearchMapping = ({
  jobs: jobsProp,
  mapping: mappingProp,
  recruiters: recruitersProp,
  onBack,
  onGenerate,
  isGenerating = false
}) => {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state || {}
  const mappings = mappingProp ?? state.mapping ?? []
  const jobs = jobsProp ?? state.jobs ?? []
  const recruiters = recruitersProp ?? state.recruiters ?? []
  const handleBack = onBack || (() => navigate('/dashboard/search'))
  const handleGenerate =
    onGenerate ||
    (() => navigate('/dashboard/search', { state: { triggerMessageGeneration: true } }))

  useEffect(() => {
    if (!mappingProp && (!state || !mappings || mappings.length === 0)) {
      navigate('/dashboard/search', { replace: true })
    }
  }, [state, mappings, navigate, mappingProp])

  const recruiterLookup = useMemo(() => {
    const lookup = new Map()
    recruiters.forEach((recruiter) => {
      const key = normalizeString(recruiter?.profile_url || recruiter?.name)
      if (key) {
        lookup.set(key, recruiter)
      }
      const nameKey = normalizeString(recruiter?.name || recruiter?.full_name || recruiter?.display_name)
      if (nameKey) {
        lookup.set(nameKey, recruiter)
      }
      const profileKey = normalizeString(recruiter?.profile_url || recruiter?.linkedin_url || recruiter?.url)
      if (profileKey) {
        lookup.set(profileKey, recruiter)
      }
    })
    return lookup
  }, [recruiters])

  const resolveJobDetails = (mappingItem) => {
    if (!mappingItem) return {}
    const mappingJobUrl = normalizeString(mappingItem.job_url || mappingItem.job_link)
    const mappingJobTitle = normalizeString(mappingItem.job_title)
    const mappingCompany = normalizeString(mappingItem.job_company)

    const jobMatch = jobs.find((job) => {
      const jobUrl = normalizeString(getJobUrl(job))
      const jobTitle = normalizeString(job.title || job.job_title)
      const jobCompany = normalizeString(job.company?.name || job.company_name || job.company)

      if (mappingJobUrl && jobUrl && jobUrl === mappingJobUrl) return true
      if (mappingJobTitle && mappingCompany) {
        return jobTitle === mappingJobTitle && jobCompany === mappingCompany
      }
      return false
    })

    return jobMatch || {}
  }

  const renderMappingCard = (mappingItem, index) => {
    if (!mappingItem) return null
    const jobDetails = resolveJobDetails(mappingItem)
    const recruiterKey = normalizeString(mappingItem.recruiter_profile_url || mappingItem.recruiter_name)
    const recruiterDetails =
      recruiterLookup.get(recruiterKey) ||
      recruiterLookup.get(normalizeString(mappingItem.recruiter_name)) ||
      mappingItem
    const jobUrl = getJobUrl(jobDetails) || mappingItem.job_url || mappingItem.job_link

    return (
      <motion.div
        key={`${mappingItem.job_title || 'job'}-${index}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="col-span-1"
      >
        <WobbleCard
          minimal
          containerClassName="h-full bg-transparent overflow-visible"
          className="h-full"
        >
          <Card className="h-full bg-gray-800/50 border border-gray-700/60 shadow-lg">
            <CardHeader className="border-b border-gray-700/60 pb-3 min-h-[112px]">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-white text-base leading-tight">
                  {mappingItem.job_title || jobDetails.title || 'Untitled Role'}
                </CardTitle>
                {jobUrl && (
                  <a
                    href={jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    View Posting
                  </a>
                )}
              </div>
              <p className="text-sm text-gray-300 mt-1">
                {mappingItem.job_company || jobDetails.company?.name || jobDetails.company_name || 'Unknown company'}
              </p>
              {jobDetails.location && (
                <p className="text-xs text-gray-400">
                  {typeof jobDetails.location === 'string' ? jobDetails.location : jobDetails.location?.name}
                </p>
              )}
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Assigned Recruiter</p>
                <p className="text-sm font-medium text-blue-200">
                  {recruiterDetails.name || mappingItem.recruiter_name || 'Unknown recruiter'}
                </p>
                {recruiterDetails.profile_url || mappingItem.recruiter_profile_url ? (
                  <a
                    href={recruiterDetails.profile_url || mappingItem.recruiter_profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    View LinkedIn Profile
                  </a>
                ) : null}
              </div>

              {mappingItem.match_reason && (
                <div className="rounded-lg bg-blue-900/20 border border-blue-700/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-blue-300 mb-1">Match Reason</p>
                  <p className="text-sm text-blue-100 whitespace-pre-line">
                    {mappingItem.match_reason}
                  </p>
                </div>
              )}

              {mappingItem.notes && (
                <div className="rounded-lg bg-gray-900/40 border border-gray-700/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-200 whitespace-pre-line">
                    {mappingItem.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </WobbleCard>
      </motion.div>
    )
  }

  if (!mappings || mappings.length === 0) {
    return null
  }

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <div className="flex items-center justify-center space-x-4 py-4">
          {STEPS.map((step, index) => (
            <React.Fragment key={index}>
              <span
                className={`text-sm font-medium transition-colors ${
                  index === CURRENT_STEP_INDEX
                    ? 'text-blue-400'
                    : index < CURRENT_STEP_INDEX
                    ? 'text-green-400'
                    : 'text-gray-500'
                }`}
              >
                {step}
              </span>
              {index < STEPS.length - 1 && (
                <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Recruiter Mapping</p>
            <h1 className="text-2xl font-semibold text-white mt-1">Matched Recruiters</h1>
            <p className="text-sm text-gray-400 mt-2">
              Review the recruiters matched to each job posting. Generate messaging when you are ready.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800/60"
            >
              Back to Search
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate Messages'}
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {mappings.map((mappingItem, index) => renderMappingCard(mappingItem, index))}
        </motion.div>
      </div>
    </div>
  )
}

export default SearchMapping

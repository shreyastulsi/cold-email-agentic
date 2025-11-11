import { useEffect, useState } from 'react'
import { WobbleCard } from '../components/ui/wobble-card'
import { apiRequest } from '../utils/api'

export default function Dashboard() {
  const [stats, setStats] = useState({
    linkedinInvitesSent: 0,
    emailsSent: 0,
    uniqueCompaniesReached: 0,
    rolesReached: [],
    latestAttempts: []
  })
  const [loading, setLoading] = useState(true)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredAttempts, setFilteredAttempts] = useState([])

  // Fetch user stats from API
  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await apiRequest('/api/v1/user-stats')
      setStats({
        linkedinInvitesSent: response.linkedin_invites_sent || 0,
        emailsSent: response.emails_sent || 0,
        uniqueCompaniesReached: response.unique_companies_reached || 0,
        rolesReached: response.roles_reached_list || [],
        latestAttempts: response.latest_attempts || []
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    
    // Listen for custom event (when stats are updated from other pages)
    const handleStatsUpdate = () => {
      fetchStats()
    }
    window.addEventListener('statsUpdated', handleStatsUpdate)
    
    return () => {
      window.removeEventListener('statsUpdated', handleStatsUpdate)
    }
  }, [])

  // Filter attempts based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredAttempts(stats.latestAttempts)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = stats.latestAttempts.filter(attempt => {
      return (
        attempt.recruiter?.toLowerCase().includes(query) ||
        attempt.company?.toLowerCase().includes(query) ||
        attempt.title?.toLowerCase().includes(query) ||
        attempt.channel?.toLowerCase().includes(query)
      )
    })
    setFilteredAttempts(filtered)
  }, [searchQuery, stats.latestAttempts])

  const handleReset = async () => {
    if (showResetConfirm) {
      try {
        await apiRequest('/api/v1/user-stats/reset', { method: 'POST' })
        await fetchStats()
        setShowResetConfirm(false)
        alert('All statistics have been reset to 0')
      } catch (error) {
        console.error('Error resetting stats:', error)
        alert('Failed to reset statistics')
      }
    } else {
      setShowResetConfirm(true)
      setTimeout(() => setShowResetConfirm(false), 3000)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="space-y-6">
          {/* Header with Reset Button */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white">Outreach Summary</h1>
        {/* <button
          onClick={handleReset}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            showResetConfirm
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'
          }`}
        >
          {showResetConfirm ? 'Click again to confirm reset' : 'Reset All Stats'}
        </button> */}
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-400">Loading statistics...</p>
        </div>
      ) : (
        <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WobbleCard
          minimal
          containerClassName="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 shadow-lg"
          className="p-6"
        >
          <h3 className="text-sm font-medium text-muted-foreground">LinkedIn Invites Sent</h3>
          <div className="mt-2">
            <p className="text-3xl font-semibold text-white">{stats.linkedinInvitesSent}</p>
          </div>
        </WobbleCard>
        <WobbleCard
          minimal
          containerClassName="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 shadow-lg"
          className="p-6"
        >
          <h3 className="text-sm font-medium text-muted-foreground">Emails Sent</h3>
          <div className="mt-2">
            <p className="text-3xl font-semibold text-white">{stats.emailsSent}</p>
          </div>
        </WobbleCard>
        <WobbleCard
          minimal
          containerClassName="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 shadow-lg"
          className="p-6"
        >
          <h3 className="text-sm font-medium text-muted-foreground">Unique Companies Reached</h3>
          <div className="mt-2">
            <p className="text-3xl font-semibold text-white">
              {stats.uniqueCompaniesReached}
            </p>
          </div>
        </WobbleCard>
      </div>

      {/* Roles Reached */}
      {stats.rolesReached && stats.rolesReached.length > 0 && (
        <WobbleCard
          minimal
          containerClassName="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 shadow-lg"
          className="p-0"
        >
          <div className="px-6 py-4 border-b border-gray-700/50">
            <h2 className="text-lg font-semibold text-white">
              Roles Reached Out For ({stats.rolesReached.length})
            </h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {stats.rolesReached.map((item, index) => (
                <span
                  key={index}
                  className="inline-flex items-center rounded-full bg-blue-900/50 border border-blue-700/50 px-3 py-1 text-sm font-medium text-blue-300"
                >
                  {item.role} @ {item.company}
                </span>
              ))}
            </div>
          </div>
        </WobbleCard>
      )}

      {/* Latest Attempts Table */}
      <WobbleCard
        minimal
        containerClassName="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 shadow-lg"
        className="p-0"
      >
        <div className="px-6 py-4 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Latest Attempts {stats.latestAttempts?.length > 0 && `(${filteredAttempts.length}/${stats.latestAttempts.length})`}
            </h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by recruiter, company, or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-80 px-4 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700/50">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Recruiter
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Channel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-transparent divide-y divide-gray-700/50">
              {filteredAttempts && filteredAttempts.length > 0 ? (
                filteredAttempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {new Date(attempt.time).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {attempt.recruiter || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {attempt.company || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-200">
                      {attempt.title || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        attempt.channel?.includes('LinkedIn') && attempt.channel?.includes('Email')
                          ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50'
                          : attempt.channel?.includes('LinkedIn')
                          ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50'
                          : 'bg-green-900/50 text-green-300 border border-green-700/50'
                      }`}>
                        {attempt.channel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900/50 text-green-300 border border-green-700/50">
                        {attempt.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : searchQuery ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                    No attempts found matching "{searchQuery}"
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                    No attempts yet. Start in{' '}
                    <a href="/dashboard/search" className="text-blue-400 hover:text-blue-300 underline underline-offset-4">
                      Search
                    </a>
                    {' or '}
                    <a href="/dashboard/drafts" className="text-blue-400 hover:text-blue-300 underline underline-offset-4">
                      Drafts
                    </a>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </WobbleCard>
        </>
      )}
        </div>
      </div>
    </div>
  )
}


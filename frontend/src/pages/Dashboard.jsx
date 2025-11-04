import { useEffect, useState } from 'react'
import { WobbleCard } from '../components/ui/wobble-card'
import { getStats, resetStats } from '../utils/dashboardStats'

export default function Dashboard() {
  const [stats, setStats] = useState(() => getStats())
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Listen for storage changes (when stats are updated from Messages page)
  useEffect(() => {
    const handleStatsUpdate = () => {
      setStats(getStats())
    }
    
    // Listen for custom event (same-tab updates)
    window.addEventListener('statsUpdated', handleStatsUpdate)
    // Also listen for storage event (different-tab updates)
    window.addEventListener('storage', handleStatsUpdate)
    
    return () => {
      window.removeEventListener('statsUpdated', handleStatsUpdate)
      window.removeEventListener('storage', handleStatsUpdate)
    }
  }, [])

  const handleReset = () => {
    if (showResetConfirm) {
      resetStats()
      setStats(getStats())
      setShowResetConfirm(false)
      alert('All statistics have been reset to 0')
    } else {
      setShowResetConfirm(true)
      setTimeout(() => setShowResetConfirm(false), 3000)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Reset Button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Outreach Summary</h1>
        <button
          onClick={handleReset}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            showResetConfirm
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'
          }`}
        >
          {showResetConfirm ? 'Click again to confirm reset' : 'Reset All Stats'}
        </button>
      </div>

      {/* KPI Cards */}
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
          <h3 className="text-sm font-medium text-muted-foreground">Total Outreach</h3>
          <div className="mt-2">
            <p className="text-3xl font-semibold text-white">
              {stats.linkedinInvitesSent + stats.emailsSent}
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
          <h2 className="text-lg font-semibold text-white">
            Latest Attempts {stats.latestAttempts?.length > 0 && `(${stats.latestAttempts.length})`}
          </h2>
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
                  Target
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
              {stats.latestAttempts && stats.latestAttempts.length > 0 ? (
                stats.latestAttempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {new Date(attempt.time).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {attempt.recruiter || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {attempt.target}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        attempt.channel === 'LinkedIn'
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
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                    No attempts yet. Start in{' '}
                    <a href="/search" className="text-blue-400 hover:text-blue-300 underline underline-offset-4">
                      Search
                    </a>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </WobbleCard>
    </div>
  )
}


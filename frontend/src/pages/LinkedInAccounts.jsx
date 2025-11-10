import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../utils/api'

export default function LinkedInAccounts() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load LinkedIn accounts
  const loadAccounts = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiRequest('/api/v1/linkedin-accounts')
      setAccounts(result.accounts || [])
    } catch (err) {
      setError(err.message || 'Failed to load LinkedIn accounts')
    } finally {
      setLoading(false)
    }
  }

  // Cleanup duplicates on load
  const cleanupDuplicates = async () => {
    try {
      const result = await apiRequest('/api/v1/linkedin-accounts/cleanup-duplicates', {
        method: 'POST'
      })
      if (result.removed > 0) {
        console.log(`Cleaned up ${result.removed} duplicate LinkedIn account(s)`)
        loadAccounts()
      }
    } catch (err) {
      console.warn('Failed to cleanup duplicates:', err)
    }
  }

  useEffect(() => {
    loadAccounts()
    cleanupDuplicates()

    const handleFocus = () => {
      loadAccounts()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // Handle Unipile hosted auth flow
  const handleUnipileAuthLink = async () => {
    try {
      setError(null)
      const result = await apiRequest('/api/v1/linkedin-accounts/unipile/auth-link')
      
      // Redirect to Unipile hosted auth wizard (full page redirect, not popup)
      // Unipile will handle the OAuth flow and redirect back to our success/failure URLs
      window.location.href = result.auth_url
      
    } catch (err) {
      setError(err.message || 'Failed to start LinkedIn connection flow')
    }
  }

  // Delete account
  const handleDelete = async (accountId) => {
    if (!confirm('Are you sure you want to delete this LinkedIn account?')) {
      return
    }
    
    try {
      setError(null)
      await apiRequest(`/api/v1/linkedin-accounts/${accountId}`, {
        method: 'DELETE'
      })
      // Reload accounts after successful deletion
      await loadAccounts()
    } catch (err) {
      const errorMessage = err.message || 'Failed to delete LinkedIn account'
      setError(errorMessage)
      console.error('Delete error:', err)
      // Show error for a few seconds
      setTimeout(() => {
        setError(null)
      }, 5000)
    }
  }

  // Removed handleToggleActive - users can only have one LinkedIn account, no enable/disable needed

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">LinkedIn Accounts</h1>
          <p className="text-gray-400">
            Connect your LinkedIn account to send messages and connection requests from your own account.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Connected Accounts</h2>
            {accounts.length === 0 && (
              <button
                onClick={handleUnipileAuthLink}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
              >
                + Connect LinkedIn Account
              </button>
            )}
            {accounts.length > 0 && (
              <p className="text-sm text-gray-400">
                You can only have one LinkedIn account. Delete your current account to connect a different one.
              </p>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Loading accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">No LinkedIn accounts connected</p>
              <p className="text-sm text-gray-500">
                Connect your LinkedIn account to send messages and connection requests from your own account.
                This provides better rate limits and compliance.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="border border-gray-700 rounded-lg p-4 bg-gray-800/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {account.display_name ? account.display_name.charAt(0).toUpperCase() : 'L'}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              {account.display_name || 'LinkedIn Account'}
                            </h3>
                          </div>
                          {account.linkedin_profile_url && (
                            <a
                              href={account.linkedin_profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-400 hover:underline"
                            >
                              View Profile
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
          <h3 className="font-semibold mb-2 text-blue-300">Why connect your LinkedIn account?</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Send messages and connection requests from your own LinkedIn account</li>
            <li>• Better rate limits (100+ connection requests per month per account)</li>
            <li>• Improved compliance and authenticity</li>
            <li>• Uses Unipile's secure hosted auth wizard for easy connection</li>
            <li>• Unipile handles LinkedIn OAuth authentication securely</li>
          </ul>
        </div>
      </div>
    </div>
  )
}


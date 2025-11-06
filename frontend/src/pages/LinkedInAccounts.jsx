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

  useEffect(() => {
    loadAccounts()
  }, [])

  // Handle OAuth flow
  const handleOAuthLink = async () => {
    try {
      setError(null)
      const result = await apiRequest('/api/v1/linkedin-accounts/oauth/auth-url')
      
      // Open OAuth popup
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      
      const popup = window.open(
        result.auth_url,
        'LinkedIn OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      )
      
      if (!popup) {
        setError('Popup blocked. Please allow popups for this site and try again.')
        return
      }
      
      // Listen for messages from popup
      const messageHandler = (event) => {
        // Verify origin for security
        if (event.origin !== window.location.origin) {
          return
        }
        
        if (event.data.type === 'OAUTH_SUCCESS') {
          // Success - reload accounts
          window.removeEventListener('message', messageHandler)
          try {
            popup.close()
          } catch (e) {
            // Ignore COOP errors when closing popup
          }
          loadAccounts()
        } else if (event.data.type === 'OAUTH_ERROR') {
          // Error - show error message
          window.removeEventListener('message', messageHandler)
          try {
            popup.close()
          } catch (e) {
            // Ignore COOP errors when closing popup
          }
          setError(event.data.error || 'LinkedIn OAuth authorization failed')
        }
      }
      
      window.addEventListener('message', messageHandler)
      
      // Cleanup after timeout
      const cleanupTimeout = setTimeout(() => {
        window.removeEventListener('message', messageHandler)
      }, 600000) // 10 minutes
      
    } catch (err) {
      setError(err.message || 'Failed to start LinkedIn OAuth flow')
    }
  }

  // Delete account
  const handleDelete = async (accountId) => {
    if (!confirm('Are you sure you want to disconnect this LinkedIn account?')) {
      return
    }
    
    try {
      await apiRequest(`/api/v1/linkedin-accounts/${accountId}`, {
        method: 'DELETE'
      })
      loadAccounts()
    } catch (err) {
      setError(err.message || 'Failed to delete LinkedIn account')
    }
  }

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
            <button
              onClick={handleOAuthLink}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
            >
              + Connect LinkedIn Account
            </button>
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
                          <h3 className="font-semibold">
                            {account.display_name || 'LinkedIn Account'}
                          </h3>
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
                          {account.is_default && (
                            <span className="ml-2 text-xs bg-blue-600 px-2 py-1 rounded">Default</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.is_active ? (
                        <span className="text-xs text-green-400">Active</span>
                      ) : (
                        <span className="text-xs text-gray-400">Inactive</span>
                      )}
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded text-white"
                      >
                        Disconnect
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
            <li>• Unipile is still used for search and discovery features</li>
          </ul>
        </div>
      </div>
    </div>
  )
}


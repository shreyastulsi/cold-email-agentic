import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../utils/api'

export default function EmailAccounts() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [provider, setProvider] = useState('gmail') // 'gmail', 'outlook', 'custom'
  
  // Custom SMTP form state
  const [customForm, setCustomForm] = useState({
    email: '',
    display_name: '',
    smtp_server: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
  })

  // Load email accounts
  const loadAccounts = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiRequest('/api/v1/email-accounts')
      setAccounts(result.accounts || [])
    } catch (err) {
      setError(err.message || 'Failed to load email accounts')
    } finally {
      setLoading(false)
    }
  }

  // Cleanup duplicates on load
  const cleanupDuplicates = async () => {
    try {
      const result = await apiRequest('/api/v1/email-accounts/cleanup-duplicates', {
        method: 'POST'
      })
      if (result.removed > 0) {
        console.log(`Cleaned up ${result.removed} duplicate email account(s)`)
        loadAccounts() // Reload after cleanup
      }
    } catch (err) {
      console.warn('Failed to cleanup duplicates:', err)
    }
  }

  useEffect(() => {
    loadAccounts()
    // Cleanup duplicates automatically on load
    cleanupDuplicates()
  }, [])

  // Handle OAuth flow
  const handleOAuthLink = async (provider) => {
    try {
      setError(null)
      const result = await apiRequest(`/api/v1/email-accounts/oauth/${provider}/auth-url`)
      
      // Open OAuth popup
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      
      const popup = window.open(
        result.auth_url,
        'OAuth',
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
          setShowAddModal(false)
        } else if (event.data.type === 'OAUTH_ERROR') {
          // Error - show error message
          window.removeEventListener('message', messageHandler)
          try {
            popup.close()
          } catch (e) {
            // Ignore COOP errors when closing popup
          }
          setError(event.data.error || 'OAuth authorization failed')
        }
      }
      
      window.addEventListener('message', messageHandler)
      
      // Cleanup after timeout (if popup is still open after 10 minutes, assume it was abandoned)
      const cleanupTimeout = setTimeout(() => {
        window.removeEventListener('message', messageHandler)
      }, 600000) // 10 minutes
      
    } catch (err) {
      setError(err.message || 'Failed to start OAuth flow')
    }
  }

  // Handle custom SMTP setup
  const handleCustomSMTP = async (e) => {
    e.preventDefault()
    setError(null)
    
    try {
      await apiRequest('/api/v1/email-accounts', {
        method: 'POST',
        body: JSON.stringify({
          email: customForm.email,
          provider: 'custom',
          display_name: customForm.display_name || customForm.email.split('@')[0],
          smtp_server: customForm.smtp_server,
          smtp_port: parseInt(customForm.smtp_port),
          smtp_username: customForm.smtp_username,
          smtp_password: customForm.smtp_password,
          is_default: accounts.length === 0, // Set as default if first account
        })
      })
      
      setShowAddModal(false)
      setCustomForm({
        email: '',
        display_name: '',
        smtp_server: '',
        smtp_port: 587,
        smtp_username: '',
        smtp_password: '',
      })
      loadAccounts()
    } catch (err) {
      setError(err.message || 'Failed to add email account')
    }
  }

  // Set default account
  const handleSetDefault = async (accountId) => {
    try {
      await apiRequest(`/api/v1/email-accounts/${accountId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_default: true })
      })
      loadAccounts()
    } catch (err) {
      setError(err.message || 'Failed to set default account')
    }
  }

  // Delete account
  const handleDelete = async (accountId) => {
    if (!confirm('Are you sure you want to delete this email account?')) {
      return
    }
    
    try {
      await apiRequest(`/api/v1/email-accounts/${accountId}`, {
        method: 'DELETE'
      })
      loadAccounts()
    } catch (err) {
      setError(err.message || 'Failed to delete email account')
    }
  }

  // Toggle active status
  const handleToggleActive = async (accountId, isActive) => {
    try {
      // If trying to enable, check if another account is already enabled
      if (!isActive) {
        const activeAccount = accounts.find(acc => acc.id !== accountId && acc.is_active)
        if (activeAccount) {
          const confirmMessage = `Another email account (${activeAccount.email || activeAccount.display_name}) is already enabled. Enabling this account will disable the other one. Continue?`
          if (!confirm(confirmMessage)) {
            return
          }
        }
      }
      
      await apiRequest(`/api/v1/email-accounts/${accountId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !isActive })
      })
      loadAccounts()
    } catch (err) {
      setError(err.message || 'Failed to update email account')
    }
  }

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'gmail':
        return '📧'
      case 'outlook':
        return '📬'
      case 'custom':
        return '⚙️'
      default:
        return '📮'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Accounts</h1>
          <p className="text-sm text-gray-300 mt-1">
            Link your email accounts to send messages from them
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + Link Email Account
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/50 border border-red-700/50 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-300">Loading email accounts...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-12 shadow-lg text-center">
          <div className="text-6xl mb-4">📧</div>
          <h2 className="text-xl font-semibold text-white mb-2">No Email Accounts Linked</h2>
          <p className="text-gray-300 mb-6">
            Link your email account to start sending messages from your own email address.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
          >
            Link Your First Email Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`rounded-lg border p-6 shadow-lg backdrop-blur-sm ${
                account.is_default 
                  ? 'border-blue-500/50 bg-blue-900/30' 
                  : 'border-gray-700/50 bg-gray-800/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{getProviderIcon(account.provider)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">
                        {account.display_name || account.email}
                      </h3>
                      {account.is_default && (
                        <span className="rounded-full bg-blue-900/50 border border-blue-700/50 px-2 py-1 text-xs font-medium text-blue-300">
                          Default
                        </span>
                      )}
                      {account.is_active && (
                        <span className="rounded-full bg-green-900/50 border border-green-700/50 px-2 py-1 text-xs font-medium text-green-300">
                          Active
                        </span>
                      )}
                      {!account.is_active && (
                        <span className="rounded-full bg-gray-800/50 border border-gray-700/50 px-2 py-1 text-xs font-medium text-gray-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{account.email}</p>
                    <p className="text-xs text-gray-400 mt-1 capitalize">
                      {account.provider} • Connected {new Date(account.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!account.is_default && (
                    <button
                      onClick={() => handleSetDefault(account.id)}
                      className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700/50"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleActive(account.id, account.is_active)}
                    className={`rounded-lg px-3 py-1.5 text-sm border ${
                      account.is_active
                        ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50 hover:bg-yellow-800/50'
                        : 'bg-green-900/50 text-green-300 border-green-700/50 hover:bg-green-800/50'
                    }`}
                  >
                    {account.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="rounded-lg bg-red-900/50 border border-red-700/50 px-3 py-1.5 text-sm text-red-300 hover:bg-red-800/50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Email Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gray-800/95 backdrop-blur-md rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-700/50">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Link Email Account</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setProvider('gmail')
                  }}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Provider Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Provider
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setProvider('gmail')}
                    className={`rounded-lg border-2 p-4 text-center transition ${
                      provider === 'gmail'
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-700/50 hover:border-gray-600 bg-gray-900/50'
                    }`}
                  >
                    <div className="text-3xl mb-2">📧</div>
                    <div className="font-medium text-white">Gmail</div>
                    <div className="text-xs text-gray-400">OAuth</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider('outlook')}
                    className={`rounded-lg border-2 p-4 text-center transition ${
                      provider === 'outlook'
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-700/50 hover:border-gray-600 bg-gray-900/50'
                    }`}
                  >
                    <div className="text-3xl mb-2">📬</div>
                    <div className="font-medium text-white">Outlook</div>
                    <div className="text-xs text-gray-400">OAuth</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider('custom')}
                    className={`rounded-lg border-2 p-4 text-center transition ${
                      provider === 'custom'
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-700/50 hover:border-gray-600 bg-gray-900/50'
                    }`}
                  >
                    <div className="text-3xl mb-2">⚙️</div>
                    <div className="font-medium text-white">Custom</div>
                    <div className="text-xs text-gray-400">SMTP</div>
                  </button>
                </div>
              </div>

              {/* OAuth Flow for Gmail/Outlook */}
              {provider !== 'custom' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-blue-900/50 border border-blue-700/50 p-4">
                    <h3 className="font-medium text-blue-300 mb-2">
                      Link Your {provider === 'gmail' ? 'Gmail' : 'Outlook'} Account
                    </h3>
                    <p className="text-sm text-blue-200 mb-4">
                      We'll use OAuth to securely connect your {provider === 'gmail' ? 'Gmail' : 'Outlook'} account.
                      You'll be redirected to authorize access.
                    </p>
                    <button
                      onClick={() => handleOAuthLink(provider)}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Continue with {provider === 'gmail' ? 'Google' : 'Microsoft'}
                    </button>
                  </div>
                </div>
              )}

              {/* Custom SMTP Form */}
              {provider === 'custom' && (
                <form onSubmit={handleCustomSMTP} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={customForm.email}
                      onChange={(e) => setCustomForm({ ...customForm, email: e.target.value })}
                      className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Display Name (optional)
                    </label>
                    <input
                      type="text"
                      value={customForm.display_name}
                      onChange={(e) => setCustomForm({ ...customForm, display_name: e.target.value })}
                      className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
                      placeholder="Your Name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        SMTP Server
                      </label>
                      <input
                        type="text"
                        required
                        value={customForm.smtp_server}
                        onChange={(e) => setCustomForm({ ...customForm, smtp_server: e.target.value })}
                        className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
                        placeholder="smtp.gmail.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        required
                        value={customForm.smtp_port}
                        onChange={(e) => setCustomForm({ ...customForm, smtp_port: e.target.value })}
                        className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
                        placeholder="587"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      SMTP Username
                    </label>
                    <input
                      type="text"
                      required
                      value={customForm.smtp_username}
                      onChange={(e) => setCustomForm({ ...customForm, smtp_username: e.target.value })}
                      className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      SMTP Password / App Password
                    </label>
                    <input
                      type="password"
                      required
                      value={customForm.smtp_password}
                      onChange={(e) => setCustomForm({ ...customForm, smtp_password: e.target.value })}
                      className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
                      placeholder="••••••••"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      For Gmail, use an App Password. For other providers, use your email password.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Link Account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false)
                        setProvider('gmail')
                      }}
                      className="flex-1 rounded-lg bg-gray-800/50 border border-gray-700/50 px-4 py-2 text-gray-200 hover:bg-gray-700/50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


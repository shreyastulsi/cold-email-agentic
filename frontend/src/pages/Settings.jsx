import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Auth from '../components/Auth'
import { Button } from '../components/ui/button'
import { apiRequest } from '../utils/api'

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('email') // 'email', 'linkedin', 'auth'

  // Read tab from URL query params on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && ['email', 'linkedin', 'auth'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  // Email Accounts state
  const [emailAccounts, setEmailAccounts] = useState([])
  const [emailLoading, setEmailLoading] = useState(true)
  const [emailError, setEmailError] = useState(null)
  const [showAddEmailModal, setShowAddEmailModal] = useState(false)
  const [emailProvider, setEmailProvider] = useState('gmail') // 'gmail', 'outlook', 'custom'
  
  // Custom SMTP form state
  const [customForm, setCustomForm] = useState({
    email: '',
    display_name: '',
    smtp_server: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
  })

  // LinkedIn Accounts state
  const [linkedInAccounts, setLinkedInAccounts] = useState([])
  const [linkedInLoading, setLinkedInLoading] = useState(true)
  const [linkedInError, setLinkedInError] = useState(null)

  // Load email accounts
  const loadEmailAccounts = async () => {
    setEmailLoading(true)
    setEmailError(null)
    try {
      const result = await apiRequest('/api/v1/email-accounts')
      setEmailAccounts(result.accounts || [])
    } catch (err) {
      setEmailError(err.message || 'Failed to load email accounts')
    } finally {
      setEmailLoading(false)
    }
  }

  // Cleanup duplicate email accounts
  const cleanupDuplicateEmails = async () => {
    try {
      const result = await apiRequest('/api/v1/email-accounts/cleanup-duplicates', {
        method: 'POST'
      })
      if (result.removed > 0) {
        console.log(`Cleaned up ${result.removed} duplicate email account(s)`)
        loadEmailAccounts()
      }
    } catch (err) {
      console.warn('Failed to cleanup duplicates:', err)
    }
  }

  // Load LinkedIn accounts
  const loadLinkedInAccounts = async () => {
    setLinkedInLoading(true)
    setLinkedInError(null)
    try {
      const result = await apiRequest('/api/v1/linkedin-accounts')
      setLinkedInAccounts(result.accounts || [])
    } catch (err) {
      setLinkedInError(err.message || 'Failed to load LinkedIn accounts')
    } finally {
      setLinkedInLoading(false)
    }
  }

  // Cleanup duplicate LinkedIn accounts
  const cleanupDuplicateLinkedIn = async () => {
    try {
      const result = await apiRequest('/api/v1/linkedin-accounts/cleanup-duplicates', {
        method: 'POST'
      })
      if (result.removed > 0) {
        console.log(`Cleaned up ${result.removed} duplicate LinkedIn account(s)`)
        loadLinkedInAccounts()
      }
    } catch (err) {
      console.warn('Failed to cleanup duplicates:', err)
    }
  }

  useEffect(() => {
    if (activeTab === 'email') {
      loadEmailAccounts()
      cleanupDuplicateEmails()
    } else if (activeTab === 'linkedin') {
      loadLinkedInAccounts()
      cleanupDuplicateLinkedIn()
    }
  }, [activeTab])

  // Refresh LinkedIn accounts when page becomes visible
  useEffect(() => {
    if (activeTab === 'linkedin') {
      const handleFocus = () => {
        loadLinkedInAccounts()
      }
      window.addEventListener('focus', handleFocus)
      return () => window.removeEventListener('focus', handleFocus)
    }
  }, [activeTab])

  // Handle OAuth flow for email
  const handleEmailOAuthLink = async (provider) => {
    try {
      setEmailError(null)
      const result = await apiRequest(`/api/v1/email-accounts/oauth/${provider}/auth-url`)
      
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
        setEmailError('Popup blocked. Please allow popups for this site and try again.')
        return
      }
      
      const messageHandler = (event) => {
        if (event.origin !== window.location.origin) {
          return
        }
        
        if (event.data.type === 'OAUTH_SUCCESS') {
          window.removeEventListener('message', messageHandler)
          try {
            popup.close()
          } catch (e) {
            // Ignore COOP errors when closing popup
          }
          loadEmailAccounts()
          setShowAddEmailModal(false)
        } else if (event.data.type === 'OAUTH_ERROR') {
          window.removeEventListener('message', messageHandler)
          try {
            popup.close()
          } catch (e) {
            // Ignore COOP errors when closing popup
          }
          setEmailError(event.data.error || 'OAuth authorization failed')
        }
      }
      
      window.addEventListener('message', messageHandler)
      
      const cleanupTimeout = setTimeout(() => {
        window.removeEventListener('message', messageHandler)
      }, 600000)
      
    } catch (err) {
      setEmailError(err.message || 'Failed to start OAuth flow')
    }
  }

  // Handle custom SMTP setup
  const handleCustomSMTP = async (e) => {
    e.preventDefault()
    setEmailError(null)
    
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
          is_default: emailAccounts.length === 0,
        })
      })
      
      setShowAddEmailModal(false)
      setCustomForm({
        email: '',
        display_name: '',
        smtp_server: '',
        smtp_port: 587,
        smtp_username: '',
        smtp_password: '',
      })
      loadEmailAccounts()
    } catch (err) {
      setEmailError(err.message || 'Failed to add email account')
    }
  }

  // Set default email account
  const handleSetDefaultEmail = async (accountId) => {
    try {
      await apiRequest(`/api/v1/email-accounts/${accountId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_default: true })
      })
      loadEmailAccounts()
    } catch (err) {
      setEmailError(err.message || 'Failed to set default account')
    }
  }

  // Delete email account
  const handleDeleteEmail = async (accountId) => {
    if (!confirm('Are you sure you want to delete this email account?')) {
      return
    }
    
    try {
      await apiRequest(`/api/v1/email-accounts/${accountId}`, {
        method: 'DELETE'
      })
      loadEmailAccounts()
    } catch (err) {
      setEmailError(err.message || 'Failed to delete email account')
    }
  }

  // Toggle email account active status
  const handleToggleEmailActive = async (accountId, isActive) => {
    try {
      // If trying to enable, check if another account is already enabled
      if (!isActive) {
        const activeAccount = emailAccounts.find(acc => acc.id !== accountId && acc.is_active)
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
      loadEmailAccounts()
    } catch (err) {
      setEmailError(err.message || 'Failed to update email account')
    }
  }

  // Handle Unipile hosted auth flow for LinkedIn
  const handleLinkedInAuthLink = async () => {
    try {
      setLinkedInError(null)
      const result = await apiRequest('/api/v1/linkedin-accounts/unipile/auth-link')
      window.location.href = result.auth_url
    } catch (err) {
      setLinkedInError(err.message || 'Failed to start LinkedIn connection flow')
    }
  }

  // Delete LinkedIn account
  const handleDeleteLinkedIn = async (accountId) => {
    if (!confirm('Are you sure you want to delete this LinkedIn account?')) {
      return
    }
    
    try {
      await apiRequest(`/api/v1/linkedin-accounts/${accountId}`, {
        method: 'DELETE'
      })
      loadLinkedInAccounts()
    } catch (err) {
      setLinkedInError(err.message || 'Failed to delete LinkedIn account')
    }
  }

  // Toggle LinkedIn account active status
  const handleToggleLinkedInActive = async (accountId, isActive) => {
    try {
      // If trying to enable, check if another account is already enabled
      if (!isActive) {
        const activeAccount = linkedInAccounts.find(acc => acc.id !== accountId && acc.is_active)
        if (activeAccount) {
          const confirmMessage = `Another LinkedIn account (${activeAccount.display_name || 'LinkedIn Account'}) is already enabled. Enabling this account will disable the other one. Continue?`
          if (!confirm(confirmMessage)) {
            return
          }
        }
      }
      
      await apiRequest(`/api/v1/linkedin-accounts/${accountId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !isActive })
      })
      loadLinkedInAccounts()
    } catch (err) {
      setLinkedInError(err.message || 'Failed to update LinkedIn account')
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
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-white">Settings</h1>

      {/* Tabs */}
      <div className="border-b border-gray-700/50">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('auth')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'auth'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
            }`}
          >
            Account Information
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'email'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
            }`}
          >
            Email Accounts
          </button>
              <button
                onClick={() => setActiveTab('linkedin')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'linkedin'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                LinkedIn Accounts
          </button>
        </nav>
      </div>

          {/* Email Accounts Tab Content */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          <div>
              <h2 className="text-lg font-semibold text-white mb-2">Email Account Management</h2>
              <p className="text-sm text-gray-300 mb-4">
                Manage your linked email accounts to send messages from your own email addresses.
              </p>
            </div>

              {emailError && (
                <div className="rounded-lg bg-red-900/50 border border-red-700/50 p-3 text-sm text-red-300">
                  {emailError}
                </div>
              )}

              <div className="rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Connected Accounts</h3>
                  <button
                    onClick={() => setShowAddEmailModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
                  >
                    + Link Email Account
                  </button>
                </div>

                {emailLoading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">Loading accounts...</p>
                  </div>
                ) : emailAccounts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">No email accounts linked</p>
                    <p className="text-sm text-gray-500">
                      Link your email account to start sending messages from your own email address.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {emailAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="border border-gray-700 rounded-lg p-4 bg-gray-800/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="text-3xl">{getProviderIcon(account.provider)}</div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">
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
                          </div>
                          <div className="flex items-center gap-2">
                            {!account.is_default && (
                              <button
                                onClick={() => handleSetDefaultEmail(account.id)}
                                className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700/50"
                              >
                                Set Default
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleEmailActive(account.id, account.is_active)}
                              className={`rounded-lg px-3 py-1.5 text-sm border ${
                                account.is_active
                                  ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50 hover:bg-yellow-800/50'
                                  : 'bg-green-900/50 text-green-300 border-green-700/50 hover:bg-green-800/50'
                              }`}
                            >
                              {account.is_active ? 'Disable' : 'Enable'}
                            </button>
                            <Button
                              onClick={() => handleDeleteEmail(account.id)}
                              variant="destructive"
                              size="sm"
                              className="shadow-none"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Email Account Modal */}
              {showAddEmailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="bg-gray-800/95 backdrop-blur-md rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-700/50">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Link Email Account</h2>
                        <button
                          onClick={() => {
                            setShowAddEmailModal(false)
                            setEmailProvider('gmail')
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
                            onClick={() => setEmailProvider('gmail')}
                            className={`rounded-lg border-2 p-4 text-center transition ${
                              emailProvider === 'gmail'
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
                            onClick={() => setEmailProvider('outlook')}
                            className={`rounded-lg border-2 p-4 text-center transition ${
                              emailProvider === 'outlook'
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
                            onClick={() => setEmailProvider('custom')}
                            className={`rounded-lg border-2 p-4 text-center transition ${
                              emailProvider === 'custom'
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
                      {emailProvider !== 'custom' && (
                        <div className="space-y-4">
                          <div className="rounded-lg bg-blue-900/50 border border-blue-700/50 p-4">
                            <h3 className="font-medium text-blue-300 mb-2">
                              Link Your {emailProvider === 'gmail' ? 'Gmail' : 'Outlook'} Account
                            </h3>
                            <p className="text-sm text-blue-200 mb-4">
                              We'll use OAuth to securely connect your {emailProvider === 'gmail' ? 'Gmail' : 'Outlook'} account.
                              You'll be redirected to authorize access.
                            </p>
                            <button
                              onClick={() => handleEmailOAuthLink(emailProvider)}
                              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                            >
                              Continue with {emailProvider === 'gmail' ? 'Google' : 'Microsoft'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Custom SMTP Form */}
                      {emailProvider === 'custom' && (
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
                                setShowAddEmailModal(false)
                                setEmailProvider('gmail')
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
          )}

          {/* LinkedIn Accounts Tab Content */}
          {activeTab === 'linkedin' && (
            <div className="space-y-6">
              <div>
              <h2 className="text-lg font-semibold text-white mb-2">LinkedIn Account Management</h2>
              <p className="text-sm text-gray-300 mb-4">
                Connect your LinkedIn account to send messages and connection requests from your own LinkedIn profile.
                Unipile is still used for search and discovery.
              </p>
            </div>

              {linkedInError && (
                <div className="rounded-lg bg-red-900/50 border border-red-700/50 p-3 text-sm text-red-300">
                  {linkedInError}
                </div>
              )}

              <div className="rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Connected Accounts</h3>
                  <button
                    onClick={handleLinkedInAuthLink}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
                  >
                    + Connect LinkedIn Account
                  </button>
                </div>

                {linkedInLoading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">Loading accounts...</p>
                  </div>
                ) : linkedInAccounts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">No LinkedIn accounts connected</p>
                    <p className="text-sm text-gray-500">
                      Connect your LinkedIn account to send messages and connection requests from your own account.
                      This provides better rate limits and compliance.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {linkedInAccounts.map((account) => (
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
                              onClick={() => handleToggleLinkedInActive(account.id, account.is_active)}
                              className={`rounded-lg px-3 py-1.5 text-sm border ${
                                account.is_active
                                  ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50 hover:bg-yellow-800/50'
                                  : 'bg-green-900/50 text-green-300 border-green-700/50 hover:bg-green-800/50'
                              }`}
                            >
                              {account.is_active ? 'Disable' : 'Enable'}
                            </button>
                            <Button
                              onClick={() => handleDeleteLinkedIn(account.id)}
                              variant="destructive"
                              size="sm"
                              className="shadow-none"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-blue-900/20 border border-blue-700/50 p-4">
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
      )}

          {/* Authentication Tab Content */}
      {activeTab === 'auth' && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">Authentication</h2>
          <Auth />
        </div>
      )}
        </div>
      </div>
    </div>
  )
}


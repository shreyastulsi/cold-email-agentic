import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../utils/api'

export default function UnipileAuthSuccess() {
  console.log('🔵 UnipileAuthSuccess component mounted')
  
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking') // 'checking', 'success', 'waiting', 'error'
  const [debugLogs, setDebugLogs] = useState([])
  const [errorDetails, setErrorDetails] = useState(null)
  const pollCountRef = useRef(0)
  const isMountedRef = useRef(true)

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const log = `[${timestamp}] ${message}`
    console.log(`${type === 'error' ? '❌' : type === 'success' ? '✅' : '📝'} ${log}`)
    setDebugLogs(prev => [...prev, { message: log, type }])
  }

  useEffect(() => {
    addLog('Component initialized')
    return () => {
      isMountedRef.current = false
      addLog('Component unmounting')
    }
  }, [])

  useEffect(() => {
    // CRITICAL: Set to true at the start to handle React Strict Mode
    isMountedRef.current = true
    
    const syncAndCheckAccount = async () => {
      if (!isMountedRef.current) {
        addLog('Component unmounted, stopping', 'error')
        return
      }

      try {
        // First, sync accounts from Unipile API (only once)
        if (pollCountRef.current === 0) {
          addLog('Starting LinkedIn account sync from Unipile...')
          try {
            const syncResult = await apiRequest('/api/v1/linkedin-accounts/unipile/sync', {
              method: 'POST'
            })
            addLog(`Sync completed: ${JSON.stringify(syncResult)}`, 'success')
          } catch (syncErr) {
            addLog(`Sync failed: ${syncErr.message}`, 'error')
            setErrorDetails({ step: 'sync', error: syncErr.message })
            console.error('Sync error details:', syncErr)
          }
        }
        
        // Then check if account exists
        addLog(`Checking for LinkedIn accounts (attempt ${pollCountRef.current + 1}/3)...`)
        const result = await apiRequest('/api/v1/linkedin-accounts')
        addLog(`API response: ${JSON.stringify(result)}`)
        const accounts = result.accounts || []
        
        if (accounts.length > 0) {
          // Account found! Redirect to settings page with LinkedIn tab active
          addLog(`✅ Found ${accounts.length} LinkedIn account(s)!`, 'success')
          addLog(`Account details: ${accounts.map(a => a.linkedin_name || a.id).join(', ')}`, 'success')
          setStatus('success')
          setTimeout(() => {
            if (isMountedRef.current) {
              addLog('Redirecting to settings...', 'success')
              navigate('/dashboard/settings?tab=linkedin', { replace: true })
            }
          }, 1500)
          return
        }
        
        // Account not found yet, poll a few more times
        addLog(`No accounts found yet. Will retry...`)
        pollCountRef.current += 1
        if (pollCountRef.current < 3) {
          const delay = 2000 * pollCountRef.current
          addLog(`Retrying in ${delay / 1000} seconds...`)
          // Poll 2 more times (total 3 attempts) with increasing delays
          setTimeout(() => {
            if (isMountedRef.current) {
              syncAndCheckAccount()
            }
          }, delay) // 2s, 4s delays
        } else {
          // After 3 attempts, show waiting message and redirect
          addLog('Max attempts reached. Account may still be syncing...', 'error')
          setStatus('waiting')
          setTimeout(() => {
            if (isMountedRef.current) {
              addLog('Redirecting to settings anyway...')
              navigate('/dashboard/settings?tab=linkedin', { replace: true })
            }
          }, 3000)
        }
      } catch (err) {
        addLog(`Error: ${err.message}`, 'error')
        setErrorDetails({ step: 'check', error: err.message, details: err })
        console.error('Full error:', err)
        setStatus('error')
        // On error, redirect after delay with LinkedIn tab active
        setTimeout(() => {
          if (isMountedRef.current) {
            addLog('Redirecting due to error...')
            navigate('/dashboard/settings?tab=linkedin', { replace: true })
          }
        }, 5000)
      }
    }

    // Start syncing and checking after a short delay
    addLog('Starting sync process in 1 second...')
    const initialTimer = setTimeout(syncAndCheckAccount, 1000)
    return () => {
      clearTimeout(initialTimer)
      isMountedRef.current = false
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
      <div className="text-center max-w-2xl w-full">
        {status === 'checking' && (
          <>
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Connecting...</h1>
            <p className="text-gray-400 mb-4">
              Verifying your LinkedIn account connection...
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Attempt {pollCountRef.current + 1} of 3
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-4">
              <svg
                className="w-16 h-16 mx-auto text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-red-500">Connection Error</h1>
            <p className="text-gray-400 mb-4">
              There was an issue connecting your LinkedIn account.
            </p>
            {errorDetails && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 mb-4 text-left">
                <p className="text-sm text-red-200 mb-2">
                  <strong>Step:</strong> {errorDetails.step}
                </p>
                <p className="text-xs text-red-300 font-mono break-all">
                  {errorDetails.error}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500">
              Redirecting to settings in 5 seconds...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-4">
              <svg
                className="w-16 h-16 mx-auto text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Successfully Connected!</h1>
            <p className="text-gray-400 mb-4">
              Your LinkedIn account has been connected successfully.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to settings page...
            </p>
          </>
        )}

        {status === 'waiting' && (
          <>
            <div className="mb-4">
              <svg
                className="w-16 h-16 mx-auto text-yellow-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Processing...</h1>
            <p className="text-gray-400 mb-4">
              Your LinkedIn account connection is being processed. This may take a few moments.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-200 mb-2">
                <strong>Note:</strong> Still processing your account connection.
              </p>
              <p className="text-xs text-yellow-300">
                The system is checking Unipile for your newly connected account. If it doesn't appear, try refreshing the page or check your backend logs.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/settings?tab=linkedin')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
            >
              Go to Settings
            </button>
          </>
        )}

        {/* Debug Console */}
        {debugLogs.length > 0 && (
          <div className="mt-8 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">Debug Console</h3>
              <button
                onClick={() => setDebugLogs([])}
                className="text-xs text-gray-400 hover:text-gray-200"
              >
                Clear
              </button>
            </div>
            <div className="space-y-1 text-left">
              {debugLogs.map((log, index) => (
                <div
                  key={index}
                  className={`text-xs font-mono ${
                    log.type === 'error'
                      ? 'text-red-400'
                      : log.type === 'success'
                      ? 'text-green-400'
                      : 'text-gray-400'
                  }`}
                >
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


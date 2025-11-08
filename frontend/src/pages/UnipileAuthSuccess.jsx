import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../utils/api'

export default function UnipileAuthSuccess() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking') // 'checking', 'success', 'waiting'
  const [pollCount, setPollCount] = useState(0)

  useEffect(() => {
    const syncAndCheckAccount = async () => {
      try {
        // First, sync accounts from Unipile API
        try {
          await apiRequest('/api/v1/linkedin-accounts/unipile/sync', {
            method: 'POST'
          })
        } catch (syncErr) {
          console.warn('Sync failed, continuing to check:', syncErr)
        }
        
        // Then check if account exists
        const result = await apiRequest('/api/v1/linkedin-accounts')
        const accounts = result.accounts || []
        
        if (accounts.length > 0) {
          // Account found! Redirect to settings page with LinkedIn tab active
          setStatus('success')
          setTimeout(() => {
            navigate('/dashboard/settings?tab=linkedin')
          }, 1500)
        } else {
          // Account not found yet, keep polling
          setPollCount(prev => prev + 1)
          if (pollCount < 10) {
            // Poll every 2 seconds for up to 20 seconds
            setTimeout(syncAndCheckAccount, 2000)
          } else {
            // After 10 attempts, show waiting message
            setStatus('waiting')
          }
        }
      } catch (err) {
        console.error('Error syncing/checking account:', err)
        // On error, still redirect after delay with LinkedIn tab active
        setTimeout(() => {
          navigate('/dashboard/settings?tab=linkedin')
        }, 3000)
      }
    }

    // Start syncing and checking after a short delay
    const initialTimer = setTimeout(syncAndCheckAccount, 1000)
    return () => clearTimeout(initialTimer)
  }, [navigate, pollCount])

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center max-w-md">
        {status === 'checking' && (
          <>
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Connecting...</h1>
            <p className="text-gray-400 mb-4">
              Verifying your LinkedIn account connection...
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
      </div>
    </div>
  )
}


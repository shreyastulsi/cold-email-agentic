import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../utils/api'

export default function OAuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const provider = searchParams.get('provider')
  const error = searchParams.get('error')

  useEffect(() => {
    const completeOAuth = async () => {
      if (error) {
        // OAuth error - close popup and notify parent
        window.opener?.postMessage({
          type: 'OAUTH_ERROR',
          error: error,
          provider: provider
        }, window.location.origin)
        window.close()
        return
      }

      if (!code || !provider) {
        // Missing required params
        window.opener?.postMessage({
          type: 'OAUTH_ERROR',
          error: 'Missing authorization code or provider',
          provider: provider
        }, window.location.origin)
        window.close()
        return
      }

      try {
        // Exchange code for tokens and create account
        const result = await apiRequest('/api/v1/email-accounts/oauth/complete', {
          method: 'POST',
          body: JSON.stringify({
            provider: provider,
            code: code,
            state: state
          })
        })

        // Success - notify parent window
        window.opener?.postMessage({
          type: 'OAUTH_SUCCESS',
          result: result
        }, window.location.origin)
        
        // Close popup
        setTimeout(() => {
          window.close()
        }, 1000)
      } catch (err) {
        // Error - notify parent window
        window.opener?.postMessage({
          type: 'OAUTH_ERROR',
          error: err.message || 'OAuth setup failed',
          provider: provider
        }, window.location.origin)
        window.close()
      }
    }

    completeOAuth()
  }, [code, state, provider, error, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-600 text-4xl mb-4">✕</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authorization Failed</h2>
            <p className="text-gray-600">{error}</p>
            <p className="text-sm text-gray-500 mt-4">This window will close automatically...</p>
          </>
        ) : (
          <>
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Completing Setup...</h2>
            <p className="text-gray-600">Please wait while we link your email account.</p>
          </>
        )}
      </div>
    </div>
  )
}


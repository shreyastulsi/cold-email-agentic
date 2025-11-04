import { useEffect, useState } from 'react'
import { getCurrentUser, signIn, signOut, signUp } from '../utils/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Check if user is logged in
  const checkUser = async () => {
    const currentUser = await getCurrentUser()
    setUser(currentUser)
  }

  // Check on mount
  useEffect(() => {
    checkUser()
  }, [])

  const handleAuth = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        await signUp(email, password)
        setError('Check your email to verify your account!')
      } else {
        await signIn(email, password)
        await checkUser()
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    setUser(null)
  }

  if (user) {
    return (
      <div className="rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Signed in</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-6 shadow-lg">
      <h2 className="mb-4 text-lg font-semibold text-white">
        {isSignUp ? 'Sign Up' : 'Sign In'}
      </h2>
      
      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 border border-red-700/50 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="your@email.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-700/50 bg-gray-900/50 text-white placeholder-gray-400 px-4 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </form>

      <button
        onClick={() => setIsSignUp(!isSignUp)}
        className="mt-4 w-full text-sm text-gray-400 hover:text-gray-200"
      >
        {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
      </button>
    </div>
  )
}


import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/logo'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { getCurrentUser, signIn, signUp } from '../utils/supabase'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isSignUp, setIsSignUp] = useState(location.pathname === '/signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const user = await getCurrentUser()
      if (user) {
        navigate('/dashboard')
      }
    }
    checkUser()
  }, [navigate])

  // Update isSignUp based on current route
  useEffect(() => {
    setIsSignUp(location.pathname === '/signup')
    // Clear form when switching between login/signup
    setError(null)
    setMessage(null)
    setPassword('')
    setConfirmPassword('')
  }, [location.pathname])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    // Validate passwords match for signup
    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    // Validate password length
    if (isSignUp && password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      if (isSignUp) {
        await signUp(email, password)
        setMessage('Account created! Please check your email to verify your account before signing in.')
        // Clear form
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        // Switch to sign in after successful signup
        setTimeout(() => {
          setIsSignUp(false)
          setMessage(null)
        }, 3000)
      } else {
        await signIn(email, password)
        // Successful login - navigate to loading then dashboard
        navigate('/loading')
        setTimeout(() => {
          navigate('/dashboard')
        }, 1000)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray to-gray flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Logo/Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <Link to="/">
              <Logo />
            </Link>
          </div>
        </div>

        {/* Auth Card */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {isSignUp ? 'Create Account' : 'Welcome Back!'}
            </CardTitle>
            <CardDescription>
              {isSignUp ? 'Sign up to get started' : 'Sign in to your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
                {error}
              </div>
            )}

            {message && (
              <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3 text-sm text-green-800 dark:text-green-200">
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={isSignUp ? 6 : undefined}
                  />
                  {isSignUp && (
                    <p className="text-xs text-muted-foreground mt-1">At least 6 characters</p>
                  )}
                </div>
                {isSignUp && (
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isSignUp ? 'Creating Account...' : 'Signing In...'}
                    </span>
                  ) : (
                    isSignUp ? 'Create Account' : 'Sign In'
                  )}
                </Button>
              </div>
              <div className="mt-6 text-center text-sm">
                {isSignUp ? (
                  <>
                    Already have an account?{' '}
                    <Link to="/login" className="underline underline-offset-4 hover:text-primary">
                      Sign in
                    </Link>
                  </>
                ) : (
                  <>
                    Don&apos;t have an account?{' '}
                    <Link to="/signup" className="underline underline-offset-4 hover:text-primary">
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
        <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
          By clicking continue, you agree to our <a href="#">Terms of Service</a>{' '}
          and <a href="#">Privacy Policy</a>.
        </div>
      </div>
    </div>
  )
}


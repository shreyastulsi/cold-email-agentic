import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import Loading from '../pages/Loading'
import { getCurrentUser } from '../utils/supabase'

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      setLoading(false)
    }
    checkAuth()
  }, [])

  if (loading) {
    return <Loading />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}


// Supabase client setup
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials not configured. Authentication will not work.')
}

// Create Supabase client
export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null

/**
 * Get current session token
 */
export async function getSessionToken() {
  if (!supabase) {
    return null
  }
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) throw error
  return data
}

/**
 * Sign up with email and password
 */
export async function signUp(email, password) {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })
  
  if (error) throw error
  return data
}

/**
 * Sign out
 */
export async function signOut() {
  if (!supabase) {
    return
  }
  
  await supabase.auth.signOut()
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  if (!supabase) {
    return null
  }
  
  const { data: { user } } = await supabase.auth.getUser()
  return user
}


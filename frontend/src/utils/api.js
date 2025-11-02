// API utility functions
import { getSessionToken } from './supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Get Supabase token from current session
 */
async function getAuthToken() {
  try {
    return await getSessionToken()
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

/**
 * Make API request with authentication
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = await getAuthToken(); // Now async
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store' // Prevent 304 caching
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      
      // If 401, provide helpful message
      if (response.status === 401) {
        throw new Error('Authentication required. Please sign in with Supabase.');
      }
      
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Health check
 */
export async function checkHealth() {
  return apiRequest('/healthz');
}

/**
 * Get current user (requires auth)
 */
export async function getCurrentUser() {
  return apiRequest('/api/v1/auth/me');
}


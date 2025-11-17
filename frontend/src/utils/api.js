// API utility functions
import { getSessionToken } from './supabase';

/**
 * Get API base URL with smart detection for production
 */
function getApiBaseUrl() {
  // First, check if explicitly set via environment variable
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }
  
  // In production (Cloud Run), try to infer backend URL from frontend URL
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // If we're on a Cloud Run domain (e.g., frontend-xxxxx-uc.a.run.app)
    if (hostname.includes('.a.run.app') || hostname.includes('cloudrun.app')) {
      // Try to infer backend URL by replacing "frontend" with "backend"
      // This works if services are named "frontend" and "backend"
      const inferredBackend = hostname.replace(/^frontend(-|\.)/, 'backend$1');
      if (inferredBackend !== hostname) {
        const inferredUrl = `${protocol}//${inferredBackend}`;
        console.log(`[API] Inferred backend URL: ${inferredUrl}`);
        return inferredUrl;
      }
      
      // If that didn't work, try common patterns
      // Pattern: frontend-xxxxx -> backend-xxxxx
      const match = hostname.match(/^(frontend)(.*)$/);
      if (match) {
        const inferredUrl = `${protocol}//backend${match[2]}`;
        console.log(`[API] Inferred backend URL (pattern match): ${inferredUrl}`);
        return inferredUrl;
      }
    }
    
    // If we're on localhost in development, use default
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }
  
  // Default fallback
  console.warn('[API] No VITE_API_BASE_URL set and could not infer backend URL. Using localhost:8000. This may not work in production.');
  return 'http://localhost:8000';
}

const API_BASE_URL = getApiBaseUrl();

// Log the API URL being used (helpful for debugging)
console.log(`[API] Using API base URL: ${API_BASE_URL}`);

// Export API_BASE_URL for use in other files that need direct fetch calls
export { API_BASE_URL };

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
    // Enhanced error logging for debugging
    console.error('API request failed:', {
      url,
      endpoint,
      error: error.message,
      apiBaseUrl: API_BASE_URL,
      isNetworkError: error.name === 'TypeError' && error.message.includes('fetch')
    });
    
    // Provide more helpful error messages
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(
        `Network error: Cannot connect to backend at ${API_BASE_URL}. ` +
        `Please check that the backend is running and VITE_API_BASE_URL is set correctly.`
      );
    }
    
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


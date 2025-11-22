// API utility functions
import { getSessionToken } from './supabase';

/**
 * Get API base URL with smart detection for production
 */
function getApiBaseUrl() {
  // First, check if explicitly set via environment variable
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    console.log(`[API] Using VITE_API_BASE_URL from environment: ${envUrl}`);
    return envUrl;
  }
  
  // In production (Cloud Run), try to infer backend URL from frontend URL
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // If we're on a Cloud Run domain (e.g., frontend-xxxxx-uc.a.run.app or backend-xxxxx.europe-west2.run.app)
    if (hostname.includes('.a.run.app') || hostname.includes('cloudrun.app') || hostname.includes('.run.app')) {
      // Pattern 1: frontend-xxxxx -> backend-xxxxx (handles both - and . separators)
      let inferredBackend = hostname.replace(/^frontend([-\.])/, 'backend$1');
      if (inferredBackend !== hostname) {
        const inferredUrl = `${protocol}//${inferredBackend}`;
        console.log(`[API] Inferred backend URL (pattern 1): ${inferredUrl}`);
        return inferredUrl;
      }
      
      // Pattern 2: frontend-xxxxx-uc -> backend-xxxxx-uc (handles region suffixes)
      inferredBackend = hostname.replace(/^frontend(-[^-]+)(-.*)?\./, 'backend$1$2.');
      if (inferredBackend !== hostname && inferredBackend.includes('backend')) {
        const inferredUrl = `${protocol}//${inferredBackend}`;
        console.log(`[API] Inferred backend URL (pattern 2): ${inferredUrl}`);
        return inferredUrl;
      }
      
      // Pattern 3: Any service-xxxxx -> backend-xxxxx (more generic)
      const match = hostname.match(/^([^-]+)-([^-]+)(.*)$/);
      if (match && match[1] !== 'backend') {
        const inferredUrl = `${protocol}//backend-${match[2]}${match[3]}`;
        console.log(`[API] Inferred backend URL (pattern 3): ${inferredUrl}`);
        return inferredUrl;
      }
      
      // Pattern 4: Try replacing the first part before the first number
      const numberMatch = hostname.match(/^([a-zA-Z]+)(-\d+.*)$/);
      if (numberMatch && numberMatch[1] !== 'backend') {
        const inferredUrl = `${protocol}//backend${numberMatch[2]}`;
        console.log(`[API] Inferred backend URL (pattern 4): ${inferredUrl}`);
        return inferredUrl;
      }
      
      console.warn(`[API] Could not infer backend URL from hostname: ${hostname}. Please set VITE_API_BASE_URL.`);
    }
    
    // If we're on localhost in development, use default
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }
  
  // Default fallback
  console.error('[API] No VITE_API_BASE_URL set and could not infer backend URL. Using localhost:8000. This will NOT work in production!');
  console.error('[API] To fix: Set VITE_API_BASE_URL build argument when building the Docker image.');
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


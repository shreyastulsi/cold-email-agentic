// Utility functions for tracking dashboard statistics via API
import { apiRequest } from './api'

// Track LinkedIn invite sent
// Note: Stats are incremented by the backend, this just triggers a dashboard refresh
export async function trackLinkedInInvite(role, company, recruiterName) {
  try {
    // Trigger event to refresh dashboard
    // The backend /outreach/linkedin/send already increments stats, so we just notify the UI
    window.dispatchEvent(new Event('statsUpdated'))
    return true
  } catch (error) {
    console.error('Error tracking LinkedIn invite:', error)
    return false
  }
}

// Track email sent
// Note: Stats are incremented by the backend, this just triggers a dashboard refresh
export async function trackEmailSent(role, company, recruiterName) {
  try {
    // Trigger event to refresh dashboard
    // The backend /outreach/email/send already increments stats, so we just notify the UI
    window.dispatchEvent(new Event('statsUpdated'))
    return true
  } catch (error) {
    console.error('Error tracking email sent:', error)
    return false
  }
}

// Track role reached (API-based)
export async function trackRoleReached(role, company) {
  try {
    await apiRequest('/api/v1/user-stats/increment/role', {
      method: 'POST'
    })
    // Trigger event to refresh dashboard
    window.dispatchEvent(new Event('statsUpdated'))
    return true
  } catch (error) {
    console.error('Error tracking role reached:', error)
    return false
  }
}

// Deprecated - kept for backwards compatibility
export function getStats() {
  console.warn('getStats() is deprecated. Use API endpoint /api/v1/user-stats instead')
  return {
    linkedinInvitesSent: 0,
    emailsSent: 0,
    rolesReached: [],
    latestAttempts: []
  }
}

// Deprecated - kept for backwards compatibility
export function resetStats() {
  console.warn('resetStats() is deprecated. Use API endpoint /api/v1/user-stats/reset instead')
}


// Utility functions for tracking dashboard statistics

const STORAGE_KEY = 'outreach_stats'

// Initialize stats if they don't exist
function initializeStats() {
  const stats = {
    linkedinInvitesSent: 0,
    emailsSent: 0,
    rolesReached: [], // Array of {role, company, date}
    latestAttempts: [] // Array of recent outreach attempts
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  return stats
}

// Get current stats
export function getStats() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return initializeStats()
    }
    return JSON.parse(stored)
  } catch (error) {
    console.error('Error reading stats:', error)
    return initializeStats()
  }
}

// Reset all stats to 0
export function resetStats() {
  initializeStats()
  // Trigger storage event so Dashboard can update
  window.dispatchEvent(new Event('storage'))
}

// Track LinkedIn invite sent
export function trackLinkedInInvite(role, company, recruiterName) {
  const stats = getStats()
  stats.linkedinInvitesSent += 1
  
  // Add to roles if not already there
  const roleKey = `${role}@${company}`
  if (!stats.rolesReached.some(r => `${r.role}@${r.company}` === roleKey)) {
    stats.rolesReached.push({
      role,
      company,
      date: new Date().toISOString()
    })
  }
  
  // Add to latest attempts
  stats.latestAttempts.unshift({
    id: Date.now(),
    time: new Date().toISOString(),
    target: `${role} at ${company}`,
    recruiter: recruiterName,
    channel: 'LinkedIn',
    status: 'sent',
    type: 'invite'
  })
  
  // Keep only last 20 attempts
  if (stats.latestAttempts.length > 20) {
    stats.latestAttempts = stats.latestAttempts.slice(0, 20)
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  window.dispatchEvent(new Event('storage'))
  window.dispatchEvent(new Event('statsUpdated'))
}

// Track email sent
export function trackEmailSent(role, company, recruiterName) {
  const stats = getStats()
  stats.emailsSent += 1
  
  // Add to roles if not already there
  const roleKey = `${role}@${company}`
  if (!stats.rolesReached.some(r => `${r.role}@${r.company}` === roleKey)) {
    stats.rolesReached.push({
      role,
      company,
      date: new Date().toISOString()
    })
  }
  
  // Add to latest attempts
  stats.latestAttempts.unshift({
    id: Date.now(),
    time: new Date().toISOString(),
    target: `${role} at ${company}`,
    recruiter: recruiterName,
    channel: 'Email',
    status: 'sent',
    type: 'email'
  })
  
  // Keep only last 20 attempts
  if (stats.latestAttempts.length > 20) {
    stats.latestAttempts = stats.latestAttempts.slice(0, 20)
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  window.dispatchEvent(new Event('storage'))
  window.dispatchEvent(new Event('statsUpdated'))
}


import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../utils/api'

export function useOnboardingStatus(options = {}) {
  return useQuery({
    queryKey: ['onboardingStatus'],
    queryFn: async () => {
      const result = await apiRequest('/api/v1/onboarding/status')
      return {
        hasResume: Boolean(result?.has_resume),
        hasEmail: Boolean(result?.has_email_account),
        hasLinkedIn: Boolean(result?.has_linkedin_account),
        isReadyForSearch: Boolean(result?.is_ready_for_search),
      }
    },
    staleTime: 60 * 1000,
    ...options,
  })
}


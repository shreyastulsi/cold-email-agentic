import {
    FileEdit,
    FileText,
    LayoutDashboard,
    Search as SearchIcon,
    Settings as SettingsIcon
} from "lucide-react"
import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { Logo } from "@/components/logo"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar"
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus"
import { getCurrentUser } from "@/utils/supabase"

// Navigation data for the application
const navMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Search Jobs",
    url: "/dashboard/search",
    icon: SearchIcon,
  },
  {
    title: "Drafts",
    url: "/dashboard/drafts",
    icon: FileEdit,
  },
  {
    title: "Resume",
    url: "/dashboard/resume",
    icon: FileText,
  },
      {
        title: "Settings",
        url: "/dashboard/settings",
        icon: SettingsIcon,
      },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState<any>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { state } = useSidebar()
  const { data: onboardingStatus, isLoading: onboardingLoading } = useOnboardingStatus()

  // Only compute these when data is actually loaded (not undefined)
  const hasResume = onboardingStatus?.hasResume ?? false
  const hasEmail = onboardingStatus?.hasEmail ?? false
  const hasLinkedIn = onboardingStatus?.hasLinkedIn ?? false
  const isReadyForSearch = onboardingStatus?.isReadyForSearch ?? false
  
  // Only show indicators when data has fully loaded AND onboardingStatus exists
  const showIndicators = !onboardingLoading && onboardingStatus !== undefined

  React.useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser()
      if (currentUser) {
        setUser({
          name: currentUser.email?.split('@')[0] || 'User',
          email: currentUser.email || '',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`,
        })
      }
    }
    loadUser()
  }, [])

  // Update active state based on current route
  const navMainWithActive = navMain.map(item => {
    // For Dashboard, only match exact path (not sub-routes)
    if (item.url === '/dashboard') {
      return {
        ...item,
        isActive: location.pathname === '/dashboard' || location.pathname === '/dashboard/',
      }
    }
    // For other items, match exact path or sub-paths
    return {
      ...item,
      isActive:
        location.pathname === item.url ||
        location.pathname.startsWith(item.url + '/') ||
        (item.items && item.items.some(subItem => location.pathname === subItem.url)),
    }
  })

  const navWithStatus = navMainWithActive.map((item) => {
    const enriched = { ...item }

    // Only show indicators when data has fully loaded
    if (showIndicators) {
      if (item.url === '/dashboard/resume') {
        if (!hasResume) {
          enriched.indicator = 'warning'
          enriched.indicatorTooltip = 'Resume required'
        }
      }

      if (item.url === '/dashboard/settings') {
        if (!hasEmail && !hasLinkedIn) {
          enriched.indicator = 'warning'
          enriched.indicatorTooltip = 'Connect email or LinkedIn'
        }
      }

      if (item.url === '/dashboard/search') {
        const disabled = !isReadyForSearch
        enriched.disabled = disabled
        if (disabled) {
          enriched.disabledReason = 'Upload a resume and connect email or LinkedIn to use search'
          enriched.indicator = 'warning'
          enriched.indicatorTooltip = enriched.disabledReason
        }
      }
    } else {
      // While loading, disable search but don't show indicators yet
      if (item.url === '/dashboard/search') {
        enriched.disabled = true
        enriched.disabledReason = 'Checking onboarding status...'
      }
    }

    return enriched
  })

  return (
    <Sidebar 
      collapsible="icon" 
      {...props}
      className="bg-transparent border-r border-white/10 backdrop-blur-xl"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              onClick={() => navigate('/dashboard')}
            >
              <div className="flex items-center justify-center rounded-lg text-sidebar-primary-foreground">
                <Logo iconOnly={state === 'collapsed'} />
              </div>
              {/* <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Keryx</span>
                <span className="truncate text-xs">Cold Email Platform</span>
              </div> */}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-2 pb-2">
        <div className="flex-1 overflow-y-auto pr-1">
          <NavMain items={navWithStatus} />
        </div>
      </SidebarContent>
      <SidebarFooter>
        {user && <NavUser user={user} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

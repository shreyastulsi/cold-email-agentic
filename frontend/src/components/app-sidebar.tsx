import {
  FileText,
  LayoutDashboard,
  Mail,
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
import { getCurrentUser } from "@/utils/supabase"

// Navigation data for the application
const navMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Search Jobs",
    url: "/dashboard/search",
    icon: SearchIcon,
  },
  {
    title: "Messages",
    url: "/dashboard/messages",
    icon: Mail,
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
    items: [
      {
        title: "General",
        url: "/dashboard/settings",
      },
      {
        title: "Email Accounts",
        url: "/dashboard/settings/email-accounts",
      },
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState<any>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { state } = useSidebar()

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
  const navMainWithActive = navMain.map(item => ({
    ...item,
    isActive: location.pathname === item.url || 
              (item.items && item.items.some(subItem => location.pathname === subItem.url)),
  }))

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
      <SidebarContent>
        <NavMain items={navMainWithActive} />
      </SidebarContent>
      <SidebarFooter>
        {user && <NavUser user={user} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

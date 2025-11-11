import { AppSidebar } from '@/components/app-sidebar'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { SidebarLoggerProvider } from '@/context/sidebar-logger-context'
import { ActivityConsoleProvider, useActivityConsole } from '@/context/activity-console-context'
import { useLocation } from 'react-router-dom'

const getPageTitle = (pathname) => {
  const routes = {
    '/dashboard': 'Dashboard',
    '/dashboard/search': 'Search Jobs',
    '/dashboard/messages': 'Messages',
    '/dashboard/drafts': 'Drafts',
    '/dashboard/resume': 'Resume',
    '/dashboard/settings': 'Settings',
  }
  
  // Check for dynamic routes (e.g., /dashboard/campaigns/:id)
  if (pathname.startsWith('/dashboard/campaigns/')) {
    return 'Campaign Details'
  }
  
  return routes[pathname] || 'Dashboard'
}

function LayoutContent({ children, pageTitle }) {
  return (
    <SidebarInset 
      className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col h-screen overflow-hidden"
    >
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4 bg-gray-700" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-base font-semibold text-white">
                {pageTitle}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:p-8 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1400px]">
          {children}
        </div>
      </main>
    </SidebarInset>
  )
}

export default function Layout({ children }) {
  const location = useLocation()
  const pageTitle = getPageTitle(location.pathname)

  return (
    <SidebarLoggerProvider>
      <ActivityConsoleProvider>
        <SidebarProvider>
          <AppSidebar />
          <LayoutContent pageTitle={pageTitle}>
            {children}
          </LayoutContent>
        </SidebarProvider>
      </ActivityConsoleProvider>
    </SidebarLoggerProvider>
  )
}


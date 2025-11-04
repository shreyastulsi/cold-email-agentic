// modern-side-bar.tsx
"use client";
import { useAuth } from '@/lib/AuthContext';
import {
  BarChart3,
  Bell,
  Camera,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:8000";

interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

interface SidebarProps {
  className?: string;
  onNavigation?: (pageId: string) => void;
}

const navigationItems: NavigationItem[] = [
  { id: "dashboard", name: "Dashboard", icon: Home, href: "/dashboard" },
  { id: "analytics", name: "Analytics", icon: BarChart3, href: "/dashboard/analytics" },
  { id: "live", name: "Live View", icon: Camera, href: "/dashboard/live" },
  { id: "documents", name: "Documents", icon: FileText, href: "/dashboard/documents", badge: "3" },
  { id: "notifications", name: "Notifications", icon: Bell, href: "/dashboard/notifications", badge: "12" },
  { id: "profile", name: "Profile", icon: User, href: "/dashboard/profile" },
  { id: "settings", name: "Settings", icon: Settings, href: "/dashboard/settings" },
  { id: "help", name: "Help & Support", icon: HelpCircle, href: "/dashboard/help" },
];

export function Sidebar({ className = "", onNavigation }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState("dashboard");
  const { logout, user, } = useAuth();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  useEffect(() => {
    const path = location.pathname;
    console.log('Sidebar: Current path:', path);
    if (path === '/dashboard' || path === '/dashboard/analytics') {
      setActiveItem('analytics');
    } else if (path.includes('/dashboard/live')) {
      setActiveItem('live');
    } else if (path.includes('/dashboard/documents')) {
      setActiveItem('documents');
    } else if (path.includes('/dashboard/notifications')) {
      setActiveItem('notifications');
    } else if (path.includes('/dashboard/profile')) {
      setActiveItem('profile');
    } else if (path.includes('/dashboard/settings')) {
      setActiveItem('settings');
    } else if (path.includes('/dashboard/help')) {
      setActiveItem('help');
    } else {
      setActiveItem('dashboard');
    }
  }, [location.pathname]);

  const handleItemClick = async (itemId: string) => {
    setActiveItem(itemId);
    console.log('Sidebar: Navigating to item:', itemId);
    
    if (onNavigation) {
      onNavigation(itemId);
    } else {
      switch (itemId) {
        case 'dashboard':
          navigate('/dashboard');
          break;
        case 'analytics':
          navigate('/dashboard/analytics');
          break;
        case 'live':
          navigate('/dashboard/live');
          break;
        case 'documents':
          navigate('/dashboard/documents');
          break;
        case 'notifications':
          navigate('/dashboard/notifications');
          break;
        case 'profile':
          navigate('/dashboard/profile');
          break;
        case 'settings':
          navigate('/dashboard/settings');
          break;
        case 'help':
          navigate('/dashboard/help');
          break;
        case 'logout':
          await logout();
          navigate('/login');
          break;
        default:
          navigate('/dashboard');
      }
    }
    
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={toggleSidebar}
        className="fixed top-6 left-6 z-50 p-3 rounded-lg bg-white shadow-md border border-slate-100 md:hidden hover:bg-slate-50 transition-all duration-200"
        aria-label="Toggle sidebar"
      >
        {isOpen ? 
          <X className="h-5 w-5 text-slate-600" /> : 
          <Menu className="h-5 w-5 text-slate-600" />
        }
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300" 
          onClick={toggleSidebar} 
        />
      )}

      <div
        className={`
          fixed top-0 left-0 h-full bg-zinc-900 border-r border-zinc-700 z-40 transition-all duration-300 ease-in-out flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${isCollapsed ? "w-16" : "w-64"}
          md:translate-x-0 md:static md:z-auto
          ${className}
        `}
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-700 bg-zinc-800/60">
          {!isCollapsed && (
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-base">A</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-white text-base">Axium Robotics</span>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center mx-auto shadow-sm">
              <span className="text-white font-bold text-base">A</span>
            </div>
          )}

          <button
            onClick={toggleCollapse}
            className="hidden md:flex p-1.5 rounded-md hover:bg-zinc-700 transition-all duration-200"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-zinc-400" />
            )}
          </button>
        </div>

        {!isCollapsed && (
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-600 rounded-md text-sm text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>
        )}

        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <ul className="space-y-0.5">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleItemClick(item.id)}
                    className={`
                      w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-left transition-all duration-200 group
                      ${isActive
                        ? "bg-blue-600/20 text-blue-400"
                        : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      }
                      ${isCollapsed ? "justify-center px-2" : ""}
                    `}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <div className="flex items-center justify-center min-w-[24px]">
                      <Icon
                        className={`
                          h-4.5 w-4.5 flex-shrink-0
                          ${isActive 
                            ? "text-blue-400" 
                            : "text-zinc-400 group-hover:text-white"
                          }
                        `}
                      />
                    </div>
                    
                    {!isCollapsed && (
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm ${isActive ? "font-medium" : "font-normal"}`}>{item.name}</span>
                        {item.badge && (
                          <span className={`
                            px-1.5 py-0.5 text-xs font-medium rounded-full
                            ${isActive
                              ? "bg-blue-600/30 text-blue-300"
                              : "bg-zinc-700 text-zinc-300"
                            }
                          `}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}

                    {isCollapsed && item.badge && (
                      <div className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full bg-blue-600/30 border border-zinc-800">
                        <span className="text-[10px] font-medium text-blue-300">
                          {parseInt(item.badge) > 9 ? '9+' : item.badge}
                        </span>
                      </div>
                    )}

                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                        {item.name}
                        {item.badge && (
                          <span className="ml-1.5 px-1 py-0.5 bg-zinc-700 rounded-full text-[10px]">
                            {item.badge}
                          </span>
                        )}
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-1.5 h-1.5 bg-zinc-800 rotate-45" />
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto border-t border-zinc-700">
          <div className={`border-b border-zinc-700 bg-zinc-800/30 ${isCollapsed ? 'py-3 px-2' : 'p-3'}`}>
            {!isCollapsed ? (
              <div className="flex items-center px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors duration-200">
                <div className="w-8 h-8 bg-zinc-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {user?.username ? user.username.charAt(0).toUpperCase() : '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0 ml-2.5">
                  <p className="text-sm font-medium text-white truncate">{user?.username || 'User'}</p>
                  <p className="text-xs text-zinc-400 truncate">{user?.email || 'No email'}</p>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full ml-2" title="Online" />
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-9 h-9 bg-zinc-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {user?.username ? user.username.charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900" />
                </div>
              </div>
            )}
          </div>

          <div className="p-3">
            <button
              onClick={() => handleItemClick("logout")}
              className={`
                w-full flex items-center rounded-md text-left transition-all duration-200 group
                text-red-600 hover:bg-red-50 hover:text-red-700
                ${isCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2.5"}
              `}
              title={isCollapsed ? "Logout" : undefined}
            >
              <div className="flex items-center justify-center min-w-[24px]">
                <LogOut className="h-4.5 w-4.5 flex-shrink-0 text-red-500 group-hover:text-red-600" />
              </div>
              
              {!isCollapsed && (
                <span className="text-sm">Logout</span>
              )}
              
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  Logout
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-1.5 h-1.5 bg-zinc-800 rotate-45" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
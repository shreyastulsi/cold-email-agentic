"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    indicator?: "warning" | "info"
    indicatorTooltip?: string
    disabled?: boolean
    disabledReason?: string
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const location = useLocation()

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
          item.items ? (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} isActive={item.isActive}>
                    {item.icon && <item.icon className="size-5" />}
                    <span className="text-base">{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => {
                      const isSubItemActive = location.pathname === subItem.url
                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={isSubItemActive}>
                            <Link to={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : (
            <SidebarMenuItem key={item.title}>
              {(() => {
                const isDisabled = Boolean(item.disabled)
                const indicator =
                  item.indicator && (
                    <span
                      className={`ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full text-[10px] font-bold leading-none ${
                        item.indicator === "warning"
                          ? "bg-amber-400 text-gray-900"
                          : "bg-sky-400 text-gray-900"
                      }`}
                    >
                      !
                    </span>
                  )

                const buttonContent = isDisabled ? (
                  <div className="flex w-full items-center gap-2">
                    {item.icon && <item.icon className="size-5 shrink-0" />}
                    <span className="text-base font-medium text-gray-400">
                      {item.title}
                    </span>
                    {indicator}
                  </div>
                ) : (
                  <Link to={item.url} className="flex w-full items-center gap-2">
                    {item.icon && <item.icon className="size-5 shrink-0" />}
                    <span className="text-base">{item.title}</span>
                    {indicator}
                  </Link>
                )

                return (
              <SidebarMenuButton
                  asChild={!isDisabled}
                tooltip={
                    isDisabled
                      ? item.disabledReason || item.title
                      : item.indicatorTooltip || item.title
                }
                  isActive={!isDisabled && item.isActive}
                  disabled={isDisabled}
                  aria-disabled={isDisabled}
                  className={isDisabled ? "cursor-not-allowed opacity-70" : undefined}
                  {...(isDisabled ? { type: "button" } : {})}
              >
                  {buttonContent}
              </SidebarMenuButton>
                )
              })()}
            </SidebarMenuItem>
          )
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  DollarSign,
  ShoppingCart,
  Users,
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  Package,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const menuItems = [
  {
    title: "Overview",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
]

const menuGroups = [
  {
    title: "Sales",
    items: [
      {
        title: "Sales by Channel",
        url: "/dashboard/sales/net-by-channel",
        icon: BarChart3,
      },
      {
        title: "Sales Over Time",
        url: "/dashboard/sales/over-time",
        icon: TrendingUp,
      },
    ],
  },
  {
    title: "Orders",
    items: [
      {
        title: "Orders Overview",
        url: "/dashboard/orders/over-time",
        icon: Package,
      },
      {
        title: "Order Status Breakdown",
        url: "/dashboard/orders/status-breakdown",
        icon: ShoppingCart,
      },
    ],
  },
  {
    title: "Financial",
    items: [
      {
        title: "Revenue Breakdown",
        url: "/dashboard/finances/revenue-breakdown",
        icon: DollarSign,
      },
      {
        title: "Transaction Analysis",
        url: "/dashboard/finances/transactions",
        icon: CreditCard,
      },
    ],
  },
  {
    title: "Customer Insights",
    items: [
      {
        title: "Channel Performance",
        url: "/dashboard/insights/channel-performance",
        icon: Users,
      },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-md font-bold text-sm">
            V
          </div>
          <span className="font-semibold text-lg">Venroy</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Overview Menu Item */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Grouped Menu Items */}
        {menuGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.url}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}

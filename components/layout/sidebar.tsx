"use client"

import {
  LayoutDashboard,
  Package,
  FolderOpen,
  Receipt,
  RotateCcw,
  Users,
  BarChart3,
  CatIcon as Catalog,
  Settings,
  UserCog,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"
import { canAccessTab } from "@/lib/auth/roles"

interface SidebarProps {
  currentPage: string
  onPageChange: (page: string) => void
  collapsed: boolean
}

const navigationItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, tab: "dashboard" },
  { id: "products", label: "Products", icon: Package, tab: "products" },
  { id: "categories", label: "Categories", icon: FolderOpen, tab: "categories" },
  { id: "receipts", label: "Receipts", icon: Receipt, tab: "receipts" },
  { id: "returns", label: "Returns", icon: RotateCcw, tab: "returns" },
  { id: "shopkeepers", label: "Shopkeepers", icon: Users, tab: "shopkeepers" },
  { id: "reports", label: "Reports", icon: BarChart3, tab: "reports" },
  { id: "catalog", label: "Catalog", icon: Catalog, tab: "catalog" },
  { id: "settings", label: "Settings", icon: Settings, tab: "settings" },
]

export function Sidebar({ currentPage, onPageChange, collapsed }: SidebarProps) {
  const { profile } = useAuth()

  const visibleItems = navigationItems.filter((item) => {
    if (!profile) return false

    // Special handling for catalog - all users can access
    if (item.id === "catalog") return true

    // Check if user can access this tab
    return canAccessTab(profile.role, item.tab, profile.permissions)
  })

  const adminItems =
    profile?.role === "admin" ? [{ id: "admin-users", label: "Manage Users", icon: UserCog, tab: "users" }] : []

  const allItems = [...visibleItems, ...adminItems]

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 bottom-0 z-40 bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {allItems.map((item) => {
              const Icon = item.icon
              const isActive = currentPage === item.id

              return (
                <Button
                  key={item.id}
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 h-10",
                    collapsed && "justify-center px-2",
                    isActive && "bg-sidebar-primary text-sidebar-primary-foreground",
                  )}
                  onClick={() => {
                    if (item.id === "admin-users") {
                      window.location.href = "/admin/users"
                    } else {
                      onPageChange(item.id)
                    }
                  }}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Button>
              )
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}

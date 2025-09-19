"use client"

import { LayoutDashboard, Package, Receipt, CatIcon as Catalog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"
import { canAccessTab } from "@/lib/auth/roles"

interface BottomNavProps {
  currentPage: string
  onPageChange: (page: string) => void
}

const bottomNavItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, tab: "dashboard" },
  { id: "products", label: "Products", icon: Package, tab: "products" },
  { id: "receipts", label: "Receipts", icon: Receipt, tab: "receipts" },
  { id: "catalog", label: "Catalog", icon: Catalog, tab: "catalog" },
]

export function BottomNav({ currentPage, onPageChange }: BottomNavProps) {
  const { profile } = useAuth()

  const visibleItems = bottomNavItems.filter((item) => {
    if (!profile) return false

    // Special handling for catalog - all users can access
    if (item.id === "catalog") return true

    // Check if user can access this tab
    return canAccessTab(profile.role, item.tab, profile.permissions)
  })

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden">
      <div className="flex items-center justify-around py-2">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id

          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              className={cn("flex flex-col items-center gap-1 h-auto py-2 px-3", isActive && "text-primary")}
              onClick={() => onPageChange(item.id)}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Button>
          )
        })}
      </div>
    </nav>
  )
}

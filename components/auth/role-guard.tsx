"use client"

import type React from "react"
import { useAuth } from "./auth-provider"
import { hasPermission, canAccessTab, type UserRole } from "@/lib/auth/roles"
import { Card, CardContent } from "@/components/ui/card"
import { Shield } from "lucide-react"

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  requiredPermission?: string
  requiredTab?: string
  fallback?: React.ReactNode
}

export function RoleGuard({ children, allowedRoles, requiredPermission, requiredTab, fallback }: RoleGuardProps) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      fallback || (
        <Card className="m-4">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600">Authentication required</p>
            </div>
          </CardContent>
        </Card>
      )
    )
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return (
      fallback || (
        <Card className="m-4">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <p className="text-gray-600">Access denied. Insufficient permissions.</p>
            </div>
          </CardContent>
        </Card>
      )
    )
  }

  // Check permission-based access
  if (requiredPermission && !hasPermission(profile.role, requiredPermission, profile.permissions)) {
    return (
      fallback || (
        <Card className="m-4">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <p className="text-gray-600">Access denied. Missing required permission.</p>
            </div>
          </CardContent>
        </Card>
      )
    )
  }

  // Check tab-based access
  if (requiredTab && !canAccessTab(profile.role, requiredTab, profile.permissions)) {
    return (
      fallback || (
        <Card className="m-4">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <p className="text-gray-600">Access denied. Tab not available for your role.</p>
            </div>
          </CardContent>
        </Card>
      )
    )
  }

  return <>{children}</>
}

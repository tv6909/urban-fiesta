export type UserRole = "admin" | "seller" | "viewer"

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  permissions: Record<string, any>
  created_at: string
  updated_at: string
  created_by: string
}

export interface SellerPermissions {
  canManageProducts: boolean
  canManageCategories: boolean
  canViewReports: boolean
  canManageShopkeepers: boolean
  canProcessReturns: boolean
  canManageStock: boolean
}

export const DEFAULT_SELLER_PERMISSIONS: SellerPermissions = {
  canManageProducts: true,
  canManageCategories: true,
  canViewReports: false,
  canManageShopkeepers: false,
  canProcessReturns: false,
  canManageStock: true,
}

export const ROLE_PERMISSIONS = {
  admin: {
    canManageProducts: true,
    canManageCategories: true,
    canViewReports: true,
    canManageShopkeepers: true,
    canProcessReturns: true,
    canManageStock: true,
    canManageUsers: true,
    canAccessAllTabs: true,
  },
  seller: DEFAULT_SELLER_PERMISSIONS,
  viewer: {
    canViewCatalog: true,
    canAddToCart: true,
    canShareCart: true,
    canManageProducts: false,
    canManageCategories: false,
    canViewReports: false,
    canManageShopkeepers: false,
    canProcessReturns: false,
    canManageStock: false,
    canSeePayNow: false,
  },
} as const

export function hasPermission(
  userRole: UserRole,
  permission: string,
  customPermissions?: Record<string, any>,
): boolean {
  // Admin has all permissions
  if (userRole === "admin") {
    return true
  }

  // Check custom permissions first (for sellers)
  if (customPermissions && permission in customPermissions) {
    return customPermissions[permission]
  }

  // Fall back to default role permissions
  const rolePerms = ROLE_PERMISSIONS[userRole] as Record<string, any>
  return rolePerms[permission] || false
}

export function canAccessTab(userRole: UserRole, tabName: string, customPermissions?: Record<string, any>): boolean {
  const tabPermissionMap: Record<string, string> = {
    catalog: "canViewCatalog",
    products: "canManageProducts",
    categories: "canManageCategories",
    shopkeepers: "canManageShopkeepers",
    reports: "canViewReports",
    returns: "canProcessReturns",
    stock: "canManageStock",
    users: "canManageUsers",
  }

  const permission = tabPermissionMap[tabName]
  if (!permission) {
    return false
  }

  return hasPermission(userRole, permission, customPermissions)
}

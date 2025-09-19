"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { RoleGuard } from "@/components/auth/role-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Trash2, UserPlus, Edit, Eye, EyeOff } from "lucide-react"
import { type UserProfile, DEFAULT_SELLER_PERMISSIONS, type SellerPermissions } from "@/lib/auth/roles"
import { useAuth } from "@/components/auth/auth-provider"

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const { refreshProfile } = useAuth()

  // Form state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<"seller" | "viewer">("viewer")
  const [permissions, setPermissions] = useState<SellerPermissions>(DEFAULT_SELLER_PERMISSIONS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const resetForm = () => {
    setEmail("")
    setPassword("")
    setRole("viewer")
    setPermissions(DEFAULT_SELLER_PERMISSIONS)
    setError(null)
    setShowCreateForm(false)
    setEditingUser(null)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Skip email confirmation for admin-created users
      })

      if (authError) throw authError

      if (authData.user) {
        // Create user profile
        const { error: profileError } = await supabase.from("user_profiles").insert({
          id: authData.user.id,
          email,
          role,
          permissions: role === "seller" ? permissions : {},
        })

        if (profileError) throw profileError

        await fetchUsers()
        resetForm()
      }
    } catch (error: any) {
      setError(error.message || "Failed to create user")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setIsSubmitting(true)
    setError(null)

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          role,
          permissions: role === "seller" ? permissions : {},
        })
        .eq("id", editingUser.id)

      if (error) throw error

      await fetchUsers()
      await refreshProfile() // Refresh current user's profile if they updated themselves
      resetForm()
    } catch (error: any) {
      setError(error.message || "Failed to update user")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return
    }

    try {
      // Delete from auth (this will cascade to user_profiles due to foreign key)
      const { error } = await supabase.auth.admin.deleteUser(userId)
      if (error) throw error

      await fetchUsers()
    } catch (error: any) {
      alert("Failed to delete user: " + error.message)
    }
  }

  const startEdit = (user: UserProfile) => {
    setEditingUser(user)
    setEmail(user.email)
    setRole(user.role as "seller" | "viewer")
    setPermissions(user.role === "seller" ? (user.permissions as SellerPermissions) : DEFAULT_SELLER_PERMISSIONS)
    setShowCreateForm(true)
  }

  const handlePermissionChange = (permission: keyof SellerPermissions, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [permission]: checked,
    }))
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800"
      case "seller":
        return "bg-blue-100 text-blue-800"
      case "viewer":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Create and manage user accounts with role-based permissions</p>
          </div>
          <Button onClick={() => setShowCreateForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <UserPlus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>

        {/* Create/Edit User Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingUser ? "Edit User" : "Create New User"}</CardTitle>
              <CardDescription>
                {editingUser ? "Update user role and permissions" : "Add a new user to the system"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@hzshop.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={!!editingUser} // Can't change email when editing
                    />
                  </div>

                  {!editingUser && (
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={role} onValueChange={(value: "seller" | "viewer") => setRole(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="seller">Seller</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Seller Permissions */}
                {role === "seller" && (
                  <div className="space-y-3">
                    <Label>Seller Permissions</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(DEFAULT_SELLER_PERMISSIONS).map(([key, defaultValue]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            id={key}
                            checked={permissions[key as keyof SellerPermissions]}
                            onCheckedChange={(checked) =>
                              handlePermissionChange(key as keyof SellerPermissions, checked as boolean)
                            }
                          />
                          <Label htmlFor={key} className="text-sm font-normal">
                            {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}

                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                    {isSubmitting ? "Saving..." : editingUser ? "Update User" : "Create User"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>Manage existing user accounts and their permissions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{user.email}</p>
                          <p className="text-sm text-gray-500">
                            Created {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className={getRoleBadgeColor(user.role)}>{user.role}</Badge>
                      </div>
                      {user.role === "seller" && user.permissions && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Permissions:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(user.permissions as SellerPermissions).map(([key, value]) =>
                              value ? (
                                <Badge key={key} variant="outline" className="text-xs">
                                  {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                                </Badge>
                              ) : null,
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {user.role !== "admin" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => startEdit(user)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteUser(user.id)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  )
}

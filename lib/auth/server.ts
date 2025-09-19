import { createClient } from "@/lib/supabase/server"
import type { UserProfile } from "./roles"
import { redirect } from "next/navigation"

export async function getCurrentUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return null
  }

  return profile
}

export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/login")
  }

  return user
}

export async function requireRole(allowedRoles: string[]) {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    redirect("/auth/login")
  }

  if (!allowedRoles.includes(profile.role)) {
    redirect("/unauthorized")
  }

  return profile
}

export async function requireAdmin() {
  return await requireRole(["admin"])
}

export async function requireAdminOrSeller() {
  return await requireRole(["admin", "seller"])
}

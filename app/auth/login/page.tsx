"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const router = useRouter()

  const addDebugLog = (message: string) => {
    console.log(`[v0] ${message}`)
    setDebugInfo((prev) => [...prev.slice(-4), message])
  }

  useEffect(() => {
    addDebugLog("Login page loaded")
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    addDebugLog("Form submitted")

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    addDebugLog(`Attempting login with email: ${email}`)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      addDebugLog(`Login response - User: ${data.user?.id}, Error: ${error?.message || "none"}`)

      if (error) throw error

      if (!data.user) {
        throw new Error("No user returned from authentication")
      }

      let { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", data.user.id)
        .single()

      addDebugLog(`Profile check - Found: ${!!profile}, Error: ${profileError?.message || "none"}`)

      // If profile doesn't exist, create it
      if (!profile && profileError?.code === "PGRST116") {
        addDebugLog("Creating user profile...")

        const { data: newProfile, error: createError } = await supabase
          .from("user_profiles")
          .insert({
            id: data.user.id,
            email: data.user.email,
            role: "admin", // Default to admin for now
            permissions: {
              products: true,
              categories: true,
              receipts: true,
              returns: true,
              reports: true,
              shopkeepers: true,
              settings: true,
            },
          })
          .select()
          .single()

        if (createError) {
          addDebugLog(`Profile creation error: ${createError.message}`)
          throw createError
        }

        profile = newProfile
        addDebugLog("Profile created successfully")
      } else if (profileError && profileError.code !== "PGRST116") {
        throw profileError
      }

      addDebugLog("Login successful, redirecting...")

      // Use window.location for a full page refresh to ensure session sync
      window.location.href = "/"
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred"
      addDebugLog(`Login error: ${errorMessage}`)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const createAdminUser = async () => {
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      addDebugLog("Creating admin user...")

      const { data, error } = await supabase.auth.signUp({
        email: "admin@hzshop.com",
        password: "admin123!",
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || window.location.origin,
        },
      })

      addDebugLog(`Admin user creation - User: ${data.user?.id}, Error: ${error?.message || "none"}`)

      if (error) throw error

      setError("Admin user created successfully! You can now login.")
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create admin user"
      addDebugLog(`Admin creation error: ${errorMessage}`)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">Welcome Back</CardTitle>
            <CardDescription className="text-gray-600">Sign in to access your shop management system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="abug@hzshop.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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

              {error && (
                <div
                  className={`p-3 text-sm rounded-md ${
                    error.includes("successfully")
                      ? "text-green-600 bg-green-50 border border-green-200"
                      : "text-red-600 bg-red-50 border border-red-200"
                  }`}
                >
                  {error}
                </div>
              )}

              {debugInfo.length > 0 && (
                <div className="p-3 text-xs bg-gray-50 border border-gray-200 rounded-md">
                  <div className="font-medium mb-1">Debug Info:</div>
                  {debugInfo.map((info, index) => (
                    <div key={index} className="text-gray-600">
                      {info}
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-4">
              <Button
                type="button"
                onClick={createAdminUser}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-medium"
                disabled={isLoading}
              >
                Create Admin User (First Time Setup)
              </Button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">Need access? Contact your administrator to create an account.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

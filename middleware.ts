import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  console.log("[v0] Middleware started for:", request.nextUrl.pathname)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log("[v0] Supabase URL exists:", !!supabaseUrl)
  console.log("[v0] Supabase Anon Key exists:", !!supabaseAnonKey)

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[v0] Missing Supabase environment variables")
    console.error("[v0] NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "SET" : "MISSING")
    console.error("[v0] NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? "SET" : "MISSING")

    // Return early without Supabase client if env vars are missing
    return NextResponse.next({
      request,
    })
  }

  // Handle CORS for Replit environment
  const origin = request.headers.get("origin")
  const isDevelopment = process.env.NODE_ENV !== "production"

  const allowedOrigins = isDevelopment
    ? [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^https?:\/\/.*\.replit\.(dev|app)$/]
    : [
        /^https?:\/\/.*\.replit\.app$/,
        // Add your production domain here when deploying
      ]

  let supabaseResponse = NextResponse.next({
    request,
  })

  // Check if origin is allowed
  if (origin) {
    const isAllowed = allowedOrigins.some((pattern) => pattern.test(origin))
    if (isAllowed) {
      supabaseResponse.headers.set("Access-Control-Allow-Origin", origin)
      supabaseResponse.headers.set("Access-Control-Allow-Credentials", "true")
      supabaseResponse.headers.set("Vary", "Origin")
    }
  }

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    const isAllowed = origin && allowedOrigins.some((pattern) => pattern.test(origin))
    if (isAllowed) {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Requested-With, X-Supabase-Authorization, apikey, Range",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        },
      })
    } else {
      return new Response(null, { status: 403 })
    }
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    })

    console.log("[v0] Supabase client created successfully")

    // Try to get session and refresh if needed
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.log("[v0] Session error:", sessionError.message)
    }

    const user = session?.user || null
    console.log("[v0] User session refreshed, user exists:", !!user, "session exists:", !!session)

    // Public routes that don't require authentication
    const publicRoutes = ["/auth/login", "/auth/signup", "/auth/error"]
    const isPublicRoute = publicRoutes.some((route) => request.nextUrl.pathname.startsWith(route))

    // Only redirect from auth pages if user is authenticated
    // Let individual pages handle their own authentication checks
    if (user && isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }
  } catch (error) {
    console.error("[v0] Error in Supabase middleware:", error)
    // Continue without Supabase functionality if there's an error
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database.types"

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error("Supabase URL and publishable key are required.")
  }

  browserClient = createBrowserClient<Database>(url, key, {
    cookieOptions: { secure: process.env.NODE_ENV === "production" },
  })

  return browserClient
}

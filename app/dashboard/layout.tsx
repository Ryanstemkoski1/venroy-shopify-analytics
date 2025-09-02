import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SidebarProvider } from "@/components/ui/sidebar"
import LogoutButton from "@/components/modules/logout-button"
import { AppSidebar } from "@/components/layouts/app-sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-xl font-semibold">
              Venroy Analytics Dashboard
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {user.email}
              </span>
              <LogoutButton />
            </div>
          </div>
        </header>

        <div className="gap-4 p-4">{children}</div>
      </main>
    </SidebarProvider>
  )
}

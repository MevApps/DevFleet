import type { Metadata } from "next"
import "./globals.css"
import { NavLink } from "@/components/ui/nav-link"
import { AlertsDrawer } from "@/components/alerts/alerts-drawer"

export const metadata: Metadata = {
  title: "DevFleet Dashboard",
  description: "Agentic Development Platform — CEO Dashboard",
}

const NAV_ITEMS = [
  { href: "/", label: "Live Floor" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/financials", label: "Financials" },
  { href: "/quality", label: "Quality" },
  { href: "/insights", label: "Insights" },
  { href: "/system", label: "System Health" },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen overflow-hidden">
        <aside className="w-56 border-r border-zinc-800 bg-zinc-950 p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between mb-6 px-4">
            <h1 className="text-lg font-bold text-white">DevFleet</h1>
            <AlertsDrawer />
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (<NavLink key={item.href} href={item.href} label={item.label} />))}
          </nav>
        </aside>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </body>
    </html>
  )
}

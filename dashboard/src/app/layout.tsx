import type { Metadata } from "next"
import "./globals.css"
import { NavLink } from "@/components/ui/nav-link"

export const metadata: Metadata = {
  title: "DevFleet Dashboard",
  description: "Agentic Development Platform — CEO Dashboard",
}

const NAV_ITEMS = [
  { href: "/", label: "Live Floor" },
  { href: "/pipeline", label: "Pipeline" },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen overflow-hidden">
        <aside className="w-56 border-r border-zinc-800 bg-zinc-950 p-4 flex flex-col gap-1">
          <h1 className="text-lg font-bold text-white mb-6 px-4">DevFleet</h1>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (<NavLink key={item.href} href={item.href} label={item.label} />))}
          </nav>
        </aside>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </body>
    </html>
  )
}

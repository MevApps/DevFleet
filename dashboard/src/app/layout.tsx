import type { Metadata } from "next"
import "./globals.css"
import { LayoutShell } from "./layout-shell"

export const metadata: Metadata = {
  title: "DevFleet Dashboard",
  description: "Agentic Development Platform — Dashboard",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}

"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface NavLinkProps { href: string; label: string }

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href
  return (
    <Link href={href} className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"}`}>
      {label}
    </Link>
  )
}

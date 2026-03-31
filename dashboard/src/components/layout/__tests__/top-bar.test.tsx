// src/components/layout/__tests__/top-bar.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TopBar } from "../top-bar"
import { useUIStore } from "@/lib/ui-store"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}))

describe("TopBar", () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarCollapsed: false })
  })

  it("renders fleet summary chips", () => {
    render(<TopBar />)
    expect(screen.getByText(/agents/i)).toBeInTheDocument()
  })

  it("shows expand button when sidebar is collapsed", () => {
    useUIStore.setState({ sidebarCollapsed: true })
    render(<TopBar />)
    expect(screen.getByLabelText(/open sidebar/i)).toBeInTheDocument()
  })

  it("hides expand button when sidebar is open", () => {
    useUIStore.setState({ sidebarCollapsed: false })
    render(<TopBar />)
    expect(screen.queryByLabelText(/open sidebar/i)).not.toBeInTheDocument()
  })
})

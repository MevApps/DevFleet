// src/components/layout/__tests__/app-sidebar.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { AppSidebar } from "../app-sidebar"
import { useUIStore } from "@/lib/ui-store"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { useDashboardStore } from "@/lib/store"

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("AppSidebar", () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarCollapsed: false })
    useWorkspaceStore.getState().clear()
  })

  it("renders the DevFleet logo", () => {
    render(<AppSidebar />)
    expect(screen.getByText("DevFleet")).toBeInTheDocument()
  })

  it("renders the New Goal button", () => {
    render(<AppSidebar />)
    expect(screen.getByRole("button", { name: /new goal/i })).toBeInTheDocument()
  })

  it("renders the search input", () => {
    render(<AppSidebar />)
    expect(screen.getByText(/search goals/i)).toBeInTheDocument()
  })

  it("renders feature links", () => {
    render(<AppSidebar />)
    expect(screen.getByText("Settings")).toBeInTheDocument()
    expect(screen.getByText("Analytics")).toBeInTheDocument()
    expect(screen.getByText("Health")).toBeInTheDocument()
  })

  it("renders Recents label", () => {
    render(<AppSidebar />)
    expect(screen.getByText("Recents")).toBeInTheDocument()
  })

  it("renders nothing visible when collapsed", () => {
    useUIStore.setState({ sidebarCollapsed: true })
    const { container } = render(<AppSidebar />)
    const sidebar = container.firstChild as HTMLElement
    expect(sidebar.style.width).toBe("0px")
  })
})

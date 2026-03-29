import { describe, it, expect } from "vitest"
import { useUIStore } from "../ui-store"

describe("sidebar collapse/expand round-trip", () => {
  it("toggleSidebar collapses and re-expands", () => {
    useUIStore.setState({ sidebarCollapsed: false })
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
  })
})

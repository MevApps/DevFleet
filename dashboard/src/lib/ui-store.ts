import { create } from "zustand"

interface UIState {
  theme: "dark" | "light"
  density: "comfortable" | "compact"
  connectionState: "connected" | "reconnecting" | "disconnected"
  sidebarCollapsed: boolean
  setTheme: (theme: "dark" | "light") => void
  setDensity: (density: "comfortable" | "compact") => void
  setConnectionState: (state: "connected" | "reconnecting" | "disconnected") => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: "dark",
  density: "comfortable",
  connectionState: "disconnected",
  sidebarCollapsed: false,
  setTheme: (theme) => set({ theme }),
  setDensity: (density) => set({ density }),
  setConnectionState: (state) => set({ connectionState: state }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))

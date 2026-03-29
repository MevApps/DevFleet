import { create } from "zustand"

type EntityType = "goal" | "task" | "agent" | "event"

interface Breadcrumb {
  readonly id: string
  readonly type: EntityType
  readonly label: string
}

interface InspectorState {
  selectedEntityId: string | null
  selectedEntityType: EntityType | null
  pinned: boolean
  breadcrumbs: readonly Breadcrumb[]
  open: (id: string, type: EntityType, label: string) => void
  close: () => void
  togglePin: () => void
  navigateBreadcrumb: (index: number) => void
}

export const useInspectorStore = create<InspectorState>((set) => ({
  selectedEntityId: null,
  selectedEntityType: null,
  pinned: false,
  breadcrumbs: [],
  open: (id, type, label) =>
    set((state) => ({
      selectedEntityId: id,
      selectedEntityType: type,
      breadcrumbs: [...state.breadcrumbs, { id, type, label }],
    })),
  close: () =>
    set({
      selectedEntityId: null,
      selectedEntityType: null,
      breadcrumbs: [],
    }),
  togglePin: () => set((state) => ({ pinned: !state.pinned })),
  navigateBreadcrumb: (index) =>
    set((state) => {
      const crumb = state.breadcrumbs[index]
      if (!crumb) return state
      return {
        selectedEntityId: crumb.id,
        selectedEntityType: crumb.type as EntityType,
        breadcrumbs: state.breadcrumbs.slice(0, index + 1),
      }
    }),
}))

// src/components/composites/__tests__/diff-viewer.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { DiffViewer } from "../diff-viewer"
import type { DiffFile } from "../diff-viewer"

describe("DiffViewer", () => {
  it("renders file name header", () => {
    const files: DiffFile[] = [{
      path: "src/auth/oauth.ts",
      additions: 5,
      deletions: 2,
      hunks: [{ lines: [
        { type: "context", content: "import { Auth } from './types'" },
        { type: "deletion", content: "const x = null" },
        { type: "addition", content: "const x = getAuth()" },
      ]}],
    }]
    render(<DiffViewer files={files} />)
    expect(screen.getByText("src/auth/oauth.ts")).toBeInTheDocument()
    expect(screen.getByText("+5 -2")).toBeInTheDocument()
  })

  it("renders diff lines with correct styling", () => {
    const files: DiffFile[] = [{
      path: "test.ts",
      additions: 1,
      deletions: 1,
      hunks: [{ lines: [
        { type: "addition", content: "const y = 1" },
        { type: "deletion", content: "const y = 0" },
      ]}],
    }]
    render(<DiffViewer files={files} />)
    expect(screen.getByText("+ const y = 1")).toBeInTheDocument()
    expect(screen.getByText("- const y = 0")).toBeInTheDocument()
  })

  it("shows empty state when no files", () => {
    render(<DiffViewer files={[]} />)
    expect(screen.getByText(/no code changes/i)).toBeInTheDocument()
  })
})

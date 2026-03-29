// src/components/composites/diff-viewer.tsx
import { cn } from "@/lib/utils"

export interface DiffLine {
  readonly type: "addition" | "deletion" | "context"
  readonly content: string
}

export interface DiffHunk {
  readonly lines: readonly DiffLine[]
}

export interface DiffFile {
  readonly path: string
  readonly additions: number
  readonly deletions: number
  readonly hunks: readonly DiffHunk[]
}

interface DiffViewerProps {
  files: readonly DiffFile[]
}

export function DiffViewer({ files }: DiffViewerProps) {
  if (files.length === 0) {
    return <p className="text-[11px] text-text-muted py-3">No code changes.</p>
  }

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <div key={file.path} className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-bg-hover text-[11px]">
            <span className="font-mono text-text-primary">{file.path}</span>
            <span className="font-mono text-text-muted">
              {`+${file.additions} -${file.deletions}`}
            </span>
          </div>
          <div className="font-mono text-[12px] leading-relaxed">
            {file.hunks.map((hunk, hi) => (
              <div key={hi}>
                {hunk.lines.map((line, li) => (
                  <div
                    key={li}
                    className={cn(
                      "px-3 py-px whitespace-pre",
                      line.type === "addition" && "bg-status-green-surface text-status-green-fg",
                      line.type === "deletion" && "bg-status-red-surface text-status-red-fg",
                      line.type === "context" && "text-text-secondary",
                    )}
                  >
                    {line.type === "addition" && "+ "}
                    {line.type === "deletion" && "- "}
                    {line.type === "context" && "  "}
                    {line.content}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

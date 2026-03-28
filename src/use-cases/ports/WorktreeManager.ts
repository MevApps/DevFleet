export type WorktreePath = string

export type MergeResult =
  | { readonly success: true; readonly commit: string }
  | { readonly success: false; readonly error: string }

export interface WorktreeManager {
  create(branch: string, baseBranch?: string): Promise<WorktreePath>
  delete(branch: string): Promise<void>
  merge(branch: string, targetBranch?: string): Promise<MergeResult>
  exists(branch: string): Promise<boolean>
  cleanupAll(): Promise<void>
}

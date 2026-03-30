import type { ProjectConfig } from "../../entities/ProjectConfig"

export interface ProjectContext {
  readonly claudeMd: string
  readonly projectConfig: ProjectConfig
  readonly fileTree: string
}

export interface ProjectContextProvider {
  getContext(): Promise<ProjectContext>
}

export interface ProjectConfig {
  readonly language: string
  readonly buildCommand: string
  readonly testCommand: string
  readonly sourceRoots: readonly string[]
}

export function createProjectConfig(params: {
  language: string
  buildCommand: string
  testCommand: string
  sourceRoots: readonly string[]
}): ProjectConfig {
  return Object.freeze({
    language: params.language,
    buildCommand: params.buildCommand,
    testCommand: params.testCommand,
    sourceRoots: Object.freeze([...params.sourceRoots]),
  })
}

export const UNKNOWN_PROJECT_CONFIG: ProjectConfig = Object.freeze({
  language: "unknown",
  buildCommand: "echo no-build",
  testCommand: "echo no-test",
  sourceRoots: Object.freeze(["."]),
})

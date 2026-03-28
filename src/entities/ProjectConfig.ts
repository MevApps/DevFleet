export interface ProjectConfig {
  readonly language: string
  readonly buildCommand: string
  readonly testCommand: string
  readonly installCommand: string
  readonly sourceRoots: readonly string[]
}

export function createProjectConfig(params: {
  language: string
  buildCommand: string
  testCommand: string
  installCommand: string
  sourceRoots: readonly string[]
}): ProjectConfig {
  return Object.freeze({
    language: params.language,
    buildCommand: params.buildCommand,
    testCommand: params.testCommand,
    installCommand: params.installCommand,
    sourceRoots: Object.freeze([...params.sourceRoots]),
  })
}

export const UNKNOWN_PROJECT_CONFIG: ProjectConfig = Object.freeze({
  language: "unknown",
  buildCommand: "echo no-build",
  testCommand: "echo no-test",
  installCommand: "",
  sourceRoots: Object.freeze(["."]),
})

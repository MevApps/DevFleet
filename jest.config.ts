import type { Config } from "jest"

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    "^@entities/(.*)$": "<rootDir>/src/entities/$1",
    "^@use-cases/(.*)$": "<rootDir>/src/use-cases/$1",
    "^@adapters/(.*)$": "<rootDir>/src/adapters/$1",
    "^@infrastructure/(.*)$": "<rootDir>/src/infrastructure/$1",
    "^@plugin-sdk/(.*)$": "<rootDir>/src/plugin-sdk/$1",
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
}

export default config

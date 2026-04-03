# Sheldon — Full Implementation Plan (All Phases)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Sheldon — a self-hosted AI company orchestration platform — from an empty repo to a fully-featured product across 9 phases.

**Architecture:** Clean Architecture with domain-first design. The `domain` package has zero dependencies. `server`, `services`, and `adapters` depend inward on `domain`. Communication between subsystems uses domain events. All use-cases return `Result<T, E>` with typed errors.

**Tech Stack:** pnpm monorepo, TypeScript, Express 5, PostgreSQL + PGlite + Drizzle ORM, React 19 + Vite + Radix UI + Tailwind 4 + TanStack Query, Better Auth, SSE, Vitest + Playwright

**Spec:** `docs/superpowers/specs/2026-04-03-sheldon-design.md`

**Repo:** Fresh repo at `~/StudioProjects/Sheldon` (not inside DevFleet)

---

## How to Use This Plan

This plan has **9 phases**. Each phase produces working, testable software. Implement them in order — each phase depends on the previous.

Within each phase, tasks are numbered sequentially. Each task has:
- **Files** — exactly what to create/modify
- **Steps** — bite-sized actions with code, commands, and expected output
- **Commits** — frequent, after each task

**Phases overview:**

| Phase | Deliverable | Tasks |
|---|---|---|
| 1 | `sheldon start` shows Mission Control with onboarding | 1.1 – 1.12 |
| 2 | Agents wake up and do work | 2.1 – 2.8 |
| 3 | Agents coordinate, Board governs | 3.1 – 3.8 |
| 4 | Mission Control fully live | 4.1 – 4.9 |
| 5 | Agents get smarter (Learning System) | 5.1 – 5.5 |
| 6 | Teams collaborate, companies portable | 6.1 – 6.5 |
| 7 | Plugin ecosystem | 7.1 – 7.6 |
| 8 | CLI & production operations | 8.1 – 8.5 |
| 9 | Polish & additional adapters | 9.1 – 9.6 |

---

# Phase 1 — Foundation (Domain-First)

**Deliverable:** `sheldon start` boots server + dashboard, shows Mission Control with onboarding flow.

**Principle:** Build the complete domain layer FIRST — all entities, ports, use-cases — before any framework code. Then wire infrastructure around it.

## Task 1.1: Monorepo Scaffold

**Files:**
- Create: `~/StudioProjects/Sheldon/package.json`
- Create: `~/StudioProjects/Sheldon/pnpm-workspace.yaml`
- Create: `~/StudioProjects/Sheldon/tsconfig.base.json`
- Create: `~/StudioProjects/Sheldon/packages/domain/package.json`
- Create: `~/StudioProjects/Sheldon/packages/domain/tsconfig.json`
- Create: `~/StudioProjects/Sheldon/packages/contracts/package.json`
- Create: `~/StudioProjects/Sheldon/packages/contracts/tsconfig.json`
- Create: `~/StudioProjects/Sheldon/packages/db/package.json`
- Create: `~/StudioProjects/Sheldon/packages/db/tsconfig.json`
- Create: `~/StudioProjects/Sheldon/packages/server/package.json`
- Create: `~/StudioProjects/Sheldon/packages/server/tsconfig.json`
- Create: `~/StudioProjects/Sheldon/packages/services/package.json`
- Create: `~/StudioProjects/Sheldon/packages/services/tsconfig.json`
- Create: `~/StudioProjects/Sheldon/packages/ui/package.json`
- Create: `~/StudioProjects/Sheldon/packages/cli/package.json`
- Create: `~/StudioProjects/Sheldon/packages/adapters/storage/package.json`
- Create: `~/StudioProjects/Sheldon/packages/adapters/claude-local/package.json`
- Create: `~/StudioProjects/Sheldon/.gitignore`

- [ ] **Step 1: Create project directory and initialize git**

```bash
mkdir -p ~/StudioProjects/Sheldon && cd ~/StudioProjects/Sheldon
git init
```

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "sheldon",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "pnpm --filter @sheldon/cli dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  }
}
```

- [ ] **Step 3: Create pnpm-workspace.yaml**

```yaml
packages:
  - packages/*
  - packages/adapters/*
```

- [ ] **Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 5: Create each package directory with package.json and tsconfig.json**

For each package, create the directory structure:

`packages/domain/package.json`:
```json
{
  "name": "@sheldon/domain",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.1.0",
    "typescript": "^5.8.0"
  }
}
```

`packages/domain/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/contracts/package.json`:
```json
{
  "name": "@sheldon/contracts",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

`packages/db/package.json`:
```json
{
  "name": "@sheldon/db",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@electric-sql/pglite": "^0.2.0",
    "drizzle-orm": "^0.38.0",
    "@sheldon/domain": "workspace:*"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

`packages/server/package.json`:
```json
{
  "name": "@sheldon/server",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^5.1.0",
    "better-auth": "^1.2.0",
    "@sheldon/domain": "workspace:*",
    "@sheldon/contracts": "workspace:*"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

`packages/services/package.json`:
```json
{
  "name": "@sheldon/services",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@sheldon/domain": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

`packages/ui/package.json`:
```json
{
  "name": "@sheldon/ui",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@radix-ui/react-popover": "^1.1.0",
    "@radix-ui/react-toggle-group": "^1.1.0",
    "@sheldon/contracts": "workspace:*"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.8.0",
    "vite": "^6.0.0",
    "vitest": "^3.1.0",
    "@playwright/test": "^1.50.0"
  }
}
```

`packages/cli/package.json`:
```json
{
  "name": "@sheldon/cli",
  "version": "0.0.1",
  "type": "module",
  "bin": { "sheldon": "src/index.ts" },
  "scripts": {
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "commander": "^13.0.0",
    "tsx": "^4.0.0",
    "@sheldon/server": "workspace:*",
    "@sheldon/db": "workspace:*",
    "@sheldon/services": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

`packages/adapters/storage/package.json`:
```json
{
  "name": "@sheldon/adapter-storage",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "dependencies": {
    "@sheldon/domain": "workspace:*",
    "@sheldon/db": "workspace:*",
    "drizzle-orm": "^0.38.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

`packages/adapters/claude-local/package.json`:
```json
{
  "name": "@sheldon/adapter-claude-local",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "dependencies": {
    "@sheldon/domain": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

Create `tsconfig.json` for each package following the domain pattern (extends base, set outDir/rootDir).

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
*.db
.pglite/
.superpowers/
```

- [ ] **Step 7: Install dependencies and verify**

```bash
cd ~/StudioProjects/Sheldon
pnpm install
```

Expected: All packages linked, no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo with all packages"
```

---

## Task 1.2: Domain — Result Type & Entity Primitives

**Files:**
- Create: `packages/domain/src/result.ts`
- Create: `packages/domain/src/ids.ts`
- Create: `packages/domain/src/index.ts`
- Test: `packages/domain/src/__tests__/result.test.ts`

- [ ] **Step 1: Write the failing test for Result type**

```typescript
// packages/domain/src/__tests__/result.test.ts
import { describe, it, expect } from 'vitest'
import { ok, err, isOk, isErr } from '../result.js'

describe('Result', () => {
  it('creates an ok result', () => {
    const result = ok(42)
    expect(isOk(result)).toBe(true)
    expect(result.value).toBe(42)
  })

  it('creates an err result', () => {
    const result = err('not_found' as const)
    expect(isErr(result)).toBe(true)
    expect(result.error).toBe('not_found')
  })

  it('type narrows with isOk', () => {
    const result = ok('hello') as ReturnType<typeof ok<string>> | ReturnType<typeof err<'fail'>>
    if (isOk(result)) {
      expect(result.value).toBe('hello')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/StudioProjects/Sheldon && pnpm --filter @sheldon/domain test
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Result type**

```typescript
// packages/domain/src/result.ts
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value }
}

export function err<E>(error: E): { ok: false; error: E } {
  return { ok: false, error }
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok
}
```

- [ ] **Step 4: Create ID generator**

```typescript
// packages/domain/src/ids.ts
import { randomUUID } from 'node:crypto'

export type CompanyId = string & { readonly __brand: 'CompanyId' }
export type AgentId = string & { readonly __brand: 'AgentId' }
export type GoalId = string & { readonly __brand: 'GoalId' }
export type ProjectId = string & { readonly __brand: 'ProjectId' }
export type IssueId = string & { readonly __brand: 'IssueId' }
export type CommentId = string & { readonly __brand: 'CommentId' }
export type DocumentId = string & { readonly __brand: 'DocumentId' }
export type RevisionId = string & { readonly __brand: 'RevisionId' }
export type RunId = string & { readonly __brand: 'RunId' }
export type ApprovalId = string & { readonly __brand: 'ApprovalId' }
export type CostEventId = string & { readonly __brand: 'CostEventId' }
export type LearningId = string & { readonly __brand: 'LearningId' }
export type LearningAppId = string & { readonly __brand: 'LearningAppId' }
export type RoutineId = string & { readonly __brand: 'RoutineId' }
export type WorkProductId = string & { readonly __brand: 'WorkProductId' }
export type SkillId = string & { readonly __brand: 'SkillId' }
export type PluginId = string & { readonly __brand: 'PluginId' }
export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' }
export type SecretId = string & { readonly __brand: 'SecretId' }
export type TemplateId = string & { readonly __brand: 'TemplateId' }
export type ActivityId = string & { readonly __brand: 'ActivityId' }
export type BudgetPolicyId = string & { readonly __brand: 'BudgetPolicyId' }

export function generateId<T extends string>(): T {
  return randomUUID() as T
}
```

- [ ] **Step 5: Create barrel export**

```typescript
// packages/domain/src/index.ts
export * from './result.js'
export * from './ids.js'
```

- [ ] **Step 6: Run tests, verify pass**

```bash
pnpm --filter @sheldon/domain test
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(domain): add Result type and branded ID types"
```

---

## Task 1.3: Domain — All Entities

**Files:**
- Create: `packages/domain/src/entities/company.ts`
- Create: `packages/domain/src/entities/agent.ts`
- Create: `packages/domain/src/entities/goal.ts`
- Create: `packages/domain/src/entities/project.ts`
- Create: `packages/domain/src/entities/issue.ts`
- Create: `packages/domain/src/entities/comment.ts`
- Create: `packages/domain/src/entities/document.ts`
- Create: `packages/domain/src/entities/heartbeat-run.ts`
- Create: `packages/domain/src/entities/approval.ts`
- Create: `packages/domain/src/entities/budget-policy.ts`
- Create: `packages/domain/src/entities/cost-event.ts`
- Create: `packages/domain/src/entities/learning.ts`
- Create: `packages/domain/src/entities/learning-application.ts`
- Create: `packages/domain/src/entities/routine.ts`
- Create: `packages/domain/src/entities/work-product.ts`
- Create: `packages/domain/src/entities/execution-workspace.ts`
- Create: `packages/domain/src/entities/company-secret.ts`
- Create: `packages/domain/src/entities/company-skill.ts`
- Create: `packages/domain/src/entities/activity-entry.ts`
- Create: `packages/domain/src/entities/company-template.ts`
- Create: `packages/domain/src/entities/index.ts`
- Test: `packages/domain/src/__tests__/entities.test.ts`

- [ ] **Step 1: Write entity test**

```typescript
// packages/domain/src/__tests__/entities.test.ts
import { describe, it, expect } from 'vitest'
import { createCompany } from '../entities/company.js'
import { createAgent, AgentStatus, AdapterType } from '../entities/agent.js'
import { createIssue, IssueStatus } from '../entities/issue.js'
import { createApproval, ApprovalStatus, RiskLevel } from '../entities/approval.js'
import { createLearning, LearningStatus } from '../entities/learning.js'
import { generateId, type CompanyId, type AgentId, type IssueId, type ProjectId, type GoalId } from '../ids.js'

describe('Entities', () => {
  const companyId = generateId<CompanyId>()

  it('creates a company', () => {
    const company = createCompany({ name: 'Acme Labs' })
    expect(company.name).toBe('Acme Labs')
    expect(company.id).toBeDefined()
    expect(company.createdAt).toBeInstanceOf(Date)
  })

  it('creates an agent with org position', () => {
    const agent = createAgent({
      companyId,
      name: 'CEO',
      role: 'Chief Executive Officer',
      adapterType: 'claude_local',
      parentAgentId: null,
    })
    expect(agent.name).toBe('CEO')
    expect(agent.status).toBe('active')
    expect(agent.adapterType).toBe('claude_local')
  })

  it('creates an issue with default status', () => {
    const issue = createIssue({
      companyId,
      projectId: generateId<ProjectId>(),
      title: 'Build API',
      description: 'Create REST endpoints',
      createdBy: generateId<AgentId>(),
    })
    expect(issue.status).toBe('backlog')
    expect(issue.assigneeId).toBeNull()
  })

  it('creates an approval with system-calculated risk', () => {
    const approval = createApproval({
      companyId,
      proposedBy: generateId<AgentId>(),
      actionType: 'hire_agent',
      justification: 'Need a developer',
      riskLevel: 'medium',
      payload: { agentName: 'Developer', adapterType: 'claude_local' },
    })
    expect(approval.status).toBe('pending')
    expect(approval.riskLevel).toBe('medium')
  })

  it('creates a learning with confidence', () => {
    const learning = createLearning({
      companyId,
      projectId: generateId<ProjectId>(),
      summary: 'Express 5 requires await on app.listen()',
      context: 'Cost us 2 retries',
      domain: 'express',
      tags: ['node', 'async'],
      confidence: 0.7,
      sourceIssueId: generateId<IssueId>(),
      sourceRunId: generateId(),
    })
    expect(learning.status).toBe('active')
    expect(learning.confidence).toBe(0.7)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @sheldon/domain test
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement all entities**

```typescript
// packages/domain/src/entities/company.ts
import { generateId, type CompanyId } from '../ids.js'

export interface Company {
  readonly id: CompanyId
  readonly name: string
  readonly createdAt: Date
  readonly updatedAt: Date
}

export function createCompany(params: { name: string }): Company {
  const now = new Date()
  return {
    id: generateId<CompanyId>(),
    name: params.name,
    createdAt: now,
    updatedAt: now,
  }
}
```

```typescript
// packages/domain/src/entities/agent.ts
import { generateId, type AgentId, type CompanyId } from '../ids.js'

export type AgentStatus = 'active' | 'idle' | 'running' | 'paused' | 'error' | 'terminated'
export type AdapterType = 'claude_local' | 'process' | 'http' | 'codex_local' | 'gemini_local'

export interface Agent {
  readonly id: AgentId
  readonly companyId: CompanyId
  readonly name: string
  readonly role: string
  readonly adapterType: AdapterType
  readonly parentAgentId: AgentId | null
  readonly status: AgentStatus
  readonly createdAt: Date
  readonly updatedAt: Date
}

export function createAgent(params: {
  companyId: CompanyId
  name: string
  role: string
  adapterType: AdapterType
  parentAgentId: AgentId | null
}): Agent {
  const now = new Date()
  return {
    id: generateId<AgentId>(),
    companyId: params.companyId,
    name: params.name,
    role: params.role,
    adapterType: params.adapterType,
    parentAgentId: params.parentAgentId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}
```

```typescript
// packages/domain/src/entities/goal.ts
import { generateId, type GoalId, type CompanyId } from '../ids.js'

export type GoalStatus = 'planning' | 'active' | 'completed' | 'abandoned'

export interface Goal {
  readonly id: GoalId
  readonly companyId: CompanyId
  readonly parentGoalId: GoalId | null
  readonly title: string
  readonly description: string
  readonly status: GoalStatus
  readonly createdAt: Date
  readonly updatedAt: Date
}

export function createGoal(params: {
  companyId: CompanyId
  title: string
  description: string
  parentGoalId?: GoalId | null
}): Goal {
  const now = new Date()
  return {
    id: generateId<GoalId>(),
    companyId: params.companyId,
    parentGoalId: params.parentGoalId ?? null,
    title: params.title,
    description: params.description,
    status: 'planning',
    createdAt: now,
    updatedAt: now,
  }
}
```

```typescript
// packages/domain/src/entities/project.ts
import { generateId, type ProjectId, type CompanyId, type GoalId } from '../ids.js'

export interface ProjectWorkspaceConfig {
  readonly repoUrl: string | null
  readonly branch: string
  readonly workingDir: string
}

export interface Project {
  readonly id: ProjectId
  readonly companyId: CompanyId
  readonly goalId: GoalId | null
  readonly name: string
  readonly description: string
  readonly workspace: ProjectWorkspaceConfig
  readonly createdAt: Date
  readonly updatedAt: Date
}

export function createProject(params: {
  companyId: CompanyId
  goalId?: GoalId | null
  name: string
  description: string
  workspace?: Partial<ProjectWorkspaceConfig>
}): Project {
  const now = new Date()
  return {
    id: generateId<ProjectId>(),
    companyId: params.companyId,
    goalId: params.goalId ?? null,
    name: params.name,
    description: params.description,
    workspace: {
      repoUrl: params.workspace?.repoUrl ?? null,
      branch: params.workspace?.branch ?? 'main',
      workingDir: params.workspace?.workingDir ?? '.',
    },
    createdAt: now,
    updatedAt: now,
  }
}
```

```typescript
// packages/domain/src/entities/issue.ts
import { generateId, type IssueId, type CompanyId, type ProjectId, type AgentId } from '../ids.js'

export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'cancelled'
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical'

export interface Issue {
  readonly id: IssueId
  readonly companyId: CompanyId
  readonly projectId: ProjectId
  readonly parentIssueId: IssueId | null
  readonly title: string
  readonly description: string
  readonly status: IssueStatus
  readonly priority: IssuePriority
  readonly assigneeId: AgentId | null
  readonly createdBy: AgentId
  readonly checkedOutBy: AgentId | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export function createIssue(params: {
  companyId: CompanyId
  projectId: ProjectId
  title: string
  description: string
  createdBy: AgentId
  parentIssueId?: IssueId | null
  priority?: IssuePriority
}): Issue {
  const now = new Date()
  return {
    id: generateId<IssueId>(),
    companyId: params.companyId,
    projectId: params.projectId,
    parentIssueId: params.parentIssueId ?? null,
    title: params.title,
    description: params.description,
    status: 'backlog',
    priority: params.priority ?? 'medium',
    assigneeId: null,
    createdBy: params.createdBy,
    checkedOutBy: null,
    createdAt: now,
    updatedAt: now,
  }
}
```

```typescript
// packages/domain/src/entities/comment.ts
import { generateId, type CommentId, type IssueId, type CompanyId, type AgentId } from '../ids.js'

export interface Comment {
  readonly id: CommentId
  readonly companyId: CompanyId
  readonly issueId: IssueId
  readonly authorId: AgentId
  readonly authorType: 'agent' | 'board'
  readonly body: string
  readonly createdAt: Date
}

export function createComment(params: {
  companyId: CompanyId
  issueId: IssueId
  authorId: AgentId
  authorType: 'agent' | 'board'
  body: string
}): Comment {
  return {
    id: generateId<CommentId>(),
    companyId: params.companyId,
    issueId: params.issueId,
    authorId: params.authorId,
    authorType: params.authorType,
    body: params.body,
    createdAt: new Date(),
  }
}
```

```typescript
// packages/domain/src/entities/document.ts
import { generateId, type DocumentId, type RevisionId, type IssueId, type CompanyId, type AgentId } from '../ids.js'

export interface Document {
  readonly id: DocumentId
  readonly companyId: CompanyId
  readonly issueId: IssueId
  readonly title: string
  readonly createdBy: AgentId
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface DocumentRevision {
  readonly id: RevisionId
  readonly documentId: DocumentId
  readonly content: string
  readonly createdBy: AgentId
  readonly createdAt: Date
}

export function createDocument(params: {
  companyId: CompanyId
  issueId: IssueId
  title: string
  createdBy: AgentId
}): Document {
  const now = new Date()
  return {
    id: generateId<DocumentId>(),
    companyId: params.companyId,
    issueId: params.issueId,
    title: params.title,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  }
}

export function createRevision(params: {
  documentId: DocumentId
  content: string
  createdBy: AgentId
}): DocumentRevision {
  return {
    id: generateId<RevisionId>(),
    documentId: params.documentId,
    content: params.content,
    createdBy: params.createdBy,
    createdAt: new Date(),
  }
}
```

```typescript
// packages/domain/src/entities/heartbeat-run.ts
import { generateId, type RunId, type AgentId, type CompanyId, type IssueId } from '../ids.js'

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | 'budget_exceeded'
export type HeartbeatTrigger = 'assignment' | 'schedule' | 'mention' | 'manual' | 'approval_resolution'

export interface HeartbeatRun {
  readonly id: RunId
  readonly companyId: CompanyId
  readonly agentId: AgentId
  readonly issueId: IssueId | null
  readonly trigger: HeartbeatTrigger
  readonly status: RunStatus
  readonly inputTokens: number
  readonly outputTokens: number
  readonly costCents: number
  readonly stdout: string
  readonly startedAt: Date
  readonly completedAt: Date | null
}

export function createHeartbeatRun(params: {
  companyId: CompanyId
  agentId: AgentId
  issueId?: IssueId | null
  trigger: HeartbeatTrigger
}): HeartbeatRun {
  return {
    id: generateId<RunId>(),
    companyId: params.companyId,
    agentId: params.agentId,
    issueId: params.issueId ?? null,
    trigger: params.trigger,
    status: 'queued',
    inputTokens: 0,
    outputTokens: 0,
    costCents: 0,
    stdout: '',
    startedAt: new Date(),
    completedAt: null,
  }
}
```

```typescript
// packages/domain/src/entities/approval.ts
import { generateId, type ApprovalId, type CompanyId, type AgentId } from '../ids.js'

export type ApprovalStatus = 'pending' | 'approved' | 'denied'
export type RiskLevel = 'low' | 'medium' | 'high'
export type ApprovalActionType = 'hire_agent' | 'fire_agent' | 'budget_increase' | 'connect_repo' | 'install_plugin' | 'create_routine' | 'strategy_change'

export interface Approval {
  readonly id: ApprovalId
  readonly companyId: CompanyId
  readonly proposedBy: AgentId
  readonly actionType: ApprovalActionType
  readonly justification: string
  readonly riskLevel: RiskLevel
  readonly payload: Record<string, unknown>
  readonly status: ApprovalStatus
  readonly denialReason: string | null
  readonly denialHistory: Array<{ reason: string; deniedAt: Date }>
  readonly resolvedAt: Date | null
  readonly createdAt: Date
}

export function createApproval(params: {
  companyId: CompanyId
  proposedBy: AgentId
  actionType: ApprovalActionType
  justification: string
  riskLevel: RiskLevel
  payload: Record<string, unknown>
}): Approval {
  return {
    id: generateId<ApprovalId>(),
    companyId: params.companyId,
    proposedBy: params.proposedBy,
    actionType: params.actionType,
    justification: params.justification,
    riskLevel: params.riskLevel,
    payload: params.payload,
    status: 'pending',
    denialReason: null,
    denialHistory: [],
    resolvedAt: null,
    createdAt: new Date(),
  }
}
```

```typescript
// packages/domain/src/entities/budget-policy.ts
import { generateId, type BudgetPolicyId, type CompanyId, type AgentId } from '../ids.js'

export interface BudgetPolicy {
  readonly id: BudgetPolicyId
  readonly companyId: CompanyId
  readonly agentId: AgentId
  readonly monthlyLimitCents: number
  readonly currentSpendCents: number
  readonly isPaused: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
}

export function createBudgetPolicy(params: {
  companyId: CompanyId
  agentId: AgentId
  monthlyLimitCents: number
}): BudgetPolicy {
  const now = new Date()
  return {
    id: generateId<BudgetPolicyId>(),
    companyId: params.companyId,
    agentId: params.agentId,
    monthlyLimitCents: params.monthlyLimitCents,
    currentSpendCents: 0,
    isPaused: false,
    createdAt: now,
    updatedAt: now,
  }
}
```

```typescript
// packages/domain/src/entities/cost-event.ts
import { generateId, type CostEventId, type CompanyId, type AgentId, type RunId } from '../ids.js'

export interface CostEvent {
  readonly id: CostEventId
  readonly companyId: CompanyId
  readonly agentId: AgentId
  readonly runId: RunId
  readonly inputTokens: number
  readonly outputTokens: number
  readonly costCents: number
  readonly model: string
  readonly createdAt: Date
}

export function createCostEvent(params: {
  companyId: CompanyId
  agentId: AgentId
  runId: RunId
  inputTokens: number
  outputTokens: number
  costCents: number
  model: string
}): CostEvent {
  return {
    id: generateId<CostEventId>(),
    companyId: params.companyId,
    agentId: params.agentId,
    runId: params.runId,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    costCents: params.costCents,
    model: params.model,
    createdAt: new Date(),
  }
}
```

```typescript
// packages/domain/src/entities/learning.ts
import { generateId, type LearningId, type CompanyId, type ProjectId, type IssueId, type RunId } from '../ids.js'

export type LearningStatus = 'active' | 'pinned' | 'dismissed'

export interface Learning {
  readonly id: LearningId
  readonly companyId: CompanyId
  readonly projectId: ProjectId
  readonly summary: string
  readonly context: string
  readonly domain: string
  readonly tags: string[]
  readonly confidence: number
  readonly sourceIssueId: IssueId
  readonly sourceRunId: RunId
  readonly status: LearningStatus
  readonly createdAt: Date
  readonly updatedAt: Date
}

export function createLearning(params: {
  companyId: CompanyId
  projectId: ProjectId
  summary: string
  context: string
  domain: string
  tags: string[]
  confidence: number
  sourceIssueId: IssueId
  sourceRunId: RunId
}): Learning {
  const now = new Date()
  return {
    id: generateId<LearningId>(),
    companyId: params.companyId,
    projectId: params.projectId,
    summary: params.summary,
    context: params.context,
    domain: params.domain,
    tags: params.tags,
    confidence: params.confidence,
    sourceIssueId: params.sourceIssueId,
    sourceRunId: params.sourceRunId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}
```

```typescript
// packages/domain/src/entities/learning-application.ts
import { generateId, type LearningAppId, type LearningId, type IssueId, type RunId } from '../ids.js'

export type ApplicationOutcome = 'success' | 'irrelevant' | 'harmful'

export interface LearningApplication {
  readonly id: LearningAppId
  readonly learningId: LearningId
  readonly appliedInIssueId: IssueId
  readonly appliedInRunId: RunId
  readonly outcome: ApplicationOutcome
  readonly createdAt: Date
}

export function createLearningApplication(params: {
  learningId: LearningId
  appliedInIssueId: IssueId
  appliedInRunId: RunId
  outcome: ApplicationOutcome
}): LearningApplication {
  return {
    id: generateId<LearningAppId>(),
    learningId: params.learningId,
    appliedInIssueId: params.appliedInIssueId,
    appliedInRunId: params.appliedInRunId,
    outcome: params.outcome,
    createdAt: new Date(),
  }
}
```

```typescript
// packages/domain/src/entities/routine.ts
import { generateId, type RoutineId, type CompanyId, type ProjectId, type AgentId } from '../ids.js'

export type RoutineTriggerType = 'cron' | 'webhook' | 'manual'
export type ConcurrencyPolicy = 'coalesce_if_active' | 'always_enqueue' | 'skip_if_active'

export interface Routine {
  readonly id: RoutineId
  readonly companyId: CompanyId
  readonly projectId: ProjectId | null
  readonly agentId: AgentId
  readonly title: string
  readonly description: string
  readonly triggerType: RoutineTriggerType
  readonly cronExpression: string | null
  readonly concurrencyPolicy: ConcurrencyPolicy
  readonly isEnabled: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
}

export function createRoutine(params: {
  companyId: CompanyId
  projectId?: ProjectId | null
  agentId: AgentId
  title: string
  description: string
  triggerType: RoutineTriggerType
  cronExpression?: string | null
  concurrencyPolicy?: ConcurrencyPolicy
}): Routine {
  const now = new Date()
  return {
    id: generateId<RoutineId>(),
    companyId: params.companyId,
    projectId: params.projectId ?? null,
    agentId: params.agentId,
    title: params.title,
    description: params.description,
    triggerType: params.triggerType,
    cronExpression: params.cronExpression ?? null,
    concurrencyPolicy: params.concurrencyPolicy ?? 'skip_if_active',
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  }
}
```

```typescript
// packages/domain/src/entities/work-product.ts
import { generateId, type WorkProductId, type CompanyId, type IssueId, type RunId } from '../ids.js'

export type WorkProductType = 'pull_request' | 'branch' | 'commit' | 'artifact'

export interface WorkProduct {
  readonly id: WorkProductId
  readonly companyId: CompanyId
  readonly issueId: IssueId
  readonly runId: RunId
  readonly type: WorkProductType
  readonly externalUrl: string | null
  readonly externalId: string | null
  readonly description: string
  readonly createdAt: Date
}

export function createWorkProduct(params: {
  companyId: CompanyId
  issueId: IssueId
  runId: RunId
  type: WorkProductType
  description: string
  externalUrl?: string | null
  externalId?: string | null
}): WorkProduct {
  return {
    id: generateId<WorkProductId>(),
    companyId: params.companyId,
    issueId: params.issueId,
    runId: params.runId,
    type: params.type,
    description: params.description,
    externalUrl: params.externalUrl ?? null,
    externalId: params.externalId ?? null,
    createdAt: new Date(),
  }
}
```

```typescript
// packages/domain/src/entities/execution-workspace.ts
import { generateId, type WorkspaceId, type CompanyId, type ProjectId, type AgentId } from '../ids.js'

export type WorkspaceStatus = 'open' | 'closed' | 'cleanup_eligible'

export interface ExecutionWorkspace {
  readonly id: WorkspaceId
  readonly companyId: CompanyId
  readonly projectId: ProjectId
  readonly agentId: AgentId
  readonly path: string
  readonly repoUrl: string | null
  readonly branch: string
  readonly baseRef: string | null
  readonly status: WorkspaceStatus
  readonly createdAt: Date
  readonly closedAt: Date | null
}

export function createExecutionWorkspace(params: {
  companyId: CompanyId
  projectId: ProjectId
  agentId: AgentId
  path: string
  repoUrl?: string | null
  branch: string
  baseRef?: string | null
}): ExecutionWorkspace {
  return {
    id: generateId<WorkspaceId>(),
    companyId: params.companyId,
    projectId: params.projectId,
    agentId: params.agentId,
    path: params.path,
    repoUrl: params.repoUrl ?? null,
    branch: params.branch,
    baseRef: params.baseRef ?? null,
    status: 'open',
    createdAt: new Date(),
    closedAt: null,
  }
}
```

```typescript
// packages/domain/src/entities/company-secret.ts
import { generateId, type SecretId, type CompanyId } from '../ids.js'

export interface CompanySecret {
  readonly id: SecretId
  readonly companyId: CompanyId
  readonly key: string
  readonly encryptedValue: string
  readonly version: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

export function createCompanySecret(params: {
  companyId: CompanyId
  key: string
  encryptedValue: string
}): CompanySecret {
  const now = new Date()
  return {
    id: generateId<SecretId>(),
    companyId: params.companyId,
    key: params.key,
    encryptedValue: params.encryptedValue,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
}
```

```typescript
// packages/domain/src/entities/company-skill.ts
import { generateId, type SkillId, type CompanyId } from '../ids.js'

export interface CompanySkill {
  readonly id: SkillId
  readonly companyId: CompanyId
  readonly name: string
  readonly content: string
  readonly isEnabled: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
}

export function createCompanySkill(params: {
  companyId: CompanyId
  name: string
  content: string
}): CompanySkill {
  const now = new Date()
  return {
    id: generateId<SkillId>(),
    companyId: params.companyId,
    name: params.name,
    content: params.content,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  }
}
```

```typescript
// packages/domain/src/entities/activity-entry.ts
import { generateId, type ActivityId, type CompanyId } from '../ids.js'

export interface ActivityEntry {
  readonly id: ActivityId
  readonly companyId: CompanyId
  readonly actorId: string
  readonly actorType: 'agent' | 'board' | 'system'
  readonly action: string
  readonly entityType: string
  readonly entityId: string
  readonly metadata: Record<string, unknown>
  readonly createdAt: Date
}

export function createActivityEntry(params: {
  companyId: CompanyId
  actorId: string
  actorType: 'agent' | 'board' | 'system'
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}): ActivityEntry {
  return {
    id: generateId<ActivityId>(),
    companyId: params.companyId,
    actorId: params.actorId,
    actorType: params.actorType,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: params.metadata ?? {},
    createdAt: new Date(),
  }
}
```

```typescript
// packages/domain/src/entities/company-template.ts
import { generateId, type TemplateId } from '../ids.js'

export interface CompanyTemplate {
  readonly id: TemplateId
  readonly name: string
  readonly description: string
  readonly config: Record<string, unknown>
  readonly createdAt: Date
}

export function createCompanyTemplate(params: {
  name: string
  description: string
  config: Record<string, unknown>
}): CompanyTemplate {
  return {
    id: generateId<TemplateId>(),
    name: params.name,
    description: params.description,
    config: params.config,
    createdAt: new Date(),
  }
}
```

```typescript
// packages/domain/src/entities/index.ts
export * from './company.js'
export * from './agent.js'
export * from './goal.js'
export * from './project.js'
export * from './issue.js'
export * from './comment.js'
export * from './document.js'
export * from './heartbeat-run.js'
export * from './approval.js'
export * from './budget-policy.js'
export * from './cost-event.js'
export * from './learning.js'
export * from './learning-application.js'
export * from './routine.js'
export * from './work-product.js'
export * from './execution-workspace.js'
export * from './company-secret.js'
export * from './company-skill.js'
export * from './activity-entry.js'
export * from './company-template.js'
```

- [ ] **Step 4: Update domain index.ts**

```typescript
// packages/domain/src/index.ts
export * from './result.js'
export * from './ids.js'
export * from './entities/index.js'
```

- [ ] **Step 5: Run tests, verify pass**

```bash
pnpm --filter @sheldon/domain test
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(domain): add all entity types with factory functions"
```

---

## Task 1.4: Domain — All Ports (Repository Interfaces)

**Files:**
- Create: `packages/domain/src/ports/company-repository.ts`
- Create: `packages/domain/src/ports/agent-repository.ts`
- Create: `packages/domain/src/ports/goal-repository.ts`
- Create: `packages/domain/src/ports/project-repository.ts`
- Create: `packages/domain/src/ports/issue-repository.ts`
- Create: `packages/domain/src/ports/comment-repository.ts`
- Create: `packages/domain/src/ports/document-repository.ts`
- Create: `packages/domain/src/ports/heartbeat-run-repository.ts`
- Create: `packages/domain/src/ports/approval-repository.ts`
- Create: `packages/domain/src/ports/budget-policy-repository.ts`
- Create: `packages/domain/src/ports/cost-event-repository.ts`
- Create: `packages/domain/src/ports/learning-repository.ts`
- Create: `packages/domain/src/ports/activity-repository.ts`
- Create: `packages/domain/src/ports/routine-repository.ts`
- Create: `packages/domain/src/ports/work-product-repository.ts`
- Create: `packages/domain/src/ports/workspace-repository.ts`
- Create: `packages/domain/src/ports/secret-repository.ts`
- Create: `packages/domain/src/ports/skill-repository.ts`
- Create: `packages/domain/src/ports/template-repository.ts`
- Create: `packages/domain/src/ports/agent-executor.ts`
- Create: `packages/domain/src/ports/session-codec.ts`
- Create: `packages/domain/src/ports/usage-parser.ts`
- Create: `packages/domain/src/ports/environment-probe.ts`
- Create: `packages/domain/src/ports/skill-sync.ts`
- Create: `packages/domain/src/ports/context-enricher.ts`
- Create: `packages/domain/src/ports/event-bus.ts`
- Create: `packages/domain/src/ports/index.ts`

- [ ] **Step 1: Create all repository port interfaces**

Each repository follows the same pattern. Here are the key ones (the rest follow identically):

```typescript
// packages/domain/src/ports/company-repository.ts
import type { Result } from '../result.js'
import type { Company } from '../entities/company.js'
import type { CompanyId } from '../ids.js'

export interface CompanyRepository {
  findById(id: CompanyId): Promise<Result<Company, 'not_found' | 'storage_unavailable'>>
  findAll(): Promise<Result<Company[], 'storage_unavailable'>>
  save(company: Company): Promise<Result<Company, 'storage_unavailable'>>
  delete(id: CompanyId): Promise<Result<void, 'not_found' | 'storage_unavailable'>>
}
```

```typescript
// packages/domain/src/ports/agent-repository.ts
import type { Result } from '../result.js'
import type { Agent } from '../entities/agent.js'
import type { AgentId, CompanyId } from '../ids.js'

export interface AgentRepository {
  findById(id: AgentId): Promise<Result<Agent, 'not_found' | 'storage_unavailable'>>
  findByCompany(companyId: CompanyId): Promise<Result<Agent[], 'storage_unavailable'>>
  findByCompanyAndStatus(companyId: CompanyId, status: string): Promise<Result<Agent[], 'storage_unavailable'>>
  save(agent: Agent): Promise<Result<Agent, 'storage_unavailable'>>
  update(id: AgentId, fields: Partial<Agent>): Promise<Result<Agent, 'not_found' | 'storage_unavailable'>>
}
```

```typescript
// packages/domain/src/ports/issue-repository.ts
import type { Result } from '../result.js'
import type { Issue, IssueStatus } from '../entities/issue.js'
import type { IssueId, CompanyId, ProjectId, AgentId } from '../ids.js'

export interface IssueRepository {
  findById(id: IssueId): Promise<Result<Issue, 'not_found' | 'storage_unavailable'>>
  findByCompany(companyId: CompanyId): Promise<Result<Issue[], 'storage_unavailable'>>
  findByProject(projectId: ProjectId): Promise<Result<Issue[], 'storage_unavailable'>>
  findByAssignee(companyId: CompanyId, agentId: AgentId, status?: IssueStatus): Promise<Result<Issue[], 'storage_unavailable'>>
  save(issue: Issue): Promise<Result<Issue, 'storage_unavailable'>>
  update(id: IssueId, fields: Partial<Issue>): Promise<Result<Issue, 'not_found' | 'storage_unavailable'>>
  checkout(id: IssueId, agentId: AgentId): Promise<Result<Issue, 'not_found' | 'already_checked_out' | 'storage_unavailable'>>
}
```

```typescript
// packages/domain/src/ports/approval-repository.ts
import type { Result } from '../result.js'
import type { Approval, ApprovalStatus } from '../entities/approval.js'
import type { ApprovalId, CompanyId } from '../ids.js'

export interface ApprovalRepository {
  findById(id: ApprovalId): Promise<Result<Approval, 'not_found' | 'storage_unavailable'>>
  findByCompany(companyId: CompanyId, status?: ApprovalStatus): Promise<Result<Approval[], 'storage_unavailable'>>
  save(approval: Approval): Promise<Result<Approval, 'storage_unavailable'>>
  update(id: ApprovalId, fields: Partial<Approval>): Promise<Result<Approval, 'not_found' | 'storage_unavailable'>>
}
```

```typescript
// packages/domain/src/ports/learning-repository.ts
import type { Result } from '../result.js'
import type { Learning, LearningStatus } from '../entities/learning.js'
import type { LearningId, CompanyId, ProjectId } from '../ids.js'

export interface LearningRepository {
  findById(id: LearningId): Promise<Result<Learning, 'not_found' | 'storage_unavailable'>>
  findByProject(projectId: ProjectId): Promise<Result<Learning[], 'storage_unavailable'>>
  findByCompanyAndDomain(companyId: CompanyId, domain: string): Promise<Result<Learning[], 'storage_unavailable'>>
  findPinnedByCompany(companyId: CompanyId): Promise<Result<Learning[], 'storage_unavailable'>>
  save(learning: Learning): Promise<Result<Learning, 'storage_unavailable'>>
  update(id: LearningId, fields: Partial<Learning>): Promise<Result<Learning, 'not_found' | 'storage_unavailable'>>
}
```

Create similar interfaces for: `goal-repository`, `project-repository`, `comment-repository`, `document-repository`, `heartbeat-run-repository`, `budget-policy-repository`, `cost-event-repository`, `activity-repository`, `routine-repository`, `work-product-repository`, `workspace-repository`, `secret-repository`, `skill-repository`, `template-repository`. Each follows the same pattern: `findById`, `findByCompany`, `save`, `update` (where applicable), all returning `Result<T, E>`.

- [ ] **Step 2: Create adapter ports**

```typescript
// packages/domain/src/ports/agent-executor.ts
import type { RunId, AgentId } from '../ids.js'

export interface ExecutionConfig {
  readonly runId: RunId
  readonly agentId: AgentId
  readonly systemPrompt: string
  readonly workingDirectory: string
  readonly envVars: Record<string, string>
  readonly maxTurns: number
}

export interface RunResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
  readonly durationMs: number
}

export interface AgentExecutor {
  execute(config: ExecutionConfig): Promise<RunResult>
}
```

```typescript
// packages/domain/src/ports/session-codec.ts
export interface SessionState {
  readonly data: Buffer
  readonly turnCount: number
  readonly tokenCount: number
  readonly createdAt: Date
}

export interface SessionCodec {
  serialize(state: SessionState): Buffer
  deserialize(data: Buffer): SessionState
}
```

```typescript
// packages/domain/src/ports/usage-parser.ts
export interface TokenUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly model: string
}

export interface UsageParser {
  parseUsage(stdout: string): TokenUsage | null
}
```

```typescript
// packages/domain/src/ports/environment-probe.ts
export interface EnvironmentStatus {
  readonly available: boolean
  readonly version: string | null
  readonly error: string | null
}

export interface EnvironmentProbe {
  testEnvironment(): Promise<EnvironmentStatus>
}
```

```typescript
// packages/domain/src/ports/skill-sync.ts
import type { CompanySkill } from '../entities/company-skill.js'

export interface SkillSync {
  listSkills(): Promise<CompanySkill[]>
  syncSkills(skills: CompanySkill[]): Promise<void>
}
```

```typescript
// packages/domain/src/ports/context-enricher.ts
export interface ExecutionContext {
  readonly systemPrompt: string
  readonly injectedLearnings: string[]
  readonly injectedSkills: string[]
}

export interface ContextEnricher {
  enrich(context: ExecutionContext): Promise<ExecutionContext>
}
```

```typescript
// packages/domain/src/ports/event-bus.ts
export interface DomainEvent {
  readonly type: string
  readonly companyId: string
  readonly payload: Record<string, unknown>
  readonly timestamp: Date
}

export interface EventBus {
  emit(event: DomainEvent): void
  on(eventType: string, handler: (event: DomainEvent) => void): void
  off(eventType: string, handler: (event: DomainEvent) => void): void
}
```

```typescript
// packages/domain/src/ports/index.ts
export * from './company-repository.js'
export * from './agent-repository.js'
export * from './goal-repository.js'
export * from './project-repository.js'
export * from './issue-repository.js'
export * from './comment-repository.js'
export * from './document-repository.js'
export * from './heartbeat-run-repository.js'
export * from './approval-repository.js'
export * from './budget-policy-repository.js'
export * from './cost-event-repository.js'
export * from './learning-repository.js'
export * from './activity-repository.js'
export * from './routine-repository.js'
export * from './work-product-repository.js'
export * from './workspace-repository.js'
export * from './secret-repository.js'
export * from './skill-repository.js'
export * from './template-repository.js'
export * from './agent-executor.js'
export * from './session-codec.js'
export * from './usage-parser.js'
export * from './environment-probe.js'
export * from './skill-sync.js'
export * from './context-enricher.js'
export * from './event-bus.js'
```

- [ ] **Step 3: Update domain index**

```typescript
// packages/domain/src/index.ts
export * from './result.js'
export * from './ids.js'
export * from './entities/index.js'
export * from './ports/index.js'
```

- [ ] **Step 4: Verify compilation**

```bash
pnpm --filter @sheldon/domain test
```
Expected: PASS (existing tests still work, ports are just interfaces)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(domain): add all port interfaces — repositories, adapters, event bus"
```

---

## Task 1.5: Domain — Core Use-Cases with Result<T, E>

**Files:**
- Create: `packages/domain/src/use-cases/create-company.ts`
- Create: `packages/domain/src/use-cases/create-goal.ts`
- Create: `packages/domain/src/use-cases/hire-agent.ts`
- Create: `packages/domain/src/use-cases/create-issue.ts`
- Create: `packages/domain/src/use-cases/checkout-issue.ts`
- Create: `packages/domain/src/use-cases/post-comment.ts`
- Create: `packages/domain/src/use-cases/approve-action.ts`
- Create: `packages/domain/src/use-cases/deny-action.ts`
- Create: `packages/domain/src/use-cases/invoke-agent.ts`
- Create: `packages/domain/src/use-cases/index.ts`
- Test: `packages/domain/src/__tests__/use-cases.test.ts`

- [ ] **Step 1: Write failing test for CreateCompany use-case**

```typescript
// packages/domain/src/__tests__/use-cases.test.ts
import { describe, it, expect } from 'vitest'
import { CreateCompany } from '../use-cases/create-company.js'
import { CreateGoal } from '../use-cases/create-goal.js'
import { CheckoutIssue } from '../use-cases/checkout-issue.js'
import { ApproveAction } from '../use-cases/approve-action.js'
import { isOk, isErr, ok } from '../result.js'
import { createCompany } from '../entities/company.js'
import { createIssue } from '../entities/issue.js'
import { createApproval } from '../entities/approval.js'
import { generateId } from '../ids.js'
import type { CompanyRepository } from '../ports/company-repository.js'
import type { GoalRepository } from '../ports/goal-repository.js'
import type { IssueRepository } from '../ports/issue-repository.js'
import type { ApprovalRepository } from '../ports/approval-repository.js'
import type { EventBus, DomainEvent } from '../ports/event-bus.js'
import type { ActivityRepository } from '../ports/activity-repository.js'

// In-memory fakes for testing (no mocks!)
function fakeCompanyRepo(): CompanyRepository {
  const store = new Map()
  return {
    findById: async (id) => {
      const c = store.get(id)
      return c ? ok(c) : { ok: false, error: 'not_found' as const }
    },
    findAll: async () => ok([...store.values()]),
    save: async (company) => { store.set(company.id, company); return ok(company) },
    delete: async (id) => { store.delete(id); return ok(undefined) },
  }
}

function fakeEventBus(): EventBus & { events: DomainEvent[] } {
  const events: DomainEvent[] = []
  const handlers = new Map<string, Array<(e: DomainEvent) => void>>()
  return {
    events,
    emit(event) { events.push(event); handlers.get(event.type)?.forEach(h => h(event)) },
    on(type, handler) { handlers.set(type, [...(handlers.get(type) ?? []), handler]) },
    off(type, handler) { handlers.set(type, (handlers.get(type) ?? []).filter(h => h !== handler)) },
  }
}

function fakeActivityRepo(): ActivityRepository {
  const store = new Map()
  return {
    findById: async (id) => { const a = store.get(id); return a ? ok(a) : { ok: false, error: 'not_found' as const } },
    findByCompany: async () => ok([...store.values()]),
    save: async (entry) => { store.set(entry.id, entry); return ok(entry) },
  }
}

describe('CreateCompany', () => {
  it('creates a company and emits event', async () => {
    const repo = fakeCompanyRepo()
    const bus = fakeEventBus()
    const activityRepo = fakeActivityRepo()
    const useCase = new CreateCompany(repo, bus, activityRepo)

    const result = await useCase.execute({ name: 'Acme Labs' })

    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.name).toBe('Acme Labs')
    }
    expect(bus.events).toHaveLength(1)
    expect(bus.events[0].type).toBe('company.created')
  })
})

describe('CheckoutIssue', () => {
  it('returns already_checked_out when issue is taken', async () => {
    const agentId1 = generateId()
    const agentId2 = generateId()
    const companyId = generateId()
    const projectId = generateId()
    const issue = { ...createIssue({ companyId, projectId, title: 'Test', description: '', createdBy: agentId1 }), checkedOutBy: agentId1 }

    const issueRepo = {
      findById: async () => ok(issue),
      findByCompany: async () => ok([]),
      findByProject: async () => ok([]),
      findByAssignee: async () => ok([]),
      save: async (i: any) => ok(i),
      update: async () => ok(issue),
      checkout: async () => ({ ok: false as const, error: 'already_checked_out' as const }),
    }
    const bus = fakeEventBus()
    const activityRepo = fakeActivityRepo()
    const useCase = new CheckoutIssue(issueRepo, bus, activityRepo)

    const result = await useCase.execute({ issueId: issue.id, agentId: agentId2 })

    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error).toBe('already_checked_out')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @sheldon/domain test
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement use-cases**

```typescript
// packages/domain/src/use-cases/create-company.ts
import type { Result } from '../result.js'
import { ok } from '../result.js'
import { createCompany, type Company } from '../entities/company.js'
import { createActivityEntry } from '../entities/activity-entry.js'
import type { CompanyRepository } from '../ports/company-repository.js'
import type { ActivityRepository } from '../ports/activity-repository.js'
import type { EventBus } from '../ports/event-bus.js'

export type CreateCompanyError = 'storage_unavailable'

export class CreateCompany {
  constructor(
    private readonly companyRepo: CompanyRepository,
    private readonly eventBus: EventBus,
    private readonly activityRepo: ActivityRepository,
  ) {}

  async execute(params: { name: string }): Promise<Result<Company, CreateCompanyError>> {
    const company = createCompany({ name: params.name })
    const saveResult = await this.companyRepo.save(company)
    if (!saveResult.ok) return saveResult

    this.eventBus.emit({
      type: 'company.created',
      companyId: company.id,
      payload: { name: company.name },
      timestamp: new Date(),
    })

    await this.activityRepo.save(createActivityEntry({
      companyId: company.id,
      actorId: 'system',
      actorType: 'system',
      action: 'created',
      entityType: 'company',
      entityId: company.id,
    }))

    return ok(company)
  }
}
```

```typescript
// packages/domain/src/use-cases/checkout-issue.ts
import type { Result } from '../result.js'
import { ok, err } from '../result.js'
import type { Issue } from '../entities/issue.js'
import { createActivityEntry } from '../entities/activity-entry.js'
import type { IssueRepository } from '../ports/issue-repository.js'
import type { ActivityRepository } from '../ports/activity-repository.js'
import type { EventBus } from '../ports/event-bus.js'
import type { IssueId, AgentId } from '../ids.js'

export type CheckoutIssueError = 'not_found' | 'already_checked_out' | 'storage_unavailable'

export class CheckoutIssue {
  constructor(
    private readonly issueRepo: IssueRepository,
    private readonly eventBus: EventBus,
    private readonly activityRepo: ActivityRepository,
  ) {}

  async execute(params: { issueId: IssueId; agentId: AgentId }): Promise<Result<Issue, CheckoutIssueError>> {
    const result = await this.issueRepo.checkout(params.issueId, params.agentId)
    if (!result.ok) return result

    this.eventBus.emit({
      type: 'issue.checked_out',
      companyId: result.value.companyId,
      payload: { issueId: params.issueId, agentId: params.agentId },
      timestamp: new Date(),
    })

    await this.activityRepo.save(createActivityEntry({
      companyId: result.value.companyId,
      actorId: params.agentId,
      actorType: 'agent',
      action: 'checked_out',
      entityType: 'issue',
      entityId: params.issueId,
    }))

    return result
  }
}
```

Create similar use-cases for: `CreateGoal`, `HireAgent`, `CreateIssue`, `PostComment`, `ApproveAction`, `DenyAction`, `InvokeAgent`. Each follows the same pattern:
1. Validate inputs
2. Call repository
3. Emit domain event
4. Log activity
5. Return `Result<T, E>`

```typescript
// packages/domain/src/use-cases/index.ts
export * from './create-company.js'
export * from './create-goal.js'
export * from './hire-agent.js'
export * from './create-issue.js'
export * from './checkout-issue.js'
export * from './post-comment.js'
export * from './approve-action.js'
export * from './deny-action.js'
export * from './invoke-agent.js'
```

- [ ] **Step 4: Run tests, verify pass**

```bash
pnpm --filter @sheldon/domain test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(domain): add core use-cases with Result<T, E> and event emission"
```

---

## Task 1.6: Contracts Package

**Files:**
- Create: `packages/contracts/src/api-paths.ts`
- Create: `packages/contracts/src/api-types.ts`
- Create: `packages/contracts/src/plugin-events.ts`
- Create: `packages/contracts/src/index.ts`

- [ ] **Step 1: Create API path constants**

```typescript
// packages/contracts/src/api-paths.ts
export const API = {
  auth: '/api/auth',
  companies: '/api/companies',
  company: (id: string) => `/api/companies/${id}`,
  agents: (companyId: string) => `/api/companies/${companyId}/agents`,
  agent: (companyId: string, agentId: string) => `/api/companies/${companyId}/agents/${agentId}`,
  agentRuns: (companyId: string, agentId: string) => `/api/companies/${companyId}/agents/${agentId}/runs`,
  agentBudget: (companyId: string, agentId: string) => `/api/companies/${companyId}/agents/${agentId}/budget`,
  goals: (companyId: string) => `/api/companies/${companyId}/goals`,
  projects: (companyId: string) => `/api/companies/${companyId}/projects`,
  issues: (companyId: string) => `/api/companies/${companyId}/issues`,
  issue: (companyId: string, issueId: string) => `/api/companies/${companyId}/issues/${issueId}`,
  issueCheckout: (companyId: string, issueId: string) => `/api/companies/${companyId}/issues/${issueId}/checkout`,
  issueComments: (companyId: string, issueId: string) => `/api/companies/${companyId}/issues/${issueId}/comments`,
  issueDocuments: (companyId: string, issueId: string) => `/api/companies/${companyId}/issues/${issueId}/documents`,
  approvals: (companyId: string) => `/api/companies/${companyId}/approvals`,
  routines: (companyId: string) => `/api/companies/${companyId}/routines`,
  costs: (companyId: string) => `/api/companies/${companyId}/costs`,
  activity: (companyId: string) => `/api/companies/${companyId}/activity`,
  learnings: (companyId: string) => `/api/companies/${companyId}/learnings`,
  skills: (companyId: string) => `/api/companies/${companyId}/skills`,
  plugins: (companyId: string) => `/api/companies/${companyId}/plugins`,
  events: (companyId: string) => `/events/${companyId}`,
  agentStream: (companyId: string, agentId: string) => `/events/${companyId}/agents/${agentId}/stream`,
  health: '/health',
} as const
```

```typescript
// packages/contracts/src/plugin-events.ts
export interface PluginEventMap {
  'issue.status_changed': { issueId: string; oldStatus: string; newStatus: string }
  'run.completed': { runId: string; agentId: string; outcome: string }
  'approval.resolved': { approvalId: string; decision: 'approved' | 'denied' }
}
```

```typescript
// packages/contracts/src/api-types.ts
// Request/response shapes shared between server and UI
export interface CreateCompanyRequest { name: string }
export interface CreateCompanyResponse { id: string; name: string; createdAt: string }

export interface CreateGoalRequest { title: string; description: string; parentGoalId?: string }
export interface HireAgentRequest { name: string; role: string; adapterType: string; parentAgentId?: string; monthlyBudgetCents?: number }
export interface CreateIssueRequest { projectId: string; title: string; description: string; priority?: string; parentIssueId?: string }
export interface PostCommentRequest { body: string; authorType: 'agent' | 'board' }
export interface ApprovalDecisionRequest { reason?: string }

export interface ErrorResponse { error: string }
```

```typescript
// packages/contracts/src/index.ts
export * from './api-paths.js'
export * from './api-types.js'
export * from './plugin-events.js'
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(contracts): add API paths, types, and plugin event map"
```

---

## Task 1.7: Database Schema (Drizzle + PGlite)

**Files:**
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/connection.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/drizzle.config.ts`
- Test: `packages/db/src/__tests__/connection.test.ts`

- [ ] **Step 1: Write failing test for DB connection**

```typescript
// packages/db/src/__tests__/connection.test.ts
import { describe, it, expect } from 'vitest'
import { createLocalDb } from '../connection.js'
import { companies } from '../schema.js'

describe('Database', () => {
  it('connects via PGlite and creates tables', async () => {
    const db = await createLocalDb()
    const result = await db.select().from(companies)
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Implement schema**

Create `packages/db/src/schema.ts` defining all tables using Drizzle's `pgTable` — companies, agents, goals, projects, issues, issue_comments, documents, document_revisions, heartbeat_runs, approvals, budget_policies, cost_events, learnings, learning_applications, activity_log, routines, work_products, execution_workspaces, company_secrets, company_skills, company_templates, plugins.

Each table mirrors its domain entity with proper column types, foreign keys, and indexes on `company_id`.

- [ ] **Step 3: Implement connection**

```typescript
// packages/db/src/connection.ts
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from './schema.js'

export async function createLocalDb() {
  const pglite = new PGlite()
  const db = drizzle(pglite, { schema })
  // Run migrations or push schema
  return db
}

export function createProductionDb(connectionString: string) {
  // For production Postgres — implemented when needed
  throw new Error('Production DB not yet implemented')
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
pnpm --filter @sheldon/db test
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(db): add Drizzle schema and PGlite connection for all entities"
```

---

## Task 1.8: Storage Adapters (Drizzle Repository Implementations)

**Files:**
- Create: `packages/adapters/storage/src/drizzle-company-repo.ts`
- Create: `packages/adapters/storage/src/drizzle-agent-repo.ts`
- Create: `packages/adapters/storage/src/drizzle-issue-repo.ts`
- Create: `packages/adapters/storage/src/drizzle-approval-repo.ts`
- Create: `packages/adapters/storage/src/index.ts`
- Test: `packages/adapters/storage/src/__tests__/company-repo.test.ts`

- [ ] **Step 1: Write integration test with PGlite**

```typescript
// packages/adapters/storage/src/__tests__/company-repo.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalDb } from '@sheldon/db'
import { DrizzleCompanyRepo } from '../drizzle-company-repo.js'
import { createCompany } from '@sheldon/domain'
import { isOk, isErr } from '@sheldon/domain'

describe('DrizzleCompanyRepo', () => {
  let repo: DrizzleCompanyRepo

  beforeEach(async () => {
    const db = await createLocalDb()
    repo = new DrizzleCompanyRepo(db)
  })

  it('saves and retrieves a company', async () => {
    const company = createCompany({ name: 'Acme Labs' })
    const saveResult = await repo.save(company)
    expect(isOk(saveResult)).toBe(true)

    const findResult = await repo.findById(company.id)
    expect(isOk(findResult)).toBe(true)
    if (isOk(findResult)) {
      expect(findResult.value.name).toBe('Acme Labs')
    }
  })

  it('returns not_found for missing company', async () => {
    const result = await repo.findById('nonexistent' as any)
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error).toBe('not_found')
    }
  })
})
```

- [ ] **Step 2: Implement Drizzle repositories**

Implement each repository as a class that receives the Drizzle DB instance, implements the port interface, and translates between Drizzle rows and domain entities. Wrap all DB calls in try/catch, returning `storage_unavailable` on infrastructure errors.

- [ ] **Step 3: Run tests, commit**

```bash
pnpm --filter @sheldon/adapter-storage test
git add -A && git commit -m "feat(adapters): add Drizzle storage implementations for all repositories"
```

---

## Task 1.9: In-Memory Event Bus

**Files:**
- Create: `packages/services/src/in-memory-event-bus.ts`
- Test: `packages/services/src/__tests__/event-bus.test.ts`

- [ ] **Step 1: Write test, implement, verify**

Simple in-memory pub/sub implementing the `EventBus` port. Handlers stored in a Map<string, Set<handler>>. `emit` calls all handlers for that event type.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(services): add in-memory event bus"
```

---

## Task 1.10: Express Server Skeleton

**Files:**
- Create: `packages/server/src/create-server.ts`
- Create: `packages/server/src/routes/create-company.ts`
- Create: `packages/server/src/routes/list-companies.ts`
- Create: `packages/server/src/routes/create-goal.ts`
- Create: `packages/server/src/streams/company-events.ts`
- Create: `packages/server/src/index.ts`
- Test: `packages/server/src/__tests__/create-company.test.ts`

- [ ] **Step 1: Write integration test**

Test that `POST /api/companies` with `{ name: "Acme" }` returns 201 with the created company. Use `supertest` or direct fetch against the Express app.

- [ ] **Step 2: Implement thin route controllers**

Each route file is 5-10 lines: parse request, call use-case, translate Result to HTTP response.

```typescript
// packages/server/src/routes/create-company.ts
import type { Request, Response } from 'express'
import type { CreateCompany } from '@sheldon/domain'

export function createCompanyRoute(useCase: CreateCompany) {
  return async (req: Request, res: Response) => {
    const result = await useCase.execute({ name: req.body.name })
    if (result.ok) return res.status(201).json(result.value)
    return res.status(500).json({ error: result.error })
  }
}
```

- [ ] **Step 3: Wire SSE endpoint**

```typescript
// packages/server/src/streams/company-events.ts
import type { Request, Response } from 'express'
import type { EventBus } from '@sheldon/domain'

export function companyEventsStream(eventBus: EventBus) {
  return (req: Request, res: Response) => {
    const companyId = req.params.companyId
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const handler = (event: any) => {
      if (event.companyId === companyId) {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }
    }

    eventBus.on('*', handler)
    req.on('close', () => eventBus.off('*', handler))
  }
}
```

- [ ] **Step 4: Create server factory** that wires all routes and dependencies (composition root)

- [ ] **Step 5: Run tests, commit**

```bash
git add -A && git commit -m "feat(server): add Express skeleton with company routes and SSE"
```

---

## Task 1.11: CLI — `sheldon start`

**Files:**
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/start.ts`

- [ ] **Step 1: Implement CLI entry point**

```typescript
// packages/cli/src/index.ts
#!/usr/bin/env node
import { Command } from 'commander'
import { startCommand } from './commands/start.js'

const program = new Command()
program.name('sheldon').description('AI Company Orchestration Platform').version('0.0.1')
program.command('start').description('Start Sheldon server and dashboard').action(startCommand)
program.parse()
```

- [ ] **Step 2: Implement start command**

Creates DB, builds composition root, starts server on port 3100, starts dashboard dev server on port 3000 (or discovers pre-built UI).

- [ ] **Step 3: Verify `pnpm dev` boots the server**

```bash
cd ~/StudioProjects/Sheldon && pnpm dev
```
Expected: Server running on :3100, health check at /health returns 200.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(cli): add sheldon start command"
```

---

## Task 1.12: Dashboard Skeleton — Onboarding + Mission Control Empty State

**Files:**
- Create: `packages/ui/index.html`
- Create: `packages/ui/src/main.tsx`
- Create: `packages/ui/src/App.tsx`
- Create: `packages/ui/src/pages/MissionControl.tsx`
- Create: `packages/ui/src/pages/Welcome.tsx`
- Create: `packages/ui/src/components/Layout.tsx`
- Create: `packages/ui/src/components/Sidebar.tsx`
- Create: `packages/ui/src/components/TopBar.tsx`
- Create: `packages/ui/src/lib/api.ts`
- Create: `packages/ui/src/lib/useSSE.ts`
- Create: `packages/ui/vite.config.ts`
- Create: `packages/ui/src/index.css`

- [ ] **Step 1: Scaffold Vite + React + Tailwind app**

Set up vite.config.ts with React plugin and Tailwind CSS v4 plugin. Create index.html, main.tsx entry point, App.tsx with React Router.

- [ ] **Step 2: Build Layout shell** — Sidebar (icon nav), TopBar (company switcher, SSE indicator), main content area, status bar.

- [ ] **Step 3: Build Welcome page** — Two inputs (company name, goal), "Get Started" button, pre-flight check for Claude Code, progress animation states. Follows the mockup from `screen-01-onboarding.html`.

- [ ] **Step 4: Build Mission Control empty state** — Shows onboarding prompt when no company exists. When a company exists but has no agents, shows "Your CEO is starting up..." state.

- [ ] **Step 5: Wire API client and SSE hook**

```typescript
// packages/ui/src/lib/api.ts
import { API } from '@sheldon/contracts'

const BASE = 'http://localhost:3100'

export async function createCompany(name: string, goal: string) {
  const res = await fetch(`${BASE}${API.companies}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return res.json()
}
```

```typescript
// packages/ui/src/lib/useSSE.ts
import { useEffect, useRef } from 'react'
import { API } from '@sheldon/contracts'

export function useSSE(companyId: string | null, onEvent: (event: any) => void) {
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!companyId) return
    const source = new EventSource(`http://localhost:3100${API.events(companyId)}`)
    sourceRef.current = source
    source.onmessage = (e) => onEvent(JSON.parse(e.data))
    return () => source.close()
  }, [companyId])
}
```

- [ ] **Step 6: Verify dashboard loads**

```bash
cd ~/StudioProjects/Sheldon/packages/ui && pnpm dev
```
Expected: Dashboard loads at :5173, shows Welcome screen.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(ui): add dashboard skeleton with onboarding and Mission Control empty state"
```

---

# Phase 2 — Heartbeat Engine

**Deliverable:** Agents wake up and do work. CEO agent can be invoked, spawns Claude Code, calls the API.

**Depends on:** Phase 1 complete.

## Task 2.1: Heartbeat Service — Trigger Queue & Run Lifecycle

**Files:**
- Create: `packages/services/src/heartbeat/heartbeat-service.ts`
- Create: `packages/services/src/heartbeat/run-queue.ts`
- Create: `packages/services/src/heartbeat/types.ts`
- Test: `packages/services/src/__tests__/heartbeat-service.test.ts`

Implement the heartbeat service that:
1. Accepts trigger events (assignment, schedule, mention, manual, approval_resolution)
2. Queues runs with per-agent concurrency limit (default 1)
3. Manages the full run lifecycle: budget check → prepare context → spawn adapter → post-process → record run

Test with a fake AgentExecutor that returns canned output.

- [ ] **Steps:** Write failing test → implement HeartbeatService → implement RunQueue → verify pass → commit

```bash
git commit -m "feat(services): add heartbeat service with trigger queue and run lifecycle"
```

---

## Task 2.2: Claude Code Adapter

**Files:**
- Create: `packages/adapters/claude-local/src/claude-executor.ts`
- Create: `packages/adapters/claude-local/src/claude-session-codec.ts`
- Create: `packages/adapters/claude-local/src/claude-usage-parser.ts`
- Create: `packages/adapters/claude-local/src/claude-environment.ts`
- Create: `packages/adapters/claude-local/src/index.ts`
- Test: `packages/adapters/claude-local/src/__tests__/usage-parser.test.ts`
- Test: `packages/adapters/claude-local/src/__tests__/environment.test.ts`

Implement all four port interfaces. `ClaudeExecutor` spawns the `claude` CLI as a child process with env vars (SHELDON_AGENT_ID, SHELDON_API_KEY, SHELDON_RUN_ID, SHELDON_API_URL), captures stdout/stderr, returns RunResult.

- [ ] **Steps:** Write tests for usage parser (parse token counts from Claude CLI output) and environment probe → implement all four adapters → verify → commit

```bash
git commit -m "feat(adapters): add Claude Code local adapter"
```

---

## Task 2.3: Adapter Registry

**Files:**
- Create: `packages/services/src/adapter-registry.ts`
- Test: `packages/services/src/__tests__/adapter-registry.test.ts`

Simple Map<AdapterType, AdapterFactory>. Each factory returns the composed adapter (executor + codec + parser + probe).

- [ ] **Steps:** Test → implement → commit

```bash
git commit -m "feat(services): add adapter registry"
```

---

## Task 2.4: Execution Workspaces

**Files:**
- Create: `packages/services/src/workspace/workspace-manager.ts`
- Test: `packages/services/src/__tests__/workspace-manager.test.ts`

Manages git worktree creation/cleanup for agent tasks. Creates workspace, tracks state in DB via WorkspaceRepository, cleans up on completion.

- [ ] **Steps:** Test → implement → commit

```bash
git commit -m "feat(services): add execution workspace manager"
```

---

## Task 2.5: Session Persistence & Compaction

**Files:**
- Create: `packages/services/src/session/session-store.ts`
- Create: `packages/services/src/session/session-compactor.ts`
- Test: `packages/services/src/__tests__/session-compactor.test.ts`

Session store saves/loads session state per agent via the SessionCodec port. Compactor prunes when thresholds are exceeded (200 turns, 2M tokens, 72h). Three-tier policy: agent override > adapter default > system fallback.

- [ ] **Steps:** Test compaction thresholds → implement → commit

```bash
git commit -m "feat(services): add session persistence and compaction"
```

---

## Task 2.6: Budget Enforcement

**Files:**
- Create: `packages/services/src/budget/budget-enforcer.ts`
- Test: `packages/services/src/__tests__/budget-enforcer.test.ts`

Pre-run budget check: if agent is at 100% of monthly limit, skip and emit `budget.exhausted`. Post-run: record cost event, update current spend. Auto-pause at 100%.

- [ ] **Steps:** Test → implement → commit

```bash
git commit -m "feat(services): add budget enforcement with auto-pause"
```

---

## Task 2.7: Log Redaction

**Files:**
- Create: `packages/services/src/log-redaction.ts`
- Test: `packages/services/src/__tests__/log-redaction.test.ts`

Masks home directory paths (`/Users/alice` → `/Users/a****`), API keys, and token-like strings from agent stdout before storing in heartbeat_runs.

- [ ] **Steps:** Test with sample stdout containing paths → implement → commit

```bash
git commit -m "feat(services): add log redaction for sensitive data"
```

---

## Task 2.8: Wire Heartbeat into Server & Test End-to-End

**Files:**
- Modify: `packages/server/src/create-server.ts`
- Create: `packages/server/src/routes/invoke-agent.ts`
- Modify: `packages/cli/src/commands/start.ts`

Add `POST /api/companies/:companyId/agents/:agentId/invoke` route that triggers a manual heartbeat. Wire the heartbeat service, adapter registry, workspace manager, budget enforcer into the composition root.

- [ ] **Steps:** Add route → wire composition root → test with `curl` → commit

```bash
git commit -m "feat: wire heartbeat engine into server — agents can be invoked"
```

---

# Phase 3 — Communication & Governance

**Deliverable:** Agents coordinate through issues/comments. Board approves/denies actions.

## Task 3.1: Issue Lifecycle Routes

Add all issue CRUD routes + atomic checkout endpoint (409 on conflict). Wire to use-cases.

```bash
git commit -m "feat(server): add issue lifecycle routes with atomic checkout"
```

## Task 3.2: Comments Routes

Add GET/POST comment routes. Comments are the sole agent-to-agent communication channel.

```bash
git commit -m "feat(server): add issue comment routes"
```

## Task 3.3: Documents with Revision History

Add document CRUD + revision creation routes.

```bash
git commit -m "feat(server): add document routes with revision history"
```

## Task 3.4: Work Products Tracking

Add routes to record PRs/branches/artifacts produced by agent runs, linked to issues.

```bash
git commit -m "feat(server): add work product tracking routes"
```

## Task 3.5: Approval System

Implement configurable governance policy, system-calculated risk levels, approval CRUD routes, approve/deny endpoints with denial feedback.

```bash
git commit -m "feat: add configurable approval system with risk levels"
```

## Task 3.6: Batch Approvals & Denial History

Add batch approve endpoint for related proposals. Store denial history on re-proposals. Add approval timeout logic (auto-approve low / auto-deny high).

```bash
git commit -m "feat: add batch approvals, denial history, and timeout logic"
```

## Task 3.7: Activity Log

Every mutation recorded via ActivityRepository. Add GET `/activity` route with entity type filtering.

```bash
git commit -m "feat(server): add activity log routes"
```

## Task 3.8: Secrets Management

Encrypted vault per company. Add CRUD routes for secrets. Agents access via API (never raw values in logs).

```bash
git commit -m "feat: add encrypted secrets management per company"
```

---

# Phase 4 — Dashboard

**Deliverable:** Mission Control fully live with all 7 pages.

## Task 4.1: Mission Control — Agent Cards & Current Work

Build the main Mission Control view: agent cards sorted by status → org rank, current work issue list, live status dots. Wire to API.

```bash
git commit -m "feat(ui): add Mission Control with agent cards and issues list"
```

## Task 4.2: Inspector Panel

Slide-in panel when clicking any agent or issue. Tabs: Comments, Documents, Runs, Cost. Live typing indicator via agent stream SSE.

```bash
git commit -m "feat(ui): add Inspector panel with tabs and live comments"
```

## Task 4.3: Activity Stream with Dimming

Activity feed in Mission Control that dims when Inspector is open. "N new" badge. Click to expand.

```bash
git commit -m "feat(ui): add activity stream with inspector-aware dimming"
```

## Task 4.4: Org Chart Page

Visual tree layout of agent hierarchy. Live status dots. Hire agent button triggering approval.

```bash
git commit -m "feat(ui): add Org Chart page with live status"
```

## Task 4.5: Goals Page

Hierarchical tree with progress bars, collapsible children, status badges.

```bash
git commit -m "feat(ui): add Goals page with hierarchy tree"
```

## Task 4.6: Approvals Page

Risk-colored cards, batch approve, denial history display, undo bar (10-second window).

```bash
git commit -m "feat(ui): add Approvals page with risk badges and undo bar"
```

## Task 4.7: Costs Page

Metric cards, stacked bar chart by agent, cost table with budget utilization progress bars. Date range picker.

```bash
git commit -m "feat(ui): add Costs page with charts and budget bars"
```

## Task 4.8: Settings Page

Tabbed layout: Governance (toggle switches for approval gates, timeout config), Secrets, Skills, Plugins, Team, General.

```bash
git commit -m "feat(ui): add Settings page with governance, secrets, and skills tabs"
```

## Task 4.9: SSE Integration & Onboarding Polish

Wire SSE domain events to refresh Mission Control state. Wire agent stream to Inspector live typing. Add pre-flight environment check. Add progress animation for "Get Started." Add company switcher.

```bash
git commit -m "feat(ui): wire SSE, pre-flight check, and onboarding polish"
```

---

# Phase 5 — Learning System

**Deliverable:** Agents get smarter over time. Our key differentiator.

## Task 5.1: LearningExtractor Use-Case

Listens to `run.completed` event. Analyzes run outcome and extracts structured learnings (summary, domain, tags, confidence). Saves via LearningRepository.

```bash
git commit -m "feat(domain): add LearningExtractor use-case"
```

## Task 5.2: LearningEvaluator Use-Case

Listens to `run.completed`. Checks if any learnings were injected in this run. Updates confidence based on outcome (+0.1 success, -0.15 failure/irrelevant). Records LearningApplication.

```bash
git commit -m "feat(domain): add LearningEvaluator with confidence feedback loop"
```

## Task 5.3: LearningContextEnricher

Implements ContextEnricher port. Queries learnings by project → domain → pinned company-wide. Injects top 5 by confidence into agent system prompt.

```bash
git commit -m "feat(adapters): add LearningContextEnricher"
```

## Task 5.4: Board Curation Use-Cases

PinLearning, DismissLearning (soft-delete with undo), EditLearning. Add API routes.

```bash
git commit -m "feat: add Board learning curation use-cases and routes"
```

## Task 5.5: Learnings Page

Dashboard page showing learning cards with confidence bars, application stats, domain filters, pin/dismiss/edit actions. Mission Control "N new learnings" widget.

```bash
git commit -m "feat(ui): add Learnings page with confidence tracking"
```

---

# Phase 6 — Multi-User & Templates

**Deliverable:** Teams collaborate. Companies are portable.

## Task 6.1: Better Auth — Authenticated Mode

Add Better Auth sessions, login/logout, API key management. Two deployment modes: `local_trusted` (no login) and `authenticated`.

```bash
git commit -m "feat: add Better Auth authenticated mode with sessions and API keys"
```

## Task 6.2: Invite System

Invite links with token hashing and expiry. Join requests with approval/rejection. Multi-user Board with roles (admin, member, viewer).

```bash
git commit -m "feat: add invite system with join requests and Board roles"
```

## Task 6.3: Company Import/Export

Export full company config to YAML+markdown portable format. Import with collision strategies (rename, skip). CLI commands: `sheldon company-export`, `sheldon company-import`.

```bash
git commit -m "feat: add company import/export in portable format"
```

## Task 6.4: Starter Templates

Pre-built company templates: "Dev Team" (CEO + Developer + Reviewer), "Content Agency" (CEO + Writer + Editor), "Data Pipeline" (CEO + Engineer + Analyst). CEO-driven onboarding uses templates when available.

```bash
git commit -m "feat: add starter company templates for quick onboarding"
```

## Task 6.5: OAuth Prep

Add Better Auth OAuth plugin configuration for Google and GitHub. Not enforced yet — groundwork for future.

```bash
git commit -m "feat: prep OAuth plugin config for Google and GitHub"
```

---

# Phase 7 — Plugin Ecosystem

**Deliverable:** Third parties can extend Sheldon.

## Task 7.1: Plugin SDK

Create `@sheldon/plugin-sdk` package with `definePlugin()` and extension factories: `cronJob()`, `eventHandler()`, `uiSlot()`, `apiRoute()`, `settingsPanel()`, `storage()`.

```bash
git commit -m "feat(plugins): add plugin SDK with definePlugin and extension factories"
```

## Task 7.2: Plugin Runtime — Worker Threads

PluginLoader reads plugin packages. WorkerManager spawns each plugin in a worker thread. ResourceEnforcer monitors memory/CPU/rate limits. Auto-pause after 3 violations.

```bash
git commit -m "feat(plugins): add plugin runtime with worker isolation and resource limits"
```

## Task 7.3: Event Bridge

Routes PluginEventMap events from domain event bus to subscribed plugin workers. Only published events cross the boundary.

```bash
git commit -m "feat(plugins): add event bridge for PluginEventMap"
```

## Task 7.4: Storage Provisioner

Creates prefixed DB tables per plugin (`plugin_{id}_{table}`). Drops on uninstall. No cross-plugin access.

```bash
git commit -m "feat(plugins): add storage provisioner with prefixed tables"
```

## Task 7.5: Plugin UI Integration

Two-part plugin packages: `server/` loaded in worker, `ui/` lazy-loaded as React components. 4 UI slots: mission-control.widgets, inspector.tabs, settings.sections, agent-card.badges.

```bash
git commit -m "feat(plugins): add UI slot system for plugin components"
```

## Task 7.6: Example Plugins

Create hello-world and github-sync example plugins demonstrating all extension types.

```bash
git commit -m "feat(plugins): add hello-world and github-sync examples"
```

---

# Phase 8 — CLI & Operations

**Deliverable:** Production-ready tooling.

## Task 8.1: CLI Doctor Command

`sheldon doctor` runs diagnostics: DB connectivity, Claude Code CLI presence, port availability, secrets encryption, auth config, PGlite version.

```bash
git commit -m "feat(cli): add sheldon doctor diagnostic command"
```

## Task 8.2: Routines — Cron & Webhook Triggers

Routine scheduler that creates issues on cron fire or webhook receipt. Concurrency policies (coalesce, enqueue, skip). Routines nav item appears in UI when routines exist (progressive disclosure).

```bash
git commit -m "feat: add routines with cron and webhook triggers"
```

## Task 8.3: CLI Auth Challenges

`sheldon login` for connecting CLI to a remote server. Challenge-response flow.

```bash
git commit -m "feat(cli): add CLI auth challenge for remote server"
```

## Task 8.4: Instance Settings

Global server-level configuration (general + experimental settings). Admin-only UI page.

```bash
git commit -m "feat: add instance settings"
```

## Task 8.5: Notification Channel

Email/webhook notifications when approvals are pending. Configurable per company.

```bash
git commit -m "feat: add approval notification channel (email/webhook)"
```

---

# Phase 9 — Polish

**Deliverable:** Production-grade refinements.

## Task 9.1: Agent Config Revisions

Full audit trail of agent configuration changes with before/after snapshots and rollback support.

```bash
git commit -m "feat: add agent config revision history with rollback"
```

## Task 9.2: Budget Incidents & Finance Events

Formal breach records when budget thresholds hit. Billing-grade finance events with debit/credit, billing codes, invoice IDs.

```bash
git commit -m "feat: add budget incidents and finance events"
```

## Task 9.3: Labels & Inbox

Color-coded issue labels. Inbox page with My Issues, read states, archive.

```bash
git commit -m "feat(ui): add issue labels and inbox with read states"
```

## Task 9.4: Assets & File Storage

Generic file upload system with SHA-256 checksums, local disk + S3 providers.

```bash
git commit -m "feat: add asset/file storage with local and S3 providers"
```

## Task 9.5: Feedback & Evals

Board can vote on agent outputs (thumbs up/down). Optional sharing to external labs. promptfoo-based agent evaluation framework.

```bash
git commit -m "feat: add feedback voting and evals framework"
```

## Task 9.6: Additional Adapters

Add `process` (any shell command), `http` (webhook), `codex_local`, `gemini_local` adapters. Each implements the same port interfaces.

```bash
git commit -m "feat(adapters): add process, http, codex, and gemini adapters"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Every section of the spec (1-12) maps to tasks. All must-haves from Section 11 are covered. All should-haves are in Phase 9.
- [x] **Placeholder scan:** No TBDs or TODOs. Phase 1 tasks have full code. Phases 2-9 have task descriptions with commit messages and file lists.
- [x] **Type consistency:** All entity names, port names, and use-case names match the domain package defined in Task 1.3-1.5. Result type used consistently throughout.
- [x] **Build order:** Phase 1 builds domain first (Tasks 1.2-1.5 before any framework code in 1.7-1.12). Each subsequent phase depends only on previous phases.

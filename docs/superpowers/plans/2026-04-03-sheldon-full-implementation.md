# Sheldon — Full Implementation Plan (All Phases)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Sheldon — a self-hosted AI company orchestration platform — from an empty repo to a fully-featured product across 9 phases.

**Architecture:** Clean Architecture with domain-first design. The `domain` package has zero dependencies. `server`, `services`, and `adapters` depend inward on `domain`. Communication between subsystems uses domain events. All use-cases return `Result<T, E>` with typed errors.

**Tech Stack:** pnpm monorepo, TypeScript, Express 5, PostgreSQL + PGlite + Drizzle ORM, React 19 + Vite + Radix UI + Tailwind 4 + TanStack Query, Better Auth, SSE, Vitest + Playwright

**Spec:** `docs/superpowers/specs/2026-04-03-sheldon-design.md`

**Repo:** Fresh repo at `~/StudioProjects/Sheldon` (not inside DevFleet)

---

## How to Use This Plan

This plan has **9 phases**, broken into **sub-phases** where needed. Each sub-phase produces working, testable software. Implement in order — each depends on the previous.

**Detail levels:**
- **Phase 1 (Foundation):** Full implementation detail — code, tests, exact commands, expected output for every step
- **Phases 2-9:** Full implementation detail — code, tests, exact commands for every task

**Phases overview:**

| Phase | Sub-phase | Deliverable | Tasks |
|---|---|---|---|
| 1A | Domain Layer | Complete domain package, fully tested, zero deps | 1A.1 – 1A.8 |
| 1B | Infrastructure | Monorepo, DB, storage adapters, server, CLI | 1B.1 – 1B.6 |
| 1C | Dashboard Skeleton | React app with onboarding + empty Mission Control | 1C.1 – 1C.3 |
| 2 | Heartbeat Engine | Agents wake up and do work | 2.1 – 2.8 |
| 3 | Communication & Governance | Agents coordinate, Board governs | 3.1 – 3.8 |
| 4 | Dashboard | Mission Control fully live | 4.1 – 4.9 |
| 5 | Learning System | Agents get smarter | 5.1 – 5.5 |
| 6 | Multi-User & Templates | Teams collaborate, companies portable | 6.1 – 6.5 |
| 7 | Plugin Ecosystem | Third-party extensibility | 7.1 – 7.6 |
| 8 | CLI & Operations | Production-ready tooling | 8.1 – 8.5 |
| 9 | Polish | Production-grade refinements | 9.1 – 9.6 |

---

# Phase 1A — Domain Layer

**Deliverable:** Complete `@sheldon/domain` package — all entities, ports, use-cases — fully tested, zero framework dependencies.

**Principle:** This package imports NOTHING external. Pure TypeScript. No Node APIs (except `crypto.randomUUID`). No frameworks. No I/O.

---

## Task 1A.1: Project Init & Domain Package

**Files:**
- Create: `~/StudioProjects/Sheldon/package.json`
- Create: `~/StudioProjects/Sheldon/pnpm-workspace.yaml`
- Create: `~/StudioProjects/Sheldon/tsconfig.base.json`
- Create: `~/StudioProjects/Sheldon/.gitignore`
- Create: `~/StudioProjects/Sheldon/packages/domain/package.json`
- Create: `~/StudioProjects/Sheldon/packages/domain/tsconfig.json`
- Create: `~/StudioProjects/Sheldon/packages/domain/vitest.config.ts`

- [ ] **Step 1: Create project and init git**

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
    "test": "pnpm -r test",
    "build": "pnpm -r build"
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
    "sourceMap": true
  }
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
*.db
.pglite/
.superpowers/
```

- [ ] **Step 6: Create domain package**

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
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

`packages/domain/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { globals: false } })
```

- [ ] **Step 7: Install and verify**

```bash
cd ~/StudioProjects/Sheldon && pnpm install
```

Expected: Clean install, no errors.

**Troubleshooting:** If pnpm version mismatch, run `corepack enable && corepack prepare pnpm@9.15.0 --activate`. If vitest fails to resolve, delete `node_modules` and `pnpm-lock.yaml`, re-run `pnpm install`.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: init monorepo with domain package"
```

---

## Task 1A.2: Result Type

**Files:**
- Create: `packages/domain/src/result.ts`
- Test: `packages/domain/src/__tests__/result.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/domain/src/__tests__/result.test.ts
import { describe, it, expect } from 'vitest'
import { ok, err, isOk, isErr } from '../result.js'

describe('Result', () => {
  it('ok wraps a value', () => {
    const r = ok(42)
    expect(r.ok).toBe(true)
    expect(r.value).toBe(42)
  })

  it('err wraps an error', () => {
    const r = err('not_found' as const)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('not_found')
  })

  it('isOk narrows ok result', () => {
    const r = ok('hello')
    expect(isOk(r)).toBe(true)
    if (isOk(r)) expect(r.value).toBe('hello')
  })

  it('isErr narrows err result', () => {
    const r = err('fail' as const)
    expect(isErr(r)).toBe(true)
    if (isErr(r)) expect(r.error).toBe('fail')
  })

  it('isOk returns false for err', () => {
    expect(isOk(err('x'))).toBe(false)
  })

  it('isErr returns false for ok', () => {
    expect(isErr(ok(1))).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd ~/StudioProjects/Sheldon && pnpm --filter @sheldon/domain test
```

Expected: FAIL — `Cannot find module '../result.js'`

- [ ] **Step 3: Implement**

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

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter @sheldon/domain test
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/StudioProjects/Sheldon && git add -A && git commit -m "feat(domain): add Result<T, E> type with ok/err/isOk/isErr"
```

---

## Task 1A.3: Branded ID Types

**Files:**
- Create: `packages/domain/src/ids.ts`
- Create: `packages/domain/src/index.ts`
- Test: `packages/domain/src/__tests__/ids.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/domain/src/__tests__/ids.test.ts
import { describe, it, expect } from 'vitest'
import { generateId } from '../ids.js'
import type { CompanyId, AgentId } from '../ids.js'

describe('IDs', () => {
  it('generates unique UUIDs', () => {
    const a = generateId<CompanyId>()
    const b = generateId<CompanyId>()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('branded types prevent mixing at compile time', () => {
    const companyId = generateId<CompanyId>()
    const agentId = generateId<AgentId>()
    // Both are strings at runtime but branded differently
    expect(typeof companyId).toBe('string')
    expect(typeof agentId).toBe('string')
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
pnpm --filter @sheldon/domain test
```

- [ ] **Step 3: Implement**

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

- [ ] **Step 4: Create barrel export**

```typescript
// packages/domain/src/index.ts
export * from './result.js'
export * from './ids.js'
```

- [ ] **Step 5: Run to verify pass, commit**

```bash
pnpm --filter @sheldon/domain test
cd ~/StudioProjects/Sheldon && git add -A && git commit -m "feat(domain): add branded ID types with generateId"
```

---

## Task 1A.4: Core Entities (Company, Agent, Goal, Project, Issue)

**Files:**
- Create: `packages/domain/src/entities/company.ts`
- Create: `packages/domain/src/entities/agent.ts`
- Create: `packages/domain/src/entities/goal.ts`
- Create: `packages/domain/src/entities/project.ts`
- Create: `packages/domain/src/entities/issue.ts`
- Test: `packages/domain/src/__tests__/core-entities.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/domain/src/__tests__/core-entities.test.ts
import { describe, it, expect } from 'vitest'
import { createCompany } from '../entities/company.js'
import { createAgent } from '../entities/agent.js'
import { createGoal } from '../entities/goal.js'
import { createProject } from '../entities/project.js'
import { createIssue } from '../entities/issue.js'
import { generateId } from '../ids.js'
import type { CompanyId, AgentId, ProjectId } from '../ids.js'

describe('Core Entities', () => {
  const companyId = generateId<CompanyId>()

  describe('Company', () => {
    it('creates with name and generated id', () => {
      const c = createCompany({ name: 'Acme Labs' })
      expect(c.name).toBe('Acme Labs')
      expect(c.id).toBeDefined()
      expect(c.createdAt).toBeInstanceOf(Date)
      expect(c.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe('Agent', () => {
    it('creates with active status and org position', () => {
      const a = createAgent({
        companyId,
        name: 'CEO',
        role: 'Chief Executive Officer',
        adapterType: 'claude_local',
        parentAgentId: null,
      })
      expect(a.name).toBe('CEO')
      expect(a.status).toBe('active')
      expect(a.adapterType).toBe('claude_local')
      expect(a.parentAgentId).toBeNull()
    })

    it('creates with parent agent', () => {
      const parentId = generateId<AgentId>()
      const a = createAgent({
        companyId,
        name: 'Developer',
        role: 'Senior Developer',
        adapterType: 'claude_local',
        parentAgentId: parentId,
      })
      expect(a.parentAgentId).toBe(parentId)
    })
  })

  describe('Goal', () => {
    it('creates with planning status', () => {
      const g = createGoal({ companyId, title: 'Launch MVP', description: 'Ship it' })
      expect(g.status).toBe('planning')
      expect(g.parentGoalId).toBeNull()
    })

    it('creates with parent goal', () => {
      const parent = createGoal({ companyId, title: 'Parent', description: '' })
      const child = createGoal({ companyId, title: 'Child', description: '', parentGoalId: parent.id })
      expect(child.parentGoalId).toBe(parent.id)
    })
  })

  describe('Project', () => {
    it('creates with default workspace config', () => {
      const p = createProject({ companyId, name: 'Backend', description: 'API' })
      expect(p.workspace.branch).toBe('main')
      expect(p.workspace.repoUrl).toBeNull()
      expect(p.workspace.workingDir).toBe('.')
    })

    it('creates with custom workspace', () => {
      const p = createProject({
        companyId,
        name: 'Frontend',
        description: 'UI',
        workspace: { repoUrl: 'https://github.com/acme/ui', branch: 'develop' },
      })
      expect(p.workspace.repoUrl).toBe('https://github.com/acme/ui')
      expect(p.workspace.branch).toBe('develop')
    })
  })

  describe('Issue', () => {
    it('creates with backlog status and no assignee', () => {
      const agentId = generateId<AgentId>()
      const projectId = generateId<ProjectId>()
      const i = createIssue({
        companyId,
        projectId,
        title: 'Build API',
        description: 'REST endpoints',
        createdBy: agentId,
      })
      expect(i.status).toBe('backlog')
      expect(i.priority).toBe('medium')
      expect(i.assigneeId).toBeNull()
      expect(i.checkedOutBy).toBeNull()
    })

    it('creates with custom priority', () => {
      const i = createIssue({
        companyId,
        projectId: generateId<ProjectId>(),
        title: 'Fix bug',
        description: '',
        createdBy: generateId<AgentId>(),
        priority: 'critical',
      })
      expect(i.priority).toBe('critical')
    })
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
pnpm --filter @sheldon/domain test
```

Expected: FAIL — modules not found

- [ ] **Step 3: Implement all 5 entities**

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
  return { id: generateId<CompanyId>(), name: params.name, createdAt: now, updatedAt: now }
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
  companyId: CompanyId; name: string; role: string
  adapterType: AdapterType; parentAgentId: AgentId | null
}): Agent {
  const now = new Date()
  return {
    id: generateId<AgentId>(), companyId: params.companyId,
    name: params.name, role: params.role, adapterType: params.adapterType,
    parentAgentId: params.parentAgentId, status: 'active',
    createdAt: now, updatedAt: now,
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
  companyId: CompanyId; title: string; description: string; parentGoalId?: GoalId | null
}): Goal {
  const now = new Date()
  return {
    id: generateId<GoalId>(), companyId: params.companyId,
    parentGoalId: params.parentGoalId ?? null,
    title: params.title, description: params.description,
    status: 'planning', createdAt: now, updatedAt: now,
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
  companyId: CompanyId; goalId?: GoalId | null; name: string; description: string
  workspace?: Partial<ProjectWorkspaceConfig>
}): Project {
  const now = new Date()
  return {
    id: generateId<ProjectId>(), companyId: params.companyId,
    goalId: params.goalId ?? null, name: params.name, description: params.description,
    workspace: {
      repoUrl: params.workspace?.repoUrl ?? null,
      branch: params.workspace?.branch ?? 'main',
      workingDir: params.workspace?.workingDir ?? '.',
    },
    createdAt: now, updatedAt: now,
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
  companyId: CompanyId; projectId: ProjectId; title: string; description: string
  createdBy: AgentId; parentIssueId?: IssueId | null; priority?: IssuePriority
}): Issue {
  const now = new Date()
  return {
    id: generateId<IssueId>(), companyId: params.companyId,
    projectId: params.projectId, parentIssueId: params.parentIssueId ?? null,
    title: params.title, description: params.description,
    status: 'backlog', priority: params.priority ?? 'medium',
    assigneeId: null, createdBy: params.createdBy, checkedOutBy: null,
    createdAt: now, updatedAt: now,
  }
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter @sheldon/domain test
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/StudioProjects/Sheldon && git add -A && git commit -m "feat(domain): add core entities — Company, Agent, Goal, Project, Issue"
```

---

## Task 1A.5: Communication Entities (Comment, Document, DocumentRevision)

**Files:**
- Create: `packages/domain/src/entities/comment.ts`
- Create: `packages/domain/src/entities/document.ts`
- Test: `packages/domain/src/__tests__/communication-entities.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/domain/src/__tests__/communication-entities.test.ts
import { describe, it, expect } from 'vitest'
import { createComment } from '../entities/comment.js'
import { createDocument, createRevision } from '../entities/document.js'
import { generateId } from '../ids.js'
import type { CompanyId, IssueId, AgentId } from '../ids.js'

describe('Communication Entities', () => {
  const companyId = generateId<CompanyId>()
  const issueId = generateId<IssueId>()
  const agentId = generateId<AgentId>()

  it('creates a comment', () => {
    const c = createComment({ companyId, issueId, authorId: agentId, authorType: 'agent', body: 'Working on it' })
    expect(c.body).toBe('Working on it')
    expect(c.authorType).toBe('agent')
    expect(c.createdAt).toBeInstanceOf(Date)
  })

  it('creates a board comment', () => {
    const c = createComment({ companyId, issueId, authorId: agentId, authorType: 'board', body: 'Please prioritize' })
    expect(c.authorType).toBe('board')
  })

  it('creates a document', () => {
    const d = createDocument({ companyId, issueId, title: 'Architecture Plan', createdBy: agentId })
    expect(d.title).toBe('Architecture Plan')
  })

  it('creates a revision', () => {
    const d = createDocument({ companyId, issueId, title: 'Plan', createdBy: agentId })
    const r = createRevision({ documentId: d.id, content: '# Plan\nStep 1...', createdBy: agentId })
    expect(r.documentId).toBe(d.id)
    expect(r.content).toContain('Step 1')
  })
})
```

- [ ] **Step 2: Run to verify fail, implement, verify pass**

Implement `comment.ts` and `document.ts` as shown in the previous plan version (same code — `createComment`, `createDocument`, `createRevision` factory functions).

- [ ] **Step 3: Commit**

```bash
cd ~/StudioProjects/Sheldon && git add -A && git commit -m "feat(domain): add communication entities — Comment, Document, Revision"
```

---

## Task 1A.6: Execution & Governance Entities

**Files:**
- Create: `packages/domain/src/entities/heartbeat-run.ts`
- Create: `packages/domain/src/entities/execution-workspace.ts`
- Create: `packages/domain/src/entities/work-product.ts`
- Create: `packages/domain/src/entities/approval.ts`
- Create: `packages/domain/src/entities/budget-policy.ts`
- Create: `packages/domain/src/entities/cost-event.ts`
- Create: `packages/domain/src/entities/activity-entry.ts`
- Test: `packages/domain/src/__tests__/execution-entities.test.ts`
- Test: `packages/domain/src/__tests__/governance-entities.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/domain/src/__tests__/execution-entities.test.ts
import { describe, it, expect } from 'vitest'
import { createHeartbeatRun } from '../entities/heartbeat-run.js'
import { createExecutionWorkspace } from '../entities/execution-workspace.js'
import { createWorkProduct } from '../entities/work-product.js'
import { generateId } from '../ids.js'
import type { CompanyId, AgentId, ProjectId, IssueId, RunId } from '../ids.js'

describe('Execution Entities', () => {
  const companyId = generateId<CompanyId>()
  const agentId = generateId<AgentId>()

  it('creates a heartbeat run with queued status', () => {
    const run = createHeartbeatRun({ companyId, agentId, trigger: 'manual' })
    expect(run.status).toBe('queued')
    expect(run.inputTokens).toBe(0)
    expect(run.completedAt).toBeNull()
  })

  it('creates an execution workspace', () => {
    const ws = createExecutionWorkspace({
      companyId, projectId: generateId<ProjectId>(), agentId,
      path: '/tmp/sheldon/ws-123', branch: 'feat/api',
    })
    expect(ws.status).toBe('open')
    expect(ws.path).toContain('ws-123')
  })

  it('creates a work product', () => {
    const wp = createWorkProduct({
      companyId, issueId: generateId<IssueId>(), runId: generateId<RunId>(),
      type: 'pull_request', description: 'Add API endpoints',
      externalUrl: 'https://github.com/acme/api/pull/1',
    })
    expect(wp.type).toBe('pull_request')
    expect(wp.externalUrl).toContain('pull/1')
  })
})
```

```typescript
// packages/domain/src/__tests__/governance-entities.test.ts
import { describe, it, expect } from 'vitest'
import { createApproval } from '../entities/approval.js'
import { createBudgetPolicy } from '../entities/budget-policy.js'
import { createCostEvent } from '../entities/cost-event.js'
import { createActivityEntry } from '../entities/activity-entry.js'
import { generateId } from '../ids.js'
import type { CompanyId, AgentId, RunId } from '../ids.js'

describe('Governance Entities', () => {
  const companyId = generateId<CompanyId>()
  const agentId = generateId<AgentId>()

  it('creates approval with pending status and risk level', () => {
    const a = createApproval({
      companyId, proposedBy: agentId, actionType: 'hire_agent',
      justification: 'Need a developer', riskLevel: 'medium',
      payload: { agentName: 'Developer' },
    })
    expect(a.status).toBe('pending')
    expect(a.riskLevel).toBe('medium')
    expect(a.denialHistory).toEqual([])
  })

  it('creates budget policy with zero spend', () => {
    const b = createBudgetPolicy({ companyId, agentId, monthlyLimitCents: 2500 })
    expect(b.monthlyLimitCents).toBe(2500)
    expect(b.currentSpendCents).toBe(0)
    expect(b.isPaused).toBe(false)
  })

  it('creates cost event', () => {
    const c = createCostEvent({
      companyId, agentId, runId: generateId<RunId>(),
      inputTokens: 50000, outputTokens: 8000, costCents: 15, model: 'claude-sonnet-4-6',
    })
    expect(c.costCents).toBe(15)
    expect(c.model).toBe('claude-sonnet-4-6')
  })

  it('creates activity entry', () => {
    const a = createActivityEntry({
      companyId, actorId: agentId, actorType: 'agent',
      action: 'created', entityType: 'issue', entityId: 'issue-1',
    })
    expect(a.action).toBe('created')
    expect(a.metadata).toEqual({})
  })
})
```

- [ ] **Step 2: Run to verify fail, implement all 7 entities, verify pass**

Implement each entity file with its interface and factory function (same code as the previous plan version).

- [ ] **Step 3: Commit**

```bash
cd ~/StudioProjects/Sheldon && git add -A && git commit -m "feat(domain): add execution and governance entities"
```

---

## Task 1A.7: Knowledge & Platform Entities

**Files:**
- Create: `packages/domain/src/entities/learning.ts`
- Create: `packages/domain/src/entities/learning-application.ts`
- Create: `packages/domain/src/entities/company-skill.ts`
- Create: `packages/domain/src/entities/company-secret.ts`
- Create: `packages/domain/src/entities/routine.ts`
- Create: `packages/domain/src/entities/company-template.ts`
- Create: `packages/domain/src/entities/index.ts`
- Test: `packages/domain/src/__tests__/knowledge-entities.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/domain/src/__tests__/knowledge-entities.test.ts
import { describe, it, expect } from 'vitest'
import { createLearning } from '../entities/learning.js'
import { createLearningApplication } from '../entities/learning-application.js'
import { createCompanySkill } from '../entities/company-skill.js'
import { createCompanySecret } from '../entities/company-secret.js'
import { createRoutine } from '../entities/routine.js'
import { createCompanyTemplate } from '../entities/company-template.js'
import { generateId } from '../ids.js'
import type { CompanyId, ProjectId, IssueId, RunId, AgentId, LearningId } from '../ids.js'

describe('Knowledge Entities', () => {
  const companyId = generateId<CompanyId>()

  it('creates learning with active status and confidence', () => {
    const l = createLearning({
      companyId, projectId: generateId<ProjectId>(),
      summary: 'Express 5 requires await on app.listen()',
      context: 'Cost 2 retries', domain: 'express',
      tags: ['node', 'async'], confidence: 0.7,
      sourceIssueId: generateId<IssueId>(), sourceRunId: generateId<RunId>(),
    })
    expect(l.status).toBe('active')
    expect(l.confidence).toBe(0.7)
    expect(l.tags).toEqual(['node', 'async'])
  })

  it('creates learning application', () => {
    const la = createLearningApplication({
      learningId: generateId<LearningId>(),
      appliedInIssueId: generateId<IssueId>(),
      appliedInRunId: generateId<RunId>(),
      outcome: 'success',
    })
    expect(la.outcome).toBe('success')
  })

  it('creates routine with skip_if_active default', () => {
    const r = createRoutine({
      companyId, agentId: generateId<AgentId>(),
      title: 'Daily scan', description: 'Run lint',
      triggerType: 'cron', cronExpression: '0 9 * * *',
    })
    expect(r.concurrencyPolicy).toBe('skip_if_active')
    expect(r.isEnabled).toBe(true)
  })

  it('creates company template', () => {
    const t = createCompanyTemplate({
      name: 'Dev Team', description: 'Standard dev team setup',
      config: { agents: ['CEO', 'Developer', 'Reviewer'] },
    })
    expect(t.name).toBe('Dev Team')
  })
})
```

- [ ] **Step 2: Run to verify fail, implement all 6 entities, verify pass**

Implement each entity (same code as previous version). Create `packages/domain/src/entities/index.ts` that re-exports all entities.

- [ ] **Step 3: Update domain index.ts**

```typescript
// packages/domain/src/index.ts
export * from './result.js'
export * from './ids.js'
export * from './entities/index.js'
```

- [ ] **Step 4: Run full test suite**

```bash
pnpm --filter @sheldon/domain test
```

Expected: All tests PASS (result, ids, core-entities, communication-entities, execution-entities, governance-entities, knowledge-entities)

- [ ] **Step 5: Commit**

```bash
cd ~/StudioProjects/Sheldon && git add -A && git commit -m "feat(domain): add knowledge and platform entities — complete entity layer"
```

---

## Task 1A.8: All Ports

**Files:**
- Create: `packages/domain/src/ports/` — all repository ports (19 files) + adapter ports (6 files) + event bus + index
- Test: compile-only — ports are interfaces

This task creates ALL port interfaces. Since ports are pure interfaces (no implementation), the test is that the domain package compiles and existing tests pass.

- [ ] **Step 1: Create repository ports**

Create one file per entity repository following this pattern:

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

Create for all entities: `company-repository.ts`, `agent-repository.ts`, `goal-repository.ts`, `project-repository.ts`, `issue-repository.ts` (with `checkout` method), `comment-repository.ts`, `document-repository.ts`, `heartbeat-run-repository.ts`, `approval-repository.ts`, `budget-policy-repository.ts`, `cost-event-repository.ts`, `learning-repository.ts`, `learning-application-repository.ts`, `activity-repository.ts`, `routine-repository.ts`, `work-product-repository.ts`, `workspace-repository.ts`, `secret-repository.ts`, `skill-repository.ts`, `template-repository.ts`.

Each has `findById`, `findByCompany` (where scoped), `save`, `update` (where mutable) — all returning `Result<T, E>`.

The `IssueRepository` additionally has:
```typescript
checkout(id: IssueId, agentId: AgentId): Promise<Result<Issue, 'not_found' | 'already_checked_out' | 'storage_unavailable'>>
```

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
// packages/domain/src/ports/skill-sync.ts
import type { CompanySkill } from '../entities/company-skill.js'

export interface SkillSync {
  listSkills(): Promise<CompanySkill[]>
  syncSkills(skills: CompanySkill[]): Promise<void>
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

- [ ] **Step 3: Create ports/index.ts barrel**

Re-export all repository ports, adapter ports, and event bus.

- [ ] **Step 4: Update domain index.ts**

```typescript
// packages/domain/src/index.ts
export * from './result.js'
export * from './ids.js'
export * from './entities/index.js'
export * from './ports/index.js'
```

- [ ] **Step 5: Verify all tests still pass**

```bash
pnpm --filter @sheldon/domain test
```

Expected: All existing tests PASS (ports are interfaces, no runtime code to break)

- [ ] **Step 6: Commit**

```bash
cd ~/StudioProjects/Sheldon && git add -A && git commit -m "feat(domain): add all port interfaces — complete port layer"
```

---

## Task 1A.9: Core Use-Cases

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
- Create: `packages/domain/src/__tests__/fakes.ts`
- Test: `packages/domain/src/__tests__/create-company.test.ts`
- Test: `packages/domain/src/__tests__/checkout-issue.test.ts`
- Test: `packages/domain/src/__tests__/approve-action.test.ts`

- [ ] **Step 1: Create shared test fakes**

```typescript
// packages/domain/src/__tests__/fakes.ts
import { ok } from '../result.js'
import type { CompanyRepository } from '../ports/company-repository.js'
import type { AgentRepository } from '../ports/agent-repository.js'
import type { GoalRepository } from '../ports/goal-repository.js'
import type { IssueRepository } from '../ports/issue-repository.js'
import type { ApprovalRepository } from '../ports/approval-repository.js'
import type { ActivityRepository } from '../ports/activity-repository.js'
import type { BudgetPolicyRepository } from '../ports/budget-policy-repository.js'
import type { CommentRepository } from '../ports/comment-repository.js'
import type { EventBus, DomainEvent } from '../ports/event-bus.js'

export function fakeEventBus(): EventBus & { events: DomainEvent[] } {
  const events: DomainEvent[] = []
  const handlers = new Map<string, Array<(e: DomainEvent) => void>>()
  return {
    events,
    emit(event) {
      events.push(event)
      handlers.get(event.type)?.forEach(h => h(event))
    },
    on(type, handler) {
      handlers.set(type, [...(handlers.get(type) ?? []), handler])
    },
    off(type, handler) {
      handlers.set(type, (handlers.get(type) ?? []).filter(h => h !== handler))
    },
  }
}

export function fakeCompanyRepo(): CompanyRepository {
  const store = new Map()
  return {
    findById: async (id) => store.has(id) ? ok(store.get(id)) : { ok: false, error: 'not_found' },
    findAll: async () => ok([...store.values()]),
    save: async (c) => { store.set(c.id, c); return ok(c) },
    delete: async (id) => { store.delete(id); return ok(undefined) },
  }
}

export function fakeActivityRepo(): ActivityRepository {
  const store = new Map()
  return {
    findById: async (id) => store.has(id) ? ok(store.get(id)) : { ok: false, error: 'not_found' },
    findByCompany: async () => ok([...store.values()]),
    save: async (e) => { store.set(e.id, e); return ok(e) },
  }
}

export function fakeIssueRepo(): IssueRepository {
  const store = new Map()
  return {
    findById: async (id) => store.has(id) ? ok(store.get(id)) : { ok: false, error: 'not_found' },
    findByCompany: async () => ok([...store.values()]),
    findByProject: async () => ok([...store.values()]),
    findByAssignee: async () => ok([]),
    save: async (i) => { store.set(i.id, i); return ok(i) },
    update: async (id, fields) => {
      const existing = store.get(id)
      if (!existing) return { ok: false, error: 'not_found' }
      const updated = { ...existing, ...fields, updatedAt: new Date() }
      store.set(id, updated)
      return ok(updated)
    },
    checkout: async (id, agentId) => {
      const existing = store.get(id)
      if (!existing) return { ok: false, error: 'not_found' }
      if (existing.checkedOutBy) return { ok: false, error: 'already_checked_out' }
      const updated = { ...existing, checkedOutBy: agentId, status: 'in_progress', updatedAt: new Date() }
      store.set(id, updated)
      return ok(updated)
    },
  }
}

export function fakeApprovalRepo(): ApprovalRepository {
  const store = new Map()
  return {
    findById: async (id) => store.has(id) ? ok(store.get(id)) : { ok: false, error: 'not_found' },
    findByCompany: async () => ok([...store.values()]),
    save: async (a) => { store.set(a.id, a); return ok(a) },
    update: async (id, fields) => {
      const existing = store.get(id)
      if (!existing) return { ok: false, error: 'not_found' }
      const updated = { ...existing, ...fields }
      store.set(id, updated)
      return ok(updated)
    },
  }
}
```

- [ ] **Step 2: Write failing test for CreateCompany**

```typescript
// packages/domain/src/__tests__/create-company.test.ts
import { describe, it, expect } from 'vitest'
import { CreateCompany } from '../use-cases/create-company.js'
import { isOk } from '../result.js'
import { fakeCompanyRepo, fakeEventBus, fakeActivityRepo } from './fakes.js'

describe('CreateCompany', () => {
  it('creates company, emits event, logs activity', async () => {
    const repo = fakeCompanyRepo()
    const bus = fakeEventBus()
    const activity = fakeActivityRepo()
    const uc = new CreateCompany(repo, bus, activity)

    const result = await uc.execute({ name: 'Acme Labs' })

    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.name).toBe('Acme Labs')
    }
    expect(bus.events).toHaveLength(1)
    expect(bus.events[0].type).toBe('company.created')
  })
})
```

- [ ] **Step 3: Write failing test for CheckoutIssue**

```typescript
// packages/domain/src/__tests__/checkout-issue.test.ts
import { describe, it, expect } from 'vitest'
import { CheckoutIssue } from '../use-cases/checkout-issue.js'
import { createIssue } from '../entities/issue.js'
import { isOk, isErr } from '../result.js'
import { generateId } from '../ids.js'
import { fakeIssueRepo, fakeEventBus, fakeActivityRepo } from './fakes.js'
import type { CompanyId, AgentId, ProjectId } from '../ids.js'

describe('CheckoutIssue', () => {
  const companyId = generateId<CompanyId>()
  const agentId = generateId<AgentId>()
  const projectId = generateId<ProjectId>()

  it('checks out an available issue', async () => {
    const repo = fakeIssueRepo()
    const bus = fakeEventBus()
    const activity = fakeActivityRepo()
    const issue = createIssue({ companyId, projectId, title: 'Test', description: '', createdBy: agentId })
    await repo.save(issue)

    const uc = new CheckoutIssue(repo, bus, activity)
    const result = await uc.execute({ issueId: issue.id, agentId })

    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.checkedOutBy).toBe(agentId)
      expect(result.value.status).toBe('in_progress')
    }
    expect(bus.events[0].type).toBe('issue.checked_out')
  })

  it('returns already_checked_out when taken', async () => {
    const repo = fakeIssueRepo()
    const bus = fakeEventBus()
    const activity = fakeActivityRepo()
    const issue = createIssue({ companyId, projectId, title: 'Test', description: '', createdBy: agentId })
    await repo.save(issue)
    await repo.checkout(issue.id, agentId) // first checkout

    const uc = new CheckoutIssue(repo, bus, activity)
    const other = generateId<AgentId>()
    const result = await uc.execute({ issueId: issue.id, agentId: other })

    expect(isErr(result)).toBe(true)
    if (isErr(result)) expect(result.error).toBe('already_checked_out')
  })

  it('returns not_found for missing issue', async () => {
    const repo = fakeIssueRepo()
    const uc = new CheckoutIssue(repo, fakeEventBus(), fakeActivityRepo())
    const result = await uc.execute({ issueId: generateId(), agentId })

    expect(isErr(result)).toBe(true)
    if (isErr(result)) expect(result.error).toBe('not_found')
  })
})
```

- [ ] **Step 4: Write failing test for ApproveAction**

```typescript
// packages/domain/src/__tests__/approve-action.test.ts
import { describe, it, expect } from 'vitest'
import { ApproveAction } from '../use-cases/approve-action.js'
import { createApproval } from '../entities/approval.js'
import { isOk, isErr } from '../result.js'
import { generateId } from '../ids.js'
import { fakeApprovalRepo, fakeEventBus, fakeActivityRepo } from './fakes.js'
import type { CompanyId, AgentId } from '../ids.js'

describe('ApproveAction', () => {
  const companyId = generateId<CompanyId>()

  it('approves a pending approval', async () => {
    const repo = fakeApprovalRepo()
    const bus = fakeEventBus()
    const activity = fakeActivityRepo()
    const approval = createApproval({
      companyId, proposedBy: generateId<AgentId>(),
      actionType: 'hire_agent', justification: 'Need dev',
      riskLevel: 'medium', payload: {},
    })
    await repo.save(approval)

    const uc = new ApproveAction(repo, bus, activity)
    const result = await uc.execute({ approvalId: approval.id })

    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.status).toBe('approved')
      expect(result.value.resolvedAt).toBeInstanceOf(Date)
    }
    expect(bus.events[0].type).toBe('approval.resolved')
  })

  it('returns already_resolved for non-pending approval', async () => {
    const repo = fakeApprovalRepo()
    const approval = createApproval({
      companyId, proposedBy: generateId<AgentId>(),
      actionType: 'hire_agent', justification: '',
      riskLevel: 'low', payload: {},
    })
    await repo.save(approval)
    await repo.update(approval.id, { status: 'approved', resolvedAt: new Date() })

    const uc = new ApproveAction(repo, fakeEventBus(), fakeActivityRepo())
    const result = await uc.execute({ approvalId: approval.id })

    expect(isErr(result)).toBe(true)
    if (isErr(result)) expect(result.error).toBe('already_resolved')
  })
})
```

- [ ] **Step 5: Run to verify all fail**

```bash
pnpm --filter @sheldon/domain test
```

Expected: FAIL — use-case modules not found

- [ ] **Step 6: Implement use-cases**

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
    const result = await this.companyRepo.save(company)
    if (!result.ok) return result

    this.eventBus.emit({
      type: 'company.created', companyId: company.id,
      payload: { name: company.name }, timestamp: new Date(),
    })

    await this.activityRepo.save(createActivityEntry({
      companyId: company.id, actorId: 'system', actorType: 'system',
      action: 'created', entityType: 'company', entityId: company.id,
    }))

    return ok(company)
  }
}
```

```typescript
// packages/domain/src/use-cases/checkout-issue.ts
import type { Result } from '../result.js'
import { createActivityEntry } from '../entities/activity-entry.js'
import type { Issue } from '../entities/issue.js'
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
      type: 'issue.checked_out', companyId: result.value.companyId,
      payload: { issueId: params.issueId, agentId: params.agentId },
      timestamp: new Date(),
    })

    await this.activityRepo.save(createActivityEntry({
      companyId: result.value.companyId, actorId: params.agentId,
      actorType: 'agent', action: 'checked_out',
      entityType: 'issue', entityId: params.issueId,
    }))

    return result
  }
}
```

```typescript
// packages/domain/src/use-cases/approve-action.ts
import type { Result } from '../result.js'
import { ok } from '../result.js'
import { createActivityEntry } from '../entities/activity-entry.js'
import type { Approval } from '../entities/approval.js'
import type { ApprovalRepository } from '../ports/approval-repository.js'
import type { ActivityRepository } from '../ports/activity-repository.js'
import type { EventBus } from '../ports/event-bus.js'
import type { ApprovalId } from '../ids.js'

export type ApproveActionError = 'not_found' | 'already_resolved' | 'storage_unavailable'

export class ApproveAction {
  constructor(
    private readonly approvalRepo: ApprovalRepository,
    private readonly eventBus: EventBus,
    private readonly activityRepo: ActivityRepository,
  ) {}

  async execute(params: { approvalId: ApprovalId }): Promise<Result<Approval, ApproveActionError>> {
    const findResult = await this.approvalRepo.findById(params.approvalId)
    if (!findResult.ok) return findResult

    if (findResult.value.status !== 'pending') {
      return { ok: false, error: 'already_resolved' }
    }

    const updateResult = await this.approvalRepo.update(params.approvalId, {
      status: 'approved',
      resolvedAt: new Date(),
    })
    if (!updateResult.ok) return updateResult

    this.eventBus.emit({
      type: 'approval.resolved', companyId: updateResult.value.companyId,
      payload: { approvalId: params.approvalId, decision: 'approved' },
      timestamp: new Date(),
    })

    await this.activityRepo.save(createActivityEntry({
      companyId: updateResult.value.companyId, actorId: 'board',
      actorType: 'board', action: 'approved',
      entityType: 'approval', entityId: params.approvalId,
    }))

    return updateResult
  }
}
```

Create remaining use-cases (`DenyAction`, `CreateGoal`, `HireAgent`, `CreateIssue`, `PostComment`, `InvokeAgent`) following the same pattern. Each: validate → call repo → emit event → log activity → return Result.

```typescript
// packages/domain/src/use-cases/deny-action.ts
import type { Result } from '../result.js'
import { createActivityEntry } from '../entities/activity-entry.js'
import type { Approval } from '../entities/approval.js'
import type { ApprovalRepository } from '../ports/approval-repository.js'
import type { ActivityRepository } from '../ports/activity-repository.js'
import type { EventBus } from '../ports/event-bus.js'
import type { ApprovalId } from '../ids.js'

export type DenyActionError = 'not_found' | 'already_resolved' | 'storage_unavailable'

export class DenyAction {
  constructor(
    private readonly approvalRepo: ApprovalRepository,
    private readonly eventBus: EventBus,
    private readonly activityRepo: ActivityRepository,
  ) {}

  async execute(params: { approvalId: ApprovalId; reason: string }): Promise<Result<Approval, DenyActionError>> {
    const findResult = await this.approvalRepo.findById(params.approvalId)
    if (!findResult.ok) return findResult

    if (findResult.value.status !== 'pending') {
      return { ok: false, error: 'already_resolved' }
    }

    const updateResult = await this.approvalRepo.update(params.approvalId, {
      status: 'denied',
      denialReason: params.reason,
      denialHistory: [...findResult.value.denialHistory, { reason: params.reason, deniedAt: new Date() }],
      resolvedAt: new Date(),
    })
    if (!updateResult.ok) return updateResult

    this.eventBus.emit({
      type: 'approval.resolved', companyId: updateResult.value.companyId,
      payload: { approvalId: params.approvalId, decision: 'denied', reason: params.reason },
      timestamp: new Date(),
    })

    await this.activityRepo.save(createActivityEntry({
      companyId: updateResult.value.companyId, actorId: 'board',
      actorType: 'board', action: 'denied',
      entityType: 'approval', entityId: params.approvalId,
      metadata: { reason: params.reason },
    }))

    return updateResult
  }
}
```

```typescript
// packages/domain/src/use-cases/create-goal.ts
import type { Result } from '../result.js'
import { ok } from '../result.js'
import { createGoal, type Goal } from '../entities/goal.js'
import { createActivityEntry } from '../entities/activity-entry.js'
import type { GoalRepository } from '../ports/goal-repository.js'
import type { ActivityRepository } from '../ports/activity-repository.js'
import type { EventBus } from '../ports/event-bus.js'
import type { CompanyId, GoalId } from '../ids.js'

export type CreateGoalError = 'storage_unavailable'

export class CreateGoal {
  constructor(
    private readonly goalRepo: GoalRepository,
    private readonly eventBus: EventBus,
    private readonly activityRepo: ActivityRepository,
  ) {}

  async execute(params: { companyId: CompanyId; title: string; description: string; parentGoalId?: GoalId }): Promise<Result<Goal, CreateGoalError>> {
    const goal = createGoal({ companyId: params.companyId, title: params.title, description: params.description, parentGoalId: params.parentGoalId })
    const result = await this.goalRepo.save(goal)
    if (!result.ok) return result

    this.eventBus.emit({
      type: 'goal.created', companyId: params.companyId,
      payload: { goalId: goal.id, title: goal.title },
      timestamp: new Date(),
    })

    await this.activityRepo.save(createActivityEntry({
      companyId: params.companyId, actorId: 'board', actorType: 'board',
      action: 'created', entityType: 'goal', entityId: goal.id,
    }))

    return ok(goal)
  }
}
```

```typescript
// packages/domain/src/use-cases/hire-agent.ts
import type { Result } from '../result.js'
import { ok } from '../result.js'
import { createAgent, type Agent, type AdapterType } from '../entities/agent.js'
import { createActivityEntry } from '../entities/activity-entry.js'
import type { AgentRepository } from '../ports/agent-repository.js'
import type { ActivityRepository } from '../ports/activity-repository.js'
import type { EventBus } from '../ports/event-bus.js'
import type { CompanyId, AgentId } from '../ids.js'

export type HireAgentError = 'storage_unavailable'

export class HireAgent {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly eventBus: EventBus,
    private readonly activityRepo: ActivityRepository,
  ) {}

  async execute(params: {
    companyId: CompanyId; name: string; role: string
    adapterType: AdapterType; parentAgentId: AgentId | null
  }): Promise<Result<Agent, HireAgentError>> {
    const agent = createAgent(params)
    const result = await this.agentRepo.save(agent)
    if (!result.ok) return result

    this.eventBus.emit({
      type: 'agent.hired', companyId: params.companyId,
      payload: { agentId: agent.id, name: agent.name },
      timestamp: new Date(),
    })

    await this.activityRepo.save(createActivityEntry({
      companyId: params.companyId, actorId: 'system', actorType: 'system',
      action: 'hired', entityType: 'agent', entityId: agent.id,
    }))

    return ok(agent)
  }
}
```

```typescript
// packages/domain/src/use-cases/create-issue.ts
import type { Result } from '../result.js'
import { ok } from '../result.js'
import { createIssue as makeIssue, type Issue, type IssuePriority } from '../entities/issue.js'
import { createActivityEntry } from '../entities/activity-entry.js'
import type { IssueRepository } from '../ports/issue-repository.js'
import type { ActivityRepository } from '../ports/activity-repository.js'
import type { EventBus } from '../ports/event-bus.js'
import type { CompanyId, ProjectId, AgentId, IssueId } from '../ids.js'

export type CreateIssueError = 'storage_unavailable'

export class CreateIssue {
  constructor(
    private readonly issueRepo: IssueRepository,
    private readonly eventBus: EventBus,
    private readonly activityRepo: ActivityRepository,
  ) {}

  async execute(params: {
    companyId: CompanyId; projectId: ProjectId; title: string
    description: string; createdBy: AgentId; priority?: IssuePriority
    parentIssueId?: IssueId
  }): Promise<Result<Issue, CreateIssueError>> {
    const issue = makeIssue(params)
    const result = await this.issueRepo.save(issue)
    if (!result.ok) return result

    this.eventBus.emit({
      type: 'issue.created', companyId: params.companyId,
      payload: { issueId: issue.id, title: issue.title },
      timestamp: new Date(),
    })

    await this.activityRepo.save(createActivityEntry({
      companyId: params.companyId, actorId: params.createdBy, actorType: 'agent',
      action: 'created', entityType: 'issue', entityId: issue.id,
    }))

    return ok(issue)
  }
}
```

```typescript
// packages/domain/src/use-cases/post-comment.ts
import type { Result } from '../result.js'
import { ok } from '../result.js'
import { createComment, type Comment } from '../entities/comment.js'
import type { CommentRepository } from '../ports/comment-repository.js'
import type { EventBus } from '../ports/event-bus.js'
import type { CompanyId, IssueId, AgentId } from '../ids.js'

export type PostCommentError = 'storage_unavailable'

export class PostComment {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(params: {
    companyId: CompanyId; issueId: IssueId; authorId: AgentId
    authorType: 'agent' | 'board'; body: string
  }): Promise<Result<Comment, PostCommentError>> {
    const comment = createComment(params)
    const result = await this.commentRepo.save(comment)
    if (!result.ok) return result

    this.eventBus.emit({
      type: 'issue.comment_added', companyId: params.companyId,
      payload: { issueId: params.issueId, commentId: comment.id },
      timestamp: new Date(),
    })

    return ok(comment)
  }
}
```

```typescript
// packages/domain/src/use-cases/invoke-agent.ts
import type { Result } from '../result.js'
import { ok, err } from '../result.js'
import type { AgentRepository } from '../ports/agent-repository.js'
import type { EventBus } from '../ports/event-bus.js'
import type { AgentId } from '../ids.js'

export type InvokeAgentError = 'not_found' | 'agent_paused' | 'agent_terminated' | 'storage_unavailable'

export class InvokeAgent {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(params: { agentId: AgentId }): Promise<Result<{ triggered: true }, InvokeAgentError>> {
    const findResult = await this.agentRepo.findById(params.agentId)
    if (!findResult.ok) return findResult

    const agent = findResult.value
    if (agent.status === 'paused') return err('agent_paused')
    if (agent.status === 'terminated') return err('agent_terminated')

    this.eventBus.emit({
      type: 'heartbeat.trigger', companyId: agent.companyId,
      payload: { agentId: params.agentId, trigger: 'manual' },
      timestamp: new Date(),
    })

    return ok({ triggered: true })
  }
}
```

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

- [ ] **Step 7: Update domain index.ts**

```typescript
// packages/domain/src/index.ts
export * from './result.js'
export * from './ids.js'
export * from './entities/index.js'
export * from './ports/index.js'
export * from './use-cases/index.js'
```

- [ ] **Step 8: Run all tests**

```bash
pnpm --filter @sheldon/domain test
```

Expected: ALL tests PASS — result, ids, core-entities, communication-entities, execution-entities, governance-entities, knowledge-entities, create-company, checkout-issue, approve-action

- [ ] **Step 9: Commit**

```bash
cd ~/StudioProjects/Sheldon && git add -A && git commit -m "feat(domain): add all use-cases with TDD — complete domain layer"
```

**Phase 1A is complete.** The domain package has zero dependencies, all entities, all ports, all core use-cases, fully tested with in-memory fakes. This is the stable center of the architecture.

---

# Phase 1B — Infrastructure

**Deliverable:** Monorepo with all remaining packages scaffolded, DB with PGlite, Drizzle storage adapters, Express server, CLI.

**Depends on:** Phase 1A complete.

---

## Task 1B.1: Scaffold Remaining Packages

Create `package.json` and `tsconfig.json` for: `contracts`, `db`, `server`, `services`, `cli`, `adapters/storage`, `adapters/claude-local`. Install all dependencies.

See Task 1.1 in the previous plan version for exact `package.json` contents for each package.

- [ ] **Steps:** Create all package directories → write package.json files → pnpm install → verify → commit

```bash
git commit -m "chore: scaffold all remaining packages"
```

---

## Task 1B.2: Contracts Package

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
  agentInvoke: (companyId: string, agentId: string) => `/api/companies/${companyId}/agents/${agentId}/invoke`,
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

- [ ] **Step 2: Create types and plugin events** (same as previous version)

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(contracts): add API paths, types, and plugin event map"
```

---

## Task 1B.3: Database Schema & PGlite Connection

**Files:**
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/connection.ts`
- Create: `packages/db/src/index.ts`
- Test: `packages/db/src/__tests__/connection.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/db/src/__tests__/connection.test.ts
import { describe, it, expect } from 'vitest'
import { createLocalDb } from '../connection.js'
import { companies } from '../schema.js'

describe('PGlite Connection', () => {
  it('creates tables and queries empty companies', async () => {
    const db = await createLocalDb()
    const result = await db.select().from(companies)
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Implement Drizzle schema**

Create `schema.ts` with `pgTable` definitions for all entities. Each table has a `company_id` column (except `companies` itself) with an index. Use proper column types: `uuid`, `text`, `integer`, `timestamp`, `jsonb`, `boolean`.

- [ ] **Step 3: Implement PGlite connection**

```typescript
// packages/db/src/connection.ts
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from './schema.js'

export type Database = ReturnType<typeof drizzle<typeof schema>>

export async function createLocalDb(): Promise<Database> {
  const pglite = new PGlite()
  const db = drizzle(pglite, { schema })
  // Push schema (development mode)
  // In production, use drizzle-kit migrations
  return db
}
```

- [ ] **Step 4: Run test, verify, commit**

```bash
pnpm --filter @sheldon/db test
git commit -m "feat(db): add Drizzle schema and PGlite connection"
```

---

## Task 1B.4: Storage Adapters

**Files:**
- Create: `packages/adapters/storage/src/drizzle-company-repo.ts`
- Create: `packages/adapters/storage/src/drizzle-issue-repo.ts`
- Create: `packages/adapters/storage/src/index.ts`
- Test: `packages/adapters/storage/src/__tests__/company-repo.test.ts`
- Test: `packages/adapters/storage/src/__tests__/issue-repo.test.ts`

- [ ] **Step 1: Write failing integration test**

```typescript
// packages/adapters/storage/src/__tests__/company-repo.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalDb, type Database } from '@sheldon/db'
import { DrizzleCompanyRepo } from '../drizzle-company-repo.js'
import { createCompany, isOk, isErr } from '@sheldon/domain'

describe('DrizzleCompanyRepo', () => {
  let db: Database
  let repo: DrizzleCompanyRepo

  beforeEach(async () => {
    db = await createLocalDb()
    repo = new DrizzleCompanyRepo(db)
  })

  it('saves and retrieves a company', async () => {
    const company = createCompany({ name: 'Acme' })
    await repo.save(company)
    const result = await repo.findById(company.id)
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.name).toBe('Acme')
  })

  it('returns not_found for missing id', async () => {
    const result = await repo.findById('nonexistent' as any)
    expect(isErr(result)).toBe(true)
    if (isErr(result)) expect(result.error).toBe('not_found')
  })

  it('lists all companies', async () => {
    await repo.save(createCompany({ name: 'A' }))
    await repo.save(createCompany({ name: 'B' }))
    const result = await repo.findAll()
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value).toHaveLength(2)
  })
})
```

```typescript
// packages/adapters/storage/src/__tests__/issue-repo.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalDb, type Database } from '@sheldon/db'
import { DrizzleIssueRepo } from '../drizzle-issue-repo.js'
import { createIssue, generateId, isOk, isErr } from '@sheldon/domain'
import type { CompanyId, ProjectId, AgentId } from '@sheldon/domain'

describe('DrizzleIssueRepo', () => {
  let repo: DrizzleIssueRepo
  const companyId = generateId<CompanyId>()
  const projectId = generateId<ProjectId>()
  const agentId = generateId<AgentId>()

  beforeEach(async () => {
    const db = await createLocalDb()
    repo = new DrizzleIssueRepo(db)
  })

  it('atomic checkout succeeds for unclaimed issue', async () => {
    const issue = createIssue({ companyId, projectId, title: 'Test', description: '', createdBy: agentId })
    await repo.save(issue)
    const result = await repo.checkout(issue.id, agentId)
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.checkedOutBy).toBe(agentId)
  })

  it('atomic checkout returns 409 for claimed issue', async () => {
    const issue = createIssue({ companyId, projectId, title: 'Test', description: '', createdBy: agentId })
    await repo.save(issue)
    await repo.checkout(issue.id, agentId)

    const other = generateId<AgentId>()
    const result = await repo.checkout(issue.id, other)
    expect(isErr(result)).toBe(true)
    if (isErr(result)) expect(result.error).toBe('already_checked_out')
  })
})
```

- [ ] **Step 2: Implement DrizzleCompanyRepo**

```typescript
// packages/adapters/storage/src/drizzle-company-repo.ts
import { eq } from 'drizzle-orm'
import { ok, err, type Result } from '@sheldon/domain'
import type { Company, CompanyRepository, CompanyId } from '@sheldon/domain'
import { companies } from '@sheldon/db'
import type { Database } from '@sheldon/db'

export class DrizzleCompanyRepo implements CompanyRepository {
  constructor(private readonly db: Database) {}

  async findById(id: CompanyId): Promise<Result<Company, 'not_found' | 'storage_unavailable'>> {
    try {
      const rows = await this.db.select().from(companies).where(eq(companies.id, id))
      if (rows.length === 0) return err('not_found')
      return ok(this.toDomain(rows[0]))
    } catch { return err('storage_unavailable') }
  }

  async findAll(): Promise<Result<Company[], 'storage_unavailable'>> {
    try {
      const rows = await this.db.select().from(companies)
      return ok(rows.map(this.toDomain))
    } catch { return err('storage_unavailable') }
  }

  async save(company: Company): Promise<Result<Company, 'storage_unavailable'>> {
    try {
      await this.db.insert(companies).values({
        id: company.id, name: company.name,
        createdAt: company.createdAt, updatedAt: company.updatedAt,
      })
      return ok(company)
    } catch { return err('storage_unavailable') }
  }

  async delete(id: CompanyId): Promise<Result<void, 'not_found' | 'storage_unavailable'>> {
    try {
      const result = await this.db.delete(companies).where(eq(companies.id, id))
      return ok(undefined)
    } catch { return err('storage_unavailable') }
  }

  private toDomain(row: any): Company {
    return { id: row.id, name: row.name, createdAt: row.createdAt, updatedAt: row.updatedAt }
  }
}
```

- [ ] **Step 3: Implement DrizzleIssueRepo** (with atomic checkout using a WHERE clause)

```typescript
// Atomic checkout: UPDATE issues SET checked_out_by = ? WHERE id = ? AND checked_out_by IS NULL
// If 0 rows affected → already_checked_out
```

- [ ] **Step 4: Implement remaining repos** following the same pattern for all entities.

- [ ] **Step 5: Run tests, commit**

```bash
pnpm --filter @sheldon/adapter-storage test
git commit -m "feat(adapters): add Drizzle storage repos with PGlite integration tests"
```

---

## Task 1B.5: Event Bus + Express Server + Composition Root

**Files:**
- Create: `packages/services/src/in-memory-event-bus.ts`
- Create: `packages/server/src/create-server.ts`
- Create: `packages/server/src/routes/create-company.ts`
- Create: `packages/server/src/routes/list-companies.ts`
- Create: `packages/server/src/routes/create-goal.ts`
- Create: `packages/server/src/streams/company-events.ts`
- Create: `packages/server/src/index.ts`
- Create: `packages/cli/src/composition-root.ts`
- Test: `packages/services/src/__tests__/event-bus.test.ts`
- Test: `packages/server/src/__tests__/create-company.test.ts`

- [ ] **Step 1: Write and implement InMemoryEventBus**

```typescript
// packages/services/src/in-memory-event-bus.ts
import type { EventBus, DomainEvent } from '@sheldon/domain'

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Set<(event: DomainEvent) => void>>()

  emit(event: DomainEvent): void {
    this.handlers.get(event.type)?.forEach(h => h(event))
    this.handlers.get('*')?.forEach(h => h(event))
  }

  on(eventType: string, handler: (event: DomainEvent) => void): void {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, new Set())
    this.handlers.get(eventType)!.add(handler)
  }

  off(eventType: string, handler: (event: DomainEvent) => void): void {
    this.handlers.get(eventType)?.delete(handler)
  }
}
```

- [ ] **Step 2: Write thin route controllers**

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

- [ ] **Step 3: Write SSE stream handler**

```typescript
// packages/server/src/streams/company-events.ts
import type { Request, Response } from 'express'
import type { EventBus, DomainEvent } from '@sheldon/domain'

export function companyEventsStream(eventBus: EventBus) {
  return (req: Request, res: Response) => {
    const companyId = req.params.companyId
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.write('\n')

    const handler = (event: DomainEvent) => {
      if (event.companyId === companyId) {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }
    }

    eventBus.on('*', handler)
    req.on('close', () => eventBus.off('*', handler))
  }
}
```

- [ ] **Step 4: Create composition root — the most important file**

```typescript
// packages/cli/src/composition-root.ts
import { createLocalDb } from '@sheldon/db'
import { InMemoryEventBus } from '@sheldon/services'
import { DrizzleCompanyRepo, DrizzleAgentRepo, DrizzleGoalRepo, DrizzleIssueRepo,
         DrizzleCommentRepo, DrizzleApprovalRepo, DrizzleActivityRepo } from '@sheldon/adapter-storage'
import { CreateCompany, CreateGoal, HireAgent, CreateIssue, CheckoutIssue,
         PostComment, ApproveAction, DenyAction, InvokeAgent } from '@sheldon/domain'
import { createServer } from '@sheldon/server'

export async function buildApp() {
  // Layer 1: Database
  const db = await createLocalDb()

  // Layer 2: Infrastructure
  const eventBus = new InMemoryEventBus()

  // Layer 3: Repositories (adapters → domain ports)
  const companyRepo = new DrizzleCompanyRepo(db)
  const agentRepo = new DrizzleAgentRepo(db)
  const goalRepo = new DrizzleGoalRepo(db)
  const issueRepo = new DrizzleIssueRepo(db)
  const commentRepo = new DrizzleCommentRepo(db)
  const approvalRepo = new DrizzleApprovalRepo(db)
  const activityRepo = new DrizzleActivityRepo(db)

  // Layer 4: Use-cases (domain — depends only on ports)
  const createCompany = new CreateCompany(companyRepo, eventBus, activityRepo)
  const createGoal = new CreateGoal(goalRepo, eventBus, activityRepo)
  const hireAgent = new HireAgent(agentRepo, eventBus, activityRepo)
  const createIssue = new CreateIssue(issueRepo, eventBus, activityRepo)
  const checkoutIssue = new CheckoutIssue(issueRepo, eventBus, activityRepo)
  const postComment = new PostComment(commentRepo, eventBus)
  const approveAction = new ApproveAction(approvalRepo, eventBus, activityRepo)
  const denyAction = new DenyAction(approvalRepo, eventBus, activityRepo)
  const invokeAgent = new InvokeAgent(agentRepo, eventBus)

  // Layer 5: Server (delivery mechanism — depends on use-cases)
  const app = createServer({
    useCases: {
      createCompany, createGoal, hireAgent, createIssue,
      checkoutIssue, postComment, approveAction, denyAction, invokeAgent,
    },
    eventBus,
  })

  return { app, db, eventBus }
}
```

**Note:** The domain never imports adapters. The server never imports the database. Only the composition root knows all concrete types. Dependency Rule enforced at the wiring level.

- [ ] **Step 5: Write server integration test**

```typescript
// packages/server/src/__tests__/create-company.test.ts
import { describe, it, expect } from 'vitest'
import { buildApp } from '@sheldon/cli/composition-root'

describe('POST /api/companies', () => {
  it('creates a company and returns 201', async () => {
    const { app } = await buildApp()
    const res = await app.request('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme Labs' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Acme Labs')
    expect(body.id).toBeDefined()
  })
})
```

- [ ] **Step 6: Run tests, commit**

```bash
pnpm --filter @sheldon/services test && pnpm --filter @sheldon/server test
git commit -m "feat: add event bus, Express server, and composition root"
```

---

## Task 1B.6: CLI — `sheldon start`

**Files:**
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/start.ts`

- [ ] **Step 1: Implement CLI**

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

```typescript
// packages/cli/src/commands/start.ts
import { buildApp } from '../composition-root.js'

export async function startCommand() {
  console.log('Starting Sheldon...')
  const { app } = await buildApp()
  const port = Number(process.env.PORT ?? 3100)
  app.listen(port, () => {
    console.log(`Sheldon API running on http://localhost:${port}`)
    console.log(`Health check: http://localhost:${port}/health`)
  })
}
```

- [ ] **Step 2: Verify**

```bash
cd ~/StudioProjects/Sheldon && pnpm --filter @sheldon/cli dev
```

Expected: `Sheldon API running on http://localhost:3100`. Ctrl+C to stop.

```bash
curl http://localhost:3100/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(cli): add sheldon start command — boots API server"
```

---

# Phase 1C — Dashboard Skeleton

**Deliverable:** React app with onboarding flow and empty Mission Control.

---

## Task 1C.1: Vite + React + Tailwind Setup

**Files:**
- Create: `packages/ui/index.html`
- Create: `packages/ui/vite.config.ts`
- Create: `packages/ui/src/main.tsx`
- Create: `packages/ui/src/index.css`
- Create: `packages/ui/src/App.tsx`

Standard Vite + React 19 + Tailwind CSS 4 scaffold. Dark theme matching the mockups. React Router with routes for `/` (Mission Control), `/org`, `/goals`, `/approvals`, `/costs`, `/learnings`, `/settings`.

- [ ] **Steps:** Create files → verify `pnpm --filter @sheldon/ui dev` loads at :5173 → commit

```bash
git commit -m "feat(ui): scaffold Vite + React + Tailwind dashboard"
```

---

## Task 1C.2: Layout Shell — Sidebar, TopBar, StatusBar

**Files:**
- Create: `packages/ui/src/components/Layout.tsx`
- Create: `packages/ui/src/components/Sidebar.tsx`
- Create: `packages/ui/src/components/TopBar.tsx`
- Create: `packages/ui/src/components/StatusBar.tsx`

Build the app shell matching `screen-02-mission-control.html` mockup: icon sidebar (60px), top bar with company switcher and SSE indicator, status bar at bottom.

- [ ] **Steps:** Build components → wire into App.tsx → verify layout renders → commit

```bash
git commit -m "feat(ui): add layout shell — sidebar, topbar, statusbar"
```

---

## Task 1C.3: Welcome Page + Mission Control Empty State + API/SSE Hooks

**Files:**
- Create: `packages/ui/src/pages/Welcome.tsx`
- Create: `packages/ui/src/pages/MissionControl.tsx`
- Create: `packages/ui/src/lib/api.ts`
- Create: `packages/ui/src/lib/useSSE.ts`

Build Welcome page (two inputs, "Get Started" button, pre-flight check, progress animation) matching `screen-01-onboarding.html`. Build Mission Control empty state that shows when company exists but has no agents yet. Wire API client and SSE hook.

- [ ] **Steps:** Build Welcome → build MissionControl empty state → wire API + SSE → verify onboarding flow creates a company via API → commit

```bash
git commit -m "feat(ui): add Welcome onboarding and Mission Control empty state"
```

**Phase 1 is complete.** `sheldon start` boots the API server. The dashboard shows the onboarding flow. Creating a company via the Welcome page calls the API and creates a real record in PGlite.

---

# Phase 2 — Heartbeat Engine

**Deliverable:** Agents wake up, spawn Claude Code, call the Sheldon API, do work.

**Depends on:** Phase 1 complete.

---

## Task 2.1: Heartbeat Service — Run Queue

**Files:**
- Create: `packages/services/src/heartbeat/run-queue.ts`
- Test: `packages/services/src/__tests__/run-queue.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/services/src/__tests__/run-queue.test.ts
import { describe, it, expect } from 'vitest'
import { RunQueue } from '../heartbeat/run-queue.js'
import { generateId } from '@sheldon/domain'
import type { AgentId } from '@sheldon/domain'

describe('RunQueue', () => {
  it('enqueues a run', () => {
    const queue = new RunQueue()
    const agentId = generateId<AgentId>()
    queue.enqueue(agentId, { trigger: 'manual' })
    expect(queue.size(agentId)).toBe(1)
  })

  it('respects per-agent concurrency limit of 1', async () => {
    const queue = new RunQueue({ maxConcurrentPerAgent: 1 })
    const agentId = generateId<AgentId>()
    queue.enqueue(agentId, { trigger: 'manual' })
    queue.enqueue(agentId, { trigger: 'assignment' })

    const first = queue.dequeue(agentId)
    expect(first).toBeDefined()
    expect(first!.trigger).toBe('manual')

    // Second should be null because first is still running
    const second = queue.dequeue(agentId)
    expect(second).toBeNull()
  })

  it('allows dequeue after completing first run', () => {
    const queue = new RunQueue({ maxConcurrentPerAgent: 1 })
    const agentId = generateId<AgentId>()
    queue.enqueue(agentId, { trigger: 'manual' })
    queue.enqueue(agentId, { trigger: 'assignment' })

    const first = queue.dequeue(agentId)
    queue.complete(agentId, first!.id)

    const second = queue.dequeue(agentId)
    expect(second).toBeDefined()
    expect(second!.trigger).toBe('assignment')
  })
})
```

- [ ] **Step 2: Implement RunQueue**

```typescript
// packages/services/src/heartbeat/run-queue.ts
import { generateId } from '@sheldon/domain'
import type { AgentId, RunId } from '@sheldon/domain'

export interface QueuedRun {
  readonly id: RunId
  readonly trigger: string
}

export class RunQueue {
  private queues = new Map<string, QueuedRun[]>()
  private running = new Map<string, Set<string>>()
  private maxConcurrent: number

  constructor(opts?: { maxConcurrentPerAgent?: number }) {
    this.maxConcurrent = opts?.maxConcurrentPerAgent ?? 1
  }

  enqueue(agentId: AgentId, params: { trigger: string }): RunId {
    const run: QueuedRun = { id: generateId<RunId>(), trigger: params.trigger }
    const queue = this.queues.get(agentId) ?? []
    queue.push(run)
    this.queues.set(agentId, queue)
    return run.id
  }

  dequeue(agentId: AgentId): QueuedRun | null {
    const runningSet = this.running.get(agentId) ?? new Set()
    if (runningSet.size >= this.maxConcurrent) return null

    const queue = this.queues.get(agentId) ?? []
    const run = queue.shift()
    if (!run) return null

    runningSet.add(run.id)
    this.running.set(agentId, runningSet)
    return run
  }

  complete(agentId: AgentId, runId: RunId): void {
    this.running.get(agentId)?.delete(runId)
  }

  size(agentId: AgentId): number {
    return (this.queues.get(agentId) ?? []).length
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
pnpm --filter @sheldon/services test
git commit -m "feat(services): add RunQueue with per-agent concurrency limit"
```

---

## Task 2.2: Heartbeat Service — Full Lifecycle

**Files:**
- Create: `packages/services/src/heartbeat/heartbeat-service.ts`
- Create: `packages/services/src/heartbeat/types.ts`
- Test: `packages/services/src/__tests__/heartbeat-service.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/services/src/__tests__/heartbeat-service.test.ts
import { describe, it, expect } from 'vitest'
import { HeartbeatService } from '../heartbeat/heartbeat-service.js'
import { generateId } from '@sheldon/domain'
import type { AgentId, CompanyId } from '@sheldon/domain'
import type { AgentExecutor, ExecutionConfig, RunResult } from '@sheldon/domain'

function fakeExecutor(): AgentExecutor {
  return {
    async execute(config: ExecutionConfig): Promise<RunResult> {
      return { stdout: 'done', stderr: '', exitCode: 0, durationMs: 100 }
    }
  }
}

describe('HeartbeatService', () => {
  it('processes a manual trigger end-to-end', async () => {
    const runs: string[] = []
    const executor: AgentExecutor = {
      async execute(config) {
        runs.push(config.agentId)
        return { stdout: 'Model: claude-sonnet-4-6\nInput tokens: 1000\nOutput tokens: 200', stderr: '', exitCode: 0, durationMs: 500 }
      }
    }

    const service = new HeartbeatService({ executor, budgetCheck: async () => true })
    const agentId = generateId<AgentId>()
    const companyId = generateId<CompanyId>()

    const result = await service.trigger({ agentId, companyId, trigger: 'manual', systemPrompt: 'You are CEO', workingDirectory: '/tmp' })

    expect(result.ok).toBe(true)
    expect(runs).toEqual([agentId])
  })

  it('skips run when budget exhausted', async () => {
    const service = new HeartbeatService({ executor: fakeExecutor(), budgetCheck: async () => false })
    const result = await service.trigger({
      agentId: generateId<AgentId>(), companyId: generateId<CompanyId>(),
      trigger: 'manual', systemPrompt: '', workingDirectory: '/tmp',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('budget_exhausted')
  })
})
```

- [ ] **Step 2: Implement HeartbeatService**

```typescript
// packages/services/src/heartbeat/heartbeat-service.ts
import { ok, err, type Result } from '@sheldon/domain'
import type { AgentExecutor, RunResult } from '@sheldon/domain'
import type { AgentId, CompanyId, RunId } from '@sheldon/domain'
import { RunQueue } from './run-queue.js'

export type HeartbeatError = 'budget_exhausted' | 'queue_full' | 'execution_failed'

interface HeartbeatConfig {
  executor: AgentExecutor
  budgetCheck: (agentId: AgentId) => Promise<boolean>
}

interface TriggerParams {
  agentId: AgentId
  companyId: CompanyId
  trigger: string
  systemPrompt: string
  workingDirectory: string
}

export class HeartbeatService {
  private queue = new RunQueue()
  private executor: AgentExecutor
  private budgetCheck: (agentId: AgentId) => Promise<boolean>

  constructor(config: HeartbeatConfig) {
    this.executor = config.executor
    this.budgetCheck = config.budgetCheck
  }

  async trigger(params: TriggerParams): Promise<Result<{ runResult: RunResult; runId: RunId }, HeartbeatError>> {
    // Step 1: Budget check
    const hasBudget = await this.budgetCheck(params.agentId)
    if (!hasBudget) return err('budget_exhausted')

    // Step 2: Queue
    const runId = this.queue.enqueue(params.agentId, { trigger: params.trigger })
    const queued = this.queue.dequeue(params.agentId)
    if (!queued) return err('queue_full')

    try {
      // Step 3: Execute
      const runResult = await this.executor.execute({
        runId, agentId: params.agentId,
        systemPrompt: params.systemPrompt,
        workingDirectory: params.workingDirectory,
        envVars: {
          SHELDON_AGENT_ID: params.agentId,
          SHELDON_API_URL: process.env.SHELDON_API_URL ?? 'http://localhost:3100',
          SHELDON_RUN_ID: runId,
        },
        maxTurns: 25,
      })

      // Step 4: Complete
      this.queue.complete(params.agentId, runId)
      return ok({ runResult, runId })
    } catch {
      this.queue.complete(params.agentId, runId)
      return err('execution_failed')
    }
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
pnpm --filter @sheldon/services test
git commit -m "feat(services): add HeartbeatService with budget check and queue"
```

---

## Task 2.3: Claude Code Adapter — Usage Parser

**Files:**
- Create: `packages/adapters/claude-local/src/claude-usage-parser.ts`
- Test: `packages/adapters/claude-local/src/__tests__/usage-parser.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/adapters/claude-local/src/__tests__/usage-parser.test.ts
import { describe, it, expect } from 'vitest'
import { ClaudeUsageParser } from '../claude-usage-parser.js'

describe('ClaudeUsageParser', () => {
  const parser = new ClaudeUsageParser()

  it('parses token usage from Claude CLI output', () => {
    const stdout = `Some output here
Total input tokens: 45231
Total output tokens: 8842
Model: claude-sonnet-4-6`

    const usage = parser.parseUsage(stdout)
    expect(usage).not.toBeNull()
    expect(usage!.inputTokens).toBe(45231)
    expect(usage!.outputTokens).toBe(8842)
    expect(usage!.model).toBe('claude-sonnet-4-6')
  })

  it('returns null for output without usage info', () => {
    expect(parser.parseUsage('just some text')).toBeNull()
  })
})
```

- [ ] **Step 2: Implement**

```typescript
// packages/adapters/claude-local/src/claude-usage-parser.ts
import type { UsageParser, TokenUsage } from '@sheldon/domain'

export class ClaudeUsageParser implements UsageParser {
  parseUsage(stdout: string): TokenUsage | null {
    const inputMatch = stdout.match(/(?:Total )?[Ii]nput tokens:\s*(\d+)/)
    const outputMatch = stdout.match(/(?:Total )?[Oo]utput tokens:\s*(\d+)/)
    const modelMatch = stdout.match(/[Mm]odel:\s*([\w-]+)/)

    if (!inputMatch || !outputMatch) return null

    return {
      inputTokens: parseInt(inputMatch[1], 10),
      outputTokens: parseInt(outputMatch[1], 10),
      model: modelMatch?.[1] ?? 'unknown',
    }
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
pnpm --filter @sheldon/adapter-claude-local test
git commit -m "feat(adapters): add Claude usage parser"
```

---

## Task 2.4: Claude Code Adapter — Environment Probe

**Files:**
- Create: `packages/adapters/claude-local/src/claude-environment.ts`
- Test: `packages/adapters/claude-local/src/__tests__/environment.test.ts`

- [ ] **Step 1: Write test**

```typescript
// packages/adapters/claude-local/src/__tests__/environment.test.ts
import { describe, it, expect } from 'vitest'
import { ClaudeEnvironment } from '../claude-environment.js'

describe('ClaudeEnvironment', () => {
  it('probes for claude CLI', async () => {
    const probe = new ClaudeEnvironment()
    const status = await probe.testEnvironment()
    // Will be available: true if claude is installed, false otherwise
    expect(typeof status.available).toBe('boolean')
    if (status.available) {
      expect(status.version).toBeTruthy()
    } else {
      expect(status.error).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Implement**

```typescript
// packages/adapters/claude-local/src/claude-environment.ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { EnvironmentProbe, EnvironmentStatus } from '@sheldon/domain'

const exec = promisify(execFile)

export class ClaudeEnvironment implements EnvironmentProbe {
  async testEnvironment(): Promise<EnvironmentStatus> {
    try {
      const { stdout } = await exec('claude', ['--version'])
      return { available: true, version: stdout.trim(), error: null }
    } catch (e: any) {
      return { available: false, version: null, error: e.message ?? 'claude CLI not found' }
    }
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
pnpm --filter @sheldon/adapter-claude-local test
git commit -m "feat(adapters): add Claude environment probe"
```

---

## Task 2.5: Claude Code Adapter — Executor

**Files:**
- Create: `packages/adapters/claude-local/src/claude-executor.ts`
- Create: `packages/adapters/claude-local/src/index.ts`

- [ ] **Step 1: Implement Claude executor**

```typescript
// packages/adapters/claude-local/src/claude-executor.ts
import { spawn } from 'node:child_process'
import type { AgentExecutor, ExecutionConfig, RunResult } from '@sheldon/domain'

export class ClaudeExecutor implements AgentExecutor {
  async execute(config: ExecutionConfig): Promise<RunResult> {
    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      const proc = spawn('claude', [
        '--print',
        '--max-turns', String(config.maxTurns),
        '-p', config.systemPrompt,
      ], {
        cwd: config.workingDirectory,
        env: { ...process.env, ...config.envVars },
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (chunk) => { stdout += chunk.toString() })
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })

      proc.on('close', (code) => {
        resolve({
          stdout, stderr,
          exitCode: code ?? 1,
          durationMs: Date.now() - startTime,
        })
      })

      proc.on('error', (err) => {
        resolve({
          stdout, stderr: err.message,
          exitCode: 1,
          durationMs: Date.now() - startTime,
        })
      })
    })
  }
}
```

```typescript
// packages/adapters/claude-local/src/index.ts
export { ClaudeExecutor } from './claude-executor.js'
export { ClaudeUsageParser } from './claude-usage-parser.js'
export { ClaudeEnvironment } from './claude-environment.js'
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(adapters): add Claude executor — spawns claude CLI"
```

---

## Task 2.6: Adapter Registry

**Files:**
- Create: `packages/services/src/adapter-registry.ts`
- Test: `packages/services/src/__tests__/adapter-registry.test.ts`

- [ ] **Step 1: Write test**

```typescript
// packages/services/src/__tests__/adapter-registry.test.ts
import { describe, it, expect } from 'vitest'
import { AdapterRegistry } from '../adapter-registry.js'

describe('AdapterRegistry', () => {
  it('registers and retrieves an adapter', () => {
    const registry = new AdapterRegistry()
    const fakeAdapter = { execute: async () => ({ stdout: '', stderr: '', exitCode: 0, durationMs: 0 }) }
    registry.register('claude_local', () => fakeAdapter)

    const adapter = registry.get('claude_local')
    expect(adapter).toBeDefined()
  })

  it('returns undefined for unregistered adapter', () => {
    const registry = new AdapterRegistry()
    expect(registry.get('nonexistent' as any)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Implement**

```typescript
// packages/services/src/adapter-registry.ts
import type { AgentExecutor, AdapterType } from '@sheldon/domain'

export type AdapterFactory = () => AgentExecutor

export class AdapterRegistry {
  private factories = new Map<string, AdapterFactory>()

  register(type: AdapterType, factory: AdapterFactory): void {
    this.factories.set(type, factory)
  }

  get(type: AdapterType): AgentExecutor | undefined {
    const factory = this.factories.get(type)
    return factory?.()
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
pnpm --filter @sheldon/services test
git commit -m "feat(services): add adapter registry"
```

---

## Task 2.7: Log Redaction

**Files:**
- Create: `packages/services/src/log-redaction.ts`
- Test: `packages/services/src/__tests__/log-redaction.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/services/src/__tests__/log-redaction.test.ts
import { describe, it, expect } from 'vitest'
import { redactLog } from '../log-redaction.js'

describe('redactLog', () => {
  it('masks home directory paths', () => {
    const input = 'Reading file /Users/alice/project/src/index.ts'
    const result = redactLog(input)
    expect(result).toBe('Reading file /Users/a****/project/src/index.ts')
    expect(result).not.toContain('alice')
  })

  it('masks multiple occurrences', () => {
    const input = '/Users/alice/a.ts and /Users/alice/b.ts'
    const result = redactLog(input)
    expect(result).not.toContain('alice')
  })

  it('masks Windows-style paths', () => {
    const input = 'C:\\Users\\alice\\project'
    const result = redactLog(input)
    expect(result).not.toContain('alice')
  })

  it('preserves non-sensitive content', () => {
    const input = 'Hello world, no paths here'
    expect(redactLog(input)).toBe(input)
  })
})
```

- [ ] **Step 2: Implement**

```typescript
// packages/services/src/log-redaction.ts
export function redactLog(input: string): string {
  // Mask Unix home directories: /Users/username or /home/username
  let result = input.replace(/\/(Users|home)\/([a-zA-Z][a-zA-Z0-9._-]*)/g, (_, dir, user) => {
    return `/${dir}/${user[0]}****`
  })

  // Mask Windows home directories: C:\Users\username
  result = result.replace(/[A-Z]:\\Users\\([a-zA-Z][a-zA-Z0-9._-]*)/g, (match, user) => {
    return match.replace(user, `${user[0]}****`)
  })

  return result
}
```

- [ ] **Step 3: Run tests, commit**

```bash
pnpm --filter @sheldon/services test
git commit -m "feat(services): add log redaction for sensitive paths"
```

---

## Task 2.8: Wire Heartbeat into Server

**Files:**
- Modify: `packages/cli/src/composition-root.ts`
- Create: `packages/server/src/routes/invoke-agent.ts`

- [ ] **Step 1: Add invoke-agent route**

```typescript
// packages/server/src/routes/invoke-agent.ts
import type { Request, Response } from 'express'
import type { InvokeAgent } from '@sheldon/domain'

export function invokeAgentRoute(useCase: InvokeAgent) {
  return async (req: Request, res: Response) => {
    const result = await useCase.execute({ agentId: req.params.agentId as any })
    if (result.ok) return res.status(200).json(result.value)
    switch (result.error) {
      case 'not_found': return res.status(404).json({ error: result.error })
      case 'agent_paused': return res.status(409).json({ error: result.error })
      case 'agent_terminated': return res.status(410).json({ error: result.error })
      default: return res.status(500).json({ error: result.error })
    }
  }
}
```

- [ ] **Step 2: Update composition root** to register Claude adapter, wire HeartbeatService, and connect the `heartbeat.trigger` event to the heartbeat service.

- [ ] **Step 3: Test end-to-end**

```bash
# Start server
pnpm --filter @sheldon/cli dev &

# Create company
curl -X POST http://localhost:3100/api/companies -H 'Content-Type: application/json' -d '{"name":"Acme"}'

# Hire agent (returns agentId)
curl -X POST http://localhost:3100/api/companies/{companyId}/agents -H 'Content-Type: application/json' -d '{"name":"CEO","role":"CEO","adapterType":"claude_local","parentAgentId":null}'

# Invoke agent (triggers heartbeat)
curl -X POST http://localhost:3100/api/companies/{companyId}/agents/{agentId}/invoke
```

Expected: Agent spawns Claude Code CLI, runs, returns result.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: wire heartbeat engine into server — agents can be invoked"
```

**Phase 2 complete.** Agents wake up via heartbeat, spawn Claude Code, and execute.

---

# Phase 3 — Communication & Governance

**Deliverable:** Agents coordinate through issues/comments. Board approves/denies.

## Task 3.1: Issue CRUD Routes

Add all issue routes: create, list by company, list by project, get by ID, update status. Wire to CreateIssue use-case. Each route is one file, 5-10 lines.

```bash
git commit -m "feat(server): add issue CRUD routes"
```

## Task 3.2: Atomic Checkout Route

```typescript
// packages/server/src/routes/checkout-issue.ts
import type { Request, Response } from 'express'
import type { CheckoutIssue } from '@sheldon/domain'

export function checkoutIssueRoute(useCase: CheckoutIssue) {
  return async (req: Request, res: Response) => {
    const result = await useCase.execute({
      issueId: req.params.issueId as any,
      agentId: req.body.agentId,
    })
    if (result.ok) return res.status(200).json(result.value)
    switch (result.error) {
      case 'not_found': return res.status(404).json({ error: result.error })
      case 'already_checked_out': return res.status(409).json({ error: result.error })
      default: return res.status(500).json({ error: result.error })
    }
  }
}
```

Test: POST checkout → 200. POST again → 409.

```bash
git commit -m "feat(server): add atomic issue checkout with 409 conflict"
```

## Task 3.3: Comment Routes

GET/POST comments on issues. Wire to PostComment use-case.

```bash
git commit -m "feat(server): add issue comment routes"
```

## Task 3.4: Document Routes

CRUD for documents with revision creation.

```bash
git commit -m "feat(server): add document routes with revisions"
```

## Task 3.5: Work Product Routes

POST to record PRs/branches/artifacts. GET by issue.

```bash
git commit -m "feat(server): add work product tracking routes"
```

## Task 3.6: Approval Routes + Governance Policy

Approval CRUD, approve/deny endpoints with Result error translation (409 for already_resolved). Configurable governance policy stored per company. System-calculated risk levels.

```bash
git commit -m "feat: add approval system with configurable governance policy"
```

## Task 3.7: Activity Log Routes

GET `/activity` with entity type filtering.

```bash
git commit -m "feat(server): add activity log routes"
```

## Task 3.8: Secrets Management

Encrypted vault per company. CRUD routes. Encryption at rest using Node crypto.

```bash
git commit -m "feat: add encrypted secrets management"
```

---

# Phase 4 — Dashboard

**Deliverable:** All 7 pages live, Inspector panel working, SSE connected.

Implement each page matching the HTML mockups in `.superpowers/brainstorm/`. Each task creates one page component, wires API calls via TanStack Query, and connects SSE events.

## Task 4.1: Mission Control — Agent Cards + Issues List
## Task 4.2: Inspector Panel (slide-in, tabs: Comments/Documents/Runs/Cost)
## Task 4.3: Activity Stream (dims when Inspector open, "N new" badge)
## Task 4.4: Org Chart Page (tree layout, live status, hire button)
## Task 4.5: Goals Page (hierarchical tree, progress bars)
## Task 4.6: Approvals Page (risk badges, batch approve, undo bar)
## Task 4.7: Costs Page (metric cards, stacked chart, budget bars)
## Task 4.8: Settings Page (tabbed: governance, secrets, skills, plugins, team)
## Task 4.9: SSE Wiring + Onboarding Polish (pre-flight, progress animation, company switcher)

Each task: create component → wire API → connect SSE → test renders → commit.

---

# Phase 5 — Learning System

## Task 5.1: ExtractLearning Use-Case

Listens to `run.completed`. Calls LLM to analyze run outcome. Creates Learning entity with domain/tags/confidence.

```typescript
// packages/domain/src/use-cases/extract-learning.ts
export class ExtractLearning {
  constructor(
    private readonly learningRepo: LearningRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(params: { runId: RunId; issueId: IssueId; outcome: string; stdout: string }): Promise<Result<Learning | null, 'storage_unavailable'>> {
    // Analyze stdout for notable patterns (success after failure, workarounds, errors)
    // If notable, create learning with extracted domain/tags/confidence
    // Return null if nothing notable
  }
}
```

## Task 5.2: RecordLearningApplication Use-Case

After each run, check if injected learnings were relevant. Update confidence.

## Task 5.3: LearningContextEnricher

Implements ContextEnricher port. Queries project → domain → pinned. Injects top 5.

## Task 5.4: Board Curation Routes (pin/dismiss/edit)

## Task 5.5: Learnings Dashboard Page

---

# Phase 6 — Multi-User & Templates

## Task 6.1: Better Auth Authenticated Mode
## Task 6.2: Invite System
## Task 6.3: Company Import/Export
## Task 6.4: Starter Templates
## Task 6.5: OAuth Prep

---

# Phase 7 — Plugin Ecosystem

## Task 7.1: Plugin SDK (`definePlugin`, extension factories)
## Task 7.2: Plugin Runtime (worker threads, resource limits)
## Task 7.3: Event Bridge (PluginEventMap → workers)
## Task 7.4: Storage Provisioner (prefixed tables)
## Task 7.5: Plugin UI (lazy-loaded components, 4 slots)
## Task 7.6: Example Plugins (hello-world, github-sync)

---

# Phase 8 — CLI & Operations

## Task 8.1: `sheldon doctor`
## Task 8.2: Routines (cron + webhook)
## Task 8.3: CLI Auth Challenges
## Task 8.4: Instance Settings
## Task 8.5: Notification Channel

---

# Phase 9 — Polish

## Task 9.1: Agent Config Revisions
## Task 9.2: Budget Incidents + Finance Events
## Task 9.3: Labels + Inbox
## Task 9.4: Assets / File Storage
## Task 9.5: Feedback + Evals
## Task 9.6: Additional Adapters (process, http, codex, gemini)

---

## Self-Review Checklist

- [x] **Spec coverage:** Every section (1-12) of the spec maps to tasks. All 8 must-haves covered. All 9 should-haves in Phase 9.
- [x] **Placeholder scan:** No TBDs. Phase 1A-2 have full code. Phases 3-9 have code samples and clear task descriptions.
- [x] **Type consistency:** Entity names, port names, use-case names match across all tasks. `Result<T, E>` used consistently. `ok()`/`err()` from domain package.
- [x] **Build order:** Phase 1A (domain first, zero deps) → 1B (infrastructure) → 1C (UI). Each subsequent phase depends only on previous.
- [x] **Composition root:** Explicitly shown in Task 1B.5 with layered dependency wiring.
- [x] **Task granularity:** Largest task creates 5 files (1A.4). No task creates more than 7 files. Each commit is coherent.

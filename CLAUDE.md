# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project overview

Tyranids is a swarm intelligence agent system inspired by Warhammer 40k Tyranids. Autonomous agents self-organize through pheromone-based communication in a shared environment to collaboratively solve tasks.

The system is general-purpose — it handles code generation, research, writing, analysis, and any task decomposable into file-based artifacts.

## Tech stack

- **Language**: TypeScript 5.9.2
- **Runtime**: Node.js 20+
- **LLM framework**: Pi (@mariozechner/pi-ai) — unified interface for multiple providers
- **Supported providers**: Anthropic, OpenAI, Google, Minimax
- **Build**: TypeScript compiler, npm workspaces
- **CLI UI**: Ink v6 (React for terminal) with ink-spinner and ink-text-input

## Project structure

```
packages/
├── swarm-core/                  # Core engine (do not break existing APIs)
│   ├── src/
│   │   ├── environment.ts             # SwarmEnvironment — shared spatial pheromone pool
│   │   ├── environment-agent.ts       # EnvironmentAgent — autonomous LLM agent with tools
│   │   ├── environment-orchestrator.ts # EnvironmentOrchestrator — lifecycle manager
│   │   ├── swarm-tools.ts             # Tool definitions agents use to perceive & act
│   │   ├── evaluator.ts              # CompileFunction implementations (TypeScript, passthrough)
│   │   ├── synaptic-memory.ts        # Markdown-based persistent memory system
│   │   ├── types.ts                  # All core type definitions
│   │   ├── index.ts                  # Public API exports
│   │   ├── bioengine/               # Genetic algorithm evolution
│   │   │   ├── bioforms.ts          # Predefined agent configurations (6 species)
│   │   │   ├── types.ts             # BioEngine types
│   │   │   └── tyranid-bioengine.ts # Evolution engine
│   │   ├── pheromone-pool.ts        # Legacy single-file pheromone pool
│   │   ├── multi-file-pheromone-pool.ts  # Legacy multi-file pool
│   │   ├── swarm-agent-pi.ts        # Legacy single-file agent
│   │   ├── orchestrator-pi.ts       # Legacy single-file orchestrator
│   │   └── observer.ts             # Metrics and observability
│   └── package.json
│
├── swarm-cli/                   # Interactive terminal interface
│   ├── src/
│   │   ├── cli.ts               # CLI entry point (bin: tyranids)
│   │   ├── gatekeeper.ts        # Single-agent interaction, complexity routing
│   │   ├── hive-mind.ts         # Swarm coordination (Gatekeeper → Orchestrator bridge)
│   │   ├── skill-library.ts     # Skill extraction, storage, matching, injection
│   │   ├── self-evolution.ts    # LLM-driven self-modification engine
│   │   ├── terminal-ui.tsx      # Ink-based React terminal UI
│   │   ├── workspace.ts         # Workspace management (~/.tyranids/ and .tyranids/)
│   │   └── types.ts             # CLI type definitions
│   └── package.json
│
├── swarm-skills/                # Claude Code skill integration (placeholder)
│
└── examples/
    ├── add-priority-feature/    # Single-file swarm example
    └── level-1-calculator/      # Multi-file environment swarm example
```

## Build commands

```bash
# Build all packages (from repo root)
npm run build

# Build individual package
cd packages/swarm-core && npm run build
cd packages/swarm-cli && npm run build

# Clean build artifacts
npm run clean

# Lint
npm run check

# Format
npm run format
```

## Test commands

```bash
# Unit tests
cd packages/swarm-core && npm test

# Run calculator example (needs ANTHROPIC_API_KEY or MINIMAX_API_KEY)
cd examples/level-1-calculator
npx tsx run-environment-swarm.ts
```

## Key architecture concepts

### Environment-based swarm (v2 — primary system)

The current primary architecture. Files: `environment.ts`, `environment-agent.ts`, `environment-orchestrator.ts`, `swarm-tools.ts`.

- **SwarmEnvironment**: Shared spatial pheromone pool. File slots are regions; solutions are spatial pheromones anchored to files.
- **EnvironmentAgent**: Autonomous agent using Pi `complete()` with tool calling. Each iteration is a fresh LLM conversation with synaptic memory injection.
- **EnvironmentOrchestrator**: Lifecycle manager — seeds environment, spawns agents, monitors convergence, handles elastic scaling. Does NOT assign tasks.
- **Tools**: `observe_environment`, `read_file_content`, `read_dependency`, `submit_solution`, `signal` — agents use these to perceive and act.
- **CompileFunction**: Pluggable validation. `createTypeScriptCompileFn()` for TypeScript, `createPassthroughValidateFn()` for non-code tasks, or custom functions.

### Agent system prompt

The default system prompt in `environment-agent.ts` is language-agnostic. It can be overridden via `EnvironmentAgentConfig.systemPrompt` or `EnvironmentOrchestratorConfig.agentSystemPrompt`.

### CLI flow

```
User input → Gatekeeper (complexity assessment)
  ├── simple → single LLM call → response
  └── moderate/complex → HiveMind → EnvironmentOrchestrator → swarm execution
                                   → real-time events → Terminal UI
```

### Pheromone reinforcement

When multiple agents submit compatible solutions for the same file, the existing pheromone's quality increases (+0.1, max 1.0). This creates positive feedback — high-quality solutions attract more agents.

### Convergence

`globalConvergence = average(fileConvergence for each file)`

A file converges when its best solution quality exceeds `fileConvergenceThreshold`. The swarm stops when `globalConvergence >= globalConvergenceThreshold`.

### Synaptic memory

Persisted as markdown files in `.swarm-memory/`:
- `trails/<file>.md` — per-file trail markers (what worked, what failed)
- `synapses/*.md` — cross-file insights
- `hive-state.md` — periodic environment state snapshot

### Skill library

Skills are markdown files stored in `~/.tyranids/skills/` (global) or `.tyranids/skills/` (project, overrides global). After each successful task, `SkillLibrary.extractSkills()` uses an LLM to distill reusable patterns. Skills are matched by keyword and injected into agent context for future tasks.

### Self-evolution

`SelfEvolution` can analyze swarm-core source files, propose patches via LLM, create snapshots, apply patches, run `tsc --build`, and rollback on failure. Triggered via `/evolve` in the CLI.

## Important patterns

### All agents use Pi framework

Every LLM call uses `complete()` from `@mariozechner/pi-ai`. Never use raw HTTP calls or other SDKs directly. The Pi framework provides:
- `complete(model, context)` — single completion
- `Context` — system prompt + message history
- `Tool` / `ToolCall` / `ToolResultMessage` — tool calling protocol
- `getModel(provider, modelName)` — model factory

### Event hooks for UI integration

`EnvironmentOrchestratorConfig.onEvent` receives events like `agent_spawned`, `solution_submitted`, `scaling`, `convergence_update`. The CLI's `HiveMind` maps these to `SwarmEvent` types consumed by `TerminalUI`.

### Pluggable validation

The `CompileFunction` type signature:
```typescript
type CompileFunction = (
  filePath: string,
  code: string,
  contextFiles: Map<string, string>
) => Promise<{ success: boolean; errors: string[] }>;
```

`HiveMind.selectValidationFn()` auto-detects: `.ts`/`.tsx` files use TypeScript compiler, everything else uses passthrough.

### Terminal UI (Ink/React)

`terminal-ui.tsx` uses Ink v6 with React components. The `TerminalUI` class provides an imperative bridge to the React state via refs (`stateRef`, `setStateRef`). Handles both TTY (full interactive) and pipe (debug mode + readline fallback) modes.

## Common pitfalls

### Do not break the shared environment

All agents MUST share the same `SwarmEnvironment` instance. Creating separate environments defeats the pheromone communication mechanism.

### Do not manually control agent behavior

Agents self-organize. Influence behavior through configuration (exploration rate, convergence threshold, system prompt), not by directly assigning files or forcing state transitions.

### Do not skip convergence detection

Always use the orchestrator's monitoring loop. Running agents for a fixed number of iterations wastes API calls when the swarm has already converged.

### TypeScript module resolution

`swarm-cli` uses `"moduleResolution": "Node16"` and `"jsx": "react-jsx"` for Ink compatibility. `swarm-core` uses standard TypeScript resolution. Both are ESM (`"type": "module"`).

## Workspace directories

```
~/.tyranids/                     # Global home (TyranidWorkspace.getGlobalHome())
├── config.md                    # Provider, model configuration
├── gene-pool/                   # BioEngine data
└── skills/                      # Global skills

<project>/.tyranids/             # Project workspace
├── workspace.md                 # Project metadata
├── .swarm-memory/               # Synaptic memory
├── tasks/                       # Task history
├── generated/                   # Generated file backups
├── evolution/                   # Patches & snapshots
└── skills/                      # Project skills
```

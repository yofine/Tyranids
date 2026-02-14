# Tyranids

> Swarm intelligence agent system inspired by Warhammer 40k Tyranids — autonomous agents that self-organize, evolve, and converge on solutions through pheromone-based communication.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Overview

Tyranids is a multi-agent system where autonomous agents collaborate through a shared environment rather than through a central coordinator. Agents deposit "pheromone" solutions into a shared environment, reinforce high-quality solutions from other agents, and converge naturally — similar to how ant colonies find optimal paths.

The system is **general-purpose**: it can handle code generation, research, writing, analysis, and any task that can be decomposed into file-based artifacts.

### Key properties

- **Decentralized**: No lead agent. All agents are equal peers that self-organize.
- **Pheromone communication**: Agents communicate indirectly through a shared environment (spatial pheromone pool), not point-to-point messages.
- **Emergent convergence**: The best solutions naturally attract more agents, creating a positive feedback loop.
- **Elastic scaling**: The swarm dynamically adds or removes agents based on task progress.
- **Persistent memory**: Synaptic memory (markdown files) persists across iterations and crashes.
- **Self-evolution**: The system can analyze and modify its own source code through LLM-driven patch generation.

## Architecture

```
packages/
├── swarm-core/           # Core engine (environment, agents, orchestrator)
│   ├── environment.ts          # Shared environment with spatial pheromones
│   ├── environment-agent.ts    # Autonomous agent with tool-calling LLM
│   ├── environment-orchestrator.ts  # Lifecycle manager (spawn, monitor, scale)
│   ├── swarm-tools.ts          # Tools agents use to perceive & act
│   ├── evaluator.ts            # Pluggable validation (TypeScript, passthrough, custom)
│   ├── synaptic-memory.ts      # Markdown-based persistent memory
│   └── bioengine/              # Genetic algorithm evolution system
│       ├── bioforms.ts         # Predefined agent configurations (species)
│       └── tyranid-bioengine.ts # Evolution engine
│
└── swarm-cli/            # Interactive terminal interface
    ├── cli.ts                  # CLI entry point (bin: tyranids)
    ├── gatekeeper.ts           # Single-agent interaction (complexity routing)
    ├── hive-mind.ts            # Swarm coordination layer
    ├── skill-library.ts        # Reusable skill extraction & matching
    ├── self-evolution.ts       # Self-modification engine
    ├── terminal-ui.tsx         # Ink-based terminal UI (React)
    ├── workspace.ts            # Workspace & project management
    └── types.ts                # CLI type definitions
```

## How it works

### 1. Environment-based swarm

Each task is decomposed into **file slots** — regions in a shared environment. Agents autonomously:

1. **Observe** the environment (which files need work, current quality, signals from other agents)
2. **Choose** a file to work on based on priority (empty > low-quality > signals)
3. **Read** dependency files to understand the context
4. **Generate** a solution using an LLM
5. **Validate** the solution (compilation, structural checks)
6. **Submit** the solution as a spatial pheromone

When multiple agents submit similar solutions, the pheromone **strengthens** — quality increases, attracting even more agents. This creates emergent convergence without any central decision-maker.

### 2. Convergence detection

```
Iteration 0:  tokenizer [░░░░░░] 0.00   parser [░░░░░░] 0.00   main [░░░░░░] 0.00
Iteration 3:  tokenizer [████░░] 0.72   parser [███░░░] 0.65   main [██░░░░] 0.40
Iteration 7:  tokenizer [██████] 0.92   parser [█████░] 0.85   main [████░░] 0.78
Iteration 9:  tokenizer [██████] 0.95   parser [██████] 0.90   main [██████] 0.88  CONVERGED
```

When all files reach the convergence threshold, the swarm stops. No wasted iterations.

### 3. Elastic scaling

The orchestrator monitors the environment and adjusts the agent count:
- **Scale up**: When many files are empty or low-quality
- **Scale down**: When most files are converged and agents are idle
- Agents with the fewest successful submissions are retired first

### 4. Synaptic memory

Agents persist their learnings to markdown files in `.swarm-memory/`:
- **Trail markers**: Per-file history of what worked and what failed
- **Synaptic entries**: Cross-file insights and patterns
- **Hive state snapshots**: Periodic environment state dumps

Memory survives across iterations, agent restarts, and even process crashes.

## Quick start

### Installation

```bash
git clone https://github.com/nicekid1/tyranids.git
cd tyranids
npm install
npm run build
```

### Using the CLI

```bash
# Initialize workspace in current directory
npx tyranids --init

# Start interactive session
npx tyranids

# Specify provider and model
npx tyranids --provider anthropic --model claude-haiku-4-5-20241022
```

Interactive commands:
- `/status` — Show workspace status
- `/skills` — List learned skills
- `/history` — Show task history
- `/evolve` — Trigger self-evolution analysis
- `/init` — Initialize project workspace
- `/clear` — Clear conversation
- `/quit` — Exit

Simple requests are answered directly by a single agent. Complex requests automatically trigger a swarm with real-time progress visualization.

### Using the core engine directly

```typescript
import {
  EnvironmentOrchestrator,
  createTypeScriptCompileFn,
  type EnvironmentTask,
  type EnvironmentSwarmConfig,
} from '@tyranids/swarm-core';

const task: EnvironmentTask = {
  description: 'Implement a calculator with tokenizer, parser, and evaluator',
  projectName: 'calculator',
  fileSlots: [
    { filePath: 'tokenizer.ts', description: 'Lexer that produces tokens', dependsOn: [] },
    { filePath: 'parser.ts', description: 'Recursive descent parser', dependsOn: ['tokenizer.ts'] },
    { filePath: 'evaluator.ts', description: 'AST evaluator', dependsOn: ['parser.ts'] },
    { filePath: 'main.ts', description: 'CLI entry point', dependsOn: ['evaluator.ts'] },
  ],
};

const swarmConfig: EnvironmentSwarmConfig = {
  agentCount: 3,
  maxIterations: 15,
  convergenceThreshold: 0.75,
  minAgents: 2,
  maxAgents: 5,
  evaporationRate: 0.10,
  evaporationInterval: 30000,
  fileConvergenceThreshold: 0.75,
  globalConvergenceThreshold: 0.75,
  scaleCheckInterval: 20000,
};

const orchestrator = new EnvironmentOrchestrator({
  task,
  swarmConfig,
  provider: 'anthropic',
  modelName: 'claude-haiku-4-5-20241022',
  compileFn: createTypeScriptCompileFn(),
  onEvent: (event) => console.log(event),
});

const results = await orchestrator.execute();
// results: Map<string, string> — filePath → generated code
```

### Custom validation

The validation function is pluggable. For non-TypeScript tasks, use the passthrough validator or write your own:

```typescript
import { createPassthroughValidateFn } from '@tyranids/swarm-core';

// Passthrough: accepts any non-empty content
const orchestrator = new EnvironmentOrchestrator({
  task,
  swarmConfig,
  compileFn: createPassthroughValidateFn(),
});

// Custom validator
const customValidate = async (filePath: string, code: string, context: Map<string, string>) => {
  const isValid = /* your validation logic */;
  return { success: isValid, errors: isValid ? [] : ['Validation failed'] };
};
```

## Configuration

### Environment variables

```bash
# Required — at least one provider key
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_AI_API_KEY="..."
export MINIMAX_API_KEY="..."

# Optional — gene pool location
export TYRANIDS_GENE_POOL_DIR="~/.tyranids/gene-pool"
```

### Workspace structure

```
~/.tyranids/                     # Global home
├── config.md                    # Provider, model, API key configuration
├── gene-pool/                   # BioEngine genetic algorithm data
└── skills/                      # Global skill library

<project>/.tyranids/             # Project workspace
├── workspace.md                 # Project metadata
├── .swarm-memory/               # Synaptic memory
│   ├── hive-state.md
│   ├── trails/
│   └── synapses/
├── tasks/                       # Task history
├── generated/                   # Backup copies of generated files
├── evolution/                   # Self-modification patches & snapshots
└── skills/                      # Project-level skills (override global)
```

## Supported providers

The system uses the [Pi framework](https://github.com/nicekid1/pi-ai) for LLM access:

- **Anthropic** (Claude) — recommended
- **OpenAI** (GPT)
- **Google** (Gemini)
- **Minimax** (MiniMax-M1/M2)

Any provider supported by Pi can be used. The agent system prompt is configurable, and the validation function is pluggable, so the system works with any language or domain.

## Bioforms (predefined configurations)

Inspired by Tyranid species from Warhammer 40k:

| Bioform | Analogy | Agents | Exploration | Use case |
|---------|---------|--------|-------------|----------|
| **Explorer** | Genestealer | 5 | High (0.40) | New features, creative solutions |
| **Refiner** | Tyranid Warrior | 5 | Low (0.05) | Refactoring, optimization |
| **Validator** | Gargoyle | 5 | Medium (0.10) | Bug fixes, testing |
| **Carnifex** | Carnifex | 15 | Medium (0.20) | Large-scale rewrites |
| **Lictor** | Lictor | 1 | Low (0.05) | Simple fixes, quick iterations |
| **Hive Tyrant** | Hive Tyrant | 8 | Medium (0.15) | General-purpose, unknown tasks |

## Development

### Build

```bash
# Build all packages
npm run build

# Build individual package
cd packages/swarm-core && npm run build
cd packages/swarm-cli && npm run build

# Watch mode
cd packages/swarm-core && npm run dev
```

### Test

```bash
# Unit tests
cd packages/swarm-core && npm test

# Run calculator example (requires API key)
cd examples/level-1-calculator
npx tsx run-environment-swarm.ts
```

### Project commands

```bash
npm run build    # Build all workspaces
npm run clean    # Clean all build artifacts
npm run test     # Run all tests
npm run check    # Biome lint check
npm run format   # Biome format
```

## License

MIT

## Acknowledgments

- **Warhammer 40k Tyranids** — Conceptual inspiration (Hive Mind, Gene Devouring, Bioforms)
- **Pi Framework** (@mariozechner/pi-ai) — Unified LLM interface
- **Ant Colony Optimization** — Theoretical foundation for pheromone-based coordination

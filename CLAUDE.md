# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Tyranids (虫群) is a swarm intelligence-based programming agent system built on top of the pi-mono framework. The project implements a novel approach to automated code generation and problem-solving using principles from ant colony optimization and swarm behavior.

### Core Concept

Instead of traditional hierarchical agent teams, this system uses multiple simple agents that communicate through a "pheromone pool" - a shared state store where agents deposit and read quality signals about code solutions. Agents follow simple behavioral rules and converge on optimal solutions through emergent collective behavior.

## Architecture

### High-Level System Components

```
Swarm Orchestrator (改造自 pi-agent-core)
    ↓
├── Pheromone Pool (共享状态存储)
├── Agent Spawner (动态实例管理)
    ↓
Swarm Agents (5-20 个并行agents, 改造自 pi-coding-agent)
    ↓
├── Tool Layer (文件/bash工具)
└── Evaluation Layer (测试/编译验证)
```

### Key Packages (Planned)

- `@mariozechner/swarm-pheromone-pool` - Central shared state store for agent communication via "pheromones"
- `@mariozechner/swarm-agent` - Base swarm agent class with behavior rules
- `@mariozechner/swarm-coding-agent` - Coding-specific swarm agent
- `@mariozechner/swarm-orchestrator` - Manages agent lifecycle and convergence detection
- `@mariozechner/swarm-evaluator` - Solution quality evaluation (compilation, tests, complexity)

### Core Mechanisms

**Pheromone System**: Agents deposit "pheromones" (quality signals) on code fragments. High-quality pheromones attract more agents, reinforcing successful paths. Low-quality pheromones evaporate over time.

**Agent Behavior**: Each agent follows simple probabilistic rules:
- 70% probability: Follow strongest pheromone trail
- 20% probability: Explore low-coverage areas
- 10% probability: Random exploration

**Agent States**: EXPLORING → REFINING → VALIDATING → IDLE

**Convergence Detection**: System monitors when 85%+ of agents cluster around the same solution, indicating convergence.

### Quality Metrics

Solutions are evaluated on:
- Compilation success (30% weight)
- Tests passing (40% weight)
- Code complexity (15% weight, lower is better)
- Test coverage (15% weight)

## Development Philosophy

### Design Principles

1. **Simplicity over Planning**: Agents use simple behavioral rules instead of complex planning
2. **Emergent Behavior**: Solutions emerge from collective behavior, not centralized orchestration
3. **Fault Tolerance**: Single agent failures don't affect the swarm
4. **Parallel Exploration**: Multiple solution paths are explored simultaneously
5. **Cost Efficiency**: Target <60% of traditional agent team LLM costs through lightweight models and rule-based decisions

### Based on pi-mono Framework

This project builds on [@mariozechner/pi-mono](https://github.com/badlogic/pi-mono) components:
- `pi-ai` - Unified LLM interface (unchanged)
- `pi-agent-core` - Base agent class (modified for swarm behavior)
- `pi-coding-agent` - Code manipulation tools (tools reused, behavior modified)
- `pi-tui` - Terminal UI (reused for visualization)

## Implementation Roadmap

### Phase 1: Infrastructure (2-3 weeks)
- Set up monorepo structure
- Implement PheromonePool with storage, evaporation, and spatial queries
- Create SwarmAgent base class with state management and behavior rules

### Phase 2: Core Logic (3-4 weeks)
- Implement three core behavior rules (follow, explore, validate)
- Build SwarmOrchestrator with agent management and convergence detection
- Integrate evaluation layer (compilation, tests, quality calculation)

### Phase 3: Tool Integration (2 weeks)
- Integrate pi-coding-agent tools (read_file, bash, ripgrep)
- Add swarm-specific tools (pheromone_read, pheromone_deposit, coverage_map)

### Phase 4: Validation (4 weeks)
Test scenarios:
1. Simple bug fixes (10 agents, <30 seconds to converge)
2. Code refactoring (explore 5 solution variants)
3. New feature development (parallel path exploration)

### Phase 5: DevX & UI (2 weeks)
- CLI tool: `swarm-code --task "fix auth.ts bug" --agents 10`
- Pheromone heatmap visualization
- Real-time agent state monitoring

## Success Criteria

**Functional**:
- Fix 5+ types of programming bugs
- Explore 3+ different solution approaches in parallel
- Converge in <2 minutes with 10 agents

**Performance**:
- LLM costs <60% of traditional agent teams
- First viable solution in <30 seconds
- Agent failure rate <20%

**Swarm Properties**:
- Observable pheromone reinforcement on successful paths
- Emergent cooperation without central scheduling
- Self-organization for task distribution

## Key Technical Decisions

### Pheromone Storage
- **MVP**: In-memory Map for speed and simplicity
- **Future**: Redis for distributed setups, SQLite for persistence

### LLM Strategy
- Use lightweight models (GPT-4o-mini, Claude Haiku) per agent
- LLM only for critical decisions, not simple rule evaluation
- Max 5 concurrent LLM calls to avoid rate limits

### Convergence Algorithm
Converged when top 3 pheromones represent >80% of total quality in the pool

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Local optima | Increase random exploration rate, inject perturbations |
| Pheromone pool memory bloat | Aggressive evaporation, size limits |
| High LLM costs | Caching, rule-based decisions, fewer redundant calls |
| Slow convergence | Dynamic agent count, optimize quality calculation |
| Unstable solution quality | Strengthen evaluation, human review gates |

## Getting Started

This is a greenfield project. To begin development:

```bash
# Clone pi-mono as reference
git clone https://github.com/badlogic/pi-mono
cd pi-mono
npm install
npm run build

# Then return to Tyranids to implement packages
cd /root/workspace/Tyranids

# Create first package
mkdir -p packages/swarm-pheromone-pool
cd packages/swarm-pheromone-pool
npm init -y
```

## Reference Documentation

See `BLUEPRINT.md` for detailed technical specifications (in Chinese), including:
- Complete TypeScript interfaces for all components
- Behavior rule implementations
- Pheromone quality calculation algorithms
- Example agent execution loops

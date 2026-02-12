# 🦎 Tyranids - Swarm Intelligence Coding Agent System

> Inspired by Warhammer 40k Tyranids - A swarm-based AI coding agent system that evolves and adapts

## 🧬 Core Concept

Tyranids implements a **swarm intelligence** approach to code generation, inspired by the Tyranids from Warhammer 40k:

- **Gene Devouring**: Absorbs successful patterns from each execution
- **Hive Mind**: Shared knowledge through pheromone pools
- **Bioform Evolution**: Specialized agent "species" for different tasks
- **Planetary Adaptation**: Rapidly analyzes and adapts to new codebases

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run example
cd examples/add-priority-feature
npm test
```

## 📦 Project Structure

```
packages/
├── swarm-core/       # Core swarm engine (pheromone pool, agents, orchestrator)
└── swarm-skills/     # Claude Code skills for swarm interaction

examples/
└── add-priority-feature/  # Example: Adding priority to TODO app
```

## 🐝 How It Works

1. **Spawn Swarm**: Create multiple agents to explore different solutions
2. **Pheromone Communication**: Agents share solution quality through pheromone pools
3. **Emergent Convergence**: Best solutions naturally attract more agents
4. **Evolution**: System learns from successful executions

## 📊 Status

🚧 **MVP Development** - Phase 1 Complete

See [BLUEPRINT.md](./BLUEPRINT.md) for detailed technical specifications.

## 📄 License

MIT

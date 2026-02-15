/**
 * @tyranids/swarm-core
 *
 * Core swarm intelligence engine for Tyranids coding agent system.
 * Inspired by Warhammer 40k Tyranids - Gene Devouring, Hive Mind, Bioform Evolution.
 */

// Re-export all core components
export * from './types.js';
export { PheromonePool } from './pheromone-pool.js';
export { SwarmAgent, type SwarmAgentConfig } from './swarm-agent.js';
export { Evaluator } from './evaluator.js';
export {
  SwarmOrchestrator,
  type SwarmOrchestratorConfig,
} from './orchestrator.js';
export {
  SwarmOrchestratorPi,
  type SwarmOrchestratorPiConfig,
} from './orchestrator-pi.js';
export { SwarmAgentPi, type SwarmAgentPiConfig } from './swarm-agent-pi.js';
export { SwarmObserver } from './observer.js';

// Multi-file support (Level 1+)
export { MultiFilePheromonePool } from './multi-file-pheromone-pool.js';
export { MultiFileSwarmAgent, type MultiFileSwarmAgentConfig } from './multi-file-agent.js';

// Bioengine - Gene Devouring & Evolution System
export * from './bioengine/index.js';

// Environment-based swarm (v2)
export { SwarmEnvironment } from './environment.js';
export { createSwarmTools } from './swarm-tools.js';
export { EnvironmentAgent, type EnvironmentAgentConfig } from './environment-agent.js';
export type { AgentTool } from '@mariozechner/pi-agent-core';
export {
  EnvironmentOrchestrator,
  type EnvironmentOrchestratorConfig,
} from './environment-orchestrator.js';
export { createTypeScriptCompileFn, createPassthroughValidateFn } from './evaluator.js';

// Synaptic Memory - Filesystem persistence & agent memory
export { SynapticMemory } from './synaptic-memory.js';
export type { SynapticEntry, TrailMarker } from './synaptic-memory.js';

// Version
export const VERSION = '0.1.0';

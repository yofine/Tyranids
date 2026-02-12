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

// Bioengine - Gene Devouring & Evolution System
export * from './bioengine/index.js';

// Version
export const VERSION = '0.1.0';

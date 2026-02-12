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
// export * from './orchestrator.js';
// export * from './observer.js';

// Version
export const VERSION = '0.1.0';

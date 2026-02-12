/**
 * Core type definitions for Tyranids swarm system
 */

/**
 * Code fragment representing a solution or partial solution
 */
export interface CodeFragment {
  /** File path being modified */
  filePath: string;
  /** Modified code content */
  content: string;
  /** Intent of this modification (e.g., "Add priority field") */
  intent: string;
  /** Line range in the original file (optional) */
  lineRange?: {
    start: number;
    end: number;
  };
}

/**
 * Pheromone deposited by agents to communicate solution quality
 * Inspired by ant colony optimization
 */
export interface Pheromone {
  /** Unique identifier */
  id: string;
  /** The code solution this pheromone represents */
  codeFragment: CodeFragment;
  /** Quality score (0-1, higher is better) */
  quality: number;
  /** IDs of agents who deposited/reinforced this pheromone */
  depositors: string[];
  /** When this pheromone was created */
  timestamp: number;
  /** Metadata for analysis */
  metadata?: {
    compilationSuccess?: boolean;
    testsPass?: boolean;
    complexity?: number;
  };
}

/**
 * Filter options for querying pheromones
 */
export interface PheromoneFilter {
  /** Minimum quality threshold */
  minQuality?: number;
  /** Maximum number of results */
  limit?: number;
  /** Filter by file path */
  filePath?: string;
  /** Only return pheromones deposited after this timestamp */
  since?: number;
}

/**
 * Coding task to be solved by the swarm
 */
export interface CodingTask {
  /** Task description */
  description: string;
  /** Target file path */
  filePath: string;
  /** Base code (original content) */
  baseCode: string;
  /** Task type classification */
  type?: 'add-feature' | 'refactor' | 'bugfix' | 'optimize' | 'unknown';
}

/**
 * Agent state enum
 */
export enum AgentState {
  EXPLORING = 'exploring',
  REFINING = 'refining',
  VALIDATING = 'validating',
  IDLE = 'idle',
}

/**
 * Action that an agent can take
 */
export interface Action {
  type: 'EXPLORE' | 'REFINE' | 'VALIDATE';
  target?: Pheromone;
}

/**
 * Swarm configuration
 */
export interface SwarmConfig {
  /** Number of agents in the swarm */
  agentCount: number;
  /** Maximum iterations per agent */
  maxIterations: number;
  /** Convergence threshold (0-1) */
  convergenceThreshold: number;
  /** Exploration rate (0-1) */
  explorationRate?: number;
  /** Model preference */
  modelPreference?: 'haiku-only' | 'mixed' | 'sonnet-preferred';
}

/**
 * Evaluation metrics for a code solution
 */
export interface EvaluationMetrics {
  /** Does it compile? */
  compiles: boolean;
  /** Is it functionally complete? */
  complete: boolean;
  /** Is the code simple/clean? */
  simple: boolean;
  /** Overall quality score (0-1) */
  quality: number;
}

/**
 * Agent action statistics
 */
export interface AgentActionStats {
  explores: number;
  refines: number;
  validates: number;
  idles: number;
}

/**
 * Pheromone evolution snapshot at a specific iteration
 */
export interface PheromoneSnapshot {
  iteration: number;
  topQuality: number;
  avgQuality: number;
  diversity: number;
  convergence: number;
  timestamp: number;
}

/**
 * LLM usage statistics
 */
export interface LLMStats {
  total: number;
  byModel: { [model: string]: number };
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

/**
 * Solution summary for reporting
 */
export interface SolutionSummary {
  id: string;
  quality: number;
  depositors: string[];
  compilationSuccess: boolean;
  timestamp: number;
}

/**
 * Comprehensive swarm execution metrics
 */
export interface SwarmMetrics {
  // Time metrics
  startTime: number;
  endTime: number;
  duration: number;

  // Agent behavior
  agentActions: { [agentId: string]: AgentActionStats };

  // Pheromone evolution
  pheromoneEvolution: PheromoneSnapshot[];

  // LLM usage
  llmCalls: LLMStats;

  // Solutions
  solutions: SolutionSummary[];

  // Convergence
  convergenceDetected: boolean;
  convergenceIteration: number;
  finalConvergenceRatio: number;
}

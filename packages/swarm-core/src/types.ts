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
 * Multi-file code solution (for Level 1+)
 */
export interface MultiFileCodeFragment {
  /** All files in this solution */
  files: CodeFragment[];
  /** Overall intent of the solution */
  intent: string;
  /** Main entry file path */
  entryFile?: string;
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
 * Multi-file pheromone (for Level 1+)
 */
export interface MultiFilePheromone {
  /** Unique identifier */
  id: string;
  /** Multi-file code solution */
  solution: MultiFileCodeFragment;
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
    crossFileConsistency?: number;  // How well files work together
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
 * Multi-file coding task (for Level 1+)
 */
export interface MultiFileCodingTask {
  /** Task description */
  description: string;
  /** Project name */
  projectName: string;
  /** Base files (existing code if any) */
  baseFiles?: { [filePath: string]: string };
  /** Expected file structure (optional guidance) */
  expectedStructure?: {
    filePath: string;
    description: string;
  }[];
  /** Task type */
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

/**
 * Hierarchical task - decomposed into phases
 */
export interface HierarchicalTask {
  /** Task description */
  description: string;
  /** Project name */
  projectName: string;
  /** Task phases (will be auto-generated or manually defined) */
  phases?: TaskPhase[];
  /** Expected file structure */
  expectedStructure?: {
    filePath: string;
    description: string;
  }[];
}

/**
 * Task phase in hierarchical execution
 */
export interface TaskPhase {
  /** Phase name (e.g., 'interface-design', 'tokenizer-impl') */
  name: string;
  /** Phase objective */
  objective: string;
  /** Dependencies (phase names that must complete before this) */
  dependencies: string[];
  /** Files to generate in this phase */
  assignedFiles: string[];
  /** Number of agents for this phase */
  agentCount: number;
  /** Max iterations per agent */
  maxIterations: number;
}

/**
 * Context passed between phases
 */
export interface PhaseContext {
  /** Files completed by previous phases */
  completedFiles: { [filePath: string]: string };
  /** Exported interfaces from previous phases */
  interfaces: { [name: string]: string };
}

/**
 * Result of a phase execution
 */
export interface PhaseResult {
  /** Phase name */
  phaseName: string;
  /** Generated files */
  files: { [filePath: string]: string };
  /** Exported interfaces (for next phases) */
  exportedInterfaces: { [name: string]: string };
  /** Quality score */
  quality: number;
  /** Execution time */
  duration: number;
  /** Number of solutions explored */
  solutionsExplored: number;
}

// ============================================================
// Environment-based swarm types (v2)
// ============================================================

/**
 * File slot status in the environment
 */
export type SlotStatus = 'empty' | 'attempted' | 'partial' | 'solid' | 'excellent' | 'blocked';

/**
 * A spatial coordinate in the environment — each file is a "region"
 */
export interface FileSlot {
  filePath: string;
  description: string;
  bestSolutionId: string | null;
  bestQuality: number;
  dependsOn: string[];
  dependedBy: string[];
  status: SlotStatus;
}

/**
 * Spatial pheromone — a code solution anchored to a file
 */
export interface SpatialPheromone {
  id: string;
  filePath: string;
  code: string;
  quality: number;
  strength: number;
  depositors: string[];
  createdAt: number;
  updatedAt: number;
  /** Agent-declared export names (language-agnostic strings) */
  exports: string[];
  /** Agent-declared imports */
  imports: { name: string; fromFile: string }[];
  compatibilityScore: number;
  metadata?: Record<string, unknown>;
}

/**
 * Data submitted by an agent when depositing a solution
 */
export interface SolutionDeposit {
  filePath: string;
  code: string;
  agentId: string;
  quality: number;
  /** Agent-declared export names (language-agnostic strings) */
  exports: string[];
  /** Agent-declared imports */
  imports: { name: string; fromFile: string }[];
  compilationSuccess: boolean;
  compilationErrors?: string[];
  compatibilityScore: number;
}

/**
 * Signal type in the environment
 */
export type SignalType =
  | 'interface_mismatch'
  | 'compilation_error'
  | 'integration_failure'
  | 'dependency_ready'
  | 'needs_attention';

/**
 * Non-code signal pheromone
 */
export interface SignalPheromone {
  id: string;
  type: SignalType;
  filePath: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  strength: number;
  createdAt: number;
  sourceAgent: string;
}

/**
 * Detail about compatibility with a specific dependency
 */
export interface CompatibilityDetail {
  filePath: string;
  compatible: boolean;
  missingImports: string[];
}

/**
 * What an agent perceives when observing the environment
 */
export interface EnvironmentPerception {
  fileSlots: {
    filePath: string;
    description: string;
    status: SlotStatus;
    bestQuality: number;
    dependsOn: string[];
    dependedBy: string[];
    signalCount: number;
    /** Number of agents currently working on this file */
    activeAgentCount: number;
    /** Total solutions deposited for this file */
    solutionCount: number;
    /** Work recommendation for agents (e.g., "HIGH PRIORITY", "AVOID") */
    recommendation: string;
  }[];
  globalProgress: {
    totalFiles: number;
    solidOrBetter: number;
    convergence: number;
  };
}

/**
 * Scaling advice returned by the environment
 */
export interface ScalingAdvice {
  action: 'scale_up' | 'scale_down' | 'hold';
  reason: string;
}

/**
 * Task definition for the environment-based swarm
 */
export interface EnvironmentTask {
  description: string;
  projectName: string;
  fileSlots: {
    filePath: string;
    description: string;
    dependsOn: string[];
  }[];
}

/**
 * Configuration for environment-based swarm
 */
export interface EnvironmentSwarmConfig extends SwarmConfig {
  minAgents: number;
  maxAgents: number;
  evaporationRate: number;
  evaporationInterval: number;
  fileConvergenceThreshold: number;
  globalConvergenceThreshold: number;
  scaleCheckInterval: number;
  synapticMemory?: SynapticMemoryConfig;
}

/**
 * Configuration for the synaptic memory system (filesystem persistence)
 */
export interface SynapticMemoryConfig {
  /** Base directory for .swarm-memory/, defaults to cwd */
  baseDir?: string;
  /** Max synaptic entries to inject into agent context per iteration (default 10) */
  maxSynapticEntries?: number;
  /** Max trail markers per file to return (default 5) */
  maxTrailMarkers?: number;
  /** Hive state snapshot interval in ms (default 30000) */
  snapshotInterval?: number;
  /** Enable/disable the memory system (default true) */
  enabled?: boolean;
}

/**
 * Pluggable compile function (language-agnostic)
 */
export type CompileFunction = (
  filePath: string,
  code: string,
  contextFiles: Map<string, string>
) => Promise<{ success: boolean; errors: string[] }>;

/**
 * Result of a compilation check
 */
export interface CompileResult {
  success: boolean;
  errors: string[];
}

/**
 * Result returned to agent after submitting a solution
 */
export interface SubmitResult {
  quality: number;
  compilationSuccess: boolean;
  errors: string[];
  compatibilityScore: number;
}

/**
 * Type definitions for Tyranids CLI
 */

// ============================================================
// Workspace Types
// ============================================================

export interface WorkspaceInfo {
  projectName: string;
  projectDir: string;
  createdAt: string;
  lastActiveAt: string;
  totalTasks: number;
  totalSkills: number;
  evolutionGeneration: number;
}

export interface GlobalConfig {
  provider: string;
  modelName: string;
  /** Optional overrides per provider */
  providers?: Record<string, { modelName?: string; baseUrl?: string }>;
}

export interface TaskRecord {
  id: string;
  description: string;
  createdAt: string;
  completedAt?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  complexity: ComplexityLevel;
  agentsUsed: number;
  filesGenerated: string[];
  skillsLearned: string[];
  convergence?: number;
  duration?: number;
}

export interface TaskResult {
  files: Map<string, string>;
  convergence: number;
  duration: number;
  skillsLearned: string[];
}

// ============================================================
// Skill Types
// ============================================================

export interface Skill {
  name: string;
  category: string;
  complexity: 'low' | 'medium' | 'high';
  language: string;
  learnedAt: string;
  source: string;
  successRate: string;
  pattern: string;
  template: string;
  whenToUse: string[];
  lessonsLearned: string[];
  keywords: string[];
}

export interface SkillMeta {
  name: string;
  category: string;
  complexity: 'low' | 'medium' | 'high';
  language: string;
  keywords: string[];
}

// ============================================================
// Complexity Assessment
// ============================================================

export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

export interface ComplexityAssessment {
  level: ComplexityLevel;
  reasoning: string;
  suggestedAgentCount: number;
  requiredSkills: string[];
  fileStructure?: {
    filePath: string;
    description: string;
    dependsOn: string[];
  }[];
}

// ============================================================
// Gatekeeper Types
// ============================================================

export type GatekeeperResponse =
  | { type: 'simple'; text: string }
  | { type: 'swarm_started'; taskId: string; assessment: ComplexityAssessment };

// ============================================================
// Swarm Events (for real-time UI)
// ============================================================

export interface FileStatusSnapshot {
  filePath: string;
  status: string;
  quality: number;
  activeAgent: string | null;
}

export type SwarmEvent =
  | { type: 'agent_spawned'; agentId: string; total: number; timestamp: number }
  | { type: 'agent_retired'; agentId: string; reason: string; timestamp: number }
  | { type: 'solution_submitted'; agentId: string; file: string; quality: number; timestamp: number }
  | { type: 'solution_reinforced'; file: string; quality: number; depositors: number; timestamp: number }
  | { type: 'convergence_update'; percentage: number; fileStatuses: FileStatusSnapshot[]; timestamp: number }
  | { type: 'skill_loaded'; skillName: string; agentId: string; timestamp: number }
  | { type: 'evolution_triggered'; description: string; timestamp: number }
  | { type: 'scaling'; direction: 'up' | 'down'; from: number; to: number; reason: string; timestamp: number }
  | { type: 'task_complete'; duration: number; filesGenerated: number; convergence: number; timestamp: number };

// ============================================================
// Self-Evolution Types
// ============================================================

export interface FilePatch {
  filePath: string;
  before: string;
  after: string;
}

export interface EvolutionProposal {
  id: string;
  description: string;
  patches: FilePatch[];
  estimatedImpact: 'low' | 'medium' | 'high';
  reasoning: string;
}

export interface EvolutionResult {
  success: boolean;
  snapshotId: string;
  proposalId: string;
  errors: string[];
  rebuiltSuccessfully: boolean;
}

// ============================================================
// Terminal UI Types
// ============================================================

export type UIMode = 'chat' | 'swarm' | 'evolution';

export interface SwarmDashboardState {
  totalAgents: number;
  convergence: number;
  files: FileStatusSnapshot[];
  recentEvents: SwarmEvent[];
  startTime: number;
  skillsLoaded: number;
}

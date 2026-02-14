/**
 * SwarmEnvironment - Language-agnostic spatial pheromone environment
 *
 * The environment is a structured data store. It does NOT parse code,
 * extract imports/exports, or run compilers. All language-specific logic
 * is performed by agents via tools.
 *
 * Key design: Environment only stores and matches string names.
 * Agents declare their exports/imports. CompileFunction is pluggable.
 */

import type {
  FileSlot,
  SlotStatus,
  SpatialPheromone,
  SolutionDeposit,
  SignalPheromone,
  EnvironmentPerception,
  EnvironmentTask,
  ScalingAdvice,
} from './types.js';

let pheromoneIdCounter = 0;

function generatePheromoneId(): string {
  return `sp-${Date.now()}-${++pheromoneIdCounter}`;
}

function generateSignalId(): string {
  return `sig-${Date.now()}-${++pheromoneIdCounter}`;
}

export class SwarmEnvironment {
  private fileSlots: Map<string, FileSlot> = new Map();
  private filePheromones: Map<string, SpatialPheromone[]> = new Map();
  private signals: SignalPheromone[] = [];
  private evaporationRate: number;
  private globalConvergenceThreshold: number;
  /** Tracks which agents are actively working on which files */
  private activeAgents: Map<string, Set<string>> = new Map();
  /** Optional event callback for real-time UI */
  private onEvent: ((event: { type: string; data: Record<string, unknown> }) => void) | null = null;

  constructor(options?: {
    evaporationRate?: number;
    fileConvergenceThreshold?: number;
    globalConvergenceThreshold?: number;
    onEvent?: (event: { type: string; data: Record<string, unknown> }) => void;
  }) {
    this.evaporationRate = options?.evaporationRate ?? 0.05;
    this.globalConvergenceThreshold = options?.globalConvergenceThreshold ?? 0.8;
    this.onEvent = options?.onEvent ?? null;
  }

  /**
   * Seed the environment with file slots and dependency edges from a task
   */
  seed(task: EnvironmentTask): void {
    // Create all file slots
    for (const slot of task.fileSlots) {
      this.fileSlots.set(slot.filePath, {
        filePath: slot.filePath,
        description: slot.description,
        bestSolutionId: null,
        bestQuality: 0,
        dependsOn: [...slot.dependsOn],
        dependedBy: [],
        status: 'empty',
      });
      this.filePheromones.set(slot.filePath, []);
    }

    // Build reverse dependency edges (dependedBy)
    for (const slot of task.fileSlots) {
      for (const dep of slot.dependsOn) {
        const depSlot = this.fileSlots.get(dep);
        if (depSlot) {
          depSlot.dependedBy.push(slot.filePath);
        }
      }
    }

    console.log(`[Environment] Seeded ${task.fileSlots.length} file slots for project "${task.projectName}"`);
    for (const slot of task.fileSlots) {
      const deps = slot.dependsOn.length > 0 ? ` (depends on: ${slot.dependsOn.join(', ')})` : '';
      console.log(`  - ${slot.filePath}: ${slot.description}${deps}`);
    }
  }

  /**
   * Return a structured perception of the environment state
   */
  perceive(focusFile?: string): EnvironmentPerception {
    const slots = this.getAllFileSlots();
    const solidOrBetter = slots.filter(s => s.status === 'solid' || s.status === 'excellent').length;

    const fileSlotPerceptions = slots
      .filter(s => !focusFile || s.filePath === focusFile)
      .map(s => {
        const activeAgentCount = this.getActiveAgentCount(s.filePath);
        const solutionCount = (this.filePheromones.get(s.filePath) ?? []).length;
        const signalCount = this.signals.filter(sig => sig.filePath === s.filePath).length;
        return {
          filePath: s.filePath,
          description: s.description,
          status: s.status,
          bestQuality: s.bestQuality,
          dependsOn: s.dependsOn,
          dependedBy: s.dependedBy,
          signalCount,
          activeAgentCount,
          solutionCount,
          recommendation: this.getWorkRecommendation(s, activeAgentCount, signalCount),
        };
      });

    return {
      fileSlots: fileSlotPerceptions,
      globalProgress: {
        totalFiles: slots.length,
        solidOrBetter,
        convergence: this.calculateGlobalConvergence(),
      },
    };
  }

  /**
   * Deposit a solution into the environment.
   *
   * All language-agnostic operations:
   * 1. Store SpatialPheromone
   * 2. Update FileSlot best solution if better
   * 3. Name-match imports vs dependency exports -> auto-generate/clear interface_mismatch signals
   * 4. Reverse check: if exports changed, check all dependedBy files
   * 5. Recompute FileSlot status
   */
  depositSolution(deposit: SolutionDeposit): void {
    const slot = this.fileSlots.get(deposit.filePath);
    if (!slot) {
      console.warn(`[Environment] Unknown file path: ${deposit.filePath}`);
      return;
    }

    // Track agent activity
    this.registerAgentActivity(deposit.filePath, deposit.agentId);

    const existingPheromones = this.filePheromones.get(deposit.filePath) ?? [];

    // Check for reinforcement: find existing pheromone from a different agent with similar code
    const similar = existingPheromones.find(p => {
      if (p.depositors.includes(deposit.agentId)) return false;
      // Similarity: same exports and code length within 20%
      const sameExports = deposit.exports.length === p.exports.length &&
        deposit.exports.every(e => p.exports.includes(e));
      const lengthRatio = Math.min(deposit.code.length, p.code.length) /
        Math.max(deposit.code.length, p.code.length);
      return sameExports && lengthRatio > 0.8;
    });

    if (similar) {
      // Reinforce: boost quality, merge depositors
      similar.quality = Math.min(1.0, similar.quality + 0.1);
      if (!similar.depositors.includes(deposit.agentId)) {
        similar.depositors.push(deposit.agentId);
      }
      similar.updatedAt = Date.now();
      similar.strength = 1.0; // Refresh strength

      // Use newer code if it has better quality
      if (deposit.quality > similar.quality - 0.1) {
        similar.code = deposit.code;
        similar.exports = deposit.exports;
        similar.imports = deposit.imports;
      }

      if (similar.quality > slot.bestQuality) {
        slot.bestSolutionId = similar.id;
        slot.bestQuality = similar.quality;
      }

      console.log(
        `[Environment] Reinforced solution for ${deposit.filePath} ` +
        `(quality: ${similar.quality.toFixed(2)}, depositors: ${similar.depositors.length}, agent: ${deposit.agentId})`
      );
      this.onEvent?.({ type: 'solution_reinforced', data: {
        file: deposit.filePath, quality: similar.quality, depositors: similar.depositors.length,
      }});
    } else {
      // New pheromone
      const pheromone: SpatialPheromone = {
        id: generatePheromoneId(),
        filePath: deposit.filePath,
        code: deposit.code,
        quality: deposit.quality,
        strength: 1.0,
        depositors: [deposit.agentId],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        exports: deposit.exports,
        imports: deposit.imports,
        compatibilityScore: deposit.compatibilityScore,
        metadata: {
          compilationSuccess: deposit.compilationSuccess,
          compilationErrors: deposit.compilationErrors,
        },
      };

      existingPheromones.push(pheromone);
      this.filePheromones.set(deposit.filePath, existingPheromones);

      if (deposit.quality > slot.bestQuality) {
        slot.bestSolutionId = pheromone.id;
        slot.bestQuality = deposit.quality;
      }

      console.log(
        `[Environment] New solution for ${deposit.filePath} ` +
        `(quality: ${deposit.quality.toFixed(2)}, exports: [${deposit.exports.join(', ')}], agent: ${deposit.agentId})`
      );
      this.onEvent?.({ type: 'solution_submitted', data: {
        agentId: deposit.agentId, file: deposit.filePath, quality: deposit.quality,
      }});
    }

    // Check imports, reverse check, recompute status
    this.checkImportCompatibility(deposit.filePath, deposit.imports);
    this.reverseCheckExports(deposit.filePath, deposit.exports);
    this.recomputeSlotStatus(deposit.filePath);
  }

  /**
   * Deposit a signal pheromone
   */
  depositSignal(signal: Omit<SignalPheromone, 'id' | 'strength' | 'createdAt'>): void {
    const fullSignal: SignalPheromone = {
      ...signal,
      id: generateSignalId(),
      strength: 1.0,
      createdAt: Date.now(),
    };
    this.signals.push(fullSignal);
  }

  /**
   * Get the best solution for a file
   */
  getBestSolution(filePath: string): SpatialPheromone | null {
    const slot = this.fileSlots.get(filePath);
    if (!slot || !slot.bestSolutionId) return null;

    const pheromones = this.filePheromones.get(filePath) ?? [];
    return pheromones.find(p => p.id === slot.bestSolutionId) ?? null;
  }

  /**
   * Get all pheromones for a file, sorted by quality descending
   */
  getFilePheromones(filePath: string): SpatialPheromone[] {
    const pheromones = this.filePheromones.get(filePath) ?? [];
    return [...pheromones].sort((a, b) => b.quality - a.quality);
  }

  /**
   * Get active signals, optionally filtered by file path
   */
  getSignals(filePath?: string): SignalPheromone[] {
    if (filePath) {
      return this.signals.filter(s => s.filePath === filePath);
    }
    return [...this.signals];
  }

  /**
   * Evaporate pheromones: decay strength and clean up weak ones
   */
  evaporate(): void {
    // Code pheromones: strength *= (1 - evaporationRate), remove < 0.1
    for (const [filePath, pheromones] of this.filePheromones) {
      const surviving: SpatialPheromone[] = [];
      for (const p of pheromones) {
        p.strength *= (1 - this.evaporationRate);
        if (p.strength >= 0.1) {
          surviving.push(p);
        }
      }
      this.filePheromones.set(filePath, surviving);

      // Recompute best if we lost the current best
      const slot = this.fileSlots.get(filePath);
      if (slot && slot.bestSolutionId) {
        const bestStillExists = surviving.some(p => p.id === slot.bestSolutionId);
        if (!bestStillExists) {
          // Find new best
          if (surviving.length > 0) {
            const newBest = surviving.reduce((a, b) => a.quality > b.quality ? a : b);
            slot.bestSolutionId = newBest.id;
            slot.bestQuality = newBest.quality;
          } else {
            slot.bestSolutionId = null;
            slot.bestQuality = 0;
          }
          this.recomputeSlotStatus(filePath);
        }
      }
    }

    // Signals: strength *= (1 - evaporationRate * 2), remove < 0.05
    this.signals = this.signals.filter(s => {
      s.strength *= (1 - this.evaporationRate * 2);
      return s.strength >= 0.05;
    });

    // Recompute status for all slots (signals may have evaporated)
    for (const filePath of this.fileSlots.keys()) {
      this.recomputeSlotStatus(filePath);
    }
  }

  /**
   * Calculate global convergence: fraction of files that are solid or better
   */
  calculateGlobalConvergence(): number {
    const slots = this.getAllFileSlots();
    if (slots.length === 0) return 0;

    const solidOrBetter = slots.filter(
      s => s.status === 'solid' || s.status === 'excellent'
    ).length;

    return solidOrBetter / slots.length;
  }

  /**
   * Check if the environment has globally converged
   */
  hasConverged(): boolean {
    return this.calculateGlobalConvergence() >= this.globalConvergenceThreshold;
  }

  /**
   * Get scaling advice based on environment state
   */
  getScalingAdvice(totalActiveAgents: number = 0): ScalingAdvice {
    const slots = this.getAllFileSlots();
    if (slots.length === 0) return { action: 'hold', reason: 'No file slots' };

    const emptySlots = slots.filter(s => s.status === 'empty').length;
    const solidOrBetter = slots.filter(
      s => s.status === 'solid' || s.status === 'excellent'
    ).length;

    // Don't scale up if we already have more agents than unfinished files
    const unfinishedFiles = slots.length - solidOrBetter;
    if (totalActiveAgents >= unfinishedFiles && unfinishedFiles > 0) {
      return {
        action: 'hold',
        reason: `Already have ${totalActiveAgents} agents for ${unfinishedFiles} unfinished files`,
      };
    }

    // Scale up only if there are empty files with no active agent
    const unattendedEmpty = slots.filter(
      s => s.status === 'empty' && this.getActiveAgentCount(s.filePath) === 0
    ).length;

    if (unattendedEmpty > 0) {
      return {
        action: 'scale_up',
        reason: `${unattendedEmpty} empty files with no active agent`,
      };
    }

    // Scale down if most files are solid
    if (solidOrBetter >= slots.length * 0.8) {
      return {
        action: 'scale_down',
        reason: `${solidOrBetter}/${slots.length} files are solid or better`,
      };
    }

    return {
      action: 'hold',
      reason: `${solidOrBetter}/${slots.length} solid, ${emptySlots} empty`,
    };
  }

  /**
   * Register that an agent is working on a file
   */
  registerAgentActivity(filePath: string, agentId: string): void {
    // Clear this agent from all other files (agent works on one file at a time)
    for (const [fp, agents] of this.activeAgents) {
      if (fp !== filePath) {
        agents.delete(agentId);
      }
    }
    if (!this.activeAgents.has(filePath)) {
      this.activeAgents.set(filePath, new Set());
    }
    this.activeAgents.get(filePath)!.add(agentId);
  }

  /**
   * Remove an agent from all activity tracking
   */
  deregisterAgent(agentId: string): void {
    for (const agents of this.activeAgents.values()) {
      agents.delete(agentId);
    }
  }

  /**
   * Get number of agents actively working on a file
   */
  getActiveAgentCount(filePath: string): number {
    return this.activeAgents.get(filePath)?.size ?? 0;
  }

  /**
   * Get all file slots
   */
  getAllFileSlots(): FileSlot[] {
    return Array.from(this.fileSlots.values());
  }

  /**
   * Get a specific file slot
   */
  getFileSlot(filePath: string): FileSlot | undefined {
    return this.fileSlots.get(filePath);
  }

  /**
   * Build a context map of best solutions for all files (for compile checks)
   */
  getContextFiles(): Map<string, string> {
    const context = new Map<string, string>();
    for (const [filePath] of this.fileSlots) {
      const best = this.getBestSolution(filePath);
      if (best) {
        context.set(filePath, best.code);
      }
    }
    return context;
  }

  /**
   * Print current environment status
   */
  printStatus(): void {
    const slots = this.getAllFileSlots();
    const convergence = this.calculateGlobalConvergence();

    console.log(`\n[Environment Status] Convergence: ${(convergence * 100).toFixed(0)}%`);
    for (const slot of slots) {
      const signals = this.signals.filter(s => s.filePath === slot.filePath);
      const signalInfo = signals.length > 0 ? ` [${signals.length} signals]` : '';
      const statusIcon = this.getStatusIcon(slot.status);
      console.log(
        `  ${statusIcon} ${slot.filePath}: ${slot.status} (quality: ${slot.bestQuality.toFixed(2)})${signalInfo}`
      );
    }
  }

  /**
   * Generate a work recommendation for agents deciding which file to work on
   */
  private getWorkRecommendation(
    slot: FileSlot,
    activeAgentCount: number,
    signalCount: number,
  ): string {
    if (slot.status === 'excellent') return 'SKIP - already excellent';
    if (activeAgentCount >= 2) return 'AVOID - too many agents already working on this';
    if (slot.status === 'blocked' && signalCount > 0) return 'HIGH PRIORITY - has interface mismatches to fix';
    if (slot.status === 'empty') return 'HIGH PRIORITY - needs initial solution';
    if (slot.status === 'attempted' || slot.status === 'partial') return 'MEDIUM - needs improvement';
    if (slot.status === 'solid') return 'LOW - already solid';
    return 'NORMAL';
  }

  // ---- Private helpers ----

  /**
   * Check if a file's imports are satisfied by its dependencies' exports.
   * Produces or clears interface_mismatch signals.
   */
  private checkImportCompatibility(
    filePath: string,
    imports: { name: string; fromFile: string }[]
  ): void {
    // Clear existing interface_mismatch signals for this file
    this.signals = this.signals.filter(
      s => !(s.type === 'interface_mismatch' && s.filePath === filePath)
    );

    // Group imports by source file
    const importsByFile = new Map<string, string[]>();
    for (const imp of imports) {
      const existing = importsByFile.get(imp.fromFile) ?? [];
      existing.push(imp.name);
      importsByFile.set(imp.fromFile, existing);
    }

    // Check each dependency
    for (const [fromFile, importNames] of importsByFile) {
      const depBest = this.getBestSolution(fromFile);
      if (!depBest) {
        // Dependency has no solution yet — signal mismatch
        this.depositSignal({
          type: 'interface_mismatch',
          filePath,
          message: `Dependency ${fromFile} has no solution yet. Needed imports: [${importNames.join(', ')}]`,
          severity: 'medium',
          sourceAgent: 'environment',
        });
        continue;
      }

      // Check which imports are missing from the dependency's exports
      const missing = importNames.filter(name => !depBest.exports.includes(name));
      if (missing.length > 0) {
        this.depositSignal({
          type: 'interface_mismatch',
          filePath,
          message: `Missing imports from ${fromFile}: [${missing.join(', ')}]. Available exports: [${depBest.exports.join(', ')}]`,
          severity: 'high',
          sourceAgent: 'environment',
        });
      }
    }
  }

  /**
   * When a file's exports change, check all files that depend on it
   */
  private reverseCheckExports(filePath: string, newExports: string[]): void {
    const slot = this.fileSlots.get(filePath);
    if (!slot) return;

    for (const dependentFile of slot.dependedBy) {
      const depBest = this.getBestSolution(dependentFile);
      if (!depBest) continue;

      // Re-check the dependent file's imports against our new exports
      const relevantImports = depBest.imports.filter(i => i.fromFile === filePath);
      if (relevantImports.length === 0) continue;

      // Clear old mismatch signals for this specific dependency relationship
      this.signals = this.signals.filter(
        s => !(s.type === 'interface_mismatch' && s.filePath === dependentFile &&
               s.message.includes(filePath))
      );

      const missing = relevantImports
        .map(i => i.name)
        .filter(name => !newExports.includes(name));

      if (missing.length > 0) {
        this.depositSignal({
          type: 'interface_mismatch',
          filePath: dependentFile,
          message: `Missing imports from ${filePath}: [${missing.join(', ')}]. Available exports: [${newExports.join(', ')}]`,
          severity: 'high',
          sourceAgent: 'environment',
        });
      }

      // Recompute dependent slot status
      this.recomputeSlotStatus(dependentFile);
    }
  }

  /**
   * Recompute a file slot's status based on quality and signals
   */
  private recomputeSlotStatus(filePath: string): void {
    const slot = this.fileSlots.get(filePath);
    if (!slot) return;

    // Only block if there are high-severity, fresh mismatch signals AND quality is low
    const hasCriticalMismatch = this.signals.some(
      s => s.type === 'interface_mismatch' &&
           s.filePath === filePath &&
           s.severity === 'high' &&
           s.strength > 0.5
    );

    if (hasCriticalMismatch && slot.bestQuality > 0 && slot.bestQuality < 0.65) {
      slot.status = 'blocked';
      return;
    }

    slot.status = this.qualityToStatus(slot.bestQuality);
  }

  /**
   * Map quality score to slot status
   */
  private qualityToStatus(quality: number): SlotStatus {
    if (quality <= 0) return 'empty';
    if (quality < 0.4) return 'attempted';
    if (quality < 0.65) return 'partial';
    if (quality < 0.85) return 'solid';
    return 'excellent';
  }

  /**
   * Get a status icon for display
   */
  private getStatusIcon(status: SlotStatus): string {
    switch (status) {
      case 'empty': return '[ ]';
      case 'attempted': return '[~]';
      case 'partial': return '[=]';
      case 'solid': return '[+]';
      case 'excellent': return '[*]';
      case 'blocked': return '[!]';
    }
  }
}

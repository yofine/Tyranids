/**
 * HiveMind - Swarm coordination layer
 *
 * Bridges Gatekeeper → EnvironmentOrchestrator.
 * Responsibilities:
 * 1. Build swarm configuration from complexity assessment
 * 2. Match & inject relevant skills
 * 3. Launch EnvironmentOrchestrator with event hooks
 * 4. Collect results & trigger skill extraction
 * 5. Forward swarm events to UI
 */

import { getModel, type Model, type Api } from '@mariozechner/pi-ai';
import {
  EnvironmentOrchestrator,
  createTypeScriptCompileFn,
  createPassthroughValidateFn,
} from '@tyranids/swarm-core';
import type {
  EnvironmentSwarmConfig,
  EnvironmentTask,
  CompileFunction,
} from '@tyranids/swarm-core';
import { TyranidWorkspace } from './workspace.js';
import { SkillLibrary } from './skill-library.js';
import { SelfEvolution } from './self-evolution.js';
import type {
  ComplexityAssessment,
  SwarmEvent,
  TaskResult,
} from './types.js';

export interface SwarmResult {
  success: boolean;
  files: Map<string, string>;
  convergence: number;
  duration: number;
  skillsLearned: string[];
}

export class HiveMind {
  private workspace: TyranidWorkspace;
  private skillLibrary: SkillLibrary;
  private selfEvolution: SelfEvolution;
  private eventCallbacks: ((event: SwarmEvent) => void)[] = [];

  constructor(
    workspace: TyranidWorkspace,
    skillLibrary: SkillLibrary,
    selfEvolution: SelfEvolution,
  ) {
    this.workspace = workspace;
    this.skillLibrary = skillLibrary;
    this.selfEvolution = selfEvolution;
  }

  /**
   * Execute a swarm task based on complexity assessment.
   */
  async executeSwarmTask(
    assessment: ComplexityAssessment,
    taskDescription: string,
    provider: string,
    modelName: string,
  ): Promise<SwarmResult> {
    const startTime = Date.now();

    // 1. Create task record
    const taskRecord = await this.workspace.createTask(taskDescription);

    // 2. Match relevant skills
    const skills = await this.skillLibrary.matchSkills(taskDescription, 5);
    for (const skill of skills) {
      this.emitEvent({
        type: 'skill_loaded',
        skillName: skill.name,
        agentId: 'hive-mind',
        timestamp: Date.now(),
      });
    }

    // 3. Build swarm configuration from assessment
    const swarmConfig = this.buildSwarmConfig(assessment);

    // 4. Build environment task from assessment
    const envTask = this.buildEnvironmentTask(assessment, taskDescription);

    // 5. Create model (fix Minimax baseUrl if needed)
    let model = getModel(provider as any, modelName as any) as Model<Api>;
    if (provider === 'minimax' && model.baseUrl?.includes('minimax.io')) {
      model = { ...model, baseUrl: 'https://api.minimaxi.com/anthropic' };
    }

    // 6. Select validation function based on file types
    const compileFn = this.selectValidationFn(envTask);

    // 7. Launch orchestrator with event hooks
    const orchestrator = new EnvironmentOrchestrator({
      task: envTask,
      swarmConfig,
      provider,
      modelName,
      compileFn,
      onEvent: (event) => this.handleOrchestratorEvent(event),
    });

    // 7. Execute
    let results: Map<string, string>;
    try {
      results = await orchestrator.execute();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[HiveMind] Swarm execution error: ${msg}`);
      results = new Map();
    }

    const duration = Date.now() - startTime;
    const convergence = orchestrator.getEnvironment().calculateGlobalConvergence();

    // 8. Extract skills from results
    let skillsLearned: string[] = [];
    if (results.size > 0) {
      try {
        const extracted = await this.skillLibrary.extractSkills(
          taskDescription,
          results,
          model,
        );
        skillsLearned = extracted.map(s => s.name);
      } catch {
        // Skill extraction is best-effort
      }
    }

    // 9. Complete task record
    const taskResult: TaskResult = {
      files: results,
      convergence,
      duration,
      skillsLearned,
    };
    await this.workspace.completeTask(taskRecord.id, taskResult);

    // 10. Save generated files to workspace
    if (results.size > 0) {
      await this.saveGeneratedFiles(taskRecord.id, results);
    }

    // 11. Emit completion event
    this.emitEvent({
      type: 'task_complete',
      duration,
      filesGenerated: results.size,
      convergence,
      timestamp: Date.now(),
    });

    return {
      success: results.size > 0,
      files: results,
      convergence,
      duration,
      skillsLearned,
    };
  }

  /**
   * Register a callback for swarm events.
   */
  onSwarmEvent(callback: (event: SwarmEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Build EnvironmentSwarmConfig from complexity assessment.
   */
  private buildSwarmConfig(assessment: ComplexityAssessment): EnvironmentSwarmConfig {
    const agentCount = assessment.suggestedAgentCount;

    const configs: Record<string, Partial<EnvironmentSwarmConfig>> = {
      simple: {
        agentCount: 1,
        minAgents: 1,
        maxAgents: 2,
        maxIterations: 10,
        evaporationRate: 0.15,
        evaporationInterval: 30000,
        fileConvergenceThreshold: 0.70,
        globalConvergenceThreshold: 0.70,
        scaleCheckInterval: 15000,
      },
      moderate: {
        agentCount: Math.min(agentCount, 3),
        minAgents: 2,
        maxAgents: 4,
        maxIterations: 15,
        evaporationRate: 0.10,
        evaporationInterval: 30000,
        fileConvergenceThreshold: 0.75,
        globalConvergenceThreshold: 0.75,
        scaleCheckInterval: 20000,
      },
      complex: {
        agentCount: Math.min(agentCount, 6),
        minAgents: 3,
        maxAgents: 8,
        maxIterations: 20,
        evaporationRate: 0.08,
        evaporationInterval: 45000,
        fileConvergenceThreshold: 0.75,
        globalConvergenceThreshold: 0.80,
        scaleCheckInterval: 30000,
      },
    };

    const base = configs[assessment.level] ?? configs.moderate;

    return {
      agentCount: base.agentCount!,
      maxIterations: base.maxIterations!,
      convergenceThreshold: base.globalConvergenceThreshold!,
      minAgents: base.minAgents!,
      maxAgents: base.maxAgents!,
      evaporationRate: base.evaporationRate!,
      evaporationInterval: base.evaporationInterval!,
      fileConvergenceThreshold: base.fileConvergenceThreshold!,
      globalConvergenceThreshold: base.globalConvergenceThreshold!,
      scaleCheckInterval: base.scaleCheckInterval!,
      synapticMemory: {
        baseDir: this.workspace.getSwarmMemoryDir(),
        enabled: true,
        maxSynapticEntries: 10,
        maxTrailMarkers: 5,
        snapshotInterval: 30000,
      },
    };
  }

  /**
   * Select the appropriate validation function based on file types in the task.
   * TypeScript files get tsc validation; everything else gets passthrough.
   */
  private selectValidationFn(task: EnvironmentTask): CompileFunction {
    const hasTypeScript = task.fileSlots.some(
      f => f.filePath.endsWith('.ts') || f.filePath.endsWith('.tsx')
    );
    return hasTypeScript ? createTypeScriptCompileFn() : createPassthroughValidateFn();
  }

  /**
   * Build EnvironmentTask from complexity assessment.
   */
  private buildEnvironmentTask(
    assessment: ComplexityAssessment,
    taskDescription: string,
  ): EnvironmentTask {
    const fileSlots = (assessment.fileStructure ?? []).map(f => ({
      filePath: f.filePath,
      description: f.description,
      dependsOn: f.dependsOn,
    }));

    // If no file structure was provided, create a single-file task
    if (fileSlots.length === 0) {
      fileSlots.push({
        filePath: 'src/solution.ts',
        description: taskDescription,
        dependsOn: [],
      });
    }

    return {
      description: taskDescription,
      projectName: `task-${Date.now()}`,
      fileSlots,
    };
  }

  /**
   * Handle events from the EnvironmentOrchestrator and forward them.
   */
  private handleOrchestratorEvent(event: { type: string; data: Record<string, unknown> }): void {
    const now = Date.now();

    // Map orchestrator events to SwarmEvent types
    switch (event.type) {
      case 'agent_spawned':
        this.emitEvent({
          type: 'agent_spawned',
          agentId: String(event.data.agentId ?? ''),
          total: Number(event.data.total ?? 0),
          timestamp: now,
        });
        break;

      case 'agent_retired':
        this.emitEvent({
          type: 'agent_retired',
          agentId: String(event.data.agentId ?? ''),
          reason: String(event.data.reason ?? 'retired'),
          timestamp: now,
        });
        break;

      case 'solution_submitted':
        this.emitEvent({
          type: 'solution_submitted',
          agentId: String(event.data.agentId ?? ''),
          file: String(event.data.file ?? ''),
          quality: Number(event.data.quality ?? 0),
          timestamp: now,
        });
        break;

      case 'solution_reinforced':
        this.emitEvent({
          type: 'solution_reinforced',
          file: String(event.data.file ?? ''),
          quality: Number(event.data.quality ?? 0),
          depositors: Number(event.data.depositors ?? 0),
          timestamp: now,
        });
        break;

      case 'scaling':
        this.emitEvent({
          type: 'scaling',
          direction: event.data.direction as 'up' | 'down',
          from: Number(event.data.from ?? 0),
          to: Number(event.data.to ?? 0),
          reason: String(event.data.reason ?? ''),
          timestamp: now,
        });
        break;

      case 'convergence_update':
        this.emitEvent({
          type: 'convergence_update',
          percentage: Number(event.data.percentage ?? 0),
          fileStatuses: [],
          timestamp: now,
        });
        break;
    }
  }

  /**
   * Emit a swarm event to all registered callbacks.
   */
  private emitEvent(event: SwarmEvent): void {
    for (const cb of this.eventCallbacks) {
      try {
        cb(event);
      } catch {
        // Don't let callback errors break the swarm
      }
    }
  }

  /**
   * Save generated files to both:
   * 1. Project directory (actual source files the user can use)
   * 2. .tyranids/generated/<taskId>/ (backup copy)
   */
  private async saveGeneratedFiles(
    taskId: string,
    files: Map<string, string>,
  ): Promise<void> {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { join, dirname } = await import('node:path');

    // 1. Write actual source files to project directory
    const projectDir = this.workspace.projectDir;
    for (const [filePath, code] of files) {
      const absPath = join(projectDir, filePath);
      await mkdir(dirname(absPath), { recursive: true });
      await writeFile(absPath, code);
    }

    // 2. Save backup copy in .tyranids/generated/<taskId>/
    const taskDir = join(this.workspace.getGeneratedDir(), taskId);
    await mkdir(taskDir, { recursive: true });

    for (const [filePath, code] of files) {
      const safeName = filePath.replace(/\//g, '--');
      await writeFile(join(taskDir, safeName), code);
    }
  }

  /**
   * Get the self-evolution engine (for CLI /evolve command).
   */
  getSelfEvolution(): SelfEvolution {
    return this.selfEvolution;
  }
}

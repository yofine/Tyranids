/**
 * EnvironmentOrchestrator - Minimal orchestrator with elastic scaling
 *
 * Four responsibilities + memory:
 * 1. Seed — create FileSlots + dependency edges
 * 2. Spawn — create initial agents
 * 3. Monitor — poll environment, print progress, check convergence
 * 4. Scale — add/remove agents based on environment.getScalingAdvice()
 * 5. Memory — manage synaptic memory lifecycle (initialize, snapshot, flush)
 *
 * The orchestrator does NOT assign tasks or tell agents what to do.
 * Agents self-organize through the environment.
 */

import { getModel, type Model, type Api } from '@mariozechner/pi-ai';
import { SwarmEnvironment } from './environment.js';
import { EnvironmentAgent } from './environment-agent.js';
import { createPassthroughValidateFn } from './evaluator.js';
import { SynapticMemory } from './synaptic-memory.js';
import type {
  EnvironmentTask,
  EnvironmentSwarmConfig,
  CompileFunction,
} from './types.js';

export interface EnvironmentOrchestratorConfig {
  task: EnvironmentTask;
  swarmConfig: EnvironmentSwarmConfig;
  provider?: string;
  modelName?: string;
  /** Validation function for solutions. Defaults to passthrough (always passes). */
  compileFn?: CompileFunction;
  /** Optional custom system prompt for agents */
  agentSystemPrompt?: string;
  /** Optional event callback for real-time UI integration */
  onEvent?: (event: { type: string; data: Record<string, unknown> }) => void;
}

export class EnvironmentOrchestrator {
  private environment: SwarmEnvironment;
  private agents: EnvironmentAgent[] = [];
  private config: EnvironmentSwarmConfig;
  private task: EnvironmentTask;
  private provider: string;
  private modelName: string;
  private compileFn: CompileFunction;
  private model: Model<Api>;
  private agentIdCounter: number = 0;
  private evaporationTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private memory: SynapticMemory | null = null;
  private onEvent: ((event: { type: string; data: Record<string, unknown> }) => void) | null = null;
  private agentSystemPrompt: string | undefined;

  constructor(params: EnvironmentOrchestratorConfig) {
    this.config = params.swarmConfig;
    this.task = params.task;
    this.provider = params.provider ?? 'anthropic';
    this.modelName = params.modelName ?? 'claude-haiku-4-5-20241022';
    this.compileFn = params.compileFn ?? createPassthroughValidateFn();

    this.environment = new SwarmEnvironment({
      evaporationRate: this.config.evaporationRate,
      fileConvergenceThreshold: this.config.fileConvergenceThreshold,
      globalConvergenceThreshold: this.config.globalConvergenceThreshold,
      onEvent: this.onEvent ?? undefined,
    });

    // Create model
    this.model = getModel(this.provider as any, this.modelName as any) as Model<Api>;

    // Fix Minimax baseUrl if needed
    if (this.provider === 'minimax' && this.model.baseUrl?.includes('minimax.io')) {
      this.model = {
        ...this.model,
        baseUrl: 'https://api.minimaxi.com/anthropic',
      };
    }

    // Store event callback and agent prompt
    this.onEvent = params.onEvent ?? null;
    this.agentSystemPrompt = params.agentSystemPrompt;

    // Initialize synaptic memory if enabled
    const memConfig = this.config.synapticMemory;
    if (memConfig?.enabled !== false && memConfig) {
      this.memory = new SynapticMemory(memConfig);
    }
  }

  /**
   * Execute the environment-based swarm
   */
  async execute(): Promise<Map<string, string>> {
    const startTime = Date.now();

    console.log(`\n=== Environment Swarm ===`);
    console.log(`Project: ${this.task.projectName}`);
    console.log(`Description: ${this.task.description}`);
    console.log(`Files: ${this.task.fileSlots.length}`);
    console.log(`Agents: ${this.config.minAgents}-${this.config.maxAgents}`);
    console.log(`Provider: ${this.provider} / ${this.modelName}`);
    console.log(`Synaptic Memory: ${this.memory ? 'ENABLED' : 'disabled'}`);
    console.log(`========================\n`);

    // 1. Seed the environment
    this.environment.seed(this.task);

    // 2. Initialize synaptic memory
    if (this.memory) {
      await this.memory.initialize();
    }

    // 3. Spawn initial agents
    const initialCount = Math.min(this.config.maxAgents, this.config.agentCount);
    for (let i = 0; i < initialCount; i++) {
      this.spawnAgent();
    }

    console.log(`\nSpawned ${this.agents.length} initial agents\n`);

    // 4. Start evaporation timer
    this.startEvaporation();

    // 5. Start hive state snapshot timer
    this.startHiveStateSnapshots();

    // 6. Run agents + monitor in parallel
    const agentPromises = this.agents.map(a => a.execute());
    const monitorPromise = this.monitorAndScale();

    // Wait for monitor to finish (convergence or timeout) or all agents to finish
    await Promise.race([
      Promise.all(agentPromises),
      monitorPromise,
    ]);

    // 7. Stop everything
    this.stopAll();

    // Wait a moment for agents to finish current tool calls
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 8. Collect results
    const results = new Map<string, string>();
    for (const slot of this.environment.getAllFileSlots()) {
      const best = this.environment.getBestSolution(slot.filePath);
      if (best) {
        results.set(slot.filePath, best.code);
      }
    }

    // 9. Print final status
    const duration = Date.now() - startTime;
    this.printFinalReport(results, duration);

    // 10. Final memory snapshot and flush
    if (this.memory) {
      this.memory.snapshotHiveState(this.environment);
      this.memory.snapshotDependencyMap(this.environment);
      await this.memory.flush();
    }

    return results;
  }

  /**
   * Monitor convergence and handle scaling
   */
  private async monitorAndScale(): Promise<void> {
    const maxDuration = this.config.maxIterations * 60000; // rough time limit
    const startTime = Date.now();

    while (!this.environment.hasConverged()) {
      await new Promise(resolve => setTimeout(resolve, this.config.scaleCheckInterval));

      // Check time limit
      if (Date.now() - startTime > maxDuration) {
        console.log(`\n[Monitor] Time limit reached`);
        break;
      }

      // Print status
      this.environment.printStatus();

      // Check all agents still running
      const activeAgents = this.agents.filter(a => !this.isAgentDone(a));
      console.log(`[Monitor] Active agents: ${activeAgents.length}/${this.agents.length}`);

      // If all agents are done, stop monitoring
      if (activeAgents.length === 0) {
        console.log(`[Monitor] All agents finished`);
        break;
      }

      // Scaling
      const advice = this.environment.getScalingAdvice(activeAgents.length);
      if (advice.action === 'scale_up' && this.agents.length < this.config.maxAgents) {
        console.log(`[Monitor] Scaling UP: ${advice.reason}`);
        this.onEvent?.({ type: 'scaling', data: { direction: 'up', from: this.agents.length, reason: advice.reason } });
        const newAgent = this.spawnAgent();
        // Start the new agent (fire and forget)
        newAgent.execute().catch(err =>
          console.error(`[${newAgent.getId()}] Execution error: ${err.message}`)
        );
      } else if (advice.action === 'scale_down' && this.agents.length > this.config.minAgents) {
        console.log(`[Monitor] Scaling DOWN: ${advice.reason}`);
        this.onEvent?.({ type: 'scaling', data: { direction: 'down', from: this.agents.length, reason: advice.reason } });
        this.retireAgent();
      }
    }

    if (this.environment.hasConverged()) {
      console.log(`\n[Monitor] Environment has converged!`);
      this.onEvent?.({ type: 'convergence_update', data: {
        percentage: 100,
        converged: true,
      }});
    }
  }

  /**
   * Spawn a new agent
   */
  private spawnAgent(): EnvironmentAgent {
    const id = `env-agent-${this.agentIdCounter++}`;
    const agent = new EnvironmentAgent({
      id,
      environment: this.environment,
      compileFn: this.compileFn,
      model: this.model,
      maxIterations: this.config.maxIterations,
      memory: this.memory ?? undefined,
      systemPrompt: this.agentSystemPrompt,
    });

    this.agents.push(agent);
    console.log(`[Orchestrator] Spawned ${id}`);
    this.onEvent?.({ type: 'agent_spawned', data: { agentId: id, total: this.agents.length } });
    return agent;
  }

  /**
   * Retire the agent with the fewest successful submits
   */
  private retireAgent(): void {
    // Find the agent with fewest successful submits that is still running
    let worst: EnvironmentAgent | null = null;
    let worstSubmits = Infinity;

    for (const agent of this.agents) {
      if (this.isAgentDone(agent)) continue;
      const submits = agent.getSuccessfulSubmits();
      if (submits < worstSubmits) {
        worstSubmits = submits;
        worst = agent;
      }
    }

    if (worst) {
      console.log(`[Orchestrator] Retiring ${worst.getId()} (${worstSubmits} successful submits)`);
      worst.stop();
      this.onEvent?.({ type: 'agent_retired', data: { agentId: worst.getId(), submits: worstSubmits } });
    }
  }

  /**
   * Check if an agent appears to be done (heuristic: iterations completed >= maxIterations)
   */
  private isAgentDone(agent: EnvironmentAgent): boolean {
    return agent.getIterationsCompleted() >= this.config.maxIterations;
  }

  /**
   * Start periodic evaporation
   */
  private startEvaporation(): void {
    this.evaporationTimer = setInterval(() => {
      this.environment.evaporate();
    }, this.config.evaporationInterval);
  }

  /**
   * Start periodic hive state snapshots to markdown
   */
  private startHiveStateSnapshots(): void {
    if (!this.memory) return;
    const interval = this.config.synapticMemory?.snapshotInterval ?? 30000;
    this.snapshotTimer = setInterval(() => {
      this.memory!.snapshotHiveState(this.environment);
      this.memory!.snapshotDependencyMap(this.environment);
    }, interval);
  }

  /**
   * Stop all agents and timers
   */
  private stopAll(): void {
    // Stop evaporation
    if (this.evaporationTimer) {
      clearInterval(this.evaporationTimer);
      this.evaporationTimer = null;
    }

    // Stop snapshot timer
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }

    // Stop all agents and deregister from environment
    for (const agent of this.agents) {
      agent.stop();
      this.environment.deregisterAgent(agent.getId());
    }
  }

  /**
   * Print the final execution report
   */
  private printFinalReport(results: Map<string, string>, duration: number): void {
    console.log(`\n=== Final Report ===`);
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`Agents used: ${this.agents.length}`);
    console.log(`Files generated: ${results.size}/${this.task.fileSlots.length}`);
    console.log(`Global convergence: ${(this.environment.calculateGlobalConvergence() * 100).toFixed(0)}%`);

    console.log(`\nFile results:`);
    for (const slot of this.environment.getAllFileSlots()) {
      const best = this.environment.getBestSolution(slot.filePath);
      if (best) {
        const lines = best.code.split('\n').length;
        console.log(
          `  ${slot.filePath}: quality=${best.quality.toFixed(2)}, ` +
          `${lines} lines, exports=[${best.exports.join(', ')}]`
        );
      } else {
        console.log(`  ${slot.filePath}: NO SOLUTION`);
      }
    }

    const totalSubmits = this.agents.reduce((sum, a) => sum + a.getSuccessfulSubmits(), 0);
    console.log(`\nTotal successful submits: ${totalSubmits}`);
    if (this.memory) {
      console.log(`Synaptic memory: .swarm-memory/`);
    }
    console.log(`====================\n`);
  }

  /**
   * Get the environment (for external observation)
   */
  getEnvironment(): SwarmEnvironment {
    return this.environment;
  }

  /**
   * Get all agents
   */
  getAgents(): EnvironmentAgent[] {
    return this.agents;
  }
}

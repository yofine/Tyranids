/**
 * SwarmRuntime - 虫群运行时环境 (Pi-based implementation)
 *
 * 基于 Pi 框架的虫群运行时
 * 为 Skills 提供虫群能力
 */

import {
  SwarmOrchestratorPi,
  type SwarmConfig,
  type CodingTask,
  type Pheromone,
} from '@tyranids/swarm-core';
import { readFile } from 'node:fs/promises';

export interface SwarmInstancePi {
  id: string;
  orchestrator: SwarmOrchestratorPi;
  task: CodingTask;
  config: SwarmConfig;
  startTime: number;
  status: 'running' | 'completed' | 'failed';
  result?: Pheromone[];
}

export class SwarmRuntimePi {
  private instances: Map<string, SwarmInstancePi> = new Map();
  private provider: 'anthropic' | 'openai' | 'google';

  constructor(provider: 'anthropic' | 'openai' | 'google' = 'anthropic') {
    this.provider = provider;
  }

  /**
   * Spawn a new swarm
   */
  async spawn(params: {
    task: string;
    file: string;
    agents?: number;
    iterations?: number;
    convergenceThreshold?: number;
  }): Promise<string> {
    // Read base code from file
    const baseCode = await readFile(params.file, 'utf-8');

    // Create task
    const task: CodingTask = {
      description: params.task,
      filePath: params.file,
      baseCode,
      type: this.classifyTask(params.task),
    };

    // Create config
    const config: SwarmConfig = {
      agentCount: params.agents || 5,
      maxIterations: params.iterations || 20,
      convergenceThreshold: params.convergenceThreshold || 0.8,
      explorationRate: 0.15,
      modelPreference: 'haiku-only',
    };

    // Create orchestrator (Pi-based)
    const orchestrator = new SwarmOrchestratorPi({
      config,
      task,
      provider: this.provider,
    });

    // Generate swarm ID
    const swarmId = `swarm-${Date.now()}`;

    // Store instance
    const instance: SwarmInstancePi = {
      id: swarmId,
      orchestrator,
      task,
      config,
      startTime: Date.now(),
      status: 'running',
    };

    this.instances.set(swarmId, instance);

    // Execute swarm (async)
    this.executeSwarm(swarmId).catch((error) => {
      console.error(`Swarm ${swarmId} failed:`, error);
      instance.status = 'failed';
    });

    return swarmId;
  }

  /**
   * Execute swarm in background
   */
  private async executeSwarm(swarmId: string): Promise<void> {
    const instance = this.instances.get(swarmId);
    if (!instance) {
      throw new Error(`Swarm ${swarmId} not found`);
    }

    try {
      const result = await instance.orchestrator.execute();
      instance.result = result;
      instance.status = 'completed';
    } catch (error) {
      instance.status = 'failed';
      throw error;
    }
  }

  /**
   * Get swarm status
   */
  getStatus(swarmId: string): SwarmInstancePi | undefined {
    return this.instances.get(swarmId);
  }

  /**
   * Get latest swarm
   */
  getLatest(): SwarmInstancePi | undefined {
    const instances = Array.from(this.instances.values());
    if (instances.length === 0) return undefined;

    return instances.sort((a, b) => b.startTime - a.startTime)[0];
  }

  /**
   * Classify task type based on description
   */
  private classifyTask(description: string): CodingTask['type'] {
    const lower = description.toLowerCase();

    const keywords = {
      'add-feature': ['添加', '新增', 'add', 'new', '功能', 'feature'],
      refactor: ['重构', 'refactor', '优化结构', 'restructure'],
      bugfix: ['修复', '修改', 'fix', 'bug', '错误'],
      optimize: ['优化', 'optimize', '性能', 'performance'],
    };

    for (const [type, words] of Object.entries(keywords)) {
      if (words.some((w) => lower.includes(w))) {
        return type as CodingTask['type'];
      }
    }

    return 'unknown';
  }
}

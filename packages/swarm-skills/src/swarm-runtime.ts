/**
 * SwarmRuntime - 虫群运行时环境
 *
 * 为 Skills 提供虫群能力的运行时环境
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  SwarmOrchestrator,
  type SwarmConfig,
  type CodingTask,
  type Pheromone,
} from '@tyranids/swarm-core';
import { readFile } from 'node:fs/promises';

export interface SwarmInstance {
  id: string;
  orchestrator: SwarmOrchestrator;
  task: CodingTask;
  config: SwarmConfig;
  startTime: number;
  status: 'running' | 'completed' | 'failed';
  result?: Pheromone[];
}

export class SwarmRuntime {
  private instances: Map<string, SwarmInstance> = new Map();
  private llm: Anthropic;

  constructor(apiKey?: string) {
    this.llm = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
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

    // Create orchestrator
    const orchestrator = new SwarmOrchestrator({
      config,
      llm: this.llm,
      task,
    });

    // Generate swarm ID
    const swarmId = `swarm-${Date.now()}`;

    // Store instance
    const instance: SwarmInstance = {
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
  getStatus(swarmId: string): SwarmInstance | undefined {
    return this.instances.get(swarmId);
  }

  /**
   * Get latest swarm
   */
  getLatest(): SwarmInstance | undefined {
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

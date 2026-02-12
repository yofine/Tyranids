/**
 * SwarmOrchestrator - 虫群编排器
 *
 * 职责:
 * - 生成指定数量的虫群个体
 * - 并行执行所有 agents
 * - 监控收敛过程
 * - 提取最佳方案
 *
 * 灵感: 泰伦主宰意志 (Hive Mind) - 统筹而不控制
 */

import type { CodingTask, Pheromone, SwarmConfig } from './types.js';
import { PheromonePool } from './pheromone-pool.js';
import { SwarmAgent, type SwarmAgentConfig } from './swarm-agent.js';
import Anthropic from '@anthropic-ai/sdk';

export interface SwarmOrchestratorConfig {
  /** Swarm configuration */
  config: SwarmConfig;
  /** LLM client */
  llm: Anthropic;
  /** Coding task */
  task: CodingTask;
}

export class SwarmOrchestrator {
  private pheromonePool: PheromonePool;
  private agents: SwarmAgent[] = [];
  private config: SwarmConfig;
  private llm: Anthropic;
  private task: CodingTask;

  constructor(params: SwarmOrchestratorConfig) {
    this.config = params.config;
    this.llm = params.llm;
    this.task = params.task;
    this.pheromonePool = new PheromonePool();
  }

  /**
   * Execute the swarm
   *
   * Returns the best solution found
   */
  async execute(): Promise<Pheromone[]> {
    console.log(`\n🐝 启动虫群...`);
    console.log(`📋 任务: ${this.task.description}`);
    console.log(`📄 文件: ${this.task.filePath}`);
    console.log(`👥 规模: ${this.config.agentCount} agents\n`);

    // 1. 生成虫群
    this.spawnAgents();

    // 2. 并行执行所有 agents (使用 Promise.all)
    const agentPromises = this.agents.map((agent) =>
      agent.execute(this.config.maxIterations)
    );

    // 3. 启动收敛监控 (在后台定期检查)
    const convergencePromise = this.monitorConvergence();

    // 4. 等待所有 agents 完成或收敛
    await Promise.race([Promise.all(agentPromises), convergencePromise]);

    // 5. 停止所有 agents
    this.stopAllAgents();

    // 6. 提取最佳方案
    const topSolutions = this.pheromonePool.getTop(3);

    console.log(`\n✅ 虫群执行完成`);
    console.log(`📊 发现 ${this.pheromonePool.size()} 个方案`);
    console.log(`🏆 Top-3 质量: [${topSolutions.map((p) => p.quality.toFixed(2)).join(', ')}]`);

    return topSolutions;
  }

  /**
   * Spawn agents
   *
   * Creates the specified number of agents with shared pheromone pool
   */
  private spawnAgents(): void {
    console.log(`🧬 派生 ${this.config.agentCount} 个虫子...`);

    for (let i = 0; i < this.config.agentCount; i++) {
      const agentConfig: SwarmAgentConfig = {
        id: `agent-${i}`,
        pheromonePool: this.pheromonePool,
        task: this.task,
        llm: this.llm,
        explorationRate: this.config.explorationRate,
        // Use modelPreference to determine which model to use
        model:
          this.config.modelPreference === 'sonnet-preferred'
            ? 'claude-sonnet-4-5-20250929'
            : 'claude-haiku-4-5-20241022',
      };

      const agent = new SwarmAgent(agentConfig);
      this.agents.push(agent);

      console.log(`  [${agentConfig.id}] 已生成`);
    }

    console.log('');
  }

  /**
   * Monitor convergence
   *
   * Periodically checks pheromone distribution
   * Stops when convergence threshold is reached
   */
  private async monitorConvergence(): Promise<void> {
    const checkInterval = 5000; // 每 5 秒检查一次
    let iteration = 0;

    while (iteration < this.config.maxIterations) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));

      const convergence = this.pheromonePool.calculateConvergence();
      const topPheromones = this.pheromonePool.getTop(3);

      if (topPheromones.length > 0) {
        const topQuality = topPheromones[0].quality;

        console.log(
          `[监控 ${iteration}] 收敛度: ${(convergence * 100).toFixed(0)}% | 最高质量: ${topQuality.toFixed(2)}`
        );

        // 收敛条件: 收敛度超过阈值
        if (convergence >= this.config.convergenceThreshold) {
          console.log(
            `\n🎯 检测到收敛 (${(convergence * 100).toFixed(0)}% >= ${(this.config.convergenceThreshold * 100).toFixed(0)}%)`
          );
          console.log(`📍 第 ${iteration} 轮达到收敛`);
          return;
        }

        // 早期停止: 已有高质量方案且多数 agents 支持
        if (topQuality > 0.95 && convergence > 0.6) {
          console.log(`\n⚡ 提前收敛: 发现高质量方案 (质量=${topQuality.toFixed(2)})`);
          return;
        }
      }

      iteration++;
    }

    console.log(`\n⏱️  达到最大迭代次数 (${this.config.maxIterations})`);
  }

  /**
   * Stop all agents
   */
  private stopAllAgents(): void {
    console.log('🛑 停止所有 agents...\n');
    for (const agent of this.agents) {
      agent.stop();
    }
  }

  /**
   * Get the pheromone pool (for external observation)
   */
  getPheromonePool(): PheromonePool {
    return this.pheromonePool;
  }

  /**
   * Get all agents (for external observation)
   */
  getAgents(): SwarmAgent[] {
    return this.agents;
  }
}

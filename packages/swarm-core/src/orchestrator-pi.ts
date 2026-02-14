/**
 * SwarmOrchestrator - 虫群编排器 (Pi-based implementation)
 *
 * 基于 Pi 框架重构:
 * - 使用 Pi getModel() 替代直接的 LLM 客户端
 * - 保留虫群特性: 并行执行、收敛监控、信息素池
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
import { SwarmAgentPi } from './swarm-agent-pi.js';
import { SwarmObserver } from './observer.js';
import { TyranidBioEngine } from './bioengine/index.js';

export interface SwarmOrchestratorPiConfig {
  /** Swarm configuration */
  config: SwarmConfig;
  /** Coding task */
  task: CodingTask;
  /** Provider to use (or any string for Pi-supported providers) */
  provider?: 'anthropic' | 'openai' | 'google' | string;
  /** Enable bioengine evolution (default: true) */
  enableEvolution?: boolean;
}

export class SwarmOrchestratorPi {
  private pheromonePool: PheromonePool;
  private agents: SwarmAgentPi[] = [];
  private config: SwarmConfig;
  private task: CodingTask;
  private provider: string;
  public observer: SwarmObserver;
  private bioEngine: TyranidBioEngine;
  private enableEvolution: boolean;

  constructor(params: SwarmOrchestratorPiConfig) {
    this.config = params.config;
    this.task = params.task;
    this.provider = params.provider || 'anthropic';
    this.enableEvolution = params.enableEvolution ?? true; // 默认启用进化
    this.pheromonePool = new PheromonePool();
    this.observer = new SwarmObserver(params.config.agentCount);
    this.bioEngine = new TyranidBioEngine();
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

    // 启动观测
    this.observer.start();

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

    // 6. 记录最终方案
    this.observer.recordSolutions(this.pheromonePool);

    // 7. 停止观测
    this.observer.stop();

    // 8. 提取最佳方案
    const topSolutions = this.pheromonePool.getTop(3);

    console.log(`\n✅ 虫群执行完成`);
    console.log(`📊 发现 ${this.pheromonePool.size()} 个方案`);
    console.log(`🏆 Top-3 质量: [${topSolutions.map((p) => p.quality.toFixed(2)).join(', ')}]`);

    // 9. 显示报告和可视化
    console.log('\n' + this.observer.generateReport());
    this.observer.visualizePheromoneEvolution();

    // 10. 记录执行到基因库 (用于进化)
    if (this.enableEvolution) {
      try {
        await this.bioEngine.recordExecution(
          this.task,
          this.config,
          this.observer.getMetrics()
        );
      } catch (error) {
        console.error('⚠️  记录执行到基因库失败:', error);
      }
    }

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
      // 根据 provider 选择模型
      let modelName: string;
      if (this.provider === 'minimax') {
        modelName = 'MiniMax-M2.1'; // Minimax 最新模型
      } else if (this.provider === 'openai') {
        modelName = this.config.modelPreference === 'sonnet-preferred'
          ? 'gpt-4o'
          : 'gpt-4o-mini';
      } else if (this.provider === 'google') {
        modelName = this.config.modelPreference === 'sonnet-preferred'
          ? 'gemini-2.0-flash-exp'
          : 'gemini-2.0-flash-exp';
      } else {
        // Anthropic (default)
        modelName = this.config.modelPreference === 'sonnet-preferred'
          ? 'claude-sonnet-4-5-20250929'
          : 'claude-haiku-4-5-20241022';
      }

      const agent = new SwarmAgentPi({
        id: `agent-${i}`,
        pheromonePool: this.pheromonePool,
        task: this.task,
        explorationRate: this.config.explorationRate,
        provider: this.provider,
        modelName,
      });

      this.agents.push(agent);

      console.log(`  [agent-${i}] 已生成`);
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

      // 记录信息素快照
      await this.observer.recordPheromoneSnapshot(iteration, this.pheromonePool);

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
          this.observer.recordConvergence(iteration, convergence);
          return;
        }

        // 早期停止: 已有高质量方案且多数 agents 支持
        if (topQuality > 0.95 && convergence > 0.6) {
          console.log(`\n⚡ 提前收敛: 发现高质量方案 (质量=${topQuality.toFixed(2)})`);
          this.observer.recordConvergence(iteration, convergence);
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
  getAgents(): SwarmAgentPi[] {
    return this.agents;
  }

  /**
   * Get the bioengine (for evolution control)
   */
  getBioEngine(): TyranidBioEngine {
    return this.bioEngine;
  }

  /**
   * 加载进化后的配置 (静态方法,用于创建编排器前)
   */
  static async loadEvolvedConfig(
    taskType: string
  ): Promise<SwarmConfig | null> {
    const bioEngine = new TyranidBioEngine();
    const taskTypeEnum = taskType as
      | 'add-feature'
      | 'refactor'
      | 'bugfix'
      | 'optimize'
      | 'unknown';
    return await bioEngine.loadEvolvedConfig(taskTypeEnum);
  }
}

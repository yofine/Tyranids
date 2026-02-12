/**
 * 泰伦生物引擎 - 基因吞噬与进化系统
 *
 * 核心功能:
 * 1. 记录执行历史到"基因库"
 * 2. 使用遗传算法优化虫群配置
 * 3. 根据任务类型和环境自适应调整参数
 */

import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
  ExecutionRecord,
  TaskType,
} from './types.js';
import type { CodingTask, SwarmConfig, SwarmMetrics } from '../types.js';

/**
 * 泰伦生物引擎
 *
 * 灵感来自战锤40k的泰伦虫族:
 * - 吞噬敌人的基因物质
 * - 快速进化适应环境
 * - 生成专门化的兵种
 */
export class TyranidBioEngine {
  private genePoolDir: string;
  private historyFile: string;
  private evolvedConfigFile: string;

  constructor(baseDir?: string) {
    this.genePoolDir = baseDir || join(homedir(), '.tyranids', 'gene-pool');
    this.historyFile = join(this.genePoolDir, 'execution-history.jsonl');
    this.evolvedConfigFile = join(this.genePoolDir, 'evolved-configs.json');
  }

  /**
   * 初始化基因库目录
   */
  async initialize(): Promise<void> {
    if (!existsSync(this.genePoolDir)) {
      await mkdir(this.genePoolDir, { recursive: true });
    }
  }

  /**
   * 记录执行结果到基因库
   *
   * 每次虫群执行完成后调用,积累进化数据
   */
  async recordExecution(
    task: CodingTask,
    config: SwarmConfig,
    metrics: SwarmMetrics
  ): Promise<void> {
    await this.initialize();

    const taskType = this.classifyTask(task);
    const score = this.calculateScore(metrics);

    const record: ExecutionRecord = {
      id: `exec-${Date.now()}`,
      timestamp: Date.now(),
      taskType,
      task,
      config,
      results: metrics,
      score,
    };

    // 追加到历史文件（JSONL 格式）
    await appendFile(this.historyFile, JSON.stringify(record) + '\n');

    console.log(
      `🧬 执行记录已保存 (任务类型: ${taskType}, 评分: ${score.toFixed(2)})`
    );

    // 每 10 次执行触发自动进化
    const history = await this.loadHistory();
    if (history.length % 10 === 0 && history.length > 0) {
      console.log(`\n🧬 达到 ${history.length} 次执行,触发自动进化...\n`);
      await this.triggerEvolution();
    }
  }

  /**
   * 任务分类 - 识别任务类型
   */
  private classifyTask(task: CodingTask): TaskType {
    const keywords = {
      'add-feature': ['添加', '新增', 'add', 'new', '功能', 'feature'],
      refactor: ['重构', 'refactor', '优化结构', 'restructure'],
      bugfix: ['修复', '修改', 'fix', 'bug', '错误'],
      optimize: ['优化', 'optimize', '性能', 'performance'],
    };

    const description = task.description.toLowerCase();

    for (const [type, words] of Object.entries(keywords)) {
      if (words.some((w) => description.includes(w))) {
        return type as TaskType;
      }
    }

    return 'unknown';
  }

  /**
   * 计算执行评分
   *
   * 综合质量、速度、成本三个维度
   */
  private calculateScore(metrics: SwarmMetrics): number {
    const weights = {
      quality: 0.4, // 40% 质量权重
      speed: 0.3, // 30% 速度权重
      cost: 0.3, // 30% 成本权重
    };

    const latestEvolution =
      metrics.pheromoneEvolution[metrics.pheromoneEvolution.length - 1];
    const qualityScore = latestEvolution?.topQuality || 0;

    // 速度评分：迭代次数越少越好（归一化到 0-1）
    const speedScore = Math.max(0, 1 - metrics.convergenceIteration / 20);

    // 成本评分：成本越低越好（目标 <$0.15）
    const costScore = Math.max(
      0,
      1 - metrics.llmCalls.estimatedCost / 0.15
    );

    return (
      weights.quality * qualityScore +
      weights.speed * speedScore +
      weights.cost * costScore
    );
  }

  /**
   * 分析进化机会
   *
   * 生成进化分析报告
   */
  async analyzeEvolutionOpportunities(): Promise<string> {
    const history = await this.loadHistory();

    if (history.length < 10) {
      return `❌ 数据不足（需要至少 10 次执行记录，当前: ${history.length} 次）`;
    }

    // 按任务类型分组
    const byTaskType = this.groupByTaskType(history);

    const report: string[] = ['# 虫群技能进化分析\n'];

    for (const [taskType, records] of Object.entries(byTaskType)) {
      report.push(`## ${taskType} 类任务\n`);

      // 找出最佳配置
      const best = records.reduce((a, b) => (a.score > b.score ? a : b));

      report.push(`**最佳配置** (评分: ${best.score.toFixed(2)}):`);
      report.push(`- Agent 数量: ${best.config.agentCount}`);
      report.push(`- 探索率: ${best.config.explorationRate}`);
      report.push(`- 收敛轮次: ${best.results.convergenceIteration}`);
      report.push(
        `- 成本: $${best.results.llmCalls.estimatedCost.toFixed(4)}\n`
      );

      // 找出最差配置（用于对比）
      const worst = records.reduce((a, b) => (a.score < b.score ? a : b));

      report.push(`**对比最差配置** (评分: ${worst.score.toFixed(2)}):`);
      report.push(
        `- 改进幅度: ${((best.score - worst.score) * 100).toFixed(1)}%\n`
      );
    }

    // 进化建议
    report.push('## 进化建议\n');
    report.push(this.generateEvolutionRecommendations(byTaskType));

    return report.join('\n');
  }

  /**
   * 触发进化 - 使用遗传算法优化配置
   */
  async triggerEvolution(): Promise<void> {
    console.log('🧬 触发虫群技能进化...');

    const history = await this.loadHistory();

    if (history.length < 5) {
      console.log('⚠️  数据不足,跳过进化');
      return;
    }

    const byTaskType = this.groupByTaskType(history);

    const evolvedConfig: { [key in TaskType]?: SwarmConfig } = {};

    for (const [taskType, records] of Object.entries(byTaskType)) {
      if (records.length < 3) {
        console.log(`⚠️  ${taskType} 类任务数据不足,跳过`);
        continue;
      }

      // 遗传算法优化配置
      const optimized = await this.geneticAlgorithmOptimize(records);
      evolvedConfig[taskType as TaskType] = optimized;

      console.log(`✅ ${taskType} 类任务配置已进化`);
      console.log(`   - Agent 数量: ${optimized.agentCount}`);
      console.log(`   - 探索率: ${(optimized.explorationRate || 0.15).toFixed(2)}`);
      console.log(
        `   - 收敛阈值: ${(optimized.convergenceThreshold || 0.8).toFixed(2)}`
      );
    }

    // 保存进化后的配置
    await writeFile(
      this.evolvedConfigFile,
      JSON.stringify(evolvedConfig, null, 2)
    );

    console.log('\n✅ 进化完成，配置已保存到', this.evolvedConfigFile);
  }

  /**
   * 遗传算法优化配置
   *
   * 使用选择、交叉、变异操作进化出最佳参数
   */
  private async geneticAlgorithmOptimize(
    records: ExecutionRecord[]
  ): Promise<SwarmConfig> {
    const population = records.map((r) => r.config);

    // 遗传算法参数
    const generations = 5;
    const populationSize = Math.min(20, records.length);
    const eliteSize = Math.floor(populationSize * 0.2);

    let currentGen = population.slice(0, populationSize);

    for (let gen = 0; gen < generations; gen++) {
      // 评分排序
      const scored = currentGen
        .map((config) => ({
          config,
          score: this.predictScore(config, records),
        }))
        .sort((a, b) => b.score - a.score);

      // 选择精英
      const elite = scored.slice(0, eliteSize).map((s) => s.config);

      // 交叉和变异生成新个体
      const nextGen: SwarmConfig[] = [...elite];

      while (nextGen.length < populationSize) {
        // 随机选择两个父代
        const parent1 = elite[Math.floor(Math.random() * elite.length)];
        const parent2 = elite[Math.floor(Math.random() * elite.length)];

        // 交叉
        const child = this.crossover(parent1, parent2);

        // 变异（10% 概率）
        const mutated = Math.random() < 0.1 ? this.mutate(child) : child;

        nextGen.push(mutated);
      }

      currentGen = nextGen;
    }

    // 返回最终最佳配置
    const finalScored = currentGen
      .map((config) => ({
        config,
        score: this.predictScore(config, records),
      }))
      .sort((a, b) => b.score - a.score);

    return finalScored[0].config;
  }

  /**
   * 交叉操作 - 单点交叉
   */
  private crossover(a: SwarmConfig, b: SwarmConfig): SwarmConfig {
    return {
      agentCount: Math.random() < 0.5 ? a.agentCount : b.agentCount,
      explorationRate:
        Math.random() < 0.5 ? a.explorationRate : b.explorationRate,
      convergenceThreshold:
        Math.random() < 0.5 ? a.convergenceThreshold : b.convergenceThreshold,
      maxIterations: Math.random() < 0.5 ? a.maxIterations : b.maxIterations,
      modelPreference:
        Math.random() < 0.5 ? a.modelPreference : b.modelPreference,
    };
  }

  /**
   * 变异操作 - 随机扰动参数
   */
  private mutate(config: SwarmConfig): SwarmConfig {
    const mutated = { ...config };

    // 随机扰动一个参数
    const param = [
      'agentCount',
      'explorationRate',
      'convergenceThreshold',
      'maxIterations',
    ][Math.floor(Math.random() * 4)];

    switch (param) {
      case 'agentCount':
        mutated.agentCount = Math.max(
          3,
          Math.min(
            10,
            Math.round(mutated.agentCount + (Math.random() - 0.5) * 4)
          )
        );
        break;
      case 'explorationRate':
        mutated.explorationRate = Math.max(
          0.05,
          Math.min(
            0.5,
            (mutated.explorationRate || 0.15) + (Math.random() - 0.5) * 0.2
          )
        );
        break;
      case 'convergenceThreshold':
        mutated.convergenceThreshold = Math.max(
          0.6,
          Math.min(
            0.95,
            mutated.convergenceThreshold + (Math.random() - 0.5) * 0.2
          )
        );
        break;
      case 'maxIterations':
        mutated.maxIterations = Math.max(
          10,
          Math.min(
            30,
            Math.round(mutated.maxIterations + (Math.random() - 0.5) * 10)
          )
        );
        break;
    }

    return mutated;
  }

  /**
   * 预测评分 - 使用 K 近邻算法
   */
  private predictScore(
    config: SwarmConfig,
    history: ExecutionRecord[]
  ): number {
    const k = Math.min(5, history.length);

    // 计算与历史配置的距离
    const distances = history.map((record) => ({
      distance: this.configDistance(config, record.config),
      score: record.score,
    }));

    // 取最近的 k 个
    distances.sort((a, b) => a.distance - b.distance);
    const nearest = distances.slice(0, k);

    // 加权平均（距离越近权重越大）
    const totalWeight = nearest.reduce(
      (sum, n) => sum + 1 / (n.distance + 0.01),
      0
    );
    const predictedScore =
      nearest.reduce(
        (sum, n) => sum + n.score * (1 / (n.distance + 0.01)),
        0
      ) / totalWeight;

    return predictedScore;
  }

  /**
   * 配置距离 - 欧几里得距离
   */
  private configDistance(a: SwarmConfig, b: SwarmConfig): number {
    return Math.sqrt(
      Math.pow((a.agentCount - b.agentCount) / 10, 2) +
        Math.pow((a.explorationRate || 0.15) - (b.explorationRate || 0.15), 2) +
        Math.pow((a.convergenceThreshold || 0.8) - (b.convergenceThreshold || 0.8), 2) +
        Math.pow((a.maxIterations - b.maxIterations) / 30, 2)
    );
  }

  /**
   * 生成进化建议
   */
  private generateEvolutionRecommendations(byTaskType: {
    [key: string]: ExecutionRecord[];
  }): string {
    const recommendations: string[] = [];

    for (const [taskType, records] of Object.entries(byTaskType)) {
      const avgScore =
        records.reduce((sum, r) => sum + r.score, 0) / records.length;
      const best = records.reduce((a, b) => (a.score > b.score ? a : b));

      if (best.score - avgScore > 0.2) {
        recommendations.push(
          `- **${taskType}**: 存在明显优化空间，建议应用最佳配置（可提升 ${((best.score - avgScore) * 100).toFixed(0)}%）`
        );
      }
    }

    if (recommendations.length === 0) {
      return '✅ 当前配置已接近最优，无需进化';
    }

    return recommendations.join('\n');
  }

  /**
   * 按任务类型分组
   */
  private groupByTaskType(history: ExecutionRecord[]): {
    [key: string]: ExecutionRecord[];
  } {
    return history.reduce(
      (groups, record) => {
        const type = record.taskType;
        if (!groups[type]) {
          groups[type] = [];
        }
        groups[type].push(record);
        return groups;
      },
      {} as { [key: string]: ExecutionRecord[] }
    );
  }

  /**
   * 加载执行历史
   */
  private async loadHistory(): Promise<ExecutionRecord[]> {
    try {
      const content = await readFile(this.historyFile, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  /**
   * 加载进化后的配置
   */
  async loadEvolvedConfig(taskType: TaskType): Promise<SwarmConfig | null> {
    try {
      const content = await readFile(this.evolvedConfigFile, 'utf-8');
      const configs = JSON.parse(content);
      return configs[taskType] || null;
    } catch {
      return null;
    }
  }

  /**
   * 获取执行统计
   */
  async getStatistics(): Promise<{
    totalExecutions: number;
    byTaskType: { [key: string]: number };
    avgScore: number;
    bestScore: number;
  }> {
    const history = await this.loadHistory();

    const byTaskType: { [key: string]: number } = {};
    let totalScore = 0;
    let bestScore = 0;

    for (const record of history) {
      byTaskType[record.taskType] = (byTaskType[record.taskType] || 0) + 1;
      totalScore += record.score;
      bestScore = Math.max(bestScore, record.score);
    }

    return {
      totalExecutions: history.length,
      byTaskType,
      avgScore: history.length > 0 ? totalScore / history.length : 0,
      bestScore,
    };
  }
}

/**
 * SwarmObserver - 虫群观测器
 *
 * 负责收集和分析虫群执行的各种度量指标:
 * - Agent 行为统计
 * - 信息素演化过程
 * - LLM 调用成本
 * - 收敛分析
 *
 * 用于评测效果和优化虫群参数
 */

import type {
  SwarmMetrics,
  AgentActionStats,
  PheromoneSnapshot,
  Action,
} from './types.js';
import type { PheromonePool } from './pheromone-pool.js';

export class SwarmObserver {
  private metrics: SwarmMetrics;
  private agentCount: number;

  constructor(agentCount: number) {
    this.agentCount = agentCount;
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize empty metrics
   */
  private initializeMetrics(): SwarmMetrics {
    return {
      startTime: 0,
      endTime: 0,
      duration: 0,
      agentActions: {},
      pheromoneEvolution: [],
      llmCalls: {
        total: 0,
        byModel: {},
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0,
      },
      solutions: [],
      convergenceDetected: false,
      convergenceIteration: -1,
      finalConvergenceRatio: 0,
    };
  }

  /**
   * Start observation
   */
  start(): void {
    this.metrics.startTime = Date.now();
    console.log('📊 观测器启动\n');
  }

  /**
   * Stop observation
   */
  stop(): void {
    this.metrics.endTime = Date.now();
    this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
    console.log('\n📊 观测器停止');
  }

  /**
   * Record agent action
   */
  recordAgentAction(agentId: string, action: Action): void {
    if (!this.metrics.agentActions[agentId]) {
      this.metrics.agentActions[agentId] = {
        explores: 0,
        refines: 0,
        validates: 0,
        idles: 0,
      };
    }

    const actionType = action.type.toLowerCase() + 's' as keyof AgentActionStats;
    this.metrics.agentActions[agentId][actionType]++;
  }

  /**
   * Record pheromone snapshot
   */
  async recordPheromoneSnapshot(
    iteration: number,
    pool: PheromonePool
  ): Promise<void> {
    const all = await pool.read();
    const top = pool.getTop(1)[0];

    if (all.length === 0) {
      return;
    }

    const avgQuality =
      all.reduce((sum, p) => sum + p.quality, 0) / all.length;
    const diversity = this.calculateDiversity(all);
    const convergence = pool.calculateConvergence();

    const snapshot: PheromoneSnapshot = {
      iteration,
      topQuality: top?.quality || 0,
      avgQuality,
      diversity,
      convergence,
      timestamp: Date.now(),
    };

    this.metrics.pheromoneEvolution.push(snapshot);
  }

  /**
   * Calculate diversity using Shannon entropy
   */
  private calculateDiversity(pheromones: { quality: number }[]): number {
    if (pheromones.length === 0) return 0;

    const total = pheromones.reduce((sum, p) => sum + p.quality, 0);
    if (total === 0) return 0;

    const entropy = pheromones.reduce((h, p) => {
      const prob = p.quality / total;
      if (prob === 0) return h;
      return h - prob * Math.log2(prob);
    }, 0);

    // Normalize to 0-1
    return pheromones.length > 1 ? entropy / Math.log2(pheromones.length) : 0;
  }

  /**
   * Record LLM call
   */
  recordLLMCall(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): void {
    this.metrics.llmCalls.total++;
    this.metrics.llmCalls.byModel[model] =
      (this.metrics.llmCalls.byModel[model] || 0) + 1;
    this.metrics.llmCalls.inputTokens += inputTokens;
    this.metrics.llmCalls.outputTokens += outputTokens;

    // Estimate cost based on Anthropic pricing (per million tokens)
    const prices: { [key: string]: { input: number; output: number } } = {
      'claude-haiku-4-5-20241022': { input: 0.25, output: 1.25 },
      'claude-haiku-4.5': { input: 0.25, output: 1.25 },
      'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
      'claude-sonnet-4.5': { input: 3.0, output: 15.0 },
    };

    const price = prices[model] || prices['claude-haiku-4.5'];
    this.metrics.llmCalls.estimatedCost +=
      (inputTokens / 1_000_000) * price.input +
      (outputTokens / 1_000_000) * price.output;
  }

  /**
   * Record convergence detection
   */
  recordConvergence(iteration: number, convergenceRatio: number): void {
    this.metrics.convergenceDetected = true;
    this.metrics.convergenceIteration = iteration;
    this.metrics.finalConvergenceRatio = convergenceRatio;
  }

  /**
   * Record final solutions
   */
  recordSolutions(pool: PheromonePool): void {
    const top = pool.getTop(10);
    this.metrics.solutions = top.map((p) => ({
      id: p.id,
      quality: p.quality,
      depositors: [...p.depositors],
      compilationSuccess: p.metadata?.compilationSuccess || false,
      timestamp: p.timestamp,
    }));
  }

  /**
   * Generate text report
   */
  generateReport(): string {
    const lines: string[] = [];

    lines.push('# Tyranids 虫群执行报告\n');

    // Time statistics
    lines.push('## 时间统计');
    lines.push(`- 总耗时: ${(this.metrics.duration / 1000).toFixed(2)}s`);
    lines.push(
      `- 开始: ${new Date(this.metrics.startTime).toISOString()}`
    );
    lines.push(`- 结束: ${new Date(this.metrics.endTime).toISOString()}\n`);

    // Agent behavior
    lines.push('## Agent 行为分析');
    for (const [id, actions] of Object.entries(this.metrics.agentActions)) {
      const total = actions.explores + actions.refines + actions.validates;
      const exploreRate =
        total > 0 ? ((actions.explores / total) * 100).toFixed(1) : '0.0';

      lines.push(`### ${id}`);
      lines.push(`- 探索次数: ${actions.explores}`);
      lines.push(`- 精炼次数: ${actions.refines}`);
      lines.push(`- 验证次数: ${actions.validates}`);
      lines.push(`- 探索率: ${exploreRate}%\n`);
    }

    // Pheromone evolution
    if (this.metrics.pheromoneEvolution.length > 0) {
      lines.push('## 信息素演化\n');
      lines.push(
        '| 迭代 | 最高质量 | 平均质量 | 多样性 | 收敛度 |'
      );
      lines.push('|------|----------|----------|--------|--------|');

      for (const e of this.metrics.pheromoneEvolution) {
        lines.push(
          `| ${e.iteration} | ${e.topQuality.toFixed(2)} | ${e.avgQuality.toFixed(2)} | ${e.diversity.toFixed(2)} | ${e.convergence.toFixed(2)} |`
        );
      }
      lines.push('');
    }

    // LLM cost
    lines.push('## 成本分析');
    lines.push(`- LLM 调用总数: ${this.metrics.llmCalls.total}`);
    for (const [model, count] of Object.entries(
      this.metrics.llmCalls.byModel
    )) {
      lines.push(`- ${model}: ${count} 次`);
    }
    lines.push(
      `- 输入 tokens: ${this.metrics.llmCalls.inputTokens.toLocaleString()}`
    );
    lines.push(
      `- 输出 tokens: ${this.metrics.llmCalls.outputTokens.toLocaleString()}`
    );
    lines.push(
      `- **估算成本: $${this.metrics.llmCalls.estimatedCost.toFixed(4)}**\n`
    );

    // Convergence
    lines.push('## 收敛分析');
    lines.push(
      `- 是否收敛: ${this.metrics.convergenceDetected ? '✅ 是' : '❌ 否'}`
    );
    lines.push(`- 收敛轮次: ${this.metrics.convergenceIteration}`);
    lines.push(
      `- 最终收敛度: ${(this.metrics.finalConvergenceRatio * 100).toFixed(1)}%\n`
    );

    // Solutions
    if (this.metrics.solutions.length > 0) {
      lines.push('## 方案质量分布');
      for (let i = 0; i < Math.min(5, this.metrics.solutions.length); i++) {
        const s = this.metrics.solutions[i];
        const compiled = s.compilationSuccess ? '✅ 编译通过' : '❌ 编译失败';
        lines.push(
          `${i + 1}. 质量 ${s.quality.toFixed(2)} - ${s.depositors.length} 个 agents 支持 - ${compiled}`
        );
      }
      lines.push('');
    }

    // Insights
    lines.push('## 关键洞察');
    lines.push(this.generateInsights());

    return lines.join('\n');
  }

  /**
   * Generate insights from metrics
   */
  private generateInsights(): string {
    const insights: string[] = [];

    // Convergence speed
    if (
      this.metrics.convergenceDetected &&
      this.metrics.convergenceIteration < 5
    ) {
      insights.push('⚡ **快速收敛**: 虫群在前 5 轮内即找到优质方案');
    } else if (this.metrics.convergenceIteration > 15) {
      insights.push(
        '🐌 **缓慢收敛**: 可能需要增加探索率或优化质量评估'
      );
    }

    // Exploration-exploitation balance
    const totalExplores = Object.values(this.metrics.agentActions).reduce(
      (sum, a) => sum + a.explores,
      0
    );
    const totalRefines = Object.values(this.metrics.agentActions).reduce(
      (sum, a) => sum + a.refines,
      0
    );
    const total = totalExplores + totalRefines;
    const exploreRatio = total > 0 ? totalExplores / total : 0;

    if (exploreRatio > 0.4) {
      insights.push('🔍 **高探索性**: agents 倾向于探索新方案,多样性强');
    } else if (exploreRatio < 0.1) {
      insights.push('🎯 **高利用性**: agents 快速收敛,可能错过更优方案');
    }

    // Cost efficiency
    const costPerAgent = this.metrics.llmCalls.estimatedCost / this.agentCount;
    if (costPerAgent < 0.02) {
      insights.push('💰 **成本优秀**: 每个 agent 平均成本 <$0.02');
    } else if (costPerAgent > 0.05) {
      insights.push('💸 **成本较高**: 考虑优化 LLM 调用或使用更便宜的模型');
    }

    // Diversity
    if (this.metrics.pheromoneEvolution.length > 0) {
      const finalSnapshot =
        this.metrics.pheromoneEvolution[
          this.metrics.pheromoneEvolution.length - 1
        ];
      if (finalSnapshot.diversity > 0.5) {
        insights.push('🌈 **方案多样性高**: 虫群探索了多种不同实现路径');
      }
    }

    return insights.length > 0
      ? insights.map((i, idx) => `${idx + 1}. ${i}`).join('\n')
      : '暂无特别洞察';
  }

  /**
   * Get metrics (for external access)
   */
  getMetrics(): SwarmMetrics {
    return this.metrics;
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * Visualize pheromone evolution in terminal (ASCII)
   */
  visualizePheromoneEvolution(): void {
    if (this.metrics.pheromoneEvolution.length === 0) {
      console.log('暂无信息素数据');
      return;
    }

    console.log('\n=== 信息素质量演化 ===\n');

    const maxQuality = Math.max(
      ...this.metrics.pheromoneEvolution.map((e) => e.topQuality)
    );

    for (const e of this.metrics.pheromoneEvolution) {
      const barLength = Math.floor((e.topQuality / maxQuality) * 40);
      const bar = '█'.repeat(barLength);
      const convergenceIndicator = e.convergence > 0.8 ? ' 🎯' : '';
      console.log(
        `轮 ${e.iteration.toString().padStart(2)}: ${bar} ${e.topQuality.toFixed(2)}${convergenceIndicator}`
      );
    }

    console.log('\n=== 收敛度演化 ===\n');

    for (const e of this.metrics.pheromoneEvolution) {
      const barLength = Math.floor(e.convergence * 40);
      const bar = '▓'.repeat(barLength) + '░'.repeat(40 - barLength);
      console.log(
        `轮 ${e.iteration.toString().padStart(2)}: ${bar} ${(e.convergence * 100).toFixed(0)}%`
      );
    }
  }
}

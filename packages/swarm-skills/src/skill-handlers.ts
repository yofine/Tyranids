/**
 * Skill handlers for Tyranids swarm skills
 */

import { SwarmRuntime, type SwarmInstance } from './swarm-runtime.js';

export class SwarmSkillHandler {
  private runtime: SwarmRuntime;

  constructor(apiKey?: string) {
    this.runtime = new SwarmRuntime(apiKey);
  }

  /**
   * Handle swarm-spawn skill
   */
  async handleSwarmSpawn(params: {
    task: string;
    file: string;
    agents?: number;
    iterations?: number;
  }): Promise<string> {
    console.log(`🐝 启动虫群...`);
    console.log(`📋 任务: ${params.task}`);
    console.log(`📄 文件: ${params.file}`);
    console.log(`👥 规模: ${params.agents || 5} agents\n`);

    const swarmId = await this.runtime.spawn(params);

    return `
## 虫群已启动 ✅

**虫群 ID**: ${swarmId}

虫群正在后台执行,请等待收敛...

使用 \`/swarm-query ${swarmId}\` 查看实时状态
使用 \`/swarm-report ${swarmId}\` 生成详细报告
`;
  }

  /**
   * Handle swarm-query skill
   */
  async handleSwarmQuery(params: { swarmId?: string }): Promise<string> {
    const instance = params.swarmId
      ? this.runtime.getStatus(params.swarmId)
      : this.runtime.getLatest();

    if (!instance) {
      return '❌ 没有找到活跃的虫群';
    }

    const metrics = instance.orchestrator.observer.getMetrics();
    const latest =
      metrics.pheromoneEvolution[metrics.pheromoneEvolution.length - 1];

    const duration = instance.status === 'completed'
      ? metrics.duration
      : Date.now() - instance.startTime;

    return `
## 虫群状态 - ${instance.id}

⏱️  运行时间: ${(duration / 1000).toFixed(0)}s
🔄 当前轮次: ${latest?.iteration || 0}
⭐ 最高质量: ${latest?.topQuality.toFixed(2) || 'N/A'}
🎯 收敛度: ${((latest?.convergence || 0) * 100).toFixed(0)}%
💰 已花费: $${metrics.llmCalls.estimatedCost.toFixed(4)}
📊 状态: ${instance.status === 'running' ? '🏃 运行中' : instance.status === 'completed' ? '✅ 已完成' : '❌ 失败'}

### Agent 状态
${Object.entries(metrics.agentActions)
  .map(
    ([id, actions]) =>
      `- ${id}: ${actions.explores}次探索, ${actions.refines}次精炼`
  )
  .join('\n')}
`;
  }

  /**
   * Handle swarm-report skill
   */
  async handleSwarmReport(params: {
    swarmId?: string;
    format?: 'markdown' | 'json';
  }): Promise<string> {
    const instance = params.swarmId
      ? this.runtime.getStatus(params.swarmId)
      : this.runtime.getLatest();

    if (!instance) {
      return '❌ 没有找到虫群';
    }

    const format = params.format || 'markdown';

    if (format === 'json') {
      return instance.orchestrator.observer.exportJSON();
    }

    // Generate full report
    const report = instance.orchestrator.observer.generateReport();

    // Add top solutions if completed
    if (instance.status === 'completed' && instance.result) {
      const solutionsText = this.formatTopSolutions(instance.result);
      return `${report}\n\n## Top-3 方案\n\n${solutionsText}`;
    }

    return report;
  }

  /**
   * Format top solutions
   */
  private formatTopSolutions(pheromones: SwarmInstance['result']): string {
    if (!pheromones || pheromones.length === 0) {
      return '暂无方案';
    }

    return pheromones
      .slice(0, 3)
      .map(
        (p, i) => `
### 方案 ${i + 1} (质量: ${p.quality.toFixed(2)}, ${p.depositors.length} agents 支持)

\`\`\`typescript
${p.codeFragment.content}
\`\`\`
`
      )
      .join('\n');
  }

  /**
   * Get runtime (for testing)
   */
  getRuntime(): SwarmRuntime {
    return this.runtime;
  }
}

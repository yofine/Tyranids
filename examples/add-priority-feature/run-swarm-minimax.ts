/**
 * Swarm Test Runner - Minimax Version
 *
 * 使用 Minimax 模型运行虫群系统
 */

import { SwarmOrchestratorPi } from '@tyranids/swarm-core';
import type { CodingTask, SwarmConfig } from '@tyranids/swarm-core';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  console.log('🐝 Tyranids 虫群系统 - Minimax 版本\n');

  // 检查环境变量
  if (!process.env.MINIMAX_API_KEY) {
    console.error('❌ 错误: 未设置 MINIMAX_API_KEY 环境变量');
    console.error('请运行: export MINIMAX_API_KEY="your-api-key"');
    process.exit(1);
  }

  if (!process.env.MINIMAX_GROUP_ID) {
    console.error('❌ 错误: 未设置 MINIMAX_GROUP_ID 环境变量');
    console.error('请运行: export MINIMAX_GROUP_ID="your-group-id"');
    process.exit(1);
  }

  // 读取原始代码
  const baseCode = await readFile(join(__dirname, 'todo.ts'), 'utf-8');

  // 定义任务
  const task: CodingTask = {
    description: `为 Todo 接口添加优先级(priority)功能。

要求:
1. 在 Todo 接口中添加 priority 字段
2. 修改 addTodo 函数支持设置优先级
3. 实现 sortByPriority 函数按优先级排序
4. 保持类型安全,确保 TypeScript 编译通过

你可以选择以下任意方案:
- 使用字符串字面量类型 ('low' | 'medium' | 'high')
- 使用数字 (1-5)
- 使用枚举 (enum Priority)

注意: 只返回完整的修改后的代码,不要解释。`,
    filePath: join(__dirname, 'todo.ts'),
    baseCode,
    type: 'add-feature',
  };

  // 虫群配置
  const config: SwarmConfig = {
    agentCount: 5, // 5 个虫子并行探索
    maxIterations: 20, // 最多 20 轮迭代
    convergenceThreshold: 0.8, // 80% 收敛
    explorationRate: 0.15,
    modelPreference: 'haiku-only', // 使用小模型控制成本
  };

  console.log('配置:');
  console.log(`- LLM 提供商: Minimax`);
  console.log(`- Agent 数量: ${config.agentCount}`);
  console.log(`- 最大迭代: ${config.maxIterations}`);
  console.log(`- 收敛阈值: ${config.convergenceThreshold * 100}%`);
  console.log(`- 模型偏好: ${config.modelPreference}\n`);

  // 创建编排器 (使用 Minimax)
  const orchestrator = new SwarmOrchestratorPi({
    config,
    task,
    provider: 'minimax', // 关键: 设置为 'minimax'
  });

  // 执行虫群
  const startTime = Date.now();
  const topSolutions = await orchestrator.execute();
  const duration = (Date.now() - startTime) / 1000;

  // 保存结果
  console.log('\n💾 保存结果...\n');

  for (let i = 0; i < Math.min(3, topSolutions.length); i++) {
    const solution = topSolutions[i];
    const filename = `generated-solution-minimax-${i + 1}.ts`;
    const filepath = join(__dirname, 'generated', filename);

    await writeFile(filepath, solution.codeFragment.content);

    console.log(`✅ 方案 ${i + 1} 已保存: ${filename}`);
    console.log(`   质量: ${solution.quality.toFixed(2)}`);
    console.log(`   支持: ${solution.depositors.length} agents`);
    console.log('');
  }

  // 导出度量数据
  const metricsPath = join(
    __dirname,
    'generated',
    'swarm-metrics-minimax.json'
  );
  await writeFile(metricsPath, orchestrator.observer.exportJSON());

  console.log(`📊 度量数据已保存: swarm-metrics-minimax.json\n`);

  // 总结
  console.log('📈 执行总结:');
  console.log(`- 总耗时: ${duration.toFixed(2)}s`);
  console.log(
    `- 发现方案: ${orchestrator.getPheromonePool().size()} 个`
  );
  console.log(
    `- Top-3 质量: [${topSolutions
      .slice(0, 3)
      .map((s) => s.quality.toFixed(2))
      .join(', ')}]`
  );

  const metrics = orchestrator.observer.getMetrics();
  console.log(`- LLM 调用: ${metrics.llmCalls.total} 次`);
  console.log(`- 估算成本: ¥${metrics.llmCalls.estimatedCost.toFixed(4)}`); // Minimax 使用人民币
  console.log(`- 收敛轮次: ${metrics.convergenceIteration}`);

  // 显示生物引擎统计
  console.log('\n🧬 生物引擎统计:');
  const bioEngine = orchestrator.getBioEngine();
  const stats = await bioEngine.getStatistics();
  console.log(`- 累计执行次数: ${stats.totalExecutions}`);
  console.log(`- 平均评分: ${stats.avgScore.toFixed(2)}`);
  console.log(`- 最高评分: ${stats.bestScore.toFixed(2)}`);

  if (stats.totalExecutions >= 10) {
    console.log('\n💡 提示: 已达到 10 次执行,可以运行进化分析:');
    console.log('   npm run demo-bioengine');
  }
}

// 运行
main().catch(console.error);

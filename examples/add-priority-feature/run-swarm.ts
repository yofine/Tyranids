/**
 * Swarm Test Runner
 *
 * 运行虫群系统来探索为 Todo 添加优先级功能的不同实现方案
 */

import { SwarmOrchestratorPi } from '@tyranids/swarm-core';
import type { CodingTask, SwarmConfig } from '@tyranids/swarm-core';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  console.log('🐝 Tyranids 虫群系统测试\n');

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
    modelPreference: 'haiku-only', // 使用 Haiku 控制成本
  };

  // 创建编排器 (Pi 版本)
  const orchestrator = new SwarmOrchestratorPi({
    config,
    task,
    provider: 'anthropic',
  });

  console.log('配置:');
  console.log(`- Agent 数量: ${config.agentCount}`);
  console.log(`- 最大迭代: ${config.maxIterations}`);
  console.log(`- 收敛阈值: ${config.convergenceThreshold * 100}%`);
  console.log(`- 模型: Claude Haiku\n`);

  // 执行虫群
  const startTime = Date.now();
  const topSolutions = await orchestrator.execute();
  const duration = (Date.now() - startTime) / 1000;

  // 保存结果
  console.log('\n💾 保存结果...\n');

  for (let i = 0; i < Math.min(3, topSolutions.length); i++) {
    const solution = topSolutions[i];
    const filename = `generated-solution-${i + 1}.ts`;
    const filepath = join(__dirname, 'generated', filename);

    await writeFile(filepath, solution.codeFragment.content);

    console.log(`✅ 方案 ${i + 1} 已保存: ${filename}`);
    console.log(`   质量: ${solution.quality.toFixed(2)}`);
    console.log(`   支持: ${solution.depositors.length} agents`);
    console.log('');
  }

  // 导出度量数据
  const metricsPath = join(__dirname, 'generated', 'swarm-metrics.json');
  await writeFile(
    metricsPath,
    orchestrator.observer.exportJSON()
  );

  console.log(`📊 度量数据已保存: swarm-metrics.json\n`);

  // 总结
  console.log('📈 执行总结:');
  console.log(`- 总耗时: ${duration.toFixed(2)}s`);
  console.log(`- 发现方案: ${orchestrator.getPheromonePool().size()} 个`);
  console.log(`- Top-3 质量: [${topSolutions.slice(0, 3).map(s => s.quality.toFixed(2)).join(', ')}]`);

  const metrics = orchestrator.observer.getMetrics();
  console.log(`- LLM 调用: ${metrics.llmCalls.total} 次`);
  console.log(`- 估算成本: $${metrics.llmCalls.estimatedCost.toFixed(4)}`);
  console.log(`- 收敛轮次: ${metrics.convergenceIteration}`);
}

// 运行
main().catch(console.error);

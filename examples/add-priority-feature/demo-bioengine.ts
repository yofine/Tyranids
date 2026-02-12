/**
 * 泰伦生物引擎演示
 *
 * 展示基因吞噬和进化功能
 */

import {
  TyranidBioEngine,
  recommendBioform,
  getBioform,
  listBioforms,
} from '@tyranids/swarm-core';

async function main() {
  console.log('🧬 泰伦生物引擎演示\n');

  const bioEngine = new TyranidBioEngine();
  await bioEngine.initialize();

  // 1. 展示预定义兵种
  console.log('=== 预定义兵种 ===\n');

  const allBioforms = listBioforms();
  for (const bioform of allBioforms) {
    console.log(`**${bioform.name}** - ${bioform.role}`);
    console.log(`  探索率: ${bioform.traits.explorationRate}`);
    console.log(`  质量阈值: ${bioform.traits.qualityThreshold}`);
    console.log(
      `  Agent 数量: ${bioform.traits.agentCount || '默认'}`
    );
    console.log(`  速度: ${bioform.traits.speed || '默认'}`);
    console.log(`  成本: ${bioform.traits.cost || '中等'}`);
    console.log(`  适用场景: ${bioform.适用场景.join(', ')}`);
    console.log('');
  }

  // 2. 任务类型推荐
  console.log('\n=== 任务类型推荐 ===\n');

  const taskTypes = [
    'add-feature',
    'refactor',
    'bugfix',
    'optimize',
  ] as const;

  for (const taskType of taskTypes) {
    const recommended = recommendBioform(taskType);
    console.log(
      `${taskType} → ${recommended.name} (探索率: ${recommended.traits.explorationRate})`
    );
  }

  // 3. 获取特定兵种
  console.log('\n\n=== 获取特定兵种 ===\n');

  const carnifex = getBioform('carnifex');
  if (carnifex) {
    console.log(`获取 Carnifex 兵种:`);
    console.log(`  角色: ${carnifex.role}`);
    console.log(`  Agent 数量: ${carnifex.traits.agentCount}`);
    console.log(`  成本: ${carnifex.traits.cost}`);
  }

  // 4. 查看执行统计
  console.log('\n\n=== 执行统计 ===\n');

  const stats = await bioEngine.getStatistics();
  console.log(`总执行次数: ${stats.totalExecutions}`);
  console.log(`平均评分: ${stats.avgScore.toFixed(2)}`);
  console.log(`最高评分: ${stats.bestScore.toFixed(2)}`);
  console.log('\n按任务类型分布:');
  for (const [taskType, count] of Object.entries(stats.byTaskType)) {
    console.log(`  - ${taskType}: ${count} 次`);
  }

  // 5. 进化分析
  console.log('\n\n=== 进化分析 ===\n');

  const analysis = await bioEngine.analyzeEvolutionOpportunities();
  console.log(analysis);

  console.log('\n✅ 演示完成');
  console.log(
    '\n提示: 运行多次 run-swarm.ts 后，执行统计和进化分析会显示更多数据'
  );
}

main().catch(console.error);

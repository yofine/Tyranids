/**
 * Level 1: Calculator - Multi-file code generation test
 *
 * Goal: 7 agents collaborate to generate 4 TypeScript files (tokenizer, parser, evaluator, main)
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import type { MultiFileCodingTask } from '../../packages/swarm-core/src/types.js';
import { MultiFileSwarmAgent } from '../../packages/swarm-core/src/multi-file-agent.js';
import { MultiFilePheromonePool } from '../../packages/swarm-core/src/multi-file-pheromone-pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('🧮 Level 1: Calculator - Multi-file code generation test\n');

  // Check API key
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error('❌ 错误: 未设置 MINIMAX_API_KEY 环境变量');
    process.exit(1);
  }

  // Define the coding task
  const task: MultiFileCodingTask = {
    projectName: 'simple-calculator',
    description: 'Implement a command-line calculator supporting +, -, *, / operations with parentheses',
    expectedStructure: [
      {
        filePath: 'tokenizer.ts',
        description: 'Lexical analyzer: converts input string to tokens',
      },
      {
        filePath: 'parser.ts',
        description: 'Syntax analyzer: converts tokens to AST with correct operator precedence',
      },
      {
        filePath: 'evaluator.ts',
        description: 'Expression evaluator: calculates result from AST',
      },
      {
        filePath: 'main.ts',
        description: 'CLI entry point: reads input, calls tokenizer → parser → evaluator',
      },
    ],
    type: 'add-feature',
  };

  console.log('📋 任务:');
  console.log(`  ${task.description}\n`);
  console.log('📁 预期文件结构:');
  task.expectedStructure?.forEach(s => {
    console.log(`  - ${s.filePath}: ${s.description}`);
  });
  console.log('');

  // Configuration
  const config = {
    provider: 'minimax',
    modelName: 'MiniMax-M2.1',
    agentCount: 7,
    maxIterations: 15,
  };

  console.log('⚙️  配置:');
  console.log(`  - Provider: ${config.provider}`);
  console.log(`  - Model: ${config.modelName}`);
  console.log(`  - Agents: ${config.agentCount}`);
  console.log(`  - 迭代: ${config.maxIterations}\n`);

  // Create pheromone pool
  const pheromonePool = new MultiFilePheromonePool();

  // Create agents
  const agents: MultiFileSwarmAgent[] = [];
  for (let i = 0; i < config.agentCount; i++) {
    agents.push(
      new MultiFileSwarmAgent({
        id: `agent-${i}`,
        pheromonePool,
        task,
        provider: config.provider,
        modelName: config.modelName,
      })
    );
  }

  console.log(`🐝 派生 ${config.agentCount} 个虫子...\n`);

  const startTime = Date.now();

  // Execute all agents in parallel
  await Promise.all(agents.map(agent => agent.execute(config.maxIterations)));

  const duration = Date.now() - startTime;

  console.log('\n✅ 虫群执行完成\n');

  // Extract top solutions
  const topSolutions = pheromonePool.getTop(3);

  console.log(`📊 发现 ${pheromonePool.getCount()} 个方案`);
  console.log(`🏆 Top-3 质量: [${topSolutions.map(s => s.quality.toFixed(2)).join(', ')}]\n`);

  // Save top 3 solutions
  const outputDir = join(__dirname, 'generated');
  await mkdir(outputDir, { recursive: true });

  for (let i = 0; i < Math.min(3, topSolutions.length); i++) {
    const solution = topSolutions[i];
    const solutionDir = join(outputDir, `solution-${i + 1}`);

    await mkdir(solutionDir, { recursive: true });

    console.log(`💾 保存方案 ${i + 1} (质量: ${solution.quality.toFixed(2)}, ${solution.solution.files.length} 个文件):`);

    for (const file of solution.solution.files) {
      const filePath = join(solutionDir, file.filePath);
      await writeFile(filePath, file.content, 'utf-8');
      console.log(`   ✅ ${file.filePath} (${file.content.split('\n').length} 行)`);
    }

    console.log('');
  }

  // Summary
  console.log('📈 执行总结:');
  console.log(`  - 总耗时: ${(duration / 1000).toFixed(2)}s`);
  console.log(`  - 发现方案: ${pheromonePool.getCount()} 个`);
  console.log(`  - Top-3 质量: [${topSolutions.map(s => s.quality.toFixed(2)).join(', ')}]`);
  console.log(`  - 多样性: ${pheromonePool.calculateDiversity().toFixed(2)}`);
  console.log(`  - 收敛度: ${(pheromonePool.calculateConvergence(config.agentCount) * 100).toFixed(0)}%\n`);

  console.log('🎉 Level 1 测试完成！\n');
  console.log('下一步:');
  console.log('  1. 检查生成的代码: cd generated/solution-1');
  console.log('  2. 编译测试: tsc --noEmit *.ts');
  console.log('  3. 运行计算器: ts-node main.ts\n');
}

main().catch(console.error);

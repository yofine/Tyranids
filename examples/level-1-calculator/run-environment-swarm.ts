/**
 * Level 1: Calculator - Environment-based swarm test
 *
 * Verifies that agents self-organize through environment tools:
 * - Each agent perceives file slots, chooses what to work on
 * - Agents read dependency solutions before generating code
 * - Cross-file import/export compatibility checked automatically
 * - Elastic scaling based on environment state
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import type { EnvironmentTask, EnvironmentSwarmConfig } from '../../packages/swarm-core/src/types.js';
import { EnvironmentOrchestrator } from '../../packages/swarm-core/src/environment-orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('=== Level 1: Calculator — Environment Swarm ===\n');

  // Check for API key (supports multiple providers)
  const provider = process.env.SWARM_PROVIDER ?? 'minimax';
  const modelName = process.env.SWARM_MODEL ?? 'MiniMax-M2.1';

  if (provider === 'minimax' && !process.env.MINIMAX_API_KEY) {
    console.error('Error: MINIMAX_API_KEY not set');
    console.error('  export MINIMAX_API_KEY="your-key"');
    process.exit(1);
  }
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  // Define the task
  const task: EnvironmentTask = {
    projectName: 'simple-calculator',
    description: 'Implement a calculator supporting +, -, *, / with parentheses. Each file should use proper TypeScript import/export statements.',
    fileSlots: [
      {
        filePath: 'tokenizer.ts',
        description: 'Lexical analyzer: export a Token type and a tokenize(input: string): Token[] function',
        dependsOn: [],
      },
      {
        filePath: 'parser.ts',
        description: 'Syntax analyzer: import Token from tokenizer.ts, export an ASTNode type and a parse(tokens: Token[]): ASTNode function',
        dependsOn: ['tokenizer.ts'],
      },
      {
        filePath: 'evaluator.ts',
        description: 'AST evaluator: import ASTNode from parser.ts, export an evaluate(node: ASTNode): number function',
        dependsOn: ['parser.ts'],
      },
      {
        filePath: 'main.ts',
        description: 'CLI entry: import tokenize from tokenizer.ts, parse from parser.ts, evaluate from evaluator.ts. Read input, run the pipeline, print the result.',
        dependsOn: ['tokenizer.ts', 'parser.ts', 'evaluator.ts'],
      },
    ],
  };

  const config: EnvironmentSwarmConfig = {
    agentCount: 5,
    minAgents: 3,
    maxAgents: 8,
    maxIterations: 10,
    convergenceThreshold: 0.8,
    evaporationRate: 0.05,
    evaporationInterval: 15000,
    fileConvergenceThreshold: 0.7,
    globalConvergenceThreshold: 0.8,
    scaleCheckInterval: 20000,
  };

  console.log(`Provider: ${provider}`);
  console.log(`Model: ${modelName}`);
  console.log(`Agents: ${config.minAgents}-${config.maxAgents} (initial: ${config.agentCount})`);
  console.log(`Max iterations per agent: ${config.maxIterations}`);
  console.log('');

  // Create and run orchestrator
  const orchestrator = new EnvironmentOrchestrator({
    task,
    swarmConfig: config,
    provider,
    modelName,
  });

  const results = await orchestrator.execute();

  // Save generated files
  if (results.size > 0) {
    const outputDir = join(__dirname, 'generated', 'env-solution');
    await mkdir(outputDir, { recursive: true });

    console.log(`Saving ${results.size} generated files:`);
    for (const [filePath, code] of results) {
      const fullPath = join(outputDir, filePath);
      await writeFile(fullPath, code, 'utf-8');
      const lines = code.split('\n').length;
      console.log(`  ${filePath} (${lines} lines)`);
    }
    console.log(`\nFiles saved to: ${outputDir}`);
    console.log('To verify: cd generated/env-solution && npx tsc --noEmit *.ts');
  } else {
    console.log('No files were generated.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

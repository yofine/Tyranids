/**
 * MultiFileSwarmAgent - Agent for multi-file code generation tasks (Level 1+)
 *
 * Key differences from single-file SwarmAgentPi:
 * - Generates multiple files at once
 * - Validates cross-file consistency (imports/exports)
 * - Deposits multi-file pheromones
 */

import { getModel, complete, type Context, type Model, type Api } from '@mariozechner/pi-ai';
import { Agent } from '@mariozechner/pi-agent-core';
import type {
  MultiFileCodingTask,
  MultiFilePheromone,
  MultiFileCodeFragment,
  CodeFragment,
  Action,
  AgentState,
} from './types.js';
import { Evaluator } from './evaluator.js';

export interface MultiFileSwarmAgentConfig {
  /** Unique agent ID */
  id: string;
  /** Shared pheromone pool (stores MultiFilePheromone) */
  pheromonePool: any;  // Will be MultiFilePheromonePool
  /** Multi-file coding task */
  task: MultiFileCodingTask;
  /** Exploration rate (0-1, default 0.15) */
  explorationRate?: number;
  /** Model to use */
  modelName?: string;
  /** Provider to use */
  provider?: string;
}

export class MultiFileSwarmAgent extends Agent {
  private id: string;
  private pheromonePool: any;
  private task: MultiFileCodingTask;
  private evaluator: Evaluator;
  private agentState: AgentState;
  private shouldStop: boolean = false;
  private model: Model<Api>;

  // Behavioral parameters
  private exploitationRate: number = 0.6;
  private localSearchRate: number = 0.25;

  constructor(config: MultiFileSwarmAgentConfig) {
    super({});
    this.id = config.id;
    this.pheromonePool = config.pheromonePool;
    this.task = config.task;
    this.evaluator = new Evaluator();
    this.agentState = 'exploring' as AgentState;

    // 使用 pi-ai 的 getModel
    const provider = config.provider || 'anthropic';
    const modelName = config.modelName || 'claude-haiku-4-5-20241022';
    this.model = getModel(provider as any, modelName as any) as Model<Api>;

    // 修复 Minimax baseUrl
    if (provider === 'minimax' && this.model.baseUrl?.includes('minimax.io')) {
      this.model = {
        ...this.model,
        baseUrl: 'https://api.minimaxi.com/anthropic',
      };
    }
  }

  /**
   * Main execution loop
   */
  async execute(maxIterations: number = 10): Promise<void> {
    console.log(`[${this.id}] Starting multi-file execution...`);

    for (let i = 0; i < maxIterations; i++) {
      if (this.shouldStop) {
        console.log(`[${this.id}] Stopped at iteration ${i}`);
        break;
      }

      try {
        // 1. Read pheromones
        const pheromones = await this.pheromonePool.read();

        // 2. Decide action
        const action = this.decideAction(pheromones);

        // 3. Perform action (generate multi-file code)
        const result = await this.performAction(action);

        // 4. Evaluate quality
        const metrics = await this.evaluateMultiFile(result);

        // 5. Deposit pheromone
        await this.pheromonePool.deposit({
          id: `${this.id}-${i}`,
          solution: result,
          quality: metrics.quality,
          depositors: [this.id],
          timestamp: Date.now(),
          metadata: {
            compilationSuccess: metrics.compiles,
            crossFileConsistency: metrics.crossFileConsistency,
          },
        });

        console.log(
          `[${this.id}] Iteration ${i}: ${action.type} (quality: ${metrics.quality.toFixed(2)}, ${result.files.length} files)`
        );

        this.updateState(action);
      } catch (error) {
        console.error(`[${this.id}] Error in iteration ${i}:`, error);
      }
    }

    this.agentState = 'idle' as AgentState;
    console.log(`[${this.id}] Completed execution`);
  }

  /**
   * Decide what action to take (same probabilistic strategy)
   */
  private decideAction(pheromones: MultiFilePheromone[]): Action {
    const random = Math.random();

    if (pheromones.length === 0) {
      return { type: 'EXPLORE' };
    }

    // 60% - Follow best pheromone
    if (random < this.exploitationRate) {
      return {
        type: 'REFINE',
        target: pheromones[0] as any,
      };
    }

    // 25% - Local search
    if (random < this.exploitationRate + this.localSearchRate && pheromones.length > 1) {
      const localIndex = Math.min(Math.floor(Math.random() * 3) + 1, pheromones.length - 1);
      return {
        type: 'REFINE',
        target: pheromones[localIndex] as any,
      };
    }

    // 15% - Global exploration
    return { type: 'EXPLORE' };
  }

  /**
   * Perform the chosen action
   */
  private async performAction(action: Action): Promise<MultiFileCodeFragment> {
    if (action.type === 'REFINE' && action.target) {
      return await this.refineMultiFileCode((action.target as any).solution);
    } else {
      return await this.exploreNewMultiFileSolution();
    }
  }

  /**
   * Explore new multi-file solution from scratch
   */
  private async exploreNewMultiFileSolution(): Promise<MultiFileCodeFragment> {
    const prompt = this.buildMultiFileExplorePrompt();

    const context: Context = {
      messages: [
        {
          role: 'user',
          content: prompt,
          timestamp: Date.now(),
        },
      ],
    };

    const response = await complete(this.model, context);
    const files = this.extractMultiFileCode(response.content);

    return {
      files,
      intent: this.task.description,
      entryFile: this.task.expectedStructure?.[this.task.expectedStructure.length - 1]?.filePath,
    };
  }

  /**
   * Refine existing multi-file solution
   */
  private async refineMultiFileCode(base: MultiFileCodeFragment): Promise<MultiFileCodeFragment> {
    const prompt = this.buildMultiFileRefinePrompt(base);

    const context: Context = {
      messages: [
        {
          role: 'user',
          content: prompt,
          timestamp: Date.now(),
        },
      ],
    };

    const response = await complete(this.model, context);
    const files = this.extractMultiFileCode(response.content);

    return {
      files,
      intent: base.intent,
      entryFile: base.entryFile,
    };
  }

  /**
   * Build prompt for exploring new multi-file solution
   */
  private buildMultiFileExplorePrompt(): string {
    const structureDesc = this.task.expectedStructure
      ?.map(s => `- ${s.filePath}: ${s.description}`)
      .join('\n') || '';

    return `Create a TypeScript project to solve the following task.

Task: ${this.task.description}

Expected file structure:
${structureDesc}

Instructions:
- Generate ALL required files
- Ensure correct import/export statements between files
- Make sure all files compile together
- Keep code simple and clean

Return the code in the following format:
\`\`\`typescript:filename1.ts
// code for filename1
\`\`\`

\`\`\`typescript:filename2.ts
// code for filename2
\`\`\`

Generate complete, working code for all files.`;
  }

  /**
   * Build prompt for refining existing multi-file solution
   */
  private buildMultiFileRefinePrompt(base: MultiFileCodeFragment): string {
    const filesDesc = base.files
      .map(f => `\`\`\`typescript:${f.filePath}\n${f.content}\n\`\`\``)
      .join('\n\n');

    return `Improve the following TypeScript project solution.

Task: ${this.task.description}

Current solution:
${filesDesc}

Instructions:
- Keep the same file structure
- Fix any compilation errors
- Improve code quality
- Ensure cross-file consistency

Return ALL files in the same format:
\`\`\`typescript:filename.ts
// improved code
\`\`\``;
  }

  /**
   * Extract multiple files from LLM response
   *
   * Expected format:
   * ```typescript:tokenizer.ts
   * export function tokenize() { ... }
   * ```
   * ```typescript:parser.ts
   * import { tokenize } from './tokenizer.js';
   * ```
   */
  private extractMultiFileCode(
    content: Array<{ type: string; text?: string; thinking?: string }>
  ): CodeFragment[] {
    const textParts: string[] = [];

    for (const item of content) {
      if (item.type === 'text' && item.text) {
        textParts.push(item.text);
      }
    }

    const fullText = textParts.join('\n');

    // Extract all code blocks with filenames
    const files: CodeFragment[] = [];
    const regex = /```(?:typescript|ts):([^\n]+)\n([\s\S]*?)```/g;

    let match;
    while ((match = regex.exec(fullText)) !== null) {
      const filePath = match[1].trim();
      const content = match[2].trim();

      files.push({
        filePath,
        content,
        intent: `File: ${filePath}`,
      });
    }

    // Fallback: if no filenames found, try to split by file headers
    if (files.length === 0) {
      const fallbackRegex = /```(?:typescript|ts)\n([\s\S]*?)```/g;
      let index = 0;
      while ((match = fallbackRegex.exec(fullText)) !== null) {
        const content = match[1].trim();
        const filePath = this.task.expectedStructure?.[index]?.filePath || `file${index}.ts`;
        files.push({
          filePath,
          content,
          intent: `File: ${filePath}`,
        });
        index++;
      }
    }

    return files;
  }

  /**
   * Evaluate multi-file solution quality
   */
  private async evaluateMultiFile(solution: MultiFileCodeFragment): Promise<{
    compiles: boolean;
    quality: number;
    crossFileConsistency: number;
  }> {
    // 1. Compilation check
    const compilationResults = await Promise.all(
      solution.files.map(f => this.evaluator.evaluate(f, this.task.description))
    );

    const compiles = compilationResults.every(r => r.compiles);
    const avgQuality = compilationResults.reduce((sum, r) => sum + r.quality, 0) / compilationResults.length;

    // 2. Cross-file consistency check
    const consistency = this.checkCrossFileConsistency(solution.files);

    // 3. Overall quality
    const quality = 0.5 * avgQuality + 0.3 * (compiles ? 1 : 0) + 0.2 * consistency;

    return {
      compiles,
      quality,
      crossFileConsistency: consistency,
    };
  }

  /**
   * Check if files have consistent imports/exports
   */
  private checkCrossFileConsistency(files: CodeFragment[]): number {
    let score = 1.0;

    // Check 1: All expected files are present
    if (this.task.expectedStructure) {
      const expectedFiles = this.task.expectedStructure.map(s => s.filePath);
      const actualFiles = files.map(f => f.filePath);

      const missingFiles = expectedFiles.filter(f => !actualFiles.includes(f));
      score -= missingFiles.length * 0.2;
    }

    // Check 2: Imports reference existing files
    for (const file of files) {
      const importMatches = file.content.matchAll(/import .* from ['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        const importPath = match[1];
        // Resolve relative import
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
          const referencedFile = importPath.replace(/^\.\//, '').replace(/\.js$/, '.ts');
          const exists = files.some(f => f.filePath.includes(referencedFile));
          if (!exists) {
            score -= 0.1;
          }
        }
      }
    }

    return Math.max(0, score);
  }

  /**
   * Update agent state based on action
   */
  private updateState(action: Action): void {
    if (action.type === 'EXPLORE') {
      this.agentState = 'exploring' as AgentState;
    } else if (action.type === 'REFINE') {
      this.agentState = 'refining' as AgentState;
    }
  }

  /**
   * Signal agent to stop
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Get current state
   */
  getState(): AgentState {
    return this.agentState;
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.id;
  }
}

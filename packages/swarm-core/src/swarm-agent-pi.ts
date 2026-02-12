/**
 * SwarmAgent - Individual unit in the Tyranid swarm (Pi-based implementation)
 *
 * 基于 Pi 框架重构:
 * - 使用 pi-ai 的 getModel() 和 complete() 函数
 * - 继承 pi-agent-core 的 Agent 基类
 * - 保留虫群特性: 信息素通信、概率决策、自组织行为
 *
 * Inspired by Tyranid bio-forms - simple units, emergent intelligence
 */

import {getModel,complete,type Context,type Model} from '@mariozechner/pi-ai';
import { Agent } from '@mariozechner/pi-agent-core';
import type {
  CodingTask,
  Pheromone,
  CodeFragment,
  Action,
  AgentState,
} from './types.js';
import { PheromonePool } from './pheromone-pool.js';
import { Evaluator } from './evaluator.js';

export interface SwarmAgentPiConfig {
  /** Unique agent ID */
  id: string;
  /** Shared pheromone pool */
  pheromonePool: PheromonePool;
  /** Coding task */
  task: CodingTask;
  /** Exploration rate (0-1, default 0.15) */
  explorationRate?: number;
  /** Model to use */
  modelName?: string;
  /** Provider to use */
  provider?: 'anthropic' | 'openai' | 'google';
}

export class SwarmAgentPi extends Agent {
  private id: string;
  private pheromonePool: PheromonePool;
  private task: CodingTask;
  private evaluator: Evaluator;
  private agentState: AgentState;
  private shouldStop: boolean = false;
  private model: Model;

  // Behavioral parameters
  private exploitationRate: number = 0.6; // 60% follow best
  private localSearchRate: number = 0.25; // 25% explore similar

  constructor(config: SwarmAgentPiConfig) {
    super({});
    this.id = config.id;
    this.pheromonePool = config.pheromonePool;
    this.task = config.task;
    this.evaluator = new Evaluator();
    this.agentState = 'exploring' as AgentState;
    this.exploitationRate = 0.6;
    this.localSearchRate = 0.25;

    // 使用 pi-ai 的 getModel
    const provider = config.provider || 'anthropic';
    const modelName = config.modelName || 'claude-haiku-4-5-20241022';
    this.model = getModel(provider, modelName);
  }

  /**
   * Main execution loop
   *
   * Runs for a fixed number of iterations or until stopped
   */
  async execute(maxIterations: number = 10): Promise<void> {
    console.log(`[${this.id}] Starting execution...`);

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

        // 3. Perform action (generate code)
        const result = await this.performAction(action);

        // 4. Evaluate quality
        const metrics = await this.evaluator.evaluate(result, this.task.description);

        // 5. Deposit pheromone
        await this.pheromonePool.deposit({
          id: `${this.id}-${i}`,
          codeFragment: result,
          quality: metrics.quality,
          depositors: [this.id],
          timestamp: Date.now(),
          metadata: {
            compilationSuccess: metrics.compiles,
            complexity: await this.evaluator['calculateComplexity'](result.content),
          },
        });

        console.log(
          `[${this.id}] Iteration ${i}: ${action.type} (quality: ${metrics.quality.toFixed(2)})`
        );

        // Update state
        this.updateState(action);
      } catch (error) {
        console.error(`[${this.id}] Error in iteration ${i}:`, error);
        // Continue to next iteration
      }
    }

    this.agentState = 'idle' as AgentState;
    console.log(`[${this.id}] Completed execution`);
  }

  /**
   * Decide what action to take
   *
   * Probabilistic decision-making:
   * - 60%: Follow strongest pheromone (exploitation)
   * - 25%: Explore similar solutions (local search)
   * - 15%: Random exploration
   */
  private decideAction(pheromones: Pheromone[]): Action {
    const random = Math.random();

    // No pheromones yet? Must explore
    if (pheromones.length === 0) {
      return { type: 'EXPLORE' };
    }

    // 60% - Exploitation: Follow best pheromone
    if (random < this.exploitationRate) {
      return {
        type: 'REFINE',
        target: pheromones[0], // Highest quality
      };
    }

    // 25% - Local search: Follow 2nd-4th best
    if (random < this.exploitationRate + this.localSearchRate && pheromones.length > 1) {
      const localIndex = Math.min(Math.floor(Math.random() * 3) + 1, pheromones.length - 1);
      return {
        type: 'REFINE',
        target: pheromones[localIndex],
      };
    }

    // 15% - Global exploration
    return { type: 'EXPLORE' };
  }

  /**
   * Perform the chosen action
   */
  private async performAction(action: Action): Promise<CodeFragment> {
    if (action.type === 'REFINE' && action.target) {
      return await this.refineCode(action.target.codeFragment);
    } else {
      return await this.exploreNewSolution();
    }
  }

  /**
   * Refine existing code solution
   *
   * Uses Pi's complete() function for unified LLM interface
   */
  private async refineCode(base: CodeFragment): Promise<CodeFragment> {
    const prompt = this.buildRefinePrompt(base);

    // 创建 Context
    const context: Context = {
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    // 使用 pi-ai 的 complete() 函数
    const response = await complete(this.model, context);

    const code = this.extractCode(response.content);

    return {
      filePath: base.filePath,
      content: code,
      intent: base.intent,
    };
  }

  /**
   * Explore new solution from scratch
   */
  private async exploreNewSolution(): Promise<CodeFragment> {
    const prompt = this.buildExplorePrompt();

    const context: Context = {
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    const response = await complete(this.model, context);

    const code = this.extractCode(response.content);

    return {
      filePath: this.task.filePath,
      content: code,
      intent: this.task.description,
    };
  }

  /**
   * Build prompt for refining existing code
   */
  private buildRefinePrompt(base: CodeFragment): string {
    return `Improve the following TypeScript code solution.

Task: ${this.task.description}

Current solution:
\`\`\`typescript
${base.content}
\`\`\`

Instructions:
- Keep the same general approach but improve quality
- Fix any compilation errors
- Simplify if possible
- Ensure it's functionally complete

Return ONLY the improved TypeScript code, no explanations.`;
  }

  /**
   * Build prompt for exploring new solution
   */
  private buildExplorePrompt(): string {
    return `Create a TypeScript solution for the following task.

Task: ${this.task.description}

Original code:
\`\`\`typescript
${this.task.baseCode}
\`\`\`

Instructions:
- Modify the original code to implement the task
- Ensure TypeScript type safety
- Keep it simple and clean
- Make sure it compiles

Return ONLY the complete modified TypeScript code, no explanations.`;
  }

  /**
   * Extract code from LLM response
   *
   * Handles markdown code blocks or plain code
   */
  private extractCode(text: string): string {
    // Try to extract from markdown code block
    const codeBlockMatch = text.match(/```(?:typescript|ts)?\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Fallback: return as-is
    return text.trim();
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

/**
 * EnvironmentAgent - Autonomous agent using tool calling
 *
 * Each iteration = one multi-turn LLM conversation with tool calls.
 * Context is NOT accumulated across iterations (fresh each time).
 *
 * The agent perceives the environment through tools, decides which file
 * to work on, reads dependencies, generates code, and submits solutions.
 * No central coordinator tells it what to do.
 */

import {
  complete,
  type Context,
  type Model,
  type Api,
  type Tool,
  type ToolCall,
  type ToolResultMessage,
  type Message,
} from '@mariozechner/pi-ai';
import type { SwarmEnvironment } from './environment.js';
import type { CompileFunction } from './types.js';
import { createSwarmTools, type SwarmToolHandlers } from './swarm-tools.js';

export interface EnvironmentAgentConfig {
  id: string;
  environment: SwarmEnvironment;
  compileFn: CompileFunction;
  model: Model<Api>;
  maxIterations: number;
}

const SYSTEM_PROMPT = `You are a swarm agent in a decentralized coding system.
You work on ONE file at a time. No one tells you what to do.

Your workflow:
1. Call perceive_environment to see all files, their status, and recommendations
2. Choose the file that needs the most help, using the "recommendation" field:
   - HIGHEST: "empty" files whose dependencies are satisfied AND activeAgentCount is 0
   - HIGH: "blocked" files with interface_mismatch signals you can fix
   - MEDIUM: "attempted" or "partial" files with low activeAgentCount
   - LOW: "solid" files (only if nothing else needs work)
   - SKIP: "excellent" files, or any file with activeAgentCount >= 2
3. If the file depends on other files, call read_file_solution for each dependency
4. Write complete TypeScript code, using imports like: import { Name } from './filename'
5. Call compile_check to verify your code compiles in context
6. If compilation fails, read errors, fix code, compile_check again (up to 3 attempts)
7. Call submit_solution with your final code, declaring all exports and imports

Rules:
- Always perceive the environment first
- Always read dependency solutions before writing code that imports from them
- Check the activeAgentCount field — avoid files where 2+ agents are already working
- Always compile_check before submitting
- Declare ALL exported names (functions, types, interfaces, classes) accurately
- Declare ALL imports with the correct from_file path
- Write complete, working TypeScript code with proper types — not stubs
- Each file must have proper import/export statements`;

export class EnvironmentAgent {
  private id: string;
  private environment: SwarmEnvironment;
  private model: Model<Api>;
  private maxIterations: number;
  private tools: Tool[];
  private handlers: SwarmToolHandlers;
  private shouldStop: boolean = false;
  private iterationsCompleted: number = 0;
  private successfulSubmits: number = 0;

  constructor(config: EnvironmentAgentConfig) {
    this.id = config.id;
    this.environment = config.environment;
    this.model = config.model;
    this.maxIterations = config.maxIterations;

    const { tools, handlers } = createSwarmTools(
      config.environment,
      config.compileFn,
      config.id
    );
    this.tools = tools;
    this.handlers = handlers;
  }

  /**
   * Execute all iterations
   */
  async execute(): Promise<void> {
    console.log(`[${this.id}] Starting execution (max ${this.maxIterations} iterations)`);

    for (let i = 0; i < this.maxIterations; i++) {
      if (this.shouldStop) {
        console.log(`[${this.id}] Stopped at iteration ${i}`);
        break;
      }

      // Check if environment has converged
      if (this.environment.hasConverged()) {
        console.log(`[${this.id}] Environment converged, stopping at iteration ${i}`);
        break;
      }

      try {
        await this.executeIteration(i + 1);
        this.iterationsCompleted = i + 1;
      } catch (error: any) {
        console.error(`[${this.id}] Error in iteration ${i + 1}: ${error.message}`);
      }
    }

    console.log(
      `[${this.id}] Completed (${this.iterationsCompleted} iterations, ` +
      `${this.successfulSubmits} successful submits)`
    );
  }

  /**
   * Execute a single iteration: one fresh multi-turn LLM conversation with tool calls
   */
  private async executeIteration(iterationNum: number): Promise<void> {
    const context: Context = {
      systemPrompt: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Iteration ${iterationNum}/${this.maxIterations}. You are agent "${this.id}". Use your tools to contribute to the project. Start by perceiving the environment.`,
          timestamp: Date.now(),
        } as Message,
      ],
      tools: this.tools,
    };

    let response = await complete(this.model, context);
    context.messages.push(response);

    let toolCallCount = 0;
    const maxToolCalls = 20; // Safety limit per iteration

    while (response.stopReason === 'toolUse' && toolCallCount < maxToolCalls) {
      // Process all tool calls in this response
      for (const item of response.content) {
        if (item.type === 'toolCall') {
          const toolCall = item as ToolCall;
          const result = await this.executeToolCall(toolCall);
          context.messages.push(result);
          toolCallCount++;

          // Track successful submits
          if (toolCall.name === 'submit_solution') {
            try {
              const parsed = JSON.parse(
                (result.content[0] as { type: 'text'; text: string }).text
              );
              if (parsed.compilationSuccess || parsed.quality >= 0.5) {
                this.successfulSubmits++;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Continue the conversation
      response = await complete(this.model, context);
      context.messages.push(response);
    }

    // Log iteration summary
    const textContent = response.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map(c => c.text)
      .join('');

    if (textContent) {
      // Truncate long messages for logging
      const summary = textContent.length > 200
        ? textContent.substring(0, 200) + '...'
        : textContent;
      console.log(`[${this.id}] Iteration ${iterationNum}: ${summary.replace(/\n/g, ' ')}`);
    } else {
      console.log(`[${this.id}] Iteration ${iterationNum}: completed (${toolCallCount} tool calls)`);
    }
  }

  /**
   * Execute a single tool call and return the result message
   */
  private async executeToolCall(toolCall: ToolCall): Promise<ToolResultMessage> {
    const { name, arguments: args, id } = toolCall;
    let resultText: string;
    let isError = false;

    try {
      switch (name) {
        case 'perceive_environment':
          resultText = await this.handlers.perceive_environment(args as any);
          break;
        case 'read_file_solution':
          resultText = await this.handlers.read_file_solution(args as any);
          break;
        case 'submit_solution':
          resultText = await this.handlers.submit_solution(args as any);
          break;
        case 'compile_check':
          resultText = await this.handlers.compile_check(args as any);
          break;
        case 'read_signals':
          resultText = await this.handlers.read_signals(args as any);
          break;
        default:
          resultText = JSON.stringify({ error: `Unknown tool: ${name}` });
          isError = true;
      }
    } catch (error: any) {
      resultText = JSON.stringify({ error: error.message || 'Tool execution failed' });
      isError = true;
    }

    return {
      role: 'toolResult',
      toolCallId: id,
      toolName: name,
      content: [{ type: 'text', text: resultText }],
      isError,
      timestamp: Date.now(),
    };
  }

  /**
   * Signal the agent to stop
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get number of completed iterations
   */
  getIterationsCompleted(): number {
    return this.iterationsCompleted;
  }

  /**
   * Get number of successful solution submits
   */
  getSuccessfulSubmits(): number {
    return this.successfulSubmits;
  }
}

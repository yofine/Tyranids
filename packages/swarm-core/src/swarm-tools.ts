/**
 * Swarm Tools - Tool definitions for environment-based agents
 *
 * Agents interact with the SwarmEnvironment through these tools.
 * Tools are language-agnostic: compile_check delegates to an injected CompileFunction.
 *
 * 7 tools total:
 * - perceive_environment, read_file_solution, submit_solution, compile_check, read_signals
 * - read_trail_markers, leave_trail_marker (stigmergy — indirect agent communication)
 *
 * Uses Pi framework's Tool<TSchema> + TypeBox for type-safe tool definitions.
 */

import { Type, type Tool } from '@mariozechner/pi-ai';
import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import type { SwarmEnvironment } from './environment.js';
import type { CompileFunction, SubmitResult, CompileResult } from './types.js';
import type { SynapticMemory } from './synaptic-memory.js';

/**
 * Wrap a pi-ai Tool + handler into a pi-agent-core AgentTool.
 * The AgentTool includes an `execute()` function so the Agent framework
 * can dispatch tool calls automatically without a manual switch statement.
 */
function toAgentTool(
  tool: Tool,
  label: string,
  handler: (args: any) => Promise<string>,
): AgentTool {
  return {
    ...tool,
    label,
    execute: async (_toolCallId: string, params: any): Promise<AgentToolResult<unknown>> => {
      const text = await handler(params);
      return { content: [{ type: 'text', text }], details: {} };
    },
  };
}

/**
 * Handler functions for executing tool calls.
 * Maps tool name -> async handler function.
 */
export interface SwarmToolHandlers {
  perceive_environment: (args: { focus_file?: string }) => Promise<string>;
  read_file_solution: (args: { file_path: string }) => Promise<string>;
  submit_solution: (args: {
    file_path: string;
    code: string;
    declared_exports: string[];
    declared_imports: { name: string; from_file: string }[];
  }) => Promise<string>;
  compile_check: (args: { file_path: string; code: string }) => Promise<string>;
  read_signals: (args: { file_path?: string }) => Promise<string>;
  read_trail_markers: (args: { file_path: string }) => Promise<string>;
  leave_trail_marker: (args: { file_path: string; recommendation: string }) => Promise<string>;
}

/**
 * Create the swarm tools and their handler functions
 */
export function createSwarmTools(
  env: SwarmEnvironment,
  compileFn: CompileFunction,
  agentId: string,
  memory?: SynapticMemory
): { tools: Tool[]; agentTools: AgentTool[]; handlers: SwarmToolHandlers } {

  // --- Tool definitions ---

  const perceiveEnvironmentTool: Tool = {
    name: 'perceive_environment',
    description: 'Observe the current state of all files in the project. Returns each file\'s status (empty/attempted/partial/solid/excellent/blocked), best quality score, dependencies, and signal count. Use this to decide which file to work on.',
    parameters: Type.Object({
      focus_file: Type.Optional(Type.String({ description: 'If set, only return info about this file' })),
    }),
  };

  const readFileSolutionTool: Tool = {
    name: 'read_file_solution',
    description: 'Read the current best solution for a specific file. Returns the content and its declared exports. Use this to understand what dependencies provide so you can reference them correctly.',
    parameters: Type.Object({
      file_path: Type.String({ description: 'The file path to read the best solution for' }),
    }),
  };

  const submitSolutionTool: Tool = {
    name: 'submit_solution',
    description: 'Submit your solution for a file. You must declare what names your solution exports and what it imports from other files. The system will validate and score your solution. Returns quality score and any errors.',
    parameters: Type.Object({
      file_path: Type.String({ description: 'The file path this solution is for' }),
      code: Type.String({ description: 'The complete content for this file' }),
      declared_exports: Type.Array(Type.String(), { description: 'Names that this file exports (e.g. functions, classes, types, variables)' }),
      declared_imports: Type.Array(
        Type.Object({
          name: Type.String({ description: 'The imported name' }),
          from_file: Type.String({ description: 'The file this name is imported from' }),
        }),
        { description: 'Names imported from other files' }
      ),
    }),
  };

  const compileCheckTool: Tool = {
    name: 'compile_check',
    description: 'Validate your solution in the context of existing solutions for other files. Use this before submitting to catch errors early. Returns success/failure and error messages.',
    parameters: Type.Object({
      file_path: Type.String({ description: 'The file path to check' }),
      code: Type.String({ description: 'The content to validate' }),
    }),
  };

  const readSignalsTool: Tool = {
    name: 'read_signals',
    description: 'Read active signals (interface mismatches, compilation errors, etc.) for a file or all files. Signals indicate problems that need fixing.',
    parameters: Type.Object({
      file_path: Type.Optional(Type.String({ description: 'If set, only return signals for this file' })),
    }),
  };

  const readTrailMarkersTool: Tool = {
    name: 'read_trail_markers',
    description: 'Read trail markers left by other agents on a file. Shows what approaches were tried, what worked/failed, and recommendations. Use this before working on a file to avoid repeating failed approaches. This is stigmergy — indirect communication through the shared environment.',
    parameters: Type.Object({
      file_path: Type.String({ description: 'The file to read trail markers for' }),
    }),
  };

  const leaveTrailMarkerTool: Tool = {
    name: 'leave_trail_marker',
    description: 'Leave a trail marker (recommendation note) on a file for other agents to read. Use this to warn about pitfalls, suggest approaches, or share discoveries. This is stigmergy — communicating by modifying the shared environment.',
    parameters: Type.Object({
      file_path: Type.String({ description: 'The file to leave a marker on' }),
      recommendation: Type.String({ description: 'Your recommendation or observation about this file' }),
    }),
  };

  // --- Handler implementations ---

  const handlers: SwarmToolHandlers = {
    async perceive_environment(args) {
      const perception = env.perceive(args.focus_file);
      return JSON.stringify(perception, null, 2);
    },

    async read_file_solution(args) {
      const best = env.getBestSolution(args.file_path);
      if (!best) {
        return JSON.stringify({ status: 'no_solution', message: `No solution yet for ${args.file_path}` });
      }
      return JSON.stringify({
        filePath: best.filePath,
        code: best.code,
        exports: best.exports,
        quality: best.quality,
        imports: best.imports,
      });
    },

    async submit_solution(args) {
      // Input validation
      if (!args.file_path || typeof args.file_path !== 'string') {
        return JSON.stringify({
          quality: 0, compilationSuccess: false,
          errors: ['Invalid file_path: must be a non-empty string'],
          compatibilityScore: 0,
        });
      }
      if (!args.code || typeof args.code !== 'string' || args.code.trim().length === 0) {
        return JSON.stringify({
          quality: 0, compilationSuccess: false,
          errors: ['Invalid code: must be a non-empty string'],
          compatibilityScore: 0,
        });
      }
      const fileSlot = env.getFileSlot(args.file_path);
      if (!fileSlot) {
        return JSON.stringify({
          quality: 0, compilationSuccess: false,
          errors: [`Unknown file_path: "${args.file_path}". Valid: ${env.getAllFileSlots().map(s => s.filePath).join(', ')}`],
          compatibilityScore: 0,
        });
      }
      if (!Array.isArray(args.declared_exports)) args.declared_exports = [];
      if (!Array.isArray(args.declared_imports)) args.declared_imports = [];

      // Get context files for compilation
      const contextFiles = env.getContextFiles();

      // Run compile check
      let compilationSuccess = false;
      let compilationErrors: string[] = [];
      try {
        const compileResult = await compileFn(args.file_path, args.code, contextFiles);
        compilationSuccess = compileResult.success;
        compilationErrors = compileResult.errors;
      } catch (err: any) {
        compilationErrors = [err.message || 'Compilation check failed'];
      }

      // Multi-factor quality formula (language-agnostic)
      const contentLines = args.code.split('\n').length;

      // Factor 1: Validation pass (0-0.40)
      const validationFactor = compilationSuccess ? 0.40 : 0.0;

      // Factor 2: Content substance (0-0.25)
      const substanceFactor = Math.min(0.25,
        (contentLines > 5 ? 0.05 : 0) +
        (contentLines > 15 ? 0.05 : 0) +
        (contentLines > 30 ? 0.05 : 0) +
        (args.declared_exports.length > 0 ? 0.05 : 0) +
        (args.code.trim().length > 100 ? 0.05 : 0)
      );

      // Factor 3: Compatibility with dependencies (0-0.20)
      let compatibilityScore = 1.0;
      for (const imp of args.declared_imports) {
        const depBest = env.getBestSolution(imp.from_file);
        if (!depBest) {
          compatibilityScore -= 0.3;
          continue;
        }
        if (!depBest.exports.includes(imp.name)) {
          compatibilityScore -= 0.2;
        }
      }
      compatibilityScore = Math.max(0, compatibilityScore);
      const compatFactor = compatibilityScore * 0.20;

      // Factor 4: Completeness (0-0.15) — non-trivial content with declared exports
      const hasNonTrivialContent = contentLines > 10 && args.code.trim().length > 200;
      const hasExports = args.declared_exports.length > 0;
      const completenessFactor = Math.min(0.15,
        (hasNonTrivialContent ? 0.08 : 0) +
        (hasExports ? 0.07 : 0)
      );

      const quality = Math.min(1.0, validationFactor + substanceFactor + compatFactor + completenessFactor);

      // Map snake_case tool args to camelCase types
      const mappedImports = args.declared_imports.map(i => ({
        name: i.name,
        fromFile: i.from_file,
      }));

      // Deposit into environment
      env.depositSolution({
        filePath: args.file_path,
        code: args.code,
        agentId,
        quality,
        exports: args.declared_exports,
        imports: mappedImports,
        compilationSuccess,
        compilationErrors,
        compatibilityScore,
      });

      // Auto-deposit trail marker on submission (stigmergy)
      if (memory) {
        memory.depositTrailMarker(args.file_path, {
          agentId,
          timestamp: Date.now(),
          iteration: 0, // Will be overridden by agent if available
          quality,
          compilationSuccess,
          compilationErrors: compilationErrors.slice(0, 3),
          exports: args.declared_exports,
          recommendation: compilationSuccess
            ? `Compiles OK. Exports: [${args.declared_exports.join(', ')}]`
            : `Compilation failed: ${compilationErrors[0] ?? 'unknown error'}`,
        });

        // Log to quality evolution
        memory.appendQualityEvent(args.file_path, agentId, quality, compilationSuccess);
      }

      const result: SubmitResult = {
        quality,
        compilationSuccess,
        errors: compilationErrors,
        compatibilityScore,
      };

      return JSON.stringify(result, null, 2);
    },

    async compile_check(args) {
      if (!args.file_path || !args.code || args.code.trim().length === 0) {
        return JSON.stringify({
          success: false,
          errors: ['Invalid arguments: file_path and code are required'],
        });
      }
      const contextFiles = env.getContextFiles();

      try {
        const compileResult = await compileFn(args.file_path, args.code, contextFiles);
        const result: CompileResult = {
          success: compileResult.success,
          errors: compileResult.errors,
        };
        return JSON.stringify(result, null, 2);
      } catch (err: any) {
        return JSON.stringify({
          success: false,
          errors: [err.message || 'Compilation check failed'],
        });
      }
    },

    async read_signals(args) {
      const signals = env.getSignals(args.file_path);
      if (signals.length === 0) {
        return JSON.stringify({ signals: [], message: 'No active signals' });
      }
      return JSON.stringify({
        signals: signals.map(s => ({
          type: s.type,
          filePath: s.filePath,
          message: s.message,
          severity: s.severity,
        })),
      }, null, 2);
    },

    async read_trail_markers(args) {
      if (!memory) {
        return JSON.stringify({ markers: [], message: 'Synaptic memory not enabled' });
      }
      const content = await memory.readTrailMarkers(args.file_path);
      if (!content) {
        return JSON.stringify({ markers: [], message: `No trail markers for ${args.file_path}` });
      }
      return content;
    },

    async leave_trail_marker(args) {
      if (!memory) {
        return JSON.stringify({ status: 'skipped', message: 'Synaptic memory not enabled' });
      }
      memory.depositTrailMarker(args.file_path, {
        agentId,
        timestamp: Date.now(),
        iteration: 0,
        quality: 0,
        compilationSuccess: false,
        compilationErrors: [],
        exports: [],
        recommendation: args.recommendation,
      });
      return JSON.stringify({ status: 'ok', message: `Trail marker left on ${args.file_path}` });
    },
  };

  const tools: Tool[] = [
    perceiveEnvironmentTool,
    readFileSolutionTool,
    submitSolutionTool,
    compileCheckTool,
    readSignalsTool,
    readTrailMarkersTool,
    leaveTrailMarkerTool,
  ];

  const agentTools: AgentTool[] = [
    toAgentTool(perceiveEnvironmentTool, 'Perceive Environment', handlers.perceive_environment),
    toAgentTool(readFileSolutionTool, 'Read File Solution', handlers.read_file_solution),
    toAgentTool(submitSolutionTool, 'Submit Solution', handlers.submit_solution),
    toAgentTool(compileCheckTool, 'Compile Check', handlers.compile_check),
    toAgentTool(readSignalsTool, 'Read Signals', handlers.read_signals),
    toAgentTool(readTrailMarkersTool, 'Read Trail Markers', handlers.read_trail_markers),
    toAgentTool(leaveTrailMarkerTool, 'Leave Trail Marker', handlers.leave_trail_marker),
  ];

  return { tools, agentTools, handlers };
}

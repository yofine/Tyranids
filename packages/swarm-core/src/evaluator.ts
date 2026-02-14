/**
 * Code Evaluator - Judges solution quality
 *
 * Evaluates code solutions across multiple dimensions:
 * - Compilation success
 * - Functional completeness
 * - Code simplicity
 */

import type { CodeFragment, EvaluationMetrics, CompileFunction } from './types.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execAsync = promisify(exec);

export class Evaluator {
  private compilationCache = new Map<string, { success: boolean; errors: string[]; quality: number; timestamp: number }>();
  private readonly CACHE_TTL_MS = 30000;

  private getCacheKey(filePath: string, code: string, contextFiles: Map<string, string>): string {
    const contextSummary = Array.from(contextFiles.entries())
      .map(([k, v]) => `${k}:${v.length}`)
      .join(',');
    return `${filePath}|${code.length}|${code.slice(0, 100)}|${code.slice(-100)}|${contextSummary}`;
  }
  /**
   * Evaluate a code solution
   *
   * Returns metrics across multiple dimensions with an overall quality score
   */
  async evaluate(fragment: CodeFragment, task?: string): Promise<EvaluationMetrics> {
    const [compiles, complete, simple] = await Promise.all([
      this.checkCompilation(fragment),
      this.checkCompleteness(fragment, task),
      this.checkSimplicity(fragment),
    ]);

    // Calculate overall quality (weighted average)
    const quality = 0.4 * (compiles ? 1 : 0) + 0.3 * (complete ? 1 : 0) + 0.3 * (simple ? 1 : 0);

    return {
      compiles,
      complete,
      simple,
      quality,
    };
  }

  /**
   * Check if code compiles (TypeScript)
   *
   * Uses tsc --noEmit to check compilation without generating output
   */
  private async checkCompilation(fragment: CodeFragment): Promise<boolean> {
    try {
      const tmpDir = join(tmpdir(), `tyranids-eval-single-${Date.now()}`);
      await mkdir(tmpDir, { recursive: true });
      const tmpFile = join(tmpDir, 'check.ts');
      await writeFile(tmpFile, fragment.content);
      await writeFile(join(tmpDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'commonjs',
          moduleResolution: 'node',
          strict: false,
          skipLibCheck: true,
          noEmit: true,
          esModuleInterop: true,
        },
        include: ['*.ts'],
      }));

      try {
        await execAsync('npx --yes tsc --noEmit', {
          cwd: tmpDir,
          timeout: 15000,
        });
        return true;
      } catch {
        return false;
      } finally {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    } catch {
      return false;
    }
  }

  /**
   * Check if solution is functionally complete
   *
   * For MVP, uses heuristics:
   * - For "add X" tasks: code must include interface/type definition
   * - Code length should be reasonable (not too short)
   */
  private async checkCompleteness(
    fragment: CodeFragment,
    task?: string
  ): Promise<boolean> {
    const content = fragment.content;

    // Basic length check - not too short
    if (content.length < 50) {
      return false;
    }

    // If task mentions "add" or "priority", check for interface/type modifications
    if (task && /add|priority/i.test(task)) {
      // Should have interface or type definition
      const hasInterface = /interface\s+\w+/i.test(content);
      const hasType = /type\s+\w+/i.test(content);

      if (!hasInterface && !hasType) {
        return false;
      }

      // Should mention priority
      if (!/priority/i.test(content)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if code is simple/clean
   *
   * Uses heuristic metrics:
   * - Not too long (< 500 lines)
   * - Low cyclomatic complexity (< 20 control flow keywords)
   */
  private async checkSimplicity(fragment: CodeFragment): Promise<boolean> {
    const content = fragment.content;
    const lines = content.split('\n');

    // Length check
    if (lines.length > 500) {
      return false;
    }

    // Cyclomatic complexity check (simple heuristic)
    const complexity = this.calculateComplexity(content);
    if (complexity > 20) {
      return false;
    }

    return true;
  }

  /**
   * Calculate cyclomatic complexity (simplified)
   *
   * Counts control flow keywords
   */
  private calculateComplexity(code: string): number {
    const controlFlowKeywords = [
      /\bif\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /&&/g,
      /\|\|/g,
      /\?/g, // ternary
    ];

    let complexity = 1; // Base complexity

    for (const pattern of controlFlowKeywords) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Quick quality estimate without compilation (for rapid iteration)
   *
   * Uses only heuristics, much faster than full evaluation
   */
  async quickEstimate(fragment: CodeFragment, task?: string): Promise<number> {
    const [complete, simple] = await Promise.all([
      this.checkCompleteness(fragment, task),
      this.checkSimplicity(fragment),
    ]);

    // Assume compilation likely succeeds if other checks pass
    const likelyCompiles = complete && simple;

    return 0.4 * (likelyCompiles ? 1 : 0) + 0.3 * (complete ? 1 : 0) + 0.3 * (simple ? 1 : 0);
  }

  /**
   * Cross-file compilation check.
   *
   * Writes all context files + target file into a temp directory,
   * runs tsc --noEmit, parses errors, and cleans up.
   */
  async evaluateInContext(
    filePath: string,
    code: string,
    contextFiles: Map<string, string>
  ): Promise<{ compiles: boolean; errors: string[]; quality: number }> {
    // Check cache first
    const cacheKey = this.getCacheKey(filePath, code, contextFiles);
    const cached = this.compilationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return { compiles: cached.success, errors: cached.errors, quality: cached.quality };
    }

    const tmpDir = join(tmpdir(), `tyranids-ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    try {
      await mkdir(tmpDir, { recursive: true });

      // Write all context files
      for (const [ctxPath, ctxCode] of contextFiles) {
        const fullPath = join(tmpDir, ctxPath);
        const dir = join(tmpDir, ctxPath.split('/').slice(0, -1).join('/'));
        if (dir !== tmpDir) {
          await mkdir(dir, { recursive: true });
        }
        await writeFile(fullPath, ctxCode);
      }

      // Write the target file (overwrite if it was in context)
      const targetPath = join(tmpDir, filePath);
      const targetDir = join(tmpDir, filePath.split('/').slice(0, -1).join('/'));
      if (targetDir !== tmpDir) {
        await mkdir(targetDir, { recursive: true });
      }
      await writeFile(targetPath, code);

      // Write a lenient tsconfig that tolerates agent-generated code styles
      const tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'commonjs',
          moduleResolution: 'node',
          strict: false,
          skipLibCheck: true,
          noEmit: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
        include: ['**/*.ts'],
      };
      await writeFile(join(tmpDir, 'tsconfig.json'), JSON.stringify(tsconfig));

      // Run tsc
      try {
        await execAsync('npx tsc --noEmit', {
          cwd: tmpDir,
          timeout: 30000,
        });

        // Compilation succeeded
        const lines = code.split('\n').length;
        const complexity = this.calculateComplexity(code);
        const quality = Math.min(1.0, 0.5 + (lines > 10 ? 0.2 : 0) + (complexity < 15 ? 0.2 : 0) + 0.1);

        const result = { compiles: true, errors: [] as string[], quality };
        this.compilationCache.set(cacheKey, { success: true, errors: [], quality, timestamp: Date.now() });
        return result;
      } catch (error: any) {
        // Parse tsc errors
        const stderr = error.stderr || error.stdout || '';
        const errorLines = stderr
          .split('\n')
          .filter((line: string) => line.includes('error TS'))
          .map((line: string) => line.trim());

        const errors = errorLines.length > 0 ? errorLines : ['Compilation failed'];
        this.compilationCache.set(cacheKey, { success: false, errors, quality: 0.2, timestamp: Date.now() });
        return { compiles: false, errors, quality: 0.2 };
      }
    } catch (error) {
      return { compiles: false, errors: ['Failed to set up compilation context'], quality: 0 };
    } finally {
      // Cleanup
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Create a TypeScript compile function (default CompileFunction implementation).
 *
 * Uses evaluateInContext under the hood to compile a file in the context of
 * other files from the environment.
 */
export function createTypeScriptCompileFn(): CompileFunction {
  const evaluator = new Evaluator();

  return async (
    filePath: string,
    code: string,
    contextFiles: Map<string, string>
  ) => {
    const result = await evaluator.evaluateInContext(filePath, code, contextFiles);
    return { success: result.compiles, errors: result.errors };
  };
}

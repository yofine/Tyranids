/**
 * Code Evaluator - Judges solution quality
 *
 * Evaluates code solutions across multiple dimensions:
 * - Compilation success
 * - Functional completeness
 * - Code simplicity
 */

import type { CodeFragment, EvaluationMetrics } from './types.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execAsync = promisify(exec);

export class Evaluator {
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
      // Write to temporary file
      const tmpFile = join(tmpdir(), `tyranids-eval-${Date.now()}.ts`);
      await writeFile(tmpFile, fragment.content);

      try {
        // Run TypeScript compiler check
        await execAsync(`npx tsc --noEmit ${tmpFile}`, {
          timeout: 10000, // 10 second timeout
        });

        return true;
      } catch (error) {
        // Compilation failed
        return false;
      } finally {
        // Cleanup
        await unlink(tmpFile).catch(() => {
          /* ignore cleanup errors */
        });
      }
    } catch (error) {
      console.error('Compilation check error:', error);
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
}

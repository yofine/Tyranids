import { tokenize } from './tokenizer';
import { parse } from './parser';
import { evaluate } from './evaluator';

function calc(expr: string): number {
  return evaluate(parse(tokenize(expr)));
}

const tests: [string, number][] = [
  ['2 + 3', 5],
  ['10 - 4', 6],
  ['3 * 7', 21],
  ['20 / 4', 5],
  ['2 + 3 * 4', 14],        // operator precedence
  ['(2 + 3) * 4', 20],      // parentheses
  ['10 / (5 - 3)', 5],      // parentheses with subtraction
];

let passed = 0;
let failed = 0;

for (const [expr, expected] of tests) {
  try {
    const result = calc(expr);
    if (Math.abs(result - expected) < 1e-9) {
      console.log(`  PASS: ${expr} = ${result}`);
      passed++;
    } else {
      console.log(`  FAIL: ${expr} = ${result} (expected ${expected})`);
      failed++;
    }
  } catch (err: any) {
    console.log(`  ERROR: ${expr} threw: ${err.message}`);
    failed++;
  }
}

console.log(`\nResults: ${passed}/${passed + failed} passed`);
process.exit(failed > 0 ? 1 : 0);

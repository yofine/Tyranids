import { Tokenizer } from './tokenizer';
import { Parser } from './parser';
import { Evaluator } from './evaluator';

function calculate(expression: string): number {
  const tokenizer = new Tokenizer(expression);
  const parser = new Parser(tokenizer);
  const ast = parser.parse();
  const evaluator = new Evaluator();
  return evaluator.evaluate(ast);
}

const tests = [
  { expr: '1 + 2', expected: 3 },
  { expr: '2 * 3 + 4', expected: 10 },
  { expr: '(1 + 2) * 3', expected: 9 },
  { expr: '10 / 2 - 3', expected: 2 },
  { expr: '3 + 5 * (2 - 8)', expected: -27 },
  { expr: '(2 + 3) * (4 - 1)', expected: 15 },
  { expr: '100 / 10 / 2', expected: 5 },
];

let passed = 0;
let failed = 0;

for (const { expr, expected } of tests) {
  try {
    const result = calculate(expr);
    if (result === expected) {
      console.log(`  ✅ "${expr}" = ${result}`);
      passed++;
    } else {
      console.log(`  ❌ "${expr}" = ${result} (expected ${expected})`);
      failed++;
    }
  } catch (e: any) {
    console.log(`  ❌ "${expr}" threw: ${e.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

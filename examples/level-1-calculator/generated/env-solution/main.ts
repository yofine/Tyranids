import { tokenize } from './tokenizer';
import { parse } from './parser';
import { evaluate } from './evaluator';

/**
 * Main CLI entry point for the expression evaluator
 */
function main() {
  // Read input from command line arguments or stdin
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Read from stdin if no arguments provided
    let input = '';
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    
    process.stdin.on('end', () => {
      try {
        const result = evaluateExpression(input.trim());
        console.log(result);
      } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
      }
    });
  } else {
    // Use command line argument
    try {
      const result = evaluateExpression(args.join(' '));
      console.log(result);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  }
}

/**
 * Evaluate a mathematical expression string
 * @param input - The expression string to evaluate
 * @returns The numeric result
 */
function evaluateExpression(input: string): number {
  const tokens = tokenize(input);
  const ast = parse(tokens);
  return evaluate(ast);
}

// Run main if this is the main module
main();

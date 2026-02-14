/**
 * Main CLI entry point for the arithmetic expression evaluator
 * Imports: tokenize from tokenizer.ts, parse from parser.ts, evaluate from evaluator.ts
 * Reads input, runs the pipeline, prints the result
 */

import { tokenize } from './tokenizer';
import { parse } from './parser';
import { evaluate } from './evaluator';

/**
 * Main function - reads expression from stdin, evaluates, prints result
 */
async function main(): Promise<void> {
  // Read all input from stdin
  const input: string = await new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
  });

  if (!input) {
    console.log('Usage: Enter an arithmetic expression to evaluate');
    console.log('Example: 2 + 3 * 4');
    return;
  }

  try {
    // Run the pipeline: tokenize -> parse -> evaluate
    const tokens = tokenize(input);
    const ast = parse(tokens);
    const result = evaluate(ast);
    
    // Print the result
    console.log(result.toString());
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

// Run main function
main();

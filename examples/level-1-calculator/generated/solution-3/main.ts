import * as readline from 'readline';
import { tokenize } from './tokenizer';
import { Parser } from './parser';
import { evaluate } from './evaluator';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('Command-line Calculator');
console.log('Supported operations: +, -, *, / with parentheses');
console.log('Type your expression and press Enter. Type "exit" to quit.\n');

function prompt() {
  rl.question('> ', (input) => {
    if (input.toLowerCase() === 'exit') {
      console.log('Goodbye!');
      rl.close();
      return;
    }

    try {
      const tokens = tokenize(input);
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const result = evaluate(ast);
      console.log(`Result: ${result}\n`);
    } catch (error) {
      console.log(`Error: ${(error as Error).message}\n`);
    }

    prompt();
  });
}

prompt();
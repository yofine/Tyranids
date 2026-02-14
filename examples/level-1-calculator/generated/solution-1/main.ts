import * as readline from 'readline';
import { Tokenizer } from './tokenizer';
import { Parser } from './parser';
import { Evaluator } from './evaluator';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Command-line Calculator (supports +, -, *, /, and parentheses)');
console.log('Type "exit" to quit\n');

const askQuestion = async (): Promise<void> => {
  const input: string = await new Promise((resolve) => {
    rl.question('Enter expression: ', resolve);
  });

  if (input.toLowerCase() === 'exit') {
    console.log('Goodbye!');
    rl.close();
    return;
  }

  try {
    const tokenizer = new Tokenizer(input);
    const parser = new Parser(tokenizer);
    const ast = parser.parse();
    const evaluator = new Evaluator();
    const result = evaluator.evaluate(ast);

    console.log(`Result: ${result}\n`);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  await askQuestion();
};

askQuestion().catch((error) => {
  console.error('Unexpected error:', error);
  rl.close();
});
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

function main(): void {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: ts-node main.ts "<expression>"');
        console.log('Supported operations: +, -, *, /');
        console.log('Use parentheses for grouping, e.g., "(2+3)*4"');
        process.exit(1);
    }

    const expression = args.join(' ');

    try {
        const result = calculate(expression);
        console.log(`Result: ${result}`);
    } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
    }
}

main();
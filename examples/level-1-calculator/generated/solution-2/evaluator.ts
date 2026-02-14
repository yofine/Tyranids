import { ASTNode } from './parser';

export class Evaluator {
    public evaluate(node: ASTNode): number {
        switch (node.type) {
            case 'Number':
                return node.value || 0;

            case 'BinaryOperation':
                const left = this.evaluate(node.left!);
                const right = this.evaluate(node.right!);
                const opValue = node.value || 0;

                switch (opValue) {
                    case 1: // Addition
                        return left + right;
                    case 2: // Multiplication
                        return left * right;
                    case 3: // Division
                        if (right === 0) {
                            throw new Error('Division by zero');
                        }
                        return left / right;
                    case 4: // Subtraction
                        return left - right;
                    default:
                        throw new Error(`Unknown operator: ${opValue}`);
                }

            case 'UnaryMinus':
                return -this.evaluate(node.left!);

            default:
                throw new Error(`Unknown node type: ${node.type}`);
        }
    }
}
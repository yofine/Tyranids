import { ASTNode } from './parser';

export class Evaluator {
  evaluate(node: ASTNode): number {
    if (node.type === 'NUMBER') {
      if (typeof node.value !== 'number') {
        throw new Error('Invalid number node');
      }
      return node.value;
    }

    if (node.type === 'BINARY_OP') {
      if (!node.operator || !node.left || !node.right) {
        throw new Error('Invalid binary operation node');
      }

      const leftValue = this.evaluate(node.left);
      const rightValue = this.evaluate(node.right);

      switch (node.operator) {
        case '+':
          return leftValue + rightValue;
        case '-':
          return leftValue - rightValue;
        case '*':
          return leftValue * rightValue;
        case '/':
          if (rightValue === 0) {
            throw new Error('Division by zero');
          }
          return leftValue / rightValue;
        default:
          throw new Error(`Unknown operator: ${node.operator}`);
      }
    }

    throw new Error('Invalid AST node');
  }
}
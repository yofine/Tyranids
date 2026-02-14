import { ASTNode } from './parser';

export function evaluate(node: ASTNode): number {
  switch (node.type) {
    case 'Number':
      return node.value;
    case 'BinaryOperator':
      const left = evaluate(node.left);
      const right = evaluate(node.right);
      switch (node.operator) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          if (right === 0) {
            throw new Error('Division by zero');
          }
          return left / right;
        default:
          throw new Error(`Unknown operator: ${node.operator}`);
      }
    default:
      throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
  }
}
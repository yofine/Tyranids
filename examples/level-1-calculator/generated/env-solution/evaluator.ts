import { ASTNode } from './parser';
import { TokenType } from './tokenizer';

/**
 * Evaluate an AST node and return its numerical value
 */
export function evaluate(node: ASTNode): number {
  if (node.type === 'NUMBER') {
    return node.value;
  }
  
  if (node.type === 'BINARY') {
    const left = evaluate(node.left);
    const right = evaluate(node.right);
    
    switch (node.operator) {
      case 'PLUS':
        return left + right;
      case 'MINUS':
        return left - right;
      case 'MULTIPLY':
        return left * right;
      case 'DIVIDE':
        if (right === 0) {
          throw new Error('Division by zero');
        }
        return left / right;
      default:
        throw new Error(`Unknown operator: ${node.operator}`);
    }
  }
  
  throw new Error(`Unknown node type: ${node.type}`);
}

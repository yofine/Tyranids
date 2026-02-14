import { ASTNode } from './parser';

export function evaluate(node: ASTNode): number {
  if (node.type === 'NumberLiteral') {
    return node.value!;
  }

  if (node.type === 'UnaryExpression') {
    const operand = evaluate(node.operand!);
    if (node.operator === '-') {
      return -operand;
    }
    return operand;
  }

  if (node.type === 'BinaryExpression') {
    const left = evaluate(node.left!);
    const right = evaluate(node.right!);

    if (node.operator === '+') return left + right;
    if (node.operator === '-') return left - right;
    if (node.operator === '*') return left * right;
    if (node.operator === '/') {
      if (right === 0) throw new Error('Division by zero');
      return left / right;
    }

    throw new Error('Unknown operator: ' + node.operator);
  }

  throw new Error('Unknown node type: ' + node.type);
}
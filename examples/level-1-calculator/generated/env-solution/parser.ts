import { Token, TokenType } from './tokenizer';

export interface ASTNode {
  type: 'NumberLiteral' | 'BinaryExpression' | 'UnaryExpression';
  value?: number;
  operator?: string;
  left?: ASTNode;
  right?: ASTNode;
  operand?: ASTNode;
}

export function parse(tokens: Token[]): ASTNode {
  let pos = 0;

  function peek(): Token {
    return tokens[pos];
  }

  function consume(): Token {
    const token = tokens[pos];
    pos++;
    return token;
  }

  function expect(type: TokenType): Token {
    const token = peek();
    if (token.type !== type) {
      throw new Error('Expected ' + type + ' but got ' + token.type);
    }
    return consume();
  }

  function parseExpression(): ASTNode {
    return parseAddition();
  }

  function parseAddition(): ASTNode {
    let left = parseMultiplication();

    while (peek().type === 'PLUS' || peek().type === 'MINUS') {
      const op = consume();
      const right = parseMultiplication();
      left = {
        type: 'BinaryExpression',
        operator: op.value,
        left: left,
        right: right
      };
    }

    return left;
  }

  function parseMultiplication(): ASTNode {
    let left = parseUnary();

    while (peek().type === 'MULTIPLY' || peek().type === 'DIVIDE') {
      const op = consume();
      const right = parseUnary();
      left = {
        type: 'BinaryExpression',
        operator: op.value,
        left: left,
        right: right
      };
    }

    return left;
  }

  function parseUnary(): ASTNode {
    if (peek().type === 'MINUS') {
      consume();
      const operand = parseUnary();
      return {
        type: 'UnaryExpression',
        operator: '-',
        operand: operand
      };
    }
    if (peek().type === 'PLUS') {
      consume();
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): ASTNode {
    const token = peek();

    if (token.type === 'NUMBER') {
      consume();
      return {
        type: 'NumberLiteral',
        value: parseFloat(token.value)
      };
    }

    if (token.type === 'LPAREN') {
      consume();
      const expr = parseExpression();
      expect('RPAREN');
      return expr;
    }

    throw new Error('Unexpected token: ' + token.type);
  }

  const ast = parseExpression();
  return ast;
}
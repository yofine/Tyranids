import { Token, TokenType } from './tokenizer';

export type ASTNode =
  | { type: 'Number'; value: number }
  | { type: 'BinaryOperator'; operator: '+' | '-' | '*' | '/'; left: ASTNode; right: ASTNode };

export class Parser {
  private tokens: Token[];
  private index: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | null {
    if (this.index < this.tokens.length) {
      return this.tokens[this.index];
    }
    return null;
  }

  private consume(): Token {
    return this.tokens[this.index++];
  }

  parse(): ASTNode {
    return this.parseExpression();
  }

  private parseExpression(): ASTNode {
    let left = this.parseTerm();

    while (true) {
      const token = this.peek();
      if (token && (token.type === TokenType.Plus || token.type === TokenType.Minus)) {
        const operator = token.type === TokenType.Plus ? '+' : '-';
        this.consume();
        const right = this.parseTerm();
        left = { type: 'BinaryOperator', operator, left, right };
      } else {
        break;
      }
    }

    return left;
  }

  private parseTerm(): ASTNode {
    let left = this.parseFactor();

    while (true) {
      const token = this.peek();
      if (token && (token.type === TokenType.Multiply || token.type === TokenType.Divide)) {
        const operator = token.type === TokenType.Multiply ? '*' : '/';
        this.consume();
        const right = this.parseFactor();
        left = { type: 'BinaryOperator', operator, left, right };
      } else {
        break;
      }
    }

    return left;
  }

  private parseFactor(): ASTNode {
    const token = this.peek();

    if (!token) {
      throw new Error('Unexpected end of input');
    }

    if (token.type === TokenType.Number) {
      this.consume();
      return { type: 'Number', value: parseFloat(token.value!) };
    }

    if (token.type === TokenType.LeftParen) {
      this.consume();
      const expression = this.parseExpression();
      const nextToken = this.peek();
      if (!nextToken || nextToken.type !== TokenType.RightParen) {
        throw new Error('Missing closing parenthesis');
      }
      this.consume();
      return expression;
    }

    throw new Error(`Unexpected token: ${token}`);
  }
}
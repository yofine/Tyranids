import { Token, Tokenizer } from './tokenizer';

export interface ASTNode {
  type: 'NUMBER' | 'BINARY_OP';
  value?: number;
  operator?: string;
  left?: ASTNode;
  right?: ASTNode;
}

export class Parser {
  private tokens: Token[];
  private currentTokenIndex: number = 0;

  constructor(tokenizer: Tokenizer) {
    this.tokens = tokenizer.tokenize();
  }

  parse(): ASTNode {
    return this.parseExpression();
  }

  private parseExpression(): ASTNode {
    let left = this.parseTerm();

    while (this.currentTokenIndex < this.tokens.length) {
      const token = this.tokens[this.currentTokenIndex];

      if (token.type === 'PLUS' || token.type === 'MINUS') {
        const operator = token.value;
        this.currentTokenIndex++;
        const right = this.parseTerm();
        left = {
          type: 'BINARY_OP',
          operator,
          left,
          right
        };
      } else {
        break;
      }
    }

    return left;
  }

  private parseTerm(): ASTNode {
    let left = this.parseFactor();

    while (this.currentTokenIndex < this.tokens.length) {
      const token = this.tokens[this.currentTokenIndex];

      if (token.type === 'MULTIPLY' || token.type === 'DIVIDE') {
        const operator = token.value;
        this.currentTokenIndex++;
        const right = this.parseFactor();
        left = {
          type: 'BINARY_OP',
          operator,
          left,
          right
        };
      } else {
        break;
      }
    }

    return left;
  }

  private parseFactor(): ASTNode {
    const token = this.tokens[this.currentTokenIndex];

    if (token.type === 'NUMBER') {
      this.currentTokenIndex++;
      const numValue = parseFloat(token.value);
      if (isNaN(numValue)) {
        throw new Error(`Invalid number: ${token.value}`);
      }
      return {
        type: 'NUMBER',
        value: numValue
      };
    } else if (token.type === 'LPAREN') {
      this.currentTokenIndex++;
      const expression = this.parseExpression();
      
      if (this.currentTokenIndex >= this.tokens.length || 
          this.tokens[this.currentTokenIndex].type !== 'RPAREN') {
        throw new Error('Missing closing parenthesis');
      }
      
      this.currentTokenIndex++;
      return expression;
    } else if (token.type === 'MINUS') {
      // Handle unary minus
      this.currentTokenIndex++;
      const operand = this.parseFactor();
      return {
        type: 'BINARY_OP',
        operator: '-',
        left: { type: 'NUMBER', value: 0 },
        right: operand
      };
    } else {
      throw new Error(`Unexpected token: ${token.type}`);
    }
  }
}
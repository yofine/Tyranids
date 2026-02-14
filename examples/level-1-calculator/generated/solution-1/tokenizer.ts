export type TokenType = 'NUMBER' | 'PLUS' | 'MINUS' | 'MULTIPLY' | 'DIVIDE' | 'LPAREN' | 'RPAREN' | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
}

export class Tokenizer {
  private input: string;
  private position: number = 0;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    this.tokens = [];
    this.position = 0;

    while (this.position < this.input.length) {
      const char = this.input[this.position];

      if (/\s/.test(char)) {
        this.position++;
        continue;
      }

      if (/[0-9.]/.test(char)) {
        this.tokenizeNumber();
      } else if (char === '+') {
        this.tokens.push({ type: 'PLUS', value: char });
        this.position++;
      } else if (char === '-') {
        this.tokens.push({ type: 'MINUS', value: char });
        this.position++;
      } else if (char === '*') {
        this.tokens.push({ type: 'MULTIPLY', value: char });
        this.position++;
      } else if (char === '/') {
        this.tokens.push({ type: 'DIVIDE', value: char });
        this.position++;
      } else if (char === '(') {
        this.tokens.push({ type: 'LPAREN', value: char });
        this.position++;
      } else if (char === ')') {
        this.tokens.push({ type: 'RPAREN', value: char });
        this.position++;
      } else {
        throw new Error(`Unexpected character: ${char}`);
      }
    }

    this.tokens.push({ type: 'EOF', value: '' });
    return this.tokens;
  }

  private tokenizeNumber(): void {
    let hasDot = false;
    let number = '';

    while (this.position < this.input.length) {
      const char = this.input[this.position];

      if (/[0-9]/.test(char)) {
        number += char;
        this.position++;
      } else if (char === '.') {
        if (hasDot) {
          throw new Error('Invalid number: multiple decimal points');
        }
        hasDot = true;
        number += char;
        this.position++;
      } else {
        break;
      }
    }

    if (number === '') {
      throw new Error('Invalid number');
    }

    this.tokens.push({ type: 'NUMBER', value: number });
  }
}
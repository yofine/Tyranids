export enum TokenType {
    Number,
    Plus,
    Minus,
    Multiply,
    Divide,
    LeftParen,
    RightParen,
    End,
}

export interface Token {
    type: TokenType;
    value: string;
}

export class Tokenizer {
    private input: string;
    private position: number;

    constructor(input: string) {
        this.input = input;
        this.position = 0;
    }

    private isDigit(char: string): boolean {
        return char >= '0' && char <= '9';
    }

    private isWhitespace(char: string): boolean {
        return char === ' ' || char === '\t' || char === '\n';
    }

    private peek(): string {
        return this.input[this.position] || '';
    }

    private consume(): string {
        return this.input[this.position++];
    }

    public tokenize(): Token[] {
        const tokens: Token[] = [];

        while (this.position < this.input.length) {
            const char = this.peek();

            if (this.isWhitespace(char)) {
                this.consume();
                continue;
            }

            if (this.isDigit(char) || char === '.') {
                let value = '';
                let hasDecimal = char === '.';

                while (this.position < this.input.length) {
                    const current = this.peek();
                    if (this.isDigit(current)) {
                        value += this.consume();
                    } else if (current === '.' && !hasDecimal) {
                        hasDecimal = true;
                        value += this.consume();
                    } else {
                        break;
                    }
                }

                tokens.push({ type: TokenType.Number, value });
            } else {
                this.consume();

                switch (char) {
                    case '+':
                        tokens.push({ type: TokenType.Plus, value: '+' });
                        break;
                    case '-':
                        tokens.push({ type: TokenType.Minus, value: '-' });
                        break;
                    case '*':
                        tokens.push({ type: TokenType.Multiply, value: '*' });
                        break;
                    case '/':
                        tokens.push({ type: TokenType.Divide, value: '/' });
                        break;
                    case '(':
                        tokens.push({ type: TokenType.LeftParen, value: '(' });
                        break;
                    case ')':
                        tokens.push({ type: TokenType.RightParen, value: ')' });
                        break;
                }
            }
        }

        tokens.push({ type: TokenType.End, value: '' });
        return tokens;
    }
}
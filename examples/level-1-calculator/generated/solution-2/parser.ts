import { Token, TokenType, Tokenizer } from './tokenizer';

export interface ASTNode {
    type: string;
    value?: number;
    left?: ASTNode;
    right?: ASTNode;
}

export class Parser {
    private tokens: Token[];
    private currentIndex: number;

    constructor(tokenizer: Tokenizer) {
        this.tokens = tokenizer.tokenize();
        this.currentIndex = 0;
    }

    private currentToken(): Token {
        return this.tokens[this.currentIndex];
    }

    private advance(): void {
        this.currentIndex++;
    }

    private match(type: TokenType): boolean {
        return this.currentToken().type === type;
    }

    public parse(): ASTNode {
        const result = this.parseExpression();
        if (!this.match(TokenType.End)) {
            throw new Error('Unexpected tokens after complete expression');
        }
        return result;
    }

    private parseExpression(): ASTNode {
        return this.parseAddSub();
    }

    private parseAddSub(): ASTNode {
        let left = this.parseMulDiv();

        while (this.match(TokenType.Plus) || this.match(TokenType.Minus)) {
            const operator = this.currentToken().value;
            this.advance();
            const right = this.parseMulDiv();
            left = {
                type: 'BinaryOperation',
                value: operator === '+' ? 1 : -1,
                left,
                right,
            };
        }

        return left;
    }

    private parseMulDiv(): ASTNode {
        let left = this.parsePrimary();

        while (this.match(TokenType.Multiply) || this.match(TokenType.Divide)) {
            const operator = this.currentToken().value;
            this.advance();
            const right = this.parsePrimary();
            left = {
                type: 'BinaryOperation',
                value: operator === '*' ? 2 : 3,
                left,
                right,
            };
        }

        return left;
    }

    private parsePrimary(): ASTNode {
        if (this.match(TokenType.Number)) {
            const token = this.currentToken();
            this.advance();
            return {
                type: 'Number',
                value: parseFloat(token.value),
            };
        }

        if (this.match(TokenType.LeftParen)) {
            this.advance();
            const expression = this.parseExpression();
            if (!this.match(TokenType.RightParen)) {
                throw new Error('Missing closing parenthesis');
            }
            this.advance();
            return expression;
        }

        if (this.match(TokenType.Minus)) {
            this.advance();
            const operand = this.parsePrimary();
            return {
                type: 'UnaryMinus',
                left: operand,
            };
        }

        throw new Error(`Unexpected token: ${this.currentToken().value}`);
    }
}
// Token type definitions for the calculator
export type TokenType = 
  | 'NUMBER'
  | 'PLUS'
  | 'MINUS'
  | 'MULTIPLY'
  | 'DIVIDE'
  | 'LPAREN'
  | 'RPAREN'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// Tokenize a string into an array of tokens
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;

  while (position < input.length) {
    // Skip whitespace
    if (/\s/.test(input[position])) {
      position++;
      continue;
    }

    // Match numbers (including decimals)
    const numberMatch = input.slice(position).match(/^\d+(\.\d+)?/);
    if (numberMatch) {
      tokens.push({
        type: 'NUMBER',
        value: numberMatch[0],
        position
      });
      position += numberMatch[0].length;
      continue;
    }

    // Match operators and parentheses
    const char = input[position];
    switch (char) {
      case '+':
        tokens.push({ type: 'PLUS', value: char, position });
        break;
      case '-':
        tokens.push({ type: 'MINUS', value: char, position });
        break;
      case '*':
        tokens.push({ type: 'MULTIPLY', value: char, position });
        break;
      case '/':
        tokens.push({ type: 'DIVIDE', value: char, position });
        break;
      case '(':
        tokens.push({ type: 'LPAREN', value: char, position });
        break;
      case ')':
        tokens.push({ type: 'RPAREN', value: char, position });
        break;
      default:
        throw new Error(`Unexpected character: ${char} at position ${position}`);
    }
    position++;
  }

  // Add EOF token
  tokens.push({ type: 'EOF', value: '', position });

  return tokens;
}

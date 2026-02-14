export enum TokenType {
  Number,
  Plus,
  Minus,
  Multiply,
  Divide,
  LeftParen,
  RightParen,
}

export interface Token {
  type: TokenType;
  value?: string;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (/\d/.test(char) || char === '.') {
      let num = '';
      while (i < input.length && (/\d/.test(input[i]) || input[i] === '.')) {
        num += input[i];
        i++;
      }
      tokens.push({ type: TokenType.Number, value: num });
      continue;
    }

    switch (char) {
      case '+':
        tokens.push({ type: TokenType.Plus });
        break;
      case '-':
        tokens.push({ type: TokenType.Minus });
        break;
      case '*':
        tokens.push({ type: TokenType.Multiply });
        break;
      case '/':
        tokens.push({ type: TokenType.Divide });
        break;
      case '(':
        tokens.push({ type: TokenType.LeftParen });
        break;
      case ')':
        tokens.push({ type: TokenType.RightParen });
        break;
      default:
        throw new Error(`Unknown character: ${char}`);
    }
    i++;
  }

  return tokens;
}
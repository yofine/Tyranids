export type TokenType = 'NUMBER' | 'PLUS' | 'MINUS' | 'MULTIPLY' | 'DIVIDE' | 'LPAREN' | 'RPAREN' | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < input.length && /[0-9.]/.test(input[i])) {
        num += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    switch (ch) {
      case '+': tokens.push({ type: 'PLUS', value: '+' }); break;
      case '-': tokens.push({ type: 'MINUS', value: '-' }); break;
      case '*': tokens.push({ type: 'MULTIPLY', value: '*' }); break;
      case '/': tokens.push({ type: 'DIVIDE', value: '/' }); break;
      case '(': tokens.push({ type: 'LPAREN', value: '(' }); break;
      case ')': tokens.push({ type: 'RPAREN', value: ')' }); break;
      default:
        throw new Error('Unexpected character: ' + ch);
    }
    i++;
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}
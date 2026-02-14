import { Token, TokenType } from './tokenizer';

/**
 * AST Node types for arithmetic expressions
 */
export type ASTNode = 
  | { type: 'NUMBER'; value: number }
  | { type: 'BINARY'; operator: TokenType; left: ASTNode; right: ASTNode };

/**
 * Parser for arithmetic expressions
 * Implements a recursive descent parser with operator precedence
 */
export function parse(tokens: Token[]): ASTNode {
  let pos = 0;
  
  /**
   * Get current token or EOF
   */
  function current(): Token {
    return pos < tokens.length ? tokens[pos] : { type: 'EOF', value: '', position: 0 };
  }
  
  /**
   * Consume a token if it matches the expected type
   */
  function consume(expectedType: TokenType): boolean {
    if (current().type === expectedType) {
      pos++;
      return true;
    }
    return false;
  }
  
  /**
   * Parse a number literal
   */
  function parseNumber(): ASTNode {
    const token = current();
    if (token.type === 'NUMBER') {
      pos++;
      return { type: 'NUMBER', value: parseFloat(token.value) };
    }
    throw new Error(`Expected number, got ${token.type}`);
  }
  
  /**
   * Parse parenthesized expression
   */
  function parseParenthesized(): ASTNode {
    if (consume('LPAREN')) {
      const expr = parseExpression();
      if (!consume('RPAREN')) {
        throw new Error('Expected closing parenthesis');
      }
      return expr;
    }
    return parseNumber();
  }
  
  /**
   * Parse factor (handles unary minus and parenthesized expressions)
   */
  function parseFactor(): ASTNode {
    if (consume('MINUS')) {
      const operand = parseFactor();
      return { type: 'BINARY', operator: 'MINUS', left: { type: 'NUMBER', value: 0 }, right: operand };
    }
    return parseParenthesized();
  }
  
  /**
   * Parse term (handles multiplication and division)
   */
  function parseTerm(): ASTNode {
    let left = parseFactor();
    
    while (current().type === 'MULTIPLY' || current().type === 'DIVIDE') {
      const operator = current().type;
      pos++;
      const right = parseFactor();
      left = { type: 'BINARY', operator, left, right };
    }
    
    return left;
  }
  
  /**
   * Parse expression (handles addition and subtraction)
   */
  function parseExpression(): ASTNode {
    let left = parseTerm();
    
    while (current().type === 'PLUS' || current().type === 'MINUS') {
      const operator = current().type;
      pos++;
      const right = parseTerm();
      left = { type: 'BINARY', operator, left, right };
    }
    
    return left;
  }
  
  // Parse the expression
  const result = parseExpression();
  
  // Ensure we consumed all tokens
  if (current().type !== 'EOF') {
    throw new Error(`Unexpected token: ${current().type}`);
  }
  
  return result;
}

# Level 1: Simple Calculator

**目标**: 实现一个支持基本四则运算的命令行计算器

## 预期文件结构

```
calculator/
├── tokenizer.ts     # 词法分析器 (50 lines)
├── parser.ts        # 语法分析器 (80 lines)
├── evaluator.ts     # 表达式求值器 (40 lines)
└── main.ts          # 命令行入口 (30 lines)
```

## 功能需求

1. **Tokenizer (tokenizer.ts)**
   - 输入: 字符串表达式 "1 + 2 * 3"
   - 输出: Token 数组 `[{type: 'NUMBER', value: '1'}, {type: 'PLUS'}, ...]`
   - 支持: 数字, +, -, *, /, (, )

2. **Parser (parser.ts)**
   - 输入: Token 数组
   - 输出: 抽象语法树 (AST)
   - 正确处理运算符优先级

3. **Evaluator (evaluator.ts)**
   - 输入: AST
   - 输出: 计算结果 (number)

4. **Main (main.ts)**
   - 读取用户输入
   - 调用 tokenizer → parser → evaluator
   - 输出结果

## 接口约定

```typescript
// tokenizer.ts
export type TokenType = 'NUMBER' | 'PLUS' | 'MINUS' | 'MULTIPLY' | 'DIVIDE' | 'LPAREN' | 'RPAREN';
export interface Token {
  type: TokenType;
  value?: string;
}
export function tokenize(input: string): Token[];

// parser.ts
export interface ASTNode {
  type: 'NUMBER' | 'BINARY_OP';
  value?: number;
  operator?: '+' | '-' | '*' | '/';
  left?: ASTNode;
  right?: ASTNode;
}
export function parse(tokens: Token[]): ASTNode;

// evaluator.ts
export function evaluate(ast: ASTNode): number;

// main.ts
export function calculate(expression: string): number;
```

## 测试用例

```typescript
calculate("1 + 2")           // 3
calculate("2 * 3 + 4")       // 10
calculate("(1 + 2) * 3")     // 9
calculate("10 / 2 - 3")      // 2
```

## Swarm 验证标准

1. **编译成功**: 所有文件 TypeScript 编译通过
2. **接口一致性**: 各文件导出符合约定的接口
3. **功能完整**: 测试用例全部通过
4. **跨文件协调**: parser 正确导入 tokenizer 的类型

## 运行测试

```bash
cd examples/level-1-calculator
npm run test-swarm
```

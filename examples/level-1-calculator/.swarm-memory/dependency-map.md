# Dependency Map
*Updated: 2026-02-14T15:56:28.003Z*

## Dependency Graph

```
tokenizer.ts (no deps)
parser.ts (depends on: tokenizer.ts)
evaluator.ts (depends on: parser.ts)
main.ts (depends on: tokenizer.ts, parser.ts, evaluator.ts)
```

## Compatibility Matrix

| Dependent | Dependency | Required Exports | Available | Status |
|-----------|-----------|-----------------|-----------|--------|
| parser.ts | tokenizer.ts | [Token, TokenType] | [TokenType, Token, tokenize] | OK |
| evaluator.ts | parser.ts | [ASTNode] | [ASTNode, parse] | OK |
| main.ts | tokenizer.ts | [tokenize] | [TokenType, Token, tokenize] | OK |
| main.ts | parser.ts | [parse] | [ASTNode, parse] | OK |
| main.ts | evaluator.ts | [evaluate] | [evaluate] | OK |

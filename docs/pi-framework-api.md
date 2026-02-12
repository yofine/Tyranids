# Pi 框架 API 参考

本文档整理了 `@mariozechner/pi-ai` 和 `@mariozechner/pi-agent-core` 的核心 API 使用方式,用于 Tyranids 虫群系统的 Pi 框架集成。

## 资源链接

- **GitHub 仓库**: https://github.com/badlogic/pi-mono
- **npm 包**:
  - [@mariozechner/pi-ai](https://www.npmjs.com/package/@mariozechner/pi-ai)
  - [@mariozechner/pi-agent-core](https://www.npmjs.com/package/@mariozechner/pi-agent-core)
- **作者博客**: https://mariozechner.at/posts/2025-11-30-pi-coding-agent/

---

## @mariozechner/pi-ai - 统一 LLM API

### 概述

`@mariozechner/pi-ai` 是一个统一的多提供商 LLM API,支持 OpenAI、Anthropic、Google、Bedrock 等 15+ 提供商。

### 核心特性

1. **统一接口**: 所有提供商使用相同的 API
2. **自动模型发现**: 类型安全的模型选择
3. **流式支持**: 事件驱动的流式响应
4. **工具调用**: 内置 Function Calling 支持
5. **成本追踪**: 自动计算 API 调用成本
6. **上下文切换**: 支持会话中切换模型

### 安装

```bash
npm install @mariozechner/pi-ai
```

### 基本使用

#### 1. 获取模型

```typescript
import { getModel } from '@mariozechner/pi-ai';

// 获取 Anthropic Claude 模型
const model = getModel('anthropic', 'claude-haiku-4-5-20241022');

// 获取 OpenAI 模型
const gpt = getModel('openai', 'gpt-4o-mini');

// 获取 Google Gemini 模型
const gemini = getModel('google', 'gemini-2.0-flash-exp');
```

**支持的提供商**:
- `anthropic` - Claude 系列
- `openai` - GPT 系列
- `google` - Gemini 系列
- `vertex` - Vertex AI
- `bedrock` - Amazon Bedrock
- `mistral` - Mistral AI
- `groq` - Groq
- `xai` - xAI
- `cerebras` - Cerebras
- `ollama` - Ollama (本地)
- `vllm` - vLLM (本地)
- `lmstudio` - LM Studio (本地)

#### 2. 完整响应 (Complete)

```typescript
import { complete, type Context } from '@mariozechner/pi-ai';

const context: Context = {
  systemPrompt: 'You are a helpful coding assistant.',
  messages: [
    {
      role: 'user',
      content: 'Write a TypeScript function to sort an array',
      timestamp: Date.now()
    }
  ]
};

const response = await complete(model, context);

console.log(response.content); // AI 生成的内容
console.log(response.usage); // Token 使用统计
console.log(response.usage.cost); // 成本信息
```

#### 3. 流式响应 (Stream)

```typescript
import { stream } from '@mariozechner/pi-ai';

const streamResponse = stream(model, context);

// 事件驱动处理
for await (const event of streamResponse) {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.content);
      break;
    case 'thinking_delta':
      console.log('[Thinking]', event.content);
      break;
    case 'toolcall_delta':
      console.log('[Tool Call]', event.toolCall);
      break;
    case 'done':
      console.log('\n[Completed]');
      break;
    case 'error':
      console.error('[Error]', event.error);
      break;
  }
}

// 获取完整结果
const finalMessage = await streamResponse.result();
```

#### 4. 工具调用 (Tool Use)

```typescript
import { Type, type Tool } from '@mariozechner/pi-ai';

// 定义工具
const tool: Tool = {
  name: 'get_weather',
  description: '获取指定城市的天气信息',
  parameters: Type.Object({
    city: Type.String({ description: '城市名称' }),
    unit: Type.Optional(Type.Union([
      Type.Literal('celsius'),
      Type.Literal('fahrenheit')
    ]))
  })
};

const context: Context = {
  messages: [
    {
      role: 'user',
      content: 'What is the weather in Beijing?',
      timestamp: Date.now()
    }
  ],
  tools: [tool]
};

const response = await complete(model, context);

// 处理工具调用
if (response.toolCalls && response.toolCalls.length > 0) {
  for (const toolCall of response.toolCalls) {
    if (toolCall.name === 'get_weather') {
      const { city, unit } = toolCall.parameters;
      const weather = await fetchWeather(city, unit);

      // 添加工具结果到上下文
      context.messages.push({
        role: 'toolResult',
        toolCallId: toolCall.id,
        content: JSON.stringify(weather),
        timestamp: Date.now()
      });
    }
  }

  // 继续对话
  const followUp = await complete(model, context);
}
```

### Context 结构

```typescript
interface Context {
  systemPrompt?: string;
  messages: Message[];
  tools?: Tool[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

// Message 类型
type Message =
  | UserMessage
  | AssistantMessage
  | ToolResultMessage;

interface UserMessage {
  role: 'user';
  content: string;
  timestamp: number;
}

interface AssistantMessage {
  role: 'assistant';
  content: (TextContent | ThinkingContent | ToolCall)[];
  timestamp: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cost: {
      input: number;
      output: number;
      total: number;
    };
  };
}

interface ToolResultMessage {
  role: 'toolResult';
  toolCallId: string;
  content: string;
  timestamp: number;
}
```

### 成本追踪

```typescript
const response = await complete(model, context);

console.log('Input Tokens:', response.usage.inputTokens);
console.log('Output Tokens:', response.usage.outputTokens);
console.log('Input Cost:', response.usage.cost.input);
console.log('Output Cost:', response.usage.cost.output);
console.log('Total Cost:', response.usage.cost.total);
```

---

## @mariozechner/pi-agent-core - Agent 基础框架

### 概述

`@mariozechner/pi-agent-core` 提供了构建 AI Agent 的基础类和工具。

### 安装

```bash
npm install @mariozechner/pi-agent-core
```

### Agent 基类

```typescript
import { Agent } from '@mariozechner/pi-agent-core';

class MyAgent extends Agent {
  constructor(options: AgentOptions) {
    super(options);
  }

  async run() {
    // Agent 主逻辑
  }
}

// 使用
const agent = new MyAgent({
  // 配置选项
});

await agent.run();
```

**注意**: `AgentOptions` 的具体结构需要参考最新的包文档或源码。

---

## Tyranids 虫群系统集成

### 集成方式

Tyranids 使用 Pi 框架的方式:

1. **SwarmAgentPi**: 继承 `Agent` 基类
2. **使用 `getModel()`**: 获取 LLM 模型
3. **使用 `complete()`**: 调用 LLM 生成代码
4. **保留虫群特性**: 信息素池、概率决策、自组织

### 示例代码

```typescript
import { Agent } from '@mariozechner/pi-agent-core';
import { getModel, complete, type Context } from '@mariozechner/pi-ai';

class SwarmAgentPi extends Agent {
  private model: ReturnType<typeof getModel>;

  constructor(config) {
    super({});
    this.model = getModel('anthropic', 'claude-haiku-4-5-20241022');
  }

  async generateCode(prompt: string): Promise<string> {
    const context: Context = {
      messages: [
        {
          role: 'user',
          content: prompt,
          timestamp: Date.now()
        }
      ]
    };

    const response = await complete(this.model, context);

    // 提取文本内容
    const textContent = response.content
      .filter(c => c.type === 'text')
      .map(c => c.content)
      .join('');

    return textContent;
  }
}
```

---

## 常见问题

### Q: 如何切换不同的 LLM 提供商?

A: 只需修改 `getModel()` 的第一个参数:

```typescript
// Anthropic
const claude = getModel('anthropic', 'claude-sonnet-4-5-20250929');

// OpenAI
const gpt = getModel('openai', 'gpt-4-turbo');

// Google
const gemini = getModel('google', 'gemini-pro');
```

### Q: 如何处理流式响应中的不同事件类型?

A: 使用 `for await...of` 循环和事件类型判断:

```typescript
for await (const event of stream(model, context)) {
  if (event.type === 'text_delta') {
    // 文本增量
    process.stdout.write(event.content);
  } else if (event.type === 'thinking_delta') {
    // 思考过程 (Claude 特有)
    console.log('[Thinking]', event.content);
  } else if (event.type === 'toolcall_delta') {
    // 工具调用增量
    console.log('[Tool]', event.toolCall);
  } else if (event.type === 'done') {
    // 完成
    break;
  } else if (event.type === 'error') {
    // 错误
    console.error(event.error);
    break;
  }
}
```

### Q: Model 类型参数怎么处理?

A: `getModel()` 返回的是泛型类型 `Model<TApi>`,通常不需要显式指定类型:

```typescript
// 自动推断类型
const model = getModel('anthropic', 'claude-haiku-4-5-20241022');

// 或显式声明 (如果需要)
import type { Model } from '@mariozechner/pi-ai';
const model: Model<'anthropic'> = getModel('anthropic', 'claude-haiku-4-5-20241022');
```

### Q: 如何访问 raw API 响应?

A: 使用提供商特定的函数:

```typescript
import { completeAnthropic, type AnthropicOptions } from '@mariozechner/pi-ai';

const options: AnthropicOptions = {
  model: 'claude-haiku-4-5-20241022',
  // Anthropic 特定选项
};

const response = await completeAnthropic(options);
```

---

## 参考资源

### 官方文档
- [GitHub - badlogic/pi-mono](https://github.com/badlogic/pi-mono)
- [npm - @mariozechner/pi-ai](https://www.npmjs.com/package/@mariozechner/pi-ai)
- [npm - @mariozechner/pi-agent-core](https://www.npmjs.com/package/@mariozechner/pi-agent-core)

### 示例项目
- [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) - 官方编程 Agent 实现
- [Pi Monorepo Review](https://www.toolworthy.ai/tool/pi-mono) - 第三方评测

### 相关文章
- [What I learned building an opinionated and minimal coding agent](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)
- [Pi: The Minimal Agent Within OpenClaw](https://lucumr.pocoo.org/2026/1/31/pi/)

---

## 更新日志

- **2026-02-12**: 初始文档创建
- 基于 `@mariozechner/pi-ai` 0.52.9
- 基于 `@mariozechner/pi-agent-core` 0.52.9

---

## 贡献

如果您发现 API 使用错误或有新的示例,欢迎更新本文档。

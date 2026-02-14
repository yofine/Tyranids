/**
 * 直接测试 Minimax API
 */

async function testMinimaxAPI() {
  const apiKey = process.env.MINIMAX_API_KEY;

  if (!apiKey) {
    console.error('需要 MINIMAX_API_KEY 环境变量');
    process.exit(1);
  }

  console.log('🧪 直接测试 Minimax API\n');

  // 使用正确的 Minimax 端点（根据官方文档）
  const response = await fetch('https://api.minimaxi.com/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.1',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: '请输出 "Hello from Minimax!"',
        },
      ],
    }),
  });

  console.log('Status:', response.status);
  console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

  const data = await response.json();
  console.log('\nResponse:', JSON.stringify(data, null, 2));
}

testMinimaxAPI().catch(console.error);

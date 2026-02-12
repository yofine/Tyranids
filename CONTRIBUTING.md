# 贡献指南

感谢你对 Tyranids 虫群智能系统的关注!

## 开发环境

### 要求

- Node.js 20+
- TypeScript 5.9+
- npm 10+

### 设置

```bash
# 克隆仓库
git clone https://github.com/yourusername/tyranids.git
cd tyranids

# 安装依赖
npm install

# 构建
npm run build

# 运行测试
npm test
```

## 项目结构

```
tyranids/
├── packages/swarm-core/    # 核心虫群引擎
├── examples/               # 示例代码
└── docs/                   # 文档
```

## 开发流程

1. 创建特性分支
2. 进行修改
3. 运行测试确保通过
4. 提交 Pull Request

## 代码规范

- 使用 TypeScript
- 遵循现有代码风格
- 添加必要的注释

## 提交规范

使用 Conventional Commits:

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `refactor:` 重构
- `test:` 测试

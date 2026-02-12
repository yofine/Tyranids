# swarm-spawn

生成虫群来并行探索代码任务的多种解决方案。

## 使用场景

- 需要探索多种实现路径的任务
- 想要对比不同设计方案
- 复杂的代码重构或新功能开发

## 语法

```
/swarm-spawn task="<任务描述>" file="<目标文件>" [agents=5] [iterations=20]
```

## 参数

- `task` (必需): 任务描述,如 "为 Todo 添加优先级功能"
- `file` (必需): 目标文件路径
- `agents` (可选): 虫群规模,默认 5
- `iterations` (可选): 最大迭代次数,默认 20

## 示例

```
/swarm-spawn task="为 User 接口添加角色权限字段" file="src/types/user.ts" agents=5
```

## 工作流程

1. 派生指定数量的虫子 (agents)
2. 每个虫子并行探索不同的实现方案
3. 通过信息素机制共享方案质量
4. 收敛到最优方案或 top-3 候选
5. 返回结果和详细报告

## 输出

- Top-3 方案代码
- 虫群执行报告 (收敛过程、成本、质量分布)
- 方案对比分析

## 技能调用

此技能会在后台调用以下工具:
- `swarm_spawn_tool` - 启动虫群
- `swarm_monitor_tool` - 监控执行
- `swarm_report_tool` - 生成报告

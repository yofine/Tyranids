# swarm-query

查询当前虫群的执行状态和信息素分布。

## 语法

```
/swarm-query [swarm-id]
```

## 参数

- `swarm-id` (可选): 虫群 ID,默认查询最近的虫群

## 示例

```
/swarm-query
/swarm-query swarm-abc123
```

## 输出

- 虫群状态 (运行中/已收敛/已停止)
- 当前迭代次数
- Top-5 信息素 (方案预览)
- 收敛度和质量趋势
- 成本统计

# KnitScape — 当前主线

本仓库只保留 **`2a1efc1` 这条开发主线**。

- 代码基线：`2a1efc16d94cdab548b0ea96e9c64c462cd7c3f5`
- 基线标签：`baseline-2a1efc1-code`
- 当前分支：`main`
- 旧 KnitScape V2（L0–L6）文档、remote、标签和无效分支已从此清理副本移除。
- 后续开发不得依据已删除的 V2 路线恢复另一套架构。

## 当前产品链路

```text
Pattern / Repeat
      ↓
原始组织 chart（排针前预览）

Needle Arrangement + Single Jersey Cam Program
      ↓
resolveSingleJerseyOperations()
      ↓
K / T / M 机器动作矩阵
      ↓
createSingleJerseySimulationInput()
      ↓
排针后预览
```

当前已经形成单面大圆机的基础机器执行链路：

- 花型/Repeat 编辑
- 排针输入与应用
- Single Jersey Cam Program（三角座）
- Needle Type × Feed → K/T/M
- 排针前 / 排针后双预览
- 色纱、双纱、扫描纱线纹理、WebGL UV 纹理预览
- 机号与二维路径纱长估算

详细现状见：`KnitScape_当前功能与算法.md`。
下一开发任务见：`NEXT_TASK.md`。

## 本地运行

```bash
npm install
npm run dev
```

Windows 也可以使用：

```text
一键启动.bat
```

## 开发前必须确认

```bash
git branch --show-current
git log -1 --oneline
```

应看到 `main`，并且历史中包含 `2a1efc1`。

任何新开发都从当前 `main` 继续，不使用旧 V2、旧实验分支或 `v1.3.0-needle-execution` 的错误语义。

# KnitScape 下一开发任务

## 优先级 P0：完整保存机器设置

当前 `downloadJSON()` / `loadJSON()` 只处理：

- chart 尺寸
- repeats
- yarnPalette
- yarnSequence
- yarnPlies

但当前机器工作区已经依赖：

- `needleArrangementInputs`
- `needleArrangement`
- `singleJerseyCamProgram`

这些数据尚未进入 JSON，因此导出再导入后，机器配置会丢失。

## 建议实施范围

### 1. 扩展项目 JSON

新增机器字段，例如：

```json
{
  "machine": {
    "type": "single-jersey",
    "needleArrangementInputs": ["1", "22", "3", "44"],
    "needleArrangement": [1, 2, 2, 3, 4, 4],
    "camProgram": {
      "tracks": [["K", "K"], ["T", "M"]]
    }
  }
}
```

具体 schema 名称可以调整，但运行时仍以现有 state 字段为准，避免同时维护两套领域模型。

### 2. 导入校验

必须校验：

- arrangement 只能是正整数；
- Needle Type 不得超过 Cam track 数；
- Cam tracks 必须为矩形；
- Cam operation 只能为 `K/T/M`；
- 旧 JSON 没有 machine 字段时仍能正常打开。

### 3. Round-trip 验证

新增验证脚本，至少覆盖：

1. 创建 Cam Program；
2. 设置排针；
3. 导出结构；
4. 再导入；
5. Cam、排针及排针后机器结果完全一致。

## P1：设计结果与机器结果差异检查

P0 完成后，再做：

- Pattern 与排针后 K/T/M 结果差异统计；
- 无法执行/被替换的格子提示；
- 机器配置错误定位到 Needle Type / Feed / Position。

## 暂不做

当前阶段不要扩展：

- PLC 控制；
- 双面机；
- 真实动力学/碰撞仿真；
- 新 V2 / L0–L6 架构；
- 第二套 simulation engine。

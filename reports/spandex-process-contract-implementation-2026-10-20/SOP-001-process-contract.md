# SOP-001 完整双纱 Fixture 工艺说明

本说明与 [SOP-001-N6W6040-bare-spandex.knitscape](SOP-001-N6W6040-bare-spandex.knitscape) 共同构成完整 Fixture。项目包保存现有项目格式可表达的事实；设备规格和抽样检验等未建模信息在此记录，不新增通用 Project 字段。

来源：用户于 2026-10-20 提供的本轮实施合同（附件 `7911d68d-4b6d-4c7f-96f2-da80da37ed0e/已粘贴的文本.txt`）；真实 Cam 与主纱初始项目来自历史 [主纱包](../sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape)。本轮没有重新进行工厂测量。

| 数据 | Value | Unit | Source | Measurement / derivation principle | Confidence | Applicable state |
|---|---|---|---|---|---|---|
| 机台 | 润山单面大圆机 | 设备身份 | 本轮用户工艺确认 | 生产记录转录 | 用户确认，未独立现场核验 | SOP-001 |
| 筒径 | 32 | inch | 同上 | 设备规格，非几何标定 | 同上 | 当前机台 |
| 机号 | 32 | needles/inch | 用户确认及历史包 | 设备规格；现有 Gauge 换算 | 同上 | 当前机台 |
| 总针数 | 3216 | 针 | 用户确认 | 设备记录 | 同上 | 当前机台 |
| 总口数 | 96 | 口 | 用户确认 | 设备记录 | 同上 | 当前机台 |
| 最小完整工艺周期 | 8 | 路 | 用户确认及真实 Cam | Feed1–8，完整循环 | 同上 | SOP-001 |
| 重复次数 | 12 | 次 | 用户确认 | 96口对应8路循环重复12次 | 工艺确认 | SOP-001 |
| 排针 | 1234 | Needle Type ID 循环 | 历史包及用户确认 | 对应4个针型 | 工艺确认 | 当前4×8 Cam |
| 主纱 | N6/W(6040) | 纱线身份 | 历史包及用户确认 | Feed1–8各有一条使用关系 | 工艺确认 | 当前SOP |
| 主纱放松实测记录 | 23 | cm/100针 | 用户工艺确认 | 放松状态实际测量；未在本轮重测 | 用户确认的实测记录转录 | 放松态；本版仍以直接模型目标23使用 |
| 氨纶 | 20D裸氨纶 | 纱线身份 | 用户工艺确认 | Feed1–8各有一条使用关系 | 工艺确认 | 当前SOP |
| 氨纶放松长度 | 8 | cm/100针 | 用户工艺确认 | 放松状态实际测量；未在本轮重测 | 用户确认的实测记录转录 | 放松态 |
| 氨纶实际牵伸 | 3.0 | 无量纲倍数 | 用户工艺确认 | 织造状态长度 ÷ 放松后长度 | 当前SOP参数，非材料常数 | 当前织造工艺 |
| 织造参考长度 | 24 | cm/100针 | 上述两项，经唯一Domain运行时派生 | 放松实测长度 × 牵伸倍率 | 算术派生可靠，非独立实测或物理模型验证 | 织造状态参考；只在报告/运行时结果出现 |
| 主纱张力 | 5 | cN | 用户工艺确认 | 独立工艺记录 | 用户确认，未独立复测 | Assignment记录，不参与长度/几何 |
| 氨纶张力 | 4 | cN | 用户工艺确认 | 独立工艺记录 | 用户确认，未独立复测 | Assignment记录，不参与长度/几何 |
| 抽样检验规则 | ±2% | 相对偏差 | 用户工艺确认 | SOP-001抽样检验 | 当前SOP规则 | 不进入Project通用字段或Solver容差 |
| 模型直径 | 0.24 | MODEL_NEEDLE_PITCH | 历史项目主纱参数，LEGACY_PRIMARY | 既有模型参数，由旧材质解析继承 | 未实机标定 | 本轮数值回放；真实直径UNKNOWN |

真实 Cam 的针型行如下，未修改执行规则：

```text
Type 1: K K K K K K T T
Type 2: K K K K T T K K
Type 3: K K T T K K K K
Type 4: T T K K K K K K
```

每路主纱与氨纶共享该路K/T/M。没有建立双纱三维偏移或新的Machine Domain。项目预览尺寸沿用历史30×40；它不是3216×96全机仿真。

每路保存事实为主纱 `directTarget / 23 / tensionCN=5`，氨纶 `relaxedWithDraft / relaxedLengthCmPer100Needles=8 / draftRatio=3 / tensionCN=4`。氨纶不保存旧直接目标、不保存24。详细运行结果见 [sop-results.json](sop-results.json)。

新模式包使用 `knitscape version 3`，能力 `relaxed-yarn-length-with-draft-v1`。只能由支持该能力的版本编辑；不能保证已经发布的旧程序会拒绝新原始JSON。原历史主纱包保持原样。

`PROCESS_MEASUREMENT_CONTRACT = ESTABLISHED_FOR_SOP001`  
`SPANDEx_PHYSICAL_MODEL = NOT_IMPLEMENTED`  
`REAL_MACHINE_VALIDATION = PARTIAL`

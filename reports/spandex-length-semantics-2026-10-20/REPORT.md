# P0-C1 裸氨纶长度语义诊断

日期：2026-10-20，Asia/Shanghai。分支 `main`，HEAD `7ababf264d495f6b96d4d66652c529424938ac4d`。本轮以已有未提交改动的工作区为基线，不是干净HEAD。仅报告脚本、结果、报告和一份现有长度合同文档变更；没有commit或tag。

**诊断结论：PASS；下一阶段模型：PARTIALLY_SUPPORTED。** 8直接作为几何目标时八路均不可达；依据已确认定义派生24后八路均收敛并应用。正常倍率2.8/3.0/3.2和极限3.6的测试值全部可达。结果支持长度状态混用是旧“8不可达”的重要解释，不能量化为所有真实物理误差的唯一原因。M1/M3窗口差异仍在，未实现氨纶物理模型。

## 1. 已确认生产合同

唯一新增工艺证据：用户本轮提供的生产部门确认，任务附件 `C:/Users/liuchen/.codex/attachments/df694446-3ebe-4997-b778-faac116ac107/已粘贴的文本.txt`。下列信息为该确认的转录，不是本轮重新现场测量。

| 项目 | Value / Unit | Source / Measurement or derivation principle | Confidence / Applicable state |
|---|---|---|---|
| 设备 | 润山单面大圆机 | 生产部门确认 | PROCESS FACT；SOP-001；替代旧报告中“巨登”的转录，不重写历史 |
| 筒径 / 机号 / 总针数 | 32 inch / 32G / 3216 needles | 同上 | PROCESS FACT；机器规格，不是已完成整机几何标定 |
| 机器口数 | 96口、96三角座、96喂纱位置，一一对应 | 同上 | PROCESS FACT；整机 |
| 工艺周期 | 8 Feed最小完整周期；96=8×12 | 生产确认；整机口数÷周期口数 | PROCESS FACT；本SOP，软件诊断仍使用8路循环 |
| A 主纱放松实测长度 | N6/W(6040)，23 cm/100机针 | 同布100针对应范围拆纱，松弛、不紧绷直接测长 | PROCESS MEASURED；拆出放松态 |
| B 氨纶放松实测长度 | 20D裸氨纶，8 cm/100机针 | 同上 | PROCESS MEASURED；拆出放松态，非织造受力路径 |
| C 当前牵伸倍率 | 3.0，无量纲 | 生产部门确认实际采用值 | PROCESS CONFIRMED PARAMETER；当前SOP使用关系 |
| 牵伸正常范围 / 极限 | 2.8–3.2 / 3.6，无量纲 | 生产部门确认 | PROCESS FACT；3.6仅极限边界，不是默认或推荐 |
| D 派生织造态参考长度 | 24 cm/100机针 | B×C=8×3.0 | PROCESS-DERIVED VALUE；织造态参考，非现场直接实测 |
| 送纱方式 | 裸氨纶专用弹力送纱装置 | 生产部门确认 | PROCESS FACT；未建立装置物理模型 |
| 张力 | 主纱5 cN、氨纶4 cN | 生产部门确认的实测记录 | PROCESS MEASURED；activeInGeometry=false，无张力转换公式 |
| 路别 / 共同成圈 | 两纱均1–8路；同Feed共享K/T/M | 生产部门确认 | PROCESS FACT；共享动作拓扑，不承诺三维中心线重合 |
| 逐路差异 | 每Feed可分别设置主纱长度、氨纶放松长度 | 生产部门确认 | 正式需求；本SOP此次各路23/8 |
| 抽样验收 | ±2% | 生产部门确认的正式抽样标准 | PROCESS FACT；长度QC，与Solver收敛标准分开 |

路别“1.3”表示仅Feed1、3存在该纱。存在性以Feed × Yarn Assignment为authority；全局第二纱开关不能成为未来authority。新机器直接设定纱长，纱盘、齿轮、纱嘴深度仅作为旧设备记录，不建立相关核心公式。97口=12个8路周期+1个位置仅记录为PROCESS NOTE，无新增软件逻辑。

## 2. 旧软件解释 / 实验A

`8 relaxed → 直接Geometry target → UNREACHABLE_TARGET`，标记 **OLD SEMANTIC DIAGNOSTIC**。真实调用当前Solver，未调整范围或容差。每路target均为8；下表min/max是软件可达范围，非机器极限，单位cm/100机针。

| Feed | target | minimum | maximum | status |
|---|---:|---:|---:|---|
| 1 | 8 | 12.988409255 | 50.963459258 | UNREACHABLE_TARGET |
| 2 | 8 | 13.479988812 | 58.880432208 | UNREACHABLE_TARGET |
| 3 | 8 | 12.988409255 | 50.963459258 | UNREACHABLE_TARGET |
| 4 | 8 | 13.561702045 | 60.995279250 | UNREACHABLE_TARGET |
| 5 | 8 | 12.839089069 | 51.562202321 | UNREACHABLE_TARGET |
| 6 | 8 | 13.399320538 | 60.558578253 | UNREACHABLE_TARGET |
| 7 | 8 | 12.839089069 | 51.562202321 | UNREACHABLE_TARGET |
| 8 | 8 | 13.208564709 | 55.658397610 | UNREACHABLE_TARGET |

最小M1逐路为12.839089–13.561702；约13.2只是历史Feed8摘要，不能代表所有Feed。失败候选h=0.05未应用；最终显示仍为默认h=0.6路径。results.json分别保存候选M1/candidateM3与实际fallback M3，不能把失败候选当作已应用几何。

## 3. 新工艺解释 / 实验B

`8 cm/100针 relaxed × 3.0 draft = 24 cm/100针 knitting-state reference → 当前Solver`。唯一实验变量为诊断氨纶槽位目标值；主纱23、真实Cam、1234、32G、30×40、模型有效直径、Solver上下界与容差保持原样。没有把这些诊断语义写入Project State。

## 4. 牵伸公式来源

**生产部门已确认定义**：牵伸倍率=氨纶织造状态长度÷氨纶放松后长度，因此织造状态参考长度=放松实测长度×实际倍率。该公式不是模型猜测，也不是由主纱23与氨纶8的比值拟合。24属于工艺派生，M1/M2/M3/loopHeight/reachable range属于软件派生。

## 5. Feed 1–8结果及主纱对照

全部长度读数单位cm/100针（M2保留legacy标签，见下文）；loopHeight为model needle pitch单位。每路24均CONVERGED且applied=true。

| Feed | Main target23 | Main status | Spandex relaxed8 | Draft | Derived24 | Spandex diagnostic status | M1 | M3 | LoopHeight |
|---|---:|---|---:|---:|---:|---|---:|---:|---:|
| 1 | 23 | CONVERGED | 8 | 3.0 | 24 | CONVERGED | 24.000753568 | 23.947985292 | 0.583917236 |
| 2 | 23 | CONVERGED | 8 | 3.0 | 24 | CONVERGED | 23.999598556 | 24.081417359 | 0.470790100 |
| 3 | 23 | CONVERGED | 8 | 3.0 | 24 | CONVERGED | 24.000755007 | 23.947987616 | 0.583917236 |
| 4 | 23 | CONVERGED | 8 | 3.0 | 24 | CONVERGED | 24.000680854 | 23.602061084 | 0.450140381 |
| 5 | 23 | CONVERGED | 8 | 3.0 | 24 | CONVERGED | 23.999916116 | 24.051664192 | 0.589332581 |
| 6 | 23 | CONVERGED | 8 | 3.0 | 24 | CONVERGED | 23.999944039 | 23.929561571 | 0.464244080 |
| 7 | 23 | CONVERGED | 8 | 3.0 | 24 | CONVERGED | 23.999915148 | 24.051665451 | 0.589332581 |
| 8 | 23 | CONVERGED | 8 | 3.0 | 24 | CONVERGED | 24.000004712 | 25.164083125 | 0.517564392 |

24诊断的求解误差为绝对误差，容差保持0.00079375 cm/100针。applied=true通过候选path map与最终draw sink逐项相等断言核对，非仅复制状态标签。

| Feed | solvedLength | error | reachable min | reachable max | applied candidate |
|---|---:|---:|---:|---:|---|
| 1 | 24.000753568 | 0.000753568 | 12.988409255 | 50.963459258 | true |
| 2 | 23.999598556 | 0.000401444 | 13.479988812 | 58.880432208 | true |
| 3 | 24.000755007 | 0.000755007 | 12.988409255 | 50.963459258 | true |
| 4 | 24.000680854 | 0.000680854 | 13.561702045 | 60.995279250 | true |
| 5 | 23.999916116 | 0.000083884 | 12.839089069 | 51.562202321 | true |
| 6 | 23.999944039 | 0.000055961 | 13.399320538 | 60.558578253 | true |
| 7 | 23.999915148 | 0.000084852 | 12.839089069 | 51.562202321 | true |
| 8 | 24.000004712 | 0.000004712 | 13.208564709 | 55.658397610 | true |

主纱控制C直接读取原fixture，每Feed保持23目标。Δh=氨纶24求解h−主纱23求解h。

| Feed | 主纱M1 | 主纱M2（共享预览） | 主纱M3 | 主纱loopHeight | status | Δh(24−23) |
|---|---:|---:|---:|---:|---|---:|
| 1 | 22.999920925 | 24.792732968 | 22.937378095 | 0.531311035 | CONVERGED | 0.052606201 |
| 2 | 22.999922024 | 24.792732968 | 23.064753860 | 0.427050781 | CONVERGED | 0.043739319 |
| 3 | 22.999921150 | 24.792732968 | 22.937378118 | 0.531311035 | CONVERGED | 0.052606201 |
| 4 | 23.000296542 | 24.792732968 | 22.625946067 | 0.408245850 | CONVERGED | 0.041894531 |
| 5 | 22.999808587 | 24.792732968 | 23.061232332 | 0.537738037 | CONVERGED | 0.051594543 |
| 6 | 22.999987339 | 24.792732968 | 22.944063496 | 0.421873474 | CONVERGED | 0.042370605 |
| 7 | 22.999808733 | 24.792732968 | 23.061228510 | 0.537738037 | CONVERGED | 0.051594543 |
| 8 | 22.999733873 | 24.792732968 | 24.077277996 | 0.470611572 | CONVERGED | 0.046952820 |

24与23在同一Feed动作拓扑下的h相近，但不相同（约增加0.042–0.053模型单位，约10%）；这只是当前几何模型对不同目标的响应，不是双纱机械耦合或相同中心线证明。主纱23本身是放松实测值，本轮保持历史输入作对照，并未证明它等于主纱织造态几何长度。

**测量口径保持原定义：** M1是Solver横向周期化30针窗口、同Feed全部5个course的平均，包含顶部边界。原30针宽不是完整4针repeat，不能偷偷改成32针。M3复用独立积分器，对最终应用路径的内部16针×3个同Feed course积分，分母48次针位经过。M2=24.792732968，是排针前整个Pattern有限窗口的预览统计，分母30×40=1200；每条诊断记录重复该上下文值，不是逐Feed/逐Yarn测量，也不用于收敛判断。

Feed8：主纱M1≈22.999734、M3≈24.077278；氨纶24时M1≈24.000005、M3≈25.164083。后者M3相对24约+4.85%，超过纯算术±2%区间，但M3尚未被确认是生产authority，不能据此判定现场QC失败。该差异说明本轮尚未消除测量窗口问题。

## 6. 2.8 / 3.0 / 3.2敏感性 / 实验D

仅测试生产确认的三个正常倍率；24用同一次实验B结果，未改变任何Solver设置。以下均CONVERGED且applied=true；h与M1/M3按Feed分别列出，不能只看Feed8。

| 倍率 | 派生目标 | Feed | status / applied | loopHeight | M1 | M3 |
|---:|---:|---:|---|---:|---:|---:|
| 2.8 | 22.4 | 1 | CONVERGED / true | 0.500009155 | 22.400272881 | 22.332328618 |
| 2.8 | 22.4 | 2 | CONVERGED / true | 0.400926208 | 22.399529909 | 22.454802986 |
| 2.8 | 22.4 | 3 | CONVERGED / true | 0.500009155 | 22.400273955 | 22.332328737 |
| 2.8 | 22.4 | 4 | CONVERGED / true | 0.383251953 | 22.400439198 | 22.040684509 |
| 2.8 | 22.4 | 5 | CONVERGED / true | 0.506912231 | 22.399224558 | 22.466032417 |
| 2.8 | 22.4 | 6 | CONVERGED / true | 0.396522522 | 22.399514848 | 22.351739255 |
| 2.8 | 22.4 | 7 | CONVERGED / true | 0.506912231 | 22.399226326 | 22.466035178 |
| 2.8 | 22.4 | 8 | CONVERGED / true | 0.442582703 | 22.399998427 | 23.426349934 |
| 3.0 | 24.0 | 1 | CONVERGED / true | 0.583917236 | 24.000753568 | 23.947985292 |
| 3.0 | 24.0 | 2 | CONVERGED / true | 0.470790100 | 23.999598556 | 24.081417359 |
| 3.0 | 24.0 | 3 | CONVERGED / true | 0.583917236 | 24.000755007 | 23.947987616 |
| 3.0 | 24.0 | 4 | CONVERGED / true | 0.450140381 | 24.000680854 | 23.602061084 |
| 3.0 | 24.0 | 5 | CONVERGED / true | 0.589332581 | 23.999916116 | 24.051664192 |
| 3.0 | 24.0 | 6 | CONVERGED / true | 0.464244080 | 23.999944039 | 23.929561571 |
| 3.0 | 24.0 | 7 | CONVERGED / true | 0.589332581 | 23.999915148 | 24.051665451 |
| 3.0 | 24.0 | 8 | CONVERGED / true | 0.517564392 | 24.000004712 | 25.164083125 |
| 3.2 | 25.6 | 1 | CONVERGED / true | 0.668598938 | 25.599720837 | 25.564164444 |
| 3.2 | 25.6 | 2 | CONVERGED / true | 0.541249084 | 25.599689868 | 25.711079208 |
| 3.2 | 25.6 | 3 | CONVERGED / true | 0.668598938 | 25.599717544 | 25.564157870 |
| 3.2 | 25.6 | 4 | CONVERGED / true | 0.517504883 | 25.599947739 | 25.162713050 |
| 3.2 | 25.6 | 5 | CONVERGED / true | 0.672348022 | 25.600743998 | 25.635533385 |
| 3.2 | 25.6 | 6 | CONVERGED / true | 0.532322693 | 25.600575112 | 25.505000537 |
| 3.2 | 25.6 | 7 | CONVERGED / true | 0.672348022 | 25.600741427 | 25.635533385 |
| 3.2 | 25.6 | 8 | CONVERGED / true | 0.593022156 | 25.599889491 | 26.904939176 |

三个正常倍率的24个Feed测试点全部可达。各路min/max不同；各路在相同目标下h、M3也不同。由当前Solver已执行的单调性采样及连续二分模型可推断这些点之间位于报告可达区间，但本轮没有穷举所有实数倍率或确认真实机器整个范围的精度。

## 7. 3.6极限边界

**PRODUCTION LIMIT DIAGNOSTIC**：8×3.6=28.8；仅边界诊断，不是正常推荐值或默认值。

| Feed | status / applied | loopHeight | M1 | M3 |
|---|---|---:|---:|---:|
| 1 | CONVERGED / true | 0.838973999 | 28.800185684 | 28.802955670 |
| 2 | CONVERGED / true | 0.683000183 | 28.800468051 | 28.977248276 |
| 3 | CONVERGED / true | 0.838973999 | 28.800185684 | 28.802955670 |
| 4 | CONVERGED / true | 0.653007507 | 28.800395390 | 28.286569596 |
| 5 | CONVERGED / true | 0.838676453 | 28.799965972 | 28.797294676 |
| 6 | CONVERGED / true | 0.668717957 | 28.800050947 | 28.648342479 |
| 7 | CONVERGED / true | 0.838676453 | 28.799963442 | 28.797291196 |
| 8 | CONVERGED / true | 0.744473267 | 28.799608573 | 30.393329465 |

## 8. QC ±2%

生产已确认正式抽样标准；以下只是诊断派生，不改Solver acceptance：

| 量 | 区间 cm/100机针 | 分类 |
|---|---|---|
| 主纱放松23 | 22.54–23.46 | DERIVED FROM QC RANGE |
| 氨纶放松8 | 7.84–8.16 | DERIVED FROM QC RANGE |
| 氨纶织造态参考，倍率固定3.0 | 23.52–24.48 | DERIVED FROM QC RANGE；非直接实测 |

上述区间只传播长度±2%，不包含倍率误差传播或物理模型不确定性。Solver仍用原0.01模型单位容差，32G下为0.00079375 cm/100针；h范围仍[0.05,2]。MODEL_CONVERGED不等于PROCESS_VALIDATED。

## 9. 已确认的Domain方向（建议，未实施）

- Feed × Yarn独立长度是正式需求；批量设置只是快捷输入。
- YarnAsset保存纱种身份、规格、材料，可选默认/推荐牵伸范围；同一种20D裸氨纶的实际倍率可随Feed、工艺单和机器条件变化，实际倍率应属于FeedYarnAssignment使用关系，不能只属于YarnAsset。
- 同Feed共存纱共享K/T/M拓扑。继续复用唯一Machine Domain，不增加第二套Cam、机器执行或全局第二纱authority。
- 当前8路是最小完整工艺周期；96口为12次循环。97口只留工艺说明。

本轮未新增yarnType/spandexType/draftRatio/relaxedLength/knittingLength正式状态字段，没有修改YarnAsset、FeedYarnAssignment、导入导出或项目格式。

## 10. 仍未验证 / KNOWN LIMITATION

真实纱径UNKNOWN。两纱在软件中使用0.24 / MODEL_NEEDLE_PITCH / LEGACY_PRIMARY，置信度UNVALIDATED_MODEL_PARAMETER，适用模型几何偏移；相同有效值不证明相同真实直径，也不是0.24 mm。不得从20D猜真实纱径。

张力5/4 cN为生产实测记录，activeInGeometry=false；原fixture中的tension=null保持原样，确认值只写报告元数据。没有张力→长度/直径/弹性公式。双纱三维相对位置、plating、接触碰撞、物理弹性、回缩模型及更多生产案例均未实现/未验证。没有进入YarnTopology或三维。

放松静置时长、仪器校准、精确起止针与端部连接归属等细节尚未提供；本轮不补默认值。当前M1/M3口径差异和真实物性缺口仍需下一阶段研究。生产确认足以建立SOP-001的长度状态合同，未证明所有软件测量等价性。

## 11. 是否支持下一阶段模型

**PARTIALLY_SUPPORTED。** 支持在下一阶段明确区分裸氨纶放松实测长度、实际牵伸倍率和织造态参考长度：只把诊断目标8改为生产派生24，当前8路Solver失败全部转为成功，无需修改几何公式或bound。2.8–3.2测试点同样成功，支持该语义方向与当前模型的数值相容性。

尚不支持宣称完整氨纶物理模型或实机标定成功：M1/M3差异、未知直径、未建张力物理与主纱状态等价性都仍存在。结论不以“24落在范围”代替真实求解，不把CONVERGED升级为生产QC通过。

## 12. 实验复现、基线与保护

运行：`node reports/spandex-length-semantics-2026-10-20/diagnostic.mjs`。六组实验共88条Feed/Yarn记录；原23控制8条，其余5组每组16条。真实fixture来自 `reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape`，SHA-256见results.json。原保存包只有主纱；本次氨纶分配来自已确认工艺，但只在内存clone添加，不伪称原包已保存。

机器动作调用现有 `createSingleJerseyExecutionInput → resolveSingleJerseyOperations`。脚本沿用既有observability harness：Vite临时模块包装只观察原buildYarnPathGeometry返回值，draw sink只捕获最终路径；不写src、不替换数学函数。M3直接import历史independent-auditor，不复制积分公式。新实验不使用旧结果充当求解值；旧结果仅用于运行后精确对照。

numeric drift = NO：每Feed原23/8的M1、M2、M3、误差、h、状态、applied、候选M3及reachable range逐项严格相等；所有新氨纶目标下主纱结果保持相等。既有SOP comparison另以输出拦截写入系统临时目录执行，历史REPORT/results和原fixture保持不变。本轮SOP比较用于数值回归，其旧“未知工艺”文字是历史分类，本次生产确认以本报告为准。

开工记录了 `git branch --show-current`、`git rev-parse HEAD`、`git status --short`、`git log -1 --oneline`，完整初始状态及本轮验证结果见results.json。开工前validate 40/40、build exit0、diff-check exit0。首次沙箱内Node启动因用户目录lstat EPERM失败，获准在沙箱外执行后完成真实验证；该环境错误不冒称项目测试失败或通过。

最终验证：纱长validator、Solver validator、material validator、SOP comparison均PASS；完整validate 40/40，build exit0，diff-check exit0。开工快照中1296个文件逐项校验，唯一既有文件变更为docs/YARN_LENGTH_CONTRACT.md；初始清单因Git路径转义漏列的三个非ASCII文件未编辑，诊断运行期间另有全量非忽略文件hash保护。详细证据见results.json verification及preservation。Git现有LF/CRLF提示不是diff-check错误。保留所有开工前未提交材料实现与报告，不重置工作区。

本轮文件：diagnostic.mjs、results.json、REPORT.md，以及 `docs/YARN_LENGTH_CONTRACT.md` 的生产合同补充。src / Solver / Geometry数学 / loopHeight bounds / tolerance / M1 / M2 / M3定义 / Project format / dependency / package.json changed = NO（相对开工快照）。

SPANDEx_LENGTH_SEMANTICS_DIAGNOSTIC = PASS

PROCESS_MEASUREMENT_CONTRACT = ESTABLISHED_FOR_SOP001

REAL_MACHINE_VALIDATION = PARTIAL

SPANDEx_PHYSICAL_MODEL = NOT_IMPLEMENTED

import fs from "node:fs";
import path from "node:path";
import { writeFabricFormPlots } from "./fabricFormPlots.mjs";

/** Assemble existing run evidence; this does not execute or silently repeat checks. */
export function writeT1Report(directory) {
  const read=name=>JSON.parse(fs.readFileSync(path.join(directory,`${name}.json`),"utf8"));
  const reference=read("reference"),fixed=read("fixed-acceptance"),refinement=read("refinement-summary");
  const freeze=read("frozen-cases"),comparison=read("b-comparison"),branches=read("branches");
  const reactions=read("locked-reaction-check"),regression=read("final-regression");
  const reproducibility=read("reproducibility"),integrals=read("case-integrals");
  const cases=freeze.lengthsMm.map(l=>read(`case-${l}`)),sop=read("sop-reference");
  const sizes=[read("branch-2x2"),read("branch-4x8")];
  const fineCases=[read("case-2.6-fine64"),read("case-4-fine64")];
  const defaultEntry=read("default-entry");
  const seeds=branches.seeds.map(row=>({seed:row.seed,initialMinDistance:row.initialMinDistance,
    result:read(row.result.replace(/\.json$/,""))}));
  const f=(x,d=6)=>Number.isFinite(x)?x.toFixed(d):String(x);
  const e=x=>x.toExponential(3);
  const table=(heads,rows)=>["| "+heads.join(" | ")+" |","| "+heads.map(()=>"---").join(" | ")+" |",...rows.map(row=>"| "+row.join(" | ")+" |")].join("\n");
  const summary={baseline:"4e68850414432898cafb5bb7d078eb52722955a8",scope:"T1 only; no T2-T8",
    numericalChecks:fixed,refinement,fineCases,defaultEntry,reactions,branches,regression,reproducibility,integrals,freeze,empiricalComparison:comparison,
    cases:cases.map(r=>({status:r.status,metrics:r.metrics,energy:r.energy,constraints:r.constraints,
      equilibrium:r.equilibrium,clearance:r.clearance,barrier:r.barrier,trajectory:r.trajectory,diagnostics:r.diagnostics})),
    sopReference:{status:sop.status,metrics:sop.metrics,energy:sop.energy,constraints:sop.constraints,
      equilibrium:sop.equilibrium,clearance:sop.clearance,params:sop.params,diagnostics:sop.diagnostics}};
  fs.writeFileSync(path.join(directory,"summary.json"),JSON.stringify(summary,null,2));
  for(const [name,result] of [["reference",reference],["branch-2x2",sizes[0]],["branch-4x8",sizes[1]],
    ...cases.map(r=>[`case-${r.cell.topology.loopLengthMm}`,r]),["sop-reference",sop]]) {
    writeFabricFormPlots(result,path.join(directory,`${name}.svg`));
  }
  const lines=["# T1 普通纬平针周期单元求解器", "",
    "基线：`4e68850414432898cafb5bb7d078eb52722955a8`，分支 main，接手工作区干净。范围为独立单纱全成圈数值模块；未进入 T2–T8，未接入 UI。", "",
    `四工况 B 类结果：**${comparison.status}**。这是任务书暂定经验区间对照，不是实物标定或 SOP 验收。所有四工况共用冻结材料参数和 N=${freeze.nodesPerLoop}、q=${freeze.settings.quadratureOrder}；l=3 mm 先以 N=${freeze.fineReferenceNodes} 建立参考分支的密度精度。额外 4 mm 检查未满足杆离散门槛，不能宣布 T1 全部验收通过。`, "",
    "## 里程碑与验收边界", "",
    table(["里程碑","结果与证据"],[
      ["M0","PASS：实际路径/HEAD/status 已核对；开工 validate/build 均退出 0，日志 m0-*.log。"],
      ["M1","PASS：复用机器动作入口，带 yarnId、材料顺序、周期偏移和实际几何核验的有向穿套签名。"],
      ["M2","PASS：离散杆解析值、节点与格矢梯度；32 节点圆环连续误差约 0.646%。"],
      ["M3","PASS（已覆盖范围）：Abel、e′=-f、实际段积分、力与周期去重；原最近距离势垒失败后改为一致双线积分。"],
      ["M4","PASS（非局部保护）：材料长度和 rc 间隙可行，普通及移动周期像的中途穿越被拒。初值试验未找到 rmin>de 的无接触种子，未改纱长。"],
      ["M5",`参考分支必要数值检查通过；A5/A8 分支诊断已执行；A14 在 l=3 mm 的 convergenceEstablished=${refinement.convergenceEstablished}。4 mm 额外杆检查未通过，A12 未普遍达标。`],
      ["M6",`四工况与 SOP 参考已运行；B=${comparison.status}；A13 validate/build 退出码 ${regression.validate.exitCode}/${regression.build.exitCode}。`],
    ]),"",
    "A3 只证明已检查的非局部中心线段对沿更新轨迹保持 r>rc。材料近邻排除的局部段、局部扫掠管面及最终三角网格不在证明内。一阶平衡不证明稳定极小值或全局最低能。", "",
    "## 独立调用", "",
    "在仓库根目录使用 Node ESM；以下默认材料明确为未标定数值参考，不是实测值：", "",
    "```js",
    "import { createPlainJerseyTopology } from './src/fabricForm/fabricFormTopology.js';",
    "import { createFabricFormParams } from './src/fabricForm/fabricFormParams.js';",
    "import { solveFabricCell } from './src/fabricForm/solveFabricCell.js';",
    "const result = solveFabricCell({",
    "  topology: createPlainJerseyTopology({ loopLengthMm: 3 }),",
    "  params: createFabricFormParams(),",
    "});",
    "console.log(result.status, result.metrics, result.equilibrium);",
    "```", "",
    `这条归档默认入口 N${defaultEntry.settings.nodesPerLoop}/q${defaultEntry.settings.quadratureOrder} 调用已实际从头运行，没有传入保存的初值：${defaultEntry.status}，${f(defaultEntry.diagnostics.elapsedMs/1000,2)} s，${defaultEntry.iterations} 次迭代，节点残差比 ${e(defaultEntry.equilibrium.nodeRatio)}、最大段应变 ${e(defaultEntry.constraints.maxSegmentStrain)}。原始结果见 default-entry.json；30 s 目标须按该次实际耗时判断，不能抵消其他工况超时。`,"",
    table(["验收项","实际状态","证据与范围"],[
      ["A1 梯度","通过已覆盖检查","节点、闭合边及 W/H/S；接触支撑/最近特征边界另含在快检。完整参考相对误差 5.59e−9。"],
      ["A2 材料长度","通过","全部报告的收敛结果满足段应变和每圈长度门槛；未收敛尝试另存。"],
      ["A3 轨迹间隙","通过非局部检查","扫掠周期像候选与距离 Lipschitz 界；含端点可行而中途穿越的拒步反例。局部纱管未验证。"],
      ["A4 平衡/反力","通过所列收敛解","完整节点与自由格矢残差；锁定尺寸仅自由变量拟合乘子，尺寸反力与平衡能量导数核对。"],
      ["A5 周期/分支","复制通过；分支仅诊断","精确复制到 2×2、4×8 的每圈能量/约束/拉回梯度一致；独立扰动优化另表。"],
      ["A6 尺度协变","通过同分支检查","真实输入变换与固定几何能量/梯度检查；变换后的平衡解重新进入求解器。"],
      ["A7 刚度缩放","通过同分支检查","Ef×10，B 与接触/势垒同步×10；不代表独立全局寻优。"],
      ["A8 多初值","已完成诊断","五个有记录种子、相同材料分段、保长可行扰动均收敛；不证明分支唯一。"],
      ["A9 镜像/剪切","镜像通过；剪切仅诊断","z 镜像及穿套正反元数据转换；零剪切只对应当前对称分支。"],
      ["A10 复现",reproducibility.status,"最终优化器完整重复 case-2.6，除 diagnostics 外逐位相同。"],
      ["A11 质量守恒","通过","1×1、2×2、4×8 的两种 GSM 公式一致；不是第三个独立形态观测。"],
      ["A12 性能","未普遍达标","1×1 目标 30 s，4×8 目标 300 s；实际时间、热启动及失败续算分别报告。"],
      ["A13 既有功能","通过",`${regression.validate.summary}；validate/build 退出 ${regression.validate.exitCode}/${regression.build.exitCode}。`],
      ["A14 独立精度","部分通过；4 mm 尚未建立杆收敛","l=3 的 24→32→64、2.6 的 N32→64 密度检查通过；4 mm 纵密变化 0.669% 超门槛。接触积分与势垒细分独立通过。"],
      ["B 经验对照",comparison.status,"2.6 mm 的 kc、kc/kw 和 4 mm 的 kc/kw 超出暂定上限。"],
    ]),"",
    "## 四工况与 SOP 参考", "",
    table(["工况","状态","横密 纵行/cm","纵密 横列/cm","kw","kc","kc/kw","GSM g/m²"],
      [...cases.map(r=>[`${r.cell.topology.loopLengthMm} mm`,r]),["SOP 主纱 2.3 mm（反事实全成圈）",sop]].map(([name,r])=>
        [name,r.status,f(r.metrics.waleDensityPerCm,4),f(r.metrics.courseDensityPerCm,4),f(r.metrics.kw,4),f(r.metrics.kc,4),f(r.metrics.kcOverKw,4),f(r.metrics.gsm,3)])),"",
    `kw 离散度 ${f(100*comparison.kwSpread,3)}%，kc 离散度 ${f(100*comparison.kcSpread,3)}%；双密度随纱长下降：${comparison.trend}。各项区间判定见 b-comparison.json。SOP 主纱 8 tex 是反推值，混纺密度、纤维直径和模量是假设；2.3 mm 输入来自拆纱测量，当前全成圈模型不是原双纱 K/T 实物。`,"",
    "## 数值结果", "",
    `运行环境：${cases[0].diagnostics.environment.node}，${cases[0].diagnostics.environment.cpu}，${cases[0].diagnostics.environment.platform}。四工况统一 q=${freeze.settings.quadratureOrder}、N=${freeze.nodesPerLoop}、L-BFGS memory=${freeze.settings.memorySize}、inner=${freeze.settings.innerIterations}、maxIterations=${freeze.settings.maxIterations}，最终物理平衡比门槛 1e−6。`,"",
    table(["l mm","弯曲/接触/势垒能 N·mm","最大段应变","每线圈长度相对误差","节点残差比","最大自由格矢残差比","最小间隙 mm","rmin / rc","耗时 s"],
      [...cases,sop].map(r=>[r.cell.topology.loopLengthMm,[r.energy.bending,r.energy.contact,r.energy.barrier].map(e).join(" / "),e(r.constraints.maxSegmentStrain),e(r.constraints.maxLoopLengthError),e(r.equilibrium.nodeRatio),e(Math.max(...r.equilibrium.latticeRatios)),f(r.clearance.minGap,6),f(r.clearance.ratioToCompaction,4),f(r.diagnostics.elapsedMs/1000,2)])),"",
    "残差比按任务书 E/l、E 与相应格矢尺度归一，门槛 1e−6；长度门槛 1e−4。完整自由残差、乘子、最小间隙、rmin/ds、势垒力/反力、轨迹安全界及迭代历史保存在各工况 JSON。运行时间来自这些实际求解，四工况由相同归一化已解分支启动，不能冒充冷启动性能。", "",
    "最终四工况和 SOP 的势垒能占比、激活段对数、最大梯度与 W/H/S 势垒反力均为零；这来自实际支撑边界检查，不是以低能量占比推断力小。乘子解法、条件数估计与截断阈值在 equilibrium 中返回：CHOLESKY 的 threshold=0 表示未作 SVD 截断，SVD 路径返回实际阈值。", "",
    "## 分支、反力与独立收敛", "",
    table(["自由优化单元","状态","每线圈能量 N·mm","横密","纵密","S/W","累计耗时 s"],
      [reference,...sizes].map(r=>[`${r.cell.topology.m}×${r.cell.topology.n}`,r.status,e(r.energy.total/(r.cell.topology.m*r.cell.topology.n)),f(r.metrics.waleDensityPerCm,6),f(r.metrics.courseDensityPerCm,6),e(r.cell.S/r.cell.W),f(r.diagnostics.elapsedMs/1000,2)])),"",
    "固定几何复制的 A5 能量/约束/拉回梯度一致性与上表独立优化分开。大单元扰动解除复制对称性；若找到较低能解，只说明该离散下存在不同候选平衡，不证明已找到全部分支。B 对照前已冻结使用来源连续的 1×1 参考分支。", "",
    table(["随机种子","状态","初值 rmin mm","能量 N·mm","横密","纵密","S mm","节点残差比","最大段应变"],
      seeds.map(({seed,initialMinDistance,result:r})=>[seed,r.status,f(initialMinDistance,6),e(r.energy.total),
        f(r.metrics.waleDensityPerCm,6),f(r.metrics.courseDensityPerCm,6),e(r.cell.S),e(r.equilibrium.nodeRatio),e(r.constraints.maxSegmentStrain)])),"",
    "五个种子均保持原材料分段并使用有间隙下界的局部保长旋转；拓扑沿连续可行变形保持，初值旋转记录见 branches.json。早期改变材料分段的形状探索独立保存在 material-partition-exploration/，不计作此五种子检查。", "",
    table(["杆节点数","状态","横密变化","纵密变化","节点残差比","本次耗时 s"],refinement.levels.map(r=>[r.nodes,r.status,f(100*r.waleRelative,4)+"%",f(100*r.courseRelative,4)+"%",e(r.nodeRatio),f(r.elapsedMs/1000,2)])),"",
    "接触积分在固定杆几何上独立提高 q 验证；势垒又独立做细分与相位检查。续算失败记录保留，累计耗时见 refinement 各 JSON 的 diagnostics，不能只用最后一次续算时间评价性能。", "",
    table(["额外细化 l mm","N64 状态","N32→64 横密变化","纵密变化","N64 kc","N64 kc/kw","节点残差比"],fineCases.map(r=>{
      const original=cases.find(c=>c.cell.topology.loopLengthMm===r.cell.topology.loopLengthMm);
      return [r.cell.topology.loopLengthMm,r.status,f(100*(r.metrics.waleDensityPerCm/original.metrics.waleDensityPerCm-1),4)+"%",
        f(100*(r.metrics.courseDensityPerCm/original.metrics.courseDensityPerCm-1),4)+"%",f(r.metrics.kc,6),f(r.metrics.kcOverKw,6),e(r.equilibrium.nodeRatio)];
    })),"",
    "4 mm 的杆离散精度尚未建立，未继续 N128；2.6 mm 的两方向变化均低于 0.5%。两点在 N64 都仍超出 B 区间，但这不提供连续模型误差上界。细化使用同一物理输入和保拓扑延拓，不替换冻结的 N32 四工况或逐工况调参。两次旧 N64 尝试遇到真实浮点 Armijo 停滞；修复仅限机器舍入范围内的梯度改善、无变化步拒绝和及时原判据检查，未放宽 A4。完整旧尝试、检查点和续算耗时保留。", "",
    "3.5 mm 与 SOP 参考没有独立 N64 杆细化，记为未执行；它们的固定几何 q12/q24 接触积分核验已执行。N64 延拓的精确起点属于修复前冻结结果，文件另存 before-roundoff-fix/；最终版本四工况重跑后变化仅为停止时的数值容差量级，精确来源在各细化 JSON 中注明。", "",
    "N64 的 2.6 mm 累计约 1427.17 s（旧检查点前 1383.26 s，加续算 43.91 s；检查点至终止的额外时间未计入）；4 mm 累计约 1320.04 s（旧 6000 次上限 1316.38 s，加续算 3.67 s）。这两项保留实际失败成本，不能以最后续算几秒声称生产性能达标。", "",
    table(["锁定尺寸方向","维持反力 N","dE*/dc N","相对误差"],Object.entries(reactions).map(([k,v])=>[k,e(v.reaction),e(v.derivative),e(v.relativeError)])),"",
    `锁定模式的乘子仅拟合自由节点与 S；W/H 方向残差作为反力返回。A6/A7 另以已平衡解做尺度/刚度变换并重新进入求解器检查，属于同一分支的平衡协变，不是独立寻找全局分支。A10 最终数值算法 ${reproducibility.inputCase} 完整重复求解（${reproducibility.iterations} 次迭代）除 diagnostics 外逐位相同，状态 ${reproducibility.status}；最后补出的三个乘子解法元数据字段在两份原终态上独立回算后再次逐位核对，未重新优化。实际五个结果固定几何 q12/q24 积分稳定性见 case-integrals.json，状态 ${integrals.status}。`, "",
    "## 材料来源", "",
    table(["参数","Value","Unit","Confidence","Source","Principle","Applicable state"],Object.entries(paramsForTable(cases[0])).map(([k,v])=>[k,v.value,v.unit,v.confidence,v.source,v.principle,v.applicableState])),"",
    "所有派生量保留依赖链，未知物性未写成实测。GSM 是输入质量与预测面积的关系，不是独立于两个密度的第三形态观测；z 跨度+de 仅为统一圆截面假设的包络厚度估计。SOP 单独来源链见 sop-reference.json。", "",
    "## 复用与模型边界", "",
    "实际复用 ml-matrix 6.15.1 的 Cholesky/SVD；L-BFGS two-loop/history 改编自 numopt-js 0.6.0 的 MIT 源码，外层加入本项目的约束与安全步长；初值复用 stitch-by-stitch commit 0ed27f35dcf5c3bda874f214bbcab0455055edf0 的八片五次 Bezier。完整许可在代码中。公开外部物理求解器未执行；DER/IPC 作为设计参考。", "",
    "物理模型仍为无摩擦、无扭转、局部不可伸长杆与原 van Wyk/Abel 接触公式。数值势垒使用 (K·Ef/de)∬b dsdt；旧段对最短距离加权的细分失败有独立反例。势垒能、梯度、格矢反力分别输出；当实际最小距离超过激活宽度×2的支撑边界时，½/1/2倍宽度在该平衡点均严格不激活，仅支持该分支的局部影响结论。", "",
    "模型公式与单位按任务书 §3：Eb=Σ B|κb|²/(|e前|+|e后|)，κb=2(e前×e后)/(|e前||e后|+e前·e后)；g边=|e|/L0−1。平行纱 e(r)=K·Ef·φ0³·de·[(de³/2)(r⁻²−de⁻²)−(de−r)]，r<de；接触 Ec=∬ψ(|x−y|)dsdt，ψ 为该 e 的 Abel 反演。rc=φ0·de；实体直径、有效直径和压实间隙不混同。固定原 e、ψ、B 定义及各项模型假设全文见仓库 docs/LAYER3_STEP1_TASK.md §3，修改的唯一保护测度见 §3.1。", "",
    "轨迹界的依据：候选由旧/新节点及移动周期像的扫掠包围体生成；段间距离对四个相对端点速度的最大范数满足 Lipschitz 界，每次安全步长不超过 0.8·(r−rc)/速度界。格矢更新同在速度界内；额外 de 位移上限只约束候选枚举成本。不是只检查线搜索接受端点。", "",
    "## 既有功能与构建", "",
    `本次最终 npm run validate：退出 ${regression.validate.exitCode}，${regression.validate.summary}；npm run build：退出 ${regression.build.exitCode}。末次总回归期间新增的节点数不匹配入口拒绝，在补丁后独立重跑完整 fabric-form 快检通过；其余既有功能无新改动。原有计算、16 槽、二维仿真、PBR 2.5D、机器执行、ProcessModel、SOP 和材质资产没有功能修改。实际日志见 final-validate.log / final-build.log、final-regression.json。`,"",
    "## 中心线（物理尺度）", "",
    ...[...cases.map(r=>[`case-${r.cell.topology.loopLengthMm}`,`${r.cell.topology.loopLengthMm} mm`]),["sop-reference","SOP 参考"]].flatMap(([name,label])=>[
      `### ${label}`,"",`![${label} 俯视与侧视](${path.join(directory,`${name}.svg`).replaceAll("\\","/")})`,"" ]),
    "## 尚不能确认", "",
    "真实材料参数、规定放松状态与无摩擦平衡是否对应，经验常数原始材料/测量程序的适用性，较大单元的分支选择与稳定性，局部纱管/三角网格可行性均未由本轮证明。B 即使通过也不代表实物标定；B 失败按冻结参数如实保留，不逐工况调参。T1 后停止，T2–T8 未实施。", ""];
  fs.writeFileSync(path.join(directory,"REPORT.md"),lines.join("\n"));
  return {report:path.join(directory,"REPORT.md"),summary:path.join(directory,"summary.json")};
}
const paramsForTable=result=>result.params.provenance;

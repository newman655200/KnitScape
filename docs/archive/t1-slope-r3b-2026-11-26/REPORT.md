# R3-b：纵行间接触脱开的平台与迟滞检查

本研究是固定无摩擦模型的诊断，不是材料标定。任何结果均不用于选择、调整或推荐 K、B 或其他参数。

## 1. 正向链

每个 l 的固定延续路径为：R3-a 1/16→1/24→1/32，以及 R3-a 1/44→1/64。另复用 R3-a 1/4、1/8 作为已登记描述点；所有原结果按原文件复用，无新求解。

| 运行 | 方向 | K倍数 | l/mm | 状态 | 迭代 | 耗时/s | W/mm | H/mm | S/mm | shearBranch | 签名 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| reused-r3a-2.77-K0.25 | forward | 1/4 | 2.77 | CONVERGED | 3800 | 复用（原 294.1971142） | 0.711222851174 | 0.507781093467 | -3.87656075757e-9 | false | waleSpacing + courseSpacing + diagonal + sameLoop |
| reused-r3a-2.84-K0.25 | forward | 1/4 | 2.84 | CONVERGED | 2975 | 复用（原 140.9223804） | 0.7233501267 | 0.524526863108 | -1.36431883544e-8 | false | waleSpacing + courseSpacing + diagonal + sameLoop |
| reused-r3a-2.9-K0.25 | forward | 1/4 | 2.9 | CONVERGED | 4250 | 复用（原 239.8814832） | 0.733386406719 | 0.538885579393 | -1.53751631323e-10 | false | waleSpacing + courseSpacing + diagonal + sameLoop |
| reused-r3a-2.77-K0.125 | forward | 1/8 | 2.77 | CONVERGED | 4175 | 复用（原 304.8980866） | 0.699590009088 | 0.521193937566 | 2.67479602679e-8 | false | waleSpacing + courseSpacing + diagonal + sameLoop |
| reused-r3a-2.84-K0.125 | forward | 1/8 | 2.84 | CONVERGED | 4000 | 复用（原 278.79754） | 0.71356478795 | 0.536399847655 | -8.78845024654e-8 | false | waleSpacing + courseSpacing + diagonal + sameLoop |
| reused-r3a-2.9-K0.125-resumed | forward | 1/8 | 2.9 | CONVERGED | 3225 | 复用（原 162.5228907） | 0.725404622646 | 0.549481189861 | 1.81207442691e-8 | false | waleSpacing + courseSpacing + diagonal + sameLoop |
| reused-r3a-2.77-K0.0625 | forward | 1/16 | 2.77 | CONVERGED | 3950 | 复用（原 251.9243215） | 0.70442884466 | 0.530954548055 | 1.32208890896e-8 | false | waleSpacing + courseSpacing + diagonal + sameLoop |
| reused-r3a-2.84-K0.0625 | forward | 1/16 | 2.84 | CONVERGED | 4100 | 复用（原 304.114744） | 0.722891728145 | 0.544269465182 | 1.16696652685e-7 | false | waleSpacing + courseSpacing + diagonal + sameLoop |
| reused-r3a-2.9-K0.0625 | forward | 1/16 | 2.9 | CONVERGED | 4950 | 复用（原 264.7050616） | 0.746224354957 | 0.553821754603 | 8.26336945964e-9 | false | courseSpacing + diagonal |
| reused-r3a-2.77-K0.022727272727272728 | forward | 1/44 | 2.77 | CONVERGED | 4075 | 复用（原 252.0282882） | 0.845854058663 | 0.512339861277 | 1.28038938955e-8 | false | courseSpacing + diagonal |
| reused-r3a-2.84-K0.022727272727272728 | forward | 1/44 | 2.84 | CONVERGED | 3950 | 复用（原 231.3677699） | 0.870825334765 | 0.523311010204 | 7.99323198905e-9 | false | courseSpacing + diagonal |
| reused-r3a-2.9-K0.022727272727272728 | forward | 1/44 | 2.9 | CONVERGED | 4000 | 复用（原 230.111951） | 0.892467411321 | 0.532636721554 | -4.7841905985e-9 | false | courseSpacing + diagonal |
| r3b-2.77-K0.041666666666666664 | forward | 1/24 | 2.77 | CONVERGED | 3575 | 215.1366595 | 0.748469096921 | 0.526921678172 | 1.87760006665e-8 | false | courseSpacing + diagonal |
| r3b-2.77-K0.03125 | forward | 1/32 | 2.77 | CONVERGED | 3775 | 244.7829811 | 0.792660210801 | 0.520792812534 | 2.75064171652e-8 | false | courseSpacing + diagonal |
| r3b-2.77-K0.015625 | forward | 1/64 | 2.77 | CONVERGED | 3943 | 347.8911827 | 0.911086522747 | 0.500181883198 | 3.13108080212e-8 | false | courseSpacing + diagonal |
| r3b-2.84-K0.041666666666666664 | forward | 1/24 | 2.84 | CONVERGED | 4900 | 181.6307848 | 0.774448378532 | 0.538005415568 | -1.65415145637e-9 | false | courseSpacing + diagonal |
| r3b-2.84-K0.03125 | forward | 1/32 | 2.84 | CONVERGED | 3650 | 141.9172285 | 0.81793351439 | 0.531859076471 | -1.66322015395e-8 | false | courseSpacing + diagonal |
| r3b-2.84-K0.015625 | forward | 1/64 | 2.84 | CONVERGED | 3750 | 249.4648604 | 0.936441993528 | 0.511017002075 | -1.78044438316e-8 | false | courseSpacing + diagonal |
| r3b-2.9-K0.041666666666666664 | forward | 1/24 | 2.9 | CONVERGED | 3725 | 200.7933449 | 0.797026629094 | 0.547420805563 | 1.73452527022e-8 | false | courseSpacing + diagonal |
| r3b-2.9-K0.03125 | forward | 1/32 | 2.9 | CONVERGED | 3400 | 116.4009452 | 0.839919129173 | 0.541222933933 | 2.4046626596e-9 | false | courseSpacing + diagonal |
| r3b-2.9-K0.015625 | forward | 1/64 | 2.9 | CONVERGED | 3550 | 120.8733362 | 0.958226027221 | 0.52023162691 | 2.35056199245e-8 | false | courseSpacing + diagonal |

| 运行 | 横密/cm⁻¹ | 纵密/cm⁻¹ | kw | kc | E_total/N·mm | E_bending | E_contact | E_barrier | barrierFraction | 能量和相对差 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| reused-r3a-2.77-K0.25 | 14.0602906438 | 19.6935256721 | 3.89470050833 | 5.45510661117 | 0.0213401156604 | 0.0204770643137 | 0.000863051346675 | 0 | 0 | 0 |
| reused-r3a-2.84-K0.25 | 13.8245638328 | 19.0648004961 | 3.92617612851 | 5.4144033409 | 0.0204288762629 | 0.0197714022573 | 0.000657474005658 | 0 | 0 | 0 |
| reused-r3a-2.9-K0.25 | 13.635376806 | 18.5568149945 | 3.95425927374 | 5.38147634841 | 0.0197218100185 | 0.019204054584 | 0.000517755434514 | 0 | 0 | 0 |
| reused-r3a-2.77-K0.125 | 14.2940863507 | 19.186715883 | 3.95946191915 | 5.31472029958 | 0.0207368984147 | 0.0198675970801 | 0.000869301334613 | 0 | 0 | 0 |
| reused-r3a-2.84-K0.125 | 14.0141444321 | 18.6428091725 | 3.98001701872 | 5.29455780499 | 0.019957675155 | 0.0192606592595 | 0.000697015895517 | 0 | 0 | 0 |
| reused-r3a-2.9-K0.125-resumed | 13.7854098083 | 18.1989851236 | 3.9977688444 | 5.27770568586 | 0.0193418111531 | 0.0187662731412 | 0.000575538011924 | 0 | 0 | 0 |
| reused-r3a-2.77-K0.0625 | 14.1958979616 | 18.8340038458 | 3.93226373537 | 5.21701906528 | 0.0201347303079 | 0.0192519050424 | 0.00088282526545 | 0 | 0 | 0 |
| reused-r3a-2.84-K0.0625 | 13.8333302356 | 18.3732519271 | 3.9286657869 | 5.21800354729 | 0.0194596163956 | 0.0186973804037 | 0.000762235991908 | 0 | 0 | 0 |
| reused-r3a-2.9-K0.0625 | 13.4007955296 | 18.0563510135 | 3.88623070359 | 5.2363417939 | 0.0189149523698 | 0.0182098301225 | 0.000705122247338 | 0 | 0 | 0 |
| reused-r3a-2.77-K0.022727272727272728 | 11.8223704167 | 19.5182939213 | 3.27479660543 | 5.4065674162 | 0.0189825727467 | 0.0175575884024 | 0.00142498434435 | 0 | 0 | 0 |
| reused-r3a-2.84-K0.022727272727272728 | 11.4833590627 | 19.1090953659 | 3.26127397381 | 5.42698308391 | 0.0184010276779 | 0.0170757479449 | 0.00132527973309 | 0 | 0 | 0 |
| reused-r3a-2.9-K0.022727272727272728 | 11.2048909273 | 18.7745222876 | 3.24941836891 | 5.4446114634 | 0.0179268924033 | 0.0166805011501 | 0.00124639125322 | 0 | 0 | 0 |
| r3b-2.77-K0.041666666666666664 | 13.3606050552 | 18.9781525685 | 3.7008876003 | 5.25694826148 | 0.0197449238378 | 0.0186671282849 | 0.00107779555286 | 0 | 0 | 0 |
| r3b-2.77-K0.03125 | 12.6157461466 | 19.201493875 | 3.49456168262 | 5.31881380337 | 0.0194095914377 | 0.0181576835066 | 0.00125190793112 | 0 | 0 | 0 |
| r3b-2.77-K0.015625 | 10.9759059654 | 19.9927273176 | 3.04032595241 | 5.53798546699 | 0.0184175312698 | 0.0168376750529 | 0.00157983699026 | 1.92266837054e-8 | 0.0000010439338163 | 1.88377416122e-16 |
| r3b-2.84-K0.041666666666666664 | 12.9124164724 | 18.5871734942 | 3.66712627817 | 5.27875727237 | 0.0191054932188 | 0.0181158921413 | 0.00098960107748 | 0 | 0 | 0 |
| r3b-2.84-K0.03125 | 12.2259325777 | 18.8019730082 | 3.47216485208 | 5.33976033434 | 0.0187967465325 | 0.0176408390725 | 0.00115590746003 | 0 | 0 | 0 |
| r3b-2.84-K0.015625 | 10.6787180296 | 19.5688205273 | 3.03275592042 | 5.55754502975 | 0.0178731569644 | 0.0163898319809 | 0.00148332498323 | 2.41194879287e-13 | 1.34948112282e-11 | 1.94114948963e-16 |
| r3b-2.9-K0.041666666666666664 | 12.5466322391 | 18.267482526 | 3.63852334934 | 5.29756993254 | 0.0185860049199 | 0.0176648267523 | 0.000921178167574 | 0 | 0 | 0 |
| r3b-2.9-K0.03125 | 11.9059081436 | 18.4766745329 | 3.45271336165 | 5.35823561453 | 0.0182979826941 | 0.0172171699893 | 0.00108081270487 | 0 | 0 | 0 |
| r3b-2.9-K0.015625 | 10.4359511388 | 19.2222069608 | 3.02642583025 | 5.57444001862 | 0.0174286219387 | 0.0160235335691 | 0.00140508836958 | 0 | 0 | 0 |

| 运行 | 总体 min/d_e | waleSpacing（对数；min/d_e） | courseSpacing（对数；min/d_e） | diagonal（对数；min/d_e） | sameLoop（对数；min/d_e） | 势垒支撑区 | 初值来源 | 完整结果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| reused-r3a-2.77-K0.25 | 0.892224273369 | 19; 0.897424926917 | 166; 0.892224273369 | 36; 0.894440285902 | 19; 0.897424867136 | false | C:\Users\liuchen\Documents\KnitScape\archives\r2-slope-2026-11-25\R2-3\qc-2.77-K0.5-result.json | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.77-K0.25-result.json |
| reused-r3a-2.84-K0.25 | 0.902307755589 | 18; 0.911186250075 | 167; 0.902307755589 | 19; 0.934061077148 | 18; 0.911186281218 | false | C:\Users\liuchen\Documents\KnitScape\archives\r2-slope-2026-11-25\R2-3\qc-2.84-K0.5-result.json | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-1\r3a-2.84-K0.25-result.json |
| reused-r3a-2.9-K0.25 | 0.910307023487 | 14; 0.92809186426 | 146; 0.910307023487 | 18; 0.923761803862 | 14; 0.928091859573 | false | C:\Users\liuchen\Documents\KnitScape\archives\r2-slope-2026-11-25\R2-3\qc-2.9-K0.5-result.json | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.9-K0.25-result.json |
| reused-r3a-2.77-K0.125 | 0.847601931744 | 19; 0.907737412504 | 195; 0.847601931744 | 37; 0.851463981329 | 19; 0.907737655305 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.77-K0.25-result.json | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.77-K0.125-result.json |
| reused-r3a-2.84-K0.125 | 0.86092900424 | 18; 0.925015066568 | 187; 0.86092900424 | 29; 0.871700969277 | 18; 0.925014984899 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-1\r3a-2.84-K0.25-result.json | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.84-K0.125-result.json |
| reused-r3a-2.9-K0.125-resumed | 0.869113232382 | 14; 0.940574511384 | 172; 0.869113232382 | 28; 0.878477618156 | 14; 0.940574475407 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.9-K0.25-result.json | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.9-K0.125-resumed-result.json |
| reused-r3a-2.77-K0.0625 | 0.788481820661 | 11; 0.96236985733 | 225; 0.788481820661 | 43; 0.793190652634 | 11; 0.962370067267 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.77-K0.125-result.json | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.77-K0.0625-result.json |
| reused-r3a-2.84-K0.0625 | 0.79998938582 | 4; 0.992403070009 | 219; 0.79998938582 | 39; 0.80423526811 | 4; 0.992403974767 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.84-K0.125-result.json | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.84-K0.0625-result.json |
| reused-r3a-2.9-K0.0625 | 0.80572084176 | 0; 1.04468912073 | 207; 0.80572084176 | 35; 0.810925010882 | 0; 1.04468900189 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.9-K0.125-resumed-result.json | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.9-K0.0625-result.json |
| reused-r3a-2.77-K0.022727272727272728 | 0.61244976487 | 0; 1.51617246457 | 262; 0.61244976487 | 48; 0.632569238349 | 0; 1.51617221045 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.77-K0.0625-result.json | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.77-K0.022727272727272728-result.json |
| reused-r3a-2.84-K0.022727272727272728 | 0.623860121519 | 0; 1.56740140983 | 254; 0.623860121519 | 46; 0.643201614482 | 0; 1.5674013656 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.84-K0.0625-result.json | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.84-K0.022727272727272728-result.json |
| reused-r3a-2.9-K0.022727272727272728 | 0.633304565111 | 0; 1.61241139656 | 248; 0.633304565111 | 44; 0.653012197929 | 0; 1.61241125534 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.9-K0.0625-result.json | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.9-K0.022727272727272728-result.json |
| r3b-2.77-K0.041666666666666664 | 0.729264917777 | 0; 1.14025463856 | 247; 0.729264917777 | 53; 0.731705806552 | 0; 1.14025453836 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.77-K0.0625-result.json | R3b-1/r3b-2.77-K0.041666666666666664-result.json |
| r3b-2.77-K0.03125 | 0.676332788901 | 0; 1.31747653352 | 246; 0.676332788901 | 58; 0.677957971033 | 0; 1.3174763703 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3b-transition-2026-11-26\R3b-1\r3b-2.77-K0.041666666666666664-result.json | R3b-1/r3b-2.77-K0.03125-result.json |
| r3b-2.77-K0.015625 | 0.537224629364 | 0; 1.76705075525 | 280; 0.537224629364 | 52; 0.578309315194 | 0; 1.7670507741 | true | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.77-K0.022727272727272728-result.json | R3b-1/r3b-2.77-K0.015625-result.json |
| r3b-2.84-K0.041666666666666664 | 0.737868020933 | 0; 1.19779418461 | 236; 0.737868020933 | 44; 0.743073809509 | 0; 1.1977941875 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.84-K0.0625-result.json | R3b-1/r3b-2.84-K0.041666666666666664-result.json |
| r3b-2.84-K0.03125 | 0.686385883221 | 0; 1.36990760501 | 248; 0.686385883221 | 44; 0.706084664826 | 0; 1.36990760517 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3b-transition-2026-11-26\R3b-1\r3b-2.84-K0.041666666666666664-result.json | R3b-1/r3b-2.84-K0.03125-result.json |
| r3b-2.84-K0.015625 | 0.549049214644 | 0; 1.81347023986 | 267; 0.549049214644 | 57; 0.572476354123 | 0; 1.81347019258 | true | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.84-K0.022727272727272728-result.json | R3b-1/r3b-2.84-K0.015625-result.json |
| r3b-2.9-K0.041666666666666664 | 0.746330850214 | 0; 1.2435494973 | 220; 0.746330850214 | 42; 0.748032676617 | 0; 1.24354934556 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.9-K0.0625-result.json | R3b-1/r3b-2.9-K0.041666666666666664-result.json |
| r3b-2.9-K0.03125 | 0.695112538698 | 0; 1.40943495779 | 232; 0.695112538698 | 44; 0.702805826422 | 0; 1.4094348717 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3b-transition-2026-11-26\R3b-1\r3b-2.9-K0.041666666666666664-result.json | R3b-1/r3b-2.9-K0.03125-result.json |
| r3b-2.9-K0.015625 | 0.558571488345 | 0; 1.85872694158 | 245; 0.558571488345 | 51; 0.581507005238 | 0; 1.85872698144 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.9-K0.022727272727272728-result.json | R3b-1/r3b-2.9-K0.015625-result.json |

| 方向 | K倍数 | b_wale | b_course | 接触状态 | 含剪切点 | 斜率用途 |
| --- | --- | --- | --- | --- | --- | --- |
| forward | 1/4 | -0.669361147327 | -1.29642309021 | 状态一致 | false | 可按预登记规则参与判读 |
| forward | 1/8 | -0.790144724022 | -1.15238261192 | 状态一致 | false | 可按预登记规则参与判读 |
| forward | 1/16 | -1.24972096968 | -0.92172627943 | 状态混合 | false | 斜率只作描述，不参与判读 |
| forward | 1/24 | -1.37044470469 | -0.832226244282 | 状态一致 | false | 可按预登记规则参与判读 |
| forward | 1/32 | -1.26252189043 | -0.839103143327 | 状态一致 | false | 可按预登记规则参与判读 |
| forward | 1/44 | -1.16950625859 | -0.847171074565 | 状态一致 | false | 可按预登记规则参与判读 |
| forward | 1/64 | -1.09991338756 | -0.857000398088 | 状态一致 | false | 可按预登记规则参与判读 |

| 方向 | K倍数 | 横密 ln残差（l=2.77/2.84/2.90） | 横密 SSE | 纵密 ln残差（同序） | 纵密 SSE | 2.84 横密偏差/% | 2.84 纵密偏差/% |
| --- | --- | --- | --- | --- | --- | --- | --- |
| forward | 1/4 | 0.0000634035989111 / -0.000139089755654 / 0.0000756861567428 | 2.90943708054e-8 | 0.0000287198625601 / -0.0000630033426257 / 0.0000342834800655 | 5.96960869288e-9 | 14.0077666728 | 5.50020318114 |
| forward | 1/8 | 0.0000185813272697 / -0.0000407622329659 / 0.0000221809056962 | 2.49881793697e-9 | -6.41910162358e-7 / 0.00000140817128802 / -7.66261126994e-7 | 2.98215114768e-12 | 15.5711910959 | 3.16500064959 |
| forward | 1/16 | -0.00166477294606 / 0.00365204603939 / -0.00198727309333 | 0.0000200581635832 | 0.00055257446154 / -0.00121219375802 / 0.00065961929648 | 0.00000220984985882 | 14.0800610337 | 1.67333310404 |
| forward | 1/24 | -0.0000252781129686 / 0.0000554531070249 / -0.0000301749940563 | 4.62456034027e-9 | 0.0000147350650463 / -0.0000323246098328 / 0.0000175895447869 | 1.57139462858e-9 | 6.48551246744 | 2.85712565442 |
| forward | 1/32 | -0.0000382029218526 / 0.000083806521348 / -0.0000456035994962 | 1.05626845455e-8 | 0.000026614157703 / -0.0000583840153472 / 0.0000317698576433 | 5.12633049298e-9 | 0.824249180032 | 4.04577655978 |
| forward | 1/44 | -0.0000289533403977 / 0.0000635155276738 / -0.0000345621872762 | 6.06706296518e-9 | 0.0000141325076397 / -0.0000310027674777 / 0.0000168702598393 | 1.44550503051e-9 | -5.29957136606 | 5.74532076109 |
| forward | 1/64 | -1.6645313794e-7 / 3.6515161117e-7 / -1.98698472786e-7 | 2.00523429358e-13 | 0.0000135058498394 / -0.0000296280556058 / 0.0000161222057651 | 1.3201551776e-9 | -11.9352474179 | 8.28933363684 |

拟合为三个 l 上含截距、等权 ln(密度) 对 ln(l) OLS；残差=观测 ln 密度−拟合 ln 密度。显示至多12位有效数字，判读使用未舍入值。l=2.84 偏差按100×(模型/干放松参照−1)，参照横密30.8/2.54 cm⁻¹、纵密45.9/2.54 cm⁻¹。

签名为 waleSpacing、courseSpacing、diagonal、sameLoop 中 activePairs>0 的组集合。同方向同K档三个l签名相同才是状态一致。状态混合或含剪切点（|S|/W>1e-4）的档，其斜率只作描述。

## 2. 反向链与迟滞对照

固定路径为每个 l 的 R3-a 1/44→反向1/24→反向1/16，反向运行编号以-reverse结尾。

| 运行 | 方向 | K倍数 | l/mm | 状态 | 迭代 | 耗时/s | W/mm | H/mm | S/mm | shearBranch | 签名 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r3b-2.77-K0.041666666666666664-reverse | reverse | 1/24 | 2.77 | CONVERGED | 3487 | 193.0321947 | 0.748469094576 | 0.526921657622 | 5.02515025237e-9 | false | courseSpacing + diagonal |
| r3b-2.77-K0.0625-reverse | reverse | 1/16 | 2.77 | CONVERGED | 3425 | 205.7719035 | 0.704428813105 | 0.530954556514 | -2.88967532688e-7 | false | waleSpacing + courseSpacing + diagonal + sameLoop |
| r3b-2.84-K0.041666666666666664-reverse | reverse | 1/24 | 2.84 | CONVERGED | 4150 | 272.3728389 | 0.774447408236 | 0.538006683673 | -2.93644335858e-7 | false | courseSpacing + diagonal |
| r3b-2.84-K0.0625-reverse | reverse | 1/16 | 2.84 | CONVERGED | 3175 | 88.7957591 | 0.722891696496 | 0.544269479395 | -3.30455843928e-7 | false | waleSpacing + courseSpacing + diagonal + sameLoop |
| r3b-2.9-K0.041666666666666664-reverse | reverse | 1/24 | 2.9 | CONVERGED | 3475 | 95.2635081 | 0.79702657965 | 0.547420813939 | 2.53302150968e-8 | false | courseSpacing + diagonal |
| r3b-2.9-K0.0625-reverse | reverse | 1/16 | 2.9 | CONVERGED | 5225 | 226.2466922 | 0.746224355943 | 0.553821753065 | -3.30225203764e-8 | false | courseSpacing + diagonal |

| 运行 | 横密/cm⁻¹ | 纵密/cm⁻¹ | kw | kc | E_total/N·mm | E_bending | E_contact | E_barrier | barrierFraction | 能量和相对差 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r3b-2.77-K0.041666666666666664-reverse | 13.3606050971 | 18.9781533087 | 3.70088761189 | 5.2569484665 | 0.0197449242108 | 0.0186671289193 | 0.0010777952915 | 0 | 0 | 0 |
| r3b-2.77-K0.0625-reverse | 14.1958985975 | 18.8340035457 | 3.93226391151 | 5.21701898217 | 0.0201347302846 | 0.0192519052007 | 0.000882825083827 | 0 | 0 | 0 |
| r3b-2.84-K0.041666666666666664-reverse | 12.9124326502 | 18.5871296835 | 3.66713087267 | 5.27874483011 | 0.0191054932252 | 0.018115893747 | 0.000989599478189 | 0 | 0 | 0 |
| r3b-2.84-K0.0625-reverse | 13.8333308412 | 18.3732514473 | 3.92866595891 | 5.21800341103 | 0.0194596163709 | 0.01869738033 | 0.000762236040901 | 0 | 0 | 0 |
| r3b-2.9-K0.041666666666666664-reverse | 12.5466330174 | 18.2674822465 | 3.63852357505 | 5.29756985148 | 0.0185860049204 | 0.0176648271917 | 0.000921177728721 | 0 | 0 | 0 |
| r3b-2.9-K0.0625-reverse | 13.4007955119 | 18.0563510636 | 3.88623069845 | 5.23634180845 | 0.0189149523698 | 0.0182098301546 | 0.000705122215124 | 0 | 0 | 0 |

| 运行 | 总体 min/d_e | waleSpacing（对数；min/d_e） | courseSpacing（对数；min/d_e） | diagonal（对数；min/d_e） | sameLoop（对数；min/d_e） | 势垒支撑区 | 初值来源 | 完整结果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r3b-2.77-K0.041666666666666664-reverse | 0.729264699858 | 0; 1.14025477615 | 247; 0.729264699858 | 53; 0.731706217239 | 0; 1.1402547556 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.77-K0.022727272727272728-result.json | R3b-2/r3b-2.77-K0.041666666666666664-reverse-result.json |
| r3b-2.77-K0.0625-reverse | 0.788481201094 | 11; 0.962370198359 | 225; 0.788481201094 | 43; 0.793193064537 | 11; 0.962369976878 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3b-transition-2026-11-26\R3b-2\r3b-2.77-K0.041666666666666664-reverse-result.json | R3b-2/r3b-2.77-K0.0625-reverse-result.json |
| r3b-2.84-K0.041666666666666664-reverse | 0.737910362277 | 0; 1.19766500065 | 236; 0.737910362277 | 44; 0.742904225018 | 0; 1.19766482454 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.84-K0.022727272727272728-result.json | R3b-2/r3b-2.84-K0.041666666666666664-reverse-result.json |
| r3b-2.84-K0.0625-reverse | 0.799983144437 | 4; 0.992405602464 | 219; 0.799983144437 | 39; 0.804243692471 | 4; 0.992406165604 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3b-transition-2026-11-26\R3b-2\r3b-2.84-K0.041666666666666664-reverse-result.json | R3b-2/r3b-2.84-K0.0625-reverse-result.json |
| r3b-2.9-K0.041666666666666664-reverse | 0.746330802642 | 0; 1.24354929413 | 220; 0.746330802642 | 42; 0.748033021849 | 0; 1.24354928145 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3a-stiffness-2026-11-26\R3a-2\r3a-2.9-K0.022727272727272728-result.json | R3b-2/r3b-2.9-K0.041666666666666664-reverse-result.json |
| r3b-2.9-K0.0625-reverse | 0.8057194148 | 0; 1.04469012055 | 207; 0.8057194148 | 35; 0.810926898213 | 0; 1.04469015511 | false | C:\Users\liuchen\Documents\KnitScape\archives\r3b-transition-2026-11-26\R3b-2\r3b-2.9-K0.041666666666666664-reverse-result.json | R3b-2/r3b-2.9-K0.0625-reverse-result.json |

正向对应档与反向档并列：

| 方向 | K倍数 | b_wale | b_course | 接触状态 | 含剪切点 | 斜率用途 |
| --- | --- | --- | --- | --- | --- | --- |
| forward | 1/16 | -1.24972096968 | -0.92172627943 | 状态混合 | false | 斜率只作描述，不参与判读 |
| reverse | 1/16 | -1.24972194437 | -0.921725897582 | 状态混合 | false | 斜率只作描述，不参与判读 |
| forward | 1/24 | -1.37044470469 | -0.832226244282 | 状态一致 | false | 可按预登记规则参与判读 |
| reverse | 1/24 | -1.37044186139 | -0.832230458061 | 状态一致 | false | 可按预登记规则参与判读 |

| 方向 | K倍数 | 横密 ln残差（l=2.77/2.84/2.90） | 横密 SSE | 纵密 ln残差（同序） | 纵密 SSE | 2.84 横密偏差/% | 2.84 纵密偏差/% |
| --- | --- | --- | --- | --- | --- | --- | --- |
| forward | 1/16 | -0.00166477294606 / 0.00365204603939 / -0.00198727309333 | 0.0000200581635832 | 0.00055257446154 / -0.00121219375802 / 0.00065961929648 | 0.00000220984985882 | 14.0800610337 | 1.67333310404 |
| reverse | 1/16 | -0.00166478024507 / 0.00365206205137 / -0.0019872818063 | 0.0000200583394691 | 0.000552580633648 / -0.0012122072979 / 0.000659626664251 | 0.00000220989922595 | 14.0800660282 | 1.673330449 |
| forward | 1/24 | -0.0000252781129686 / 0.0000554531070249 / -0.0000301749940563 | 4.62456034027e-9 | 0.0000147350650463 / -0.0000323246098328 / 0.0000175895447869 | 1.57139462858e-9 | 6.48551246744 | 2.85712565442 |
| reverse | 1/24 | -0.0000256472105074 / 0.0000562628037519 / -0.0000306155932446 | 4.76059704255e-9 | 0.0000154523739075 / -0.0000338981847716 / 0.0000184458108636 | 1.72811072861e-9 | 6.48564588184 | 2.85688321574 |

拟合为三个 l 上含截距、等权 ln(密度) 对 ln(l) OLS；残差=观测 ln 密度−拟合 ln 密度。显示至多12位有效数字，判读使用未舍入值。l=2.84 偏差按100×(模型/干放松参照−1)，参照横密30.8/2.54 cm⁻¹、纵密45.9/2.54 cm⁻¹。

| l/mm | K倍数 | 正向运行 | 反向运行 | \|ΔW\|/W正 | \|ΔH\|/H正 | 签名相同 | 正向签名 | 反向签名 | E正/N·mm | E反/N·mm | E反−E正 | 较低总能量 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.77 | 1/24 | r3b-2.77-K0.041666666666666664 | r3b-2.77-K0.041666666666666664-reverse | 3.13321922881e-9 | 3.89999900275e-8 | true | courseSpacing + diagonal | courseSpacing + diagonal | 0.0197449238378 | 0.0197449242108 | 3.7297360686e-10 | forward |
| 2.84 | 1/24 | r3b-2.84-K0.041666666666666664 | r3b-2.84-K0.041666666666666664-reverse | 0.0000012528862372 | 0.00000235704872809 | true | courseSpacing + diagonal | courseSpacing + diagonal | 0.0191054932188 | 0.0191054932252 | 6.38328973013e-12 | forward |
| 2.9 | 1/24 | r3b-2.9-K0.041666666666666664 | r3b-2.9-K0.041666666666666664-reverse | 6.20351320366e-8 | 1.53010747783e-8 | true | courseSpacing + diagonal | courseSpacing + diagonal | 0.0185860049199 | 0.0185860049204 | 5.47700773623e-13 | forward |
| 2.77 | 1/16 | reused-r3a-2.77-K0.0625 | r3b-2.77-K0.0625-reverse | 4.47952060604e-8 | 1.59311649737e-8 | true | waleSpacing + courseSpacing + diagonal + sameLoop | waleSpacing + courseSpacing + diagonal + sameLoop | 0.0201347303079 | 0.0201347302846 | -2.33157798624e-11 | reverse |
| 2.84 | 1/16 | reused-r3a-2.84-K0.0625 | r3b-2.84-K0.0625-reverse | 4.37811674942e-8 | 2.61134631727e-8 | true | waleSpacing + courseSpacing + diagonal + sameLoop | waleSpacing + courseSpacing + diagonal + sameLoop | 0.0194596163956 | 0.0194596163709 | -2.47375384066e-11 | reverse |
| 2.9 | 1/16 | reused-r3a-2.9-K0.0625 | r3b-2.9-K0.0625-reverse | 1.32128340701e-9 | 2.77737340752e-9 | true | courseSpacing + diagonal | courseSpacing + diagonal | 0.0189149523698 | 0.0189149523698 | -5.44599088048e-14 | reverse |

全部六对均保留；总能量和差值只作描述，不据此剔除或替换点。迟滞比较不使用斜率，不额外删去混合档或剪切档的几何/签名配对。

## 3. 判读

Q-平台：正向1/32、1/44、1/64三档均须状态一致、无剪切点，且签名均不含waleSpacing；不满足时按任务书记“不确定（状态混合）”。前提满足时Δb=max(b_wale)−min(b_wale)：≤0.15为稳定平台，≥0.30为无稳定平台，中间为不确定。稳定平台值取三档平均，仅描述。

Q-迟滞：六对全部 |ΔW|/W≤1e-4、|ΔH|/H≤1e-4且签名相同，为无迟滞；任一对 |ΔW|/W≥1e-2或签名不同，为存在迟滞或多解；其他为不确定。H的较大差异本身不是登记的迟滞阳性判据。

本阶段保留逐点结果及描述性拟合；完整判读在R3b-3交接时呈现。

## 4. 局限与来源

本结果仅适用于登记的T1 N64无摩擦普通纬平针模型与延续初值，不证明真实面料充分放松或干放松的形态。真实纱径及其他未知物性仍为UNKNOWN；诊断覆盖不升级为材料实测。只检查指定的正反向路径，不能排除未探索分支。

原输入数值设置原样沿用：N64、q=12（原输入未显式填写时保持其缺省）、maxIterations=24000、innerIterations=800、memorySize=180；不锁W/H/S。仅覆盖K，B及其余参数、容差和设置不变。

| 字段 | 记录 |
| --- | --- |
| Value | 上表及r3b-summary.json的完整精度标量与分析；物性及诊断覆盖详见下表 |
| Unit | {"l":"mm","W":"mm","H":"mm","S":"mm","energy":"N*mm","density":"1/cm","kw":"1","kc":"1","elapsedMs":"ms","ratios":"1","slope":"1","activePairs":"count","deviation":"%"} |
| Source | R3-b task §§2/4; original Hossain inputs; R3-a summary.targets result paths; per-run manifest |
| Measurement / derivation principle | Free frictionless T1 continuation; equal-weight three-point log OLS; six forward/reverse geometry and signature pairs；密度=10m/W、10n/H，本组m=n=1；kw/kc=对应密度×l/10；非实物测量 |
| Confidence | MODEL_DERIVED_DIAGNOSTIC; not a material measurement |
| Applicable state | T1 N64 frictionless plain jersey; dry-relaxed observations used only as labelled reference |

| 参数 | Value | Unit | Source | Measurement / derivation principle | Confidence | Applicable state |
| --- | --- | --- | --- | --- | --- | --- |
| 原参数 l=2.77 tex | 19.78 | tex | Hossain et al.2025 PLOS ONE e0323572; table supplied by user | Measured yarn linear density reported by user from study; no fitting | REPORTED_MEASUREMENT | Combed cotton single yarn; fabric dry-relaxed48h at22C/67%RH |
| 原参数 l=2.77 densityGPerCm3 | 1.31 | g/cm^3 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.77 fiberDiameterMm | 0.021 | mm | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.77 E_f | 3000 | N/mm^2 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.77 K | 0.01 | 1 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.77 phi0 | 0.5 | 1 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.77 d_s | 0.13865404857744756 | mm | Derived from tex, densityGPerCm3 | sqrt(4 * tex / (pi * densityGPerCm3 * 1000)) | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.77 fiberTex | 0.4537323729763399 | tex | Derived from densityGPerCm3, fiberDiameterMm | densityGPerCm3 * 1000 * pi * fiberDiameterMm^2 / 4 | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.77 d_e | 0.1960864359761643 | mm | Derived from d_s, phi0 | d_s / sqrt(phi0) | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.77 r_c | 0.09804321798808215 | mm | Derived from phi0, d_e | phi0 * d_e; uniaxial compaction model | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.77 N_f | 43.59398001568523 | 1 | Derived from tex, fiberTex | tex / fiberTex; continuum fiber count estimate | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.77 B | 0.0012485181297709927 | N*mm^2 | Derived from N_f, E_f, fiberDiameterMm | N_f * E_f * pi * fiberDiameterMm^4 / 64; freely sliding fibers | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.84 tex | 19.78 | tex | Hossain et al.2025 PLOS ONE e0323572; table supplied by user | Measured yarn linear density reported by user from study; no fitting | REPORTED_MEASUREMENT | Combed cotton single yarn; fabric dry-relaxed48h at22C/67%RH |
| 原参数 l=2.84 densityGPerCm3 | 1.31 | g/cm^3 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.84 fiberDiameterMm | 0.021 | mm | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.84 E_f | 3000 | N/mm^2 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.84 K | 0.01 | 1 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.84 phi0 | 0.5 | 1 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.84 d_s | 0.13865404857744756 | mm | Derived from tex, densityGPerCm3 | sqrt(4 * tex / (pi * densityGPerCm3 * 1000)) | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.84 fiberTex | 0.4537323729763399 | tex | Derived from densityGPerCm3, fiberDiameterMm | densityGPerCm3 * 1000 * pi * fiberDiameterMm^2 / 4 | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.84 d_e | 0.1960864359761643 | mm | Derived from d_s, phi0 | d_s / sqrt(phi0) | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.84 r_c | 0.09804321798808215 | mm | Derived from phi0, d_e | phi0 * d_e; uniaxial compaction model | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.84 N_f | 43.59398001568523 | 1 | Derived from tex, fiberTex | tex / fiberTex; continuum fiber count estimate | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.84 B | 0.0012485181297709927 | N*mm^2 | Derived from N_f, E_f, fiberDiameterMm | N_f * E_f * pi * fiberDiameterMm^4 / 64; freely sliding fibers | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.9 tex | 19.78 | tex | Hossain et al.2025 PLOS ONE e0323572; table supplied by user | Measured yarn linear density reported by user from study; no fitting | REPORTED_MEASUREMENT | Combed cotton single yarn; fabric dry-relaxed48h at22C/67%RH |
| 原参数 l=2.9 densityGPerCm3 | 1.31 | g/cm^3 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.9 fiberDiameterMm | 0.021 | mm | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.9 E_f | 3000 | N/mm^2 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.9 K | 0.01 | 1 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.9 phi0 | 0.5 | 1 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| 原参数 l=2.9 d_s | 0.13865404857744756 | mm | Derived from tex, densityGPerCm3 | sqrt(4 * tex / (pi * densityGPerCm3 * 1000)) | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.9 fiberTex | 0.4537323729763399 | tex | Derived from densityGPerCm3, fiberDiameterMm | densityGPerCm3 * 1000 * pi * fiberDiameterMm^2 / 4 | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.9 d_e | 0.1960864359761643 | mm | Derived from d_s, phi0 | d_s / sqrt(phi0) | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.9 r_c | 0.09804321798808215 | mm | Derived from phi0, d_e | phi0 * d_e; uniaxial compaction model | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.9 N_f | 43.59398001568523 | 1 | Derived from tex, fiberTex | tex / fiberTex; continuum fiber count estimate | DERIVED | Inherits the states and uncertainty of all dependencies |
| 原参数 l=2.9 B | 0.0012485181297709927 | N*mm^2 | Derived from N_f, E_f, fiberDiameterMm | N_f * E_f * pi * fiberDiameterMm^4 / 64; freely sliding fibers | DERIVED | Inherits the states and uncertainty of all dependencies |

| 运行覆盖 | Value | Unit | Source | Measurement / derivation principle | Confidence | Applicable state |
| --- | --- | --- | --- | --- | --- | --- |
| r3b-2.77-K0.041666666666666664 | 0.00041666666666666664 | 1 | R3-b task §4 | K scaled by 0.041666666666666664; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.77-K0.03125 | 0.0003125 | 1 | R3-b task §4 | K scaled by 0.03125; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.77-K0.015625 | 0.00015625 | 1 | R3-b task §4 | K scaled by 0.015625; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.84-K0.041666666666666664 | 0.00041666666666666664 | 1 | R3-b task §4 | K scaled by 0.041666666666666664; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.84-K0.03125 | 0.0003125 | 1 | R3-b task §4 | K scaled by 0.03125; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.84-K0.015625 | 0.00015625 | 1 | R3-b task §4 | K scaled by 0.015625; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.9-K0.041666666666666664 | 0.00041666666666666664 | 1 | R3-b task §4 | K scaled by 0.041666666666666664; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.9-K0.03125 | 0.0003125 | 1 | R3-b task §4 | K scaled by 0.03125; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.9-K0.015625 | 0.00015625 | 1 | R3-b task §4 | K scaled by 0.015625; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.77-K0.041666666666666664-reverse | 0.00041666666666666664 | 1 | R3-b task §4 | K scaled by 0.041666666666666664; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.77-K0.0625-reverse | 0.000625 | 1 | R3-b task §4 | K scaled by 0.0625; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.84-K0.041666666666666664-reverse | 0.00041666666666666664 | 1 | R3-b task §4 | K scaled by 0.041666666666666664; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.84-K0.0625-reverse | 0.000625 | 1 | R3-b task §4 | K scaled by 0.0625; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.9-K0.041666666666666664-reverse | 0.00041666666666666664 | 1 | R3-b task §4 | K scaled by 0.041666666666666664; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |
| r3b-2.9-K0.0625-reverse | 0.000625 | 1 | R3-b task §4 | K scaled by 0.0625; B unchanged; diagnostic only | DIAGNOSTIC_OVERRIDE | R3-b contact-transition diagnosis; not a material value |

研究状态：COMPLETE；累计计预算求解15/45，实际调用15，中断恢复记录0条。已完成点不重算，单目标仅允许直接失败后几何中点+一次目标重试；中断无终态调用不计入45次。

完整结果、原输入、manifest及日志根目录：C:/Users/liuchen/Documents/KnitScape/archives/r3b-transition-2026-11-26。逐次manifest记录HEAD、运行环境、时间、输入SHA-256、初值来源及K覆盖六字段。仅对新输入做登记的SHA-256；没有额外文件哈希、结果双跑或性能测量。

本报告渲染不运行验证或求解。各步实际validate/build数字及证据由执行者在相应提交正文记录，不把既有历史通过记录当成本步验收。

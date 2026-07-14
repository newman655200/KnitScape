// 针法操作类型。这里的字母来自 Pattern / ProcessModel 生成的内部组织数据。
const KNIT = "K";
const PURL = "P";
const TUCK = "T";
const MISS = "M";

// Contact Neighborhood 的实际化状态：
// ECN: empty contact node，空接触点；
// PCN: potential contact node，潜在接触点；
// ACN: actualized contact node，已经实际成环/锚定的接触点；
// UACN: unanchored actualized contact node，暂未锚定但可能被后续针法拉住的接触点。
const ECN = "ECN";
const PCN = "PCN";
const ACN = "ACN";
const UACN = "UACN";

function followTheYarn(DS) {
  // 沿着 ProcessModel 生成的 contact-neighborhood 网格追踪纱线路径。
  // 返回的 yarnPath 是一串 [i, j, stitchRow, nodeType]，后续会转成渲染链接。
  let i = 0,
    j = 0,
    legNode = true,
    currentStitchRow = 0;
  const yarnPath = [];

  // DS.height 比真实组织行多 1，因为 contact-neighborhood 包含上方接触行。
  while (j < DS.height) {
    // 织造方向按行交替：偶数行从左到右，奇数行从右到左。
    const movingRight = currentStitchRow % 2 == 0;
    // contact-neighborhood 中每个针位占两个 i 位置，因此奇偶决定当前是左/右侧节点。
    const evenI = i % 2 == 0;
    // F/L 不是物理左右，而是沿纱线前进方向的 first/last，用于组成 FL/FH/LL/LH。
    const side = movingRight === evenI ? "F" : "L";

    // 只有实际需要绘制的接触点才进入 yarnPath。
    if (addToList(i, j, legNode, yarnPath, DS)) {
      let location;
      if (legNode) {
        // leg node 是当前行的腿部节点，位置固定在当前 contact-neighborhood 坐标。
        location = [i, j, currentStitchRow, side + "L"];
      } else {
        // head node 可能被 tuck / miss 等操作向上或横向移动，需要解析最终落点。
        const final = finalLocation(i, j, DS);

        location = [final.i, final.j, currentStitchRow, side + "H"];
      }

      yarnPath.push(location);
    }

    // 按蛇形顺序移动到下一个 contact node。
    ({ i, j, legNode, currentStitchRow } = nextCN(
      i,
      j,
      legNode,
      currentStitchRow,
      DS
    ));
  }

  return yarnPath;
}

function addToList(i, j, legNode, yarnPath, DS) {
  // 判断当前 contact node 是否应该加入纱线路径。
  if (legNode) {
    // 腿部节点只在普通 knit / purl 成圈时参与绘制。
    return DS.getST(i, j) == KNIT || DS.getST(i, j) == PURL;
  } else {
    // 头部节点由 actualization value 决定是否已经形成有效接触点。
    let AV = DS.getAV(i, j);

    if (AV == ECN) {
      // 空接触点没有可绘制纱线路径。
      return false;
    } else if (AV == UACN) {
      // UACN 需要判断它最终是否被上方或后续路径锚定。
      let m, n, row, part;
      if (i % 2 != j % 2) {
        // 奇偶不同表示当前判断要参考已经走过的上一段纱线路径。
        [m, n, row, part] = yarnPath.at(-1);
      } else {
        // 奇偶相同则向前预看下一个 contact node，判断这段纱线会不会被拉到更高处。
        const check = nextCN(i, j, legNode, j - 1, DS);
        m = check.i;
        n = check.j;
      }

      // 计算当前头部节点在最终 yarn grid 中实际落到的位置。
      const final = finalLocation(i, j, DS);

      if (n < final.j) {
        // 如果预看/回看位置低于最终位置，说明当前 CN 已被锚定，可以参与绘制。
        DS.setAV(i, j, ACN);
        return true;
      } else {
        // 否则它仍是未锚定状态，不加入路径。
        return false;
      }
    } else {
      // ACN 或 PCN 都是有效接触点，需要加入纱线路径。
      return true;
    }
  }
}

function finalLocation(i, j, DS) {
  // 根据 contact node 的 movement vector，找到 ACN 在最终 yarn grid 中的位置。
  const [di, dj] = DS.getMV(i, j);

  if (j == DS.height - 1) {
    // 顶部边界已经没有更高的 contact row，直接使用当前位置。
    return { i, j };
  } else if (di != 0) {
    // 横向移动优先处理，例如某些节点被相邻针位接走。
    return finalLocationRecursive(i + di, j, DS);
  } else {
    // 没有横向移动时，沿 deltaJ 继续向上/下查找实际成圈位置。
    return finalLocationRecursive(i, j + dj, DS);
  }
}

function finalLocationRecursive(i, j, DS) {
  // 递归追踪 movement vector，直到找到真实 knit / purl 成圈点或顶部边界。
  if (DS.getST(i, j) == KNIT || DS.getST(i, j) == PURL) {
    // 当前 contact node 已经由 knit / purl 实际成圈，作为最终位置。
    return { i, j };
  } else if (j == DS.height - 1) {
    // 追踪到顶部边界时停止，避免继续越界。
    return { i, j };
  } else {
    // tuck / miss 等非普通成圈位置继续沿 deltaJ 查找最终锚点。
    return finalLocationRecursive(i, j + DS.getDeltaJ(i, j), DS);
  }
}

// function acnsAt(i, J, DS) {
//   // 预留思路：查找哪些 ACN 最终落在 contact-neighborhood 的 (i, j) 位置。
//   const ACNList = [];
//   // 原思路是遍历 contact-neighborhood，并检查 movement vector 是否指向目标位置。
// }

function nextCN(i, j, legNode, currentStitchRow, DS) {
  // 计算蛇形路径中的下一个 contact node。
  // 每一行模拟针织机车方向交替：一行向右，下一行向左。
  const movingRight = currentStitchRow % 2 == 0;
  const evenI = i % 2 == 0;

  let iNext = i;
  let jNext = j;
  let nextLegNode = legNode;

  if (legNode) {
    // 当前位于腿部节点：下一步可能去同针位头部，也可能去相邻针位腿部。
    if (movingRight) {
      if (evenI) {
        // 向右行进时，左腿先向上连接到头部。
        jNext = j + 1;
        nextLegNode = false;
      } else {
        // 向右行进时，右腿继续走到右侧下一个腿部节点。
        iNext = i + 1;
      }
    } else {
      // 当前行向左行进。
      if (evenI) {
        // 向左行进时，左腿继续走到左侧下一个腿部节点。
        iNext = i - 1;
      } else {
        // 向左行进时，右腿向上连接到头部。
        jNext = j + 1;
        nextLegNode = false;
      }
    }
  } else {
    // 当前位于头部节点：下一步可能沿头部横向走，也可能向下回到腿部。
    if (movingRight) {
      if (evenI) {
        // 向右行进时，左头部横向走到右头部。
        iNext = i + 1;
      } else {
        // 向右行进时，右头部向下回到腿部。
        jNext = j - 1;
        nextLegNode = true;
      }
    } else {
      // 当前行向左行进。
      if (evenI) {
        // 向左行进时，左头部向下回到腿部。
        jNext = j - 1;
        nextLegNode = true;
      } else {
        // 向左行进时，右头部横向走到左头部。
        iNext = i - 1;
      }
    }
  }

  if (iNext < 0 || iNext >= DS.width) {
    // 到达左右边界后，上移一层并切换到下一 stitch row。
    return {
      i: i,
      j: j + 1,
      legNode: true,
      currentStitchRow: currentStitchRow + 1,
    };
  }

  return {
    i: iNext,
    j: jNext,
    legNode: nextLegNode,
    currentStitchRow: currentStitchRow,
  };
}

function calcLayer(nodes, source, target, linkType) {
  // 根据源/目标针法和链接类型决定这段线画在 front / mid / back 哪一层。
  // knit 与 purl 的前后关系相反；混合针法使用 mid，避免强行表达前后穿插。
  if (nodes[source].st == "K" && nodes[target].st == "K") {
    // knit 普通成圈：LHLL / FLFH 这两类段在前层，其余在后层。
    if (linkType == "LHLL" || linkType == "FLFH") return "front";
    else return "back";
  } else if (nodes[source].st == "P" && nodes[target].st == "P") {
    // purl 普通成圈与 knit 的前后层级相反。
    if (linkType == "LHLL" || linkType == "FLFH") return "back";
    else return "front";
  } else return "mid";
}

export class YarnModel {
  constructor(cns) {
    // YarnModel 接收 ProcessModel 生成的 contact-neighborhood，
    // 将它转换成后续 yarnSimulation 可绘制的节点和链接。
    this.width = cns.width;
    this.height = cns.height;
    this.cns = cns;

    // 扁平化保存所有 contact node，保留 stitch type、actualization value 和 movement vector。
    this.contactNodes = cns.contacts.map((cn, i) => {
      return {
        index: i,
        st: cn[0],
        cn: cn[1],
        mv: cn[2],
      };
    });

    // 生成沿纱线前进方向排列的关键 contact node 路径。
    this.yarnPath = followTheYarn(cns);
  }

  yarnPathToLinks() {
    // 把 yarnPath 中相邻节点转换成可绘制的 link。
    // 每个 link 会记录源点、目标点、所在行、绘制顺序和前/中/后层级。
    let source = 0;
    let last = this.yarnPath[0][3];
    const links = [];

    this.yarnPath.forEach(([i, j, stitchRow, headOrLeg], index) => {
      // 第一个路径点没有前驱节点，因此不能形成 link。
      if (index == 0) return;

      // contact-neighborhood 使用一维数组保存节点，这里把二维坐标转回扁平索引。
      let target = j * this.width + i;
      // linkType 由上一节点类型和当前节点类型拼接而成，例如 FLFH、LHLL。
      let linkType = last + headOrLeg;

      links.push({
        source: source,
        target: target,
        linkType,
        row: stitchRow,
        index: index - 1,
        layer: calcLayer(this.contactNodes, source, target, linkType),
      });

      // 当前节点成为下一段 link 的 source。
      source = target;
      last = headOrLeg;
    });

    return links;
  }

  makeNice() {
    // 将 yarnPath 转为 yarnSimulation 更容易消费的对象结构。
    // cnIndex 对应 contactNodes 的扁平索引；cnType 保留 FL/FH/LL/LH 类型。
    return this.yarnPath.map(([i, j, stitchRow, headOrLeg]) => {
      return {
        cnIndex: j * this.width + i,
        i: i,
        j: j,
        row: stitchRow,
        cnType: headOrLeg,
        angle: null,
        normal: [0, 0],
      };
    });
  }
}

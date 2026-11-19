import { buildParallelTransportFrames } from './yarnParallelTransport.js';
import { buildYarnTubeGeometry } from './yarnTubeGeometry.js';
import { createSpatialCurve } from './yarnSpatialPath.js';
import { integrateSpatialSegment, measureSpatialLength } from './yarnSpatialLength.js';
import { normalize } from './yarnSpatialMath.js';
import { SOP_INTERLOCK_LAYOUT } from './sopInterlockCurve.js';

export const SOP_SWATCH_FORM = Object.freeze({
  evidenceStatus: 'VISUAL_ASSUMPTION', applicableState: 'DISPLAY_ONLY_UNCALIBRATED',
  source: 'Neutral 4-by-8 SOP clearance and Catmull curvature fit at open edges and interior. A display-only depth-dependent shoulder adjustment is fit to the two photographs. Each yarn slot is swept at a fixed circular radius.',
  columnPitch: SOP_INTERLOCK_LAYOUT.columnPitch, courseStep: SOP_INTERLOCK_LAYOUT.courseStep * .72,
  openEdge: Object.freeze({supportCourses: 8, rampCourses: 3, lateralPerDepth: 0.085, depthScaleChange: 0.085}),
  courseScale: .72, depthScale: 1.35, depthSpan: .20, lateralLay: .75, mainRadiusScale: 1.4, platedRadiusScale: 1,
  units: { dimensionless: 'courseScale, depthScale, lateralLay, mainRadiusScale, platedRadiusScale', displayLength: 'columnPitch, courseStep, depthSpan, periodic XYZ coefficient triples' },
});
const form = SOP_SWATCH_FORM;
const walePhase = 2*Math.PI/(4*form.columnPitch), coursePhase = -6*Math.PI/(8*form.courseStep);
export function reverseLayPhaseFor(operations, width, height, repeatWidth, repeatHeight) {
  if (repeatWidth !== 4 || repeatHeight !== 8 || width < 4 || height < 8) return null;
  const tucks = [];
  for (let row = 0; row < 8; row++) {
    const needles = [0, 1, 2, 3].filter(needle => operations.get(row * width + needle)?.operation === 'T');
    if (needles.length !== 1) return null;
    tucks.push(needles[0]);
  }
  if (!tucks.every((needle, row) => (needle + 1) % 4 === tucks[(row + 6) % 8])) return null;
  const first = tucks.findIndex((needle, row) => needle !== tucks[(row + 7) % 8] && needle === tucks[(row + 1) % 8]);
  if (first < 0) return null;
  for (const { row, needle, operation } of operations.values()) {
    if (operation !== (needle % 4 === tucks[row % 8] ? 'T' : 'K')) return null;
  }
  return 1.5 * Math.PI - walePhase * (tucks[first] - 3) * form.columnPitch - coursePhase * first * form.courseStep;
}

// Display-length XYZ coefficients follow the two resolved course phases and two yarn slots.
// Reproduce the neutral clearance fit with archives/swatch-reverse-20261119/fit-round-layout.py --clear16.
// Input is the reference cubic controls and the original visual tube. These coefficients
// describe this particular 4 x 8 display layout and carry no measured material properties.
const corrections = [
  [ // first phase, main yarn
    [0, 0, 0],
    [-0.005950197, 0.0016505309, 0],
    [0, 0, -0.0015634887],
    [-0.0060559692, -0.0025435837, 0],
    [0, 0.0033425188, 0],
    [-0.0003419655, 0.0043770331, 0],
    [0, 0.0072864672, -0.0012889449],
    [-0.000569266, 0.0116288039, 0.0004663934],
    [0, 0, 0],
    [0.0006342803, -0.0034846729, -0.0027676418],
  ],
  [ // first phase, plated yarn
    [0, -0.003686512, 0],
    [0.0004379606, 0, 0],
    [0, 0, 0],
    [0, -0.0017642628, 0.0103311812],
    [0, 0, 0],
    [-0.0010710689, -0.0075132633, 0],
    [0.0013746195, 0.0027734764, 0],
    [-5.73993e-05, 0.0091464161, 0],
    [0, 0, -0.0011903513],
    [0, -0.0032673675, -0.0035032663],
  ],
  [ // second phase, main yarn
    [0, 0.0093161694, 0],
    [0.0011410921, 0.0078977981, 0.0072687645],
    [0, 0.0002508562, -0.0037880902],
    [0, -0.0059985205, 0.0103207226],
    [0.0089953517, 0.0063460628, 0.0115415918],
    [-0.0063448067, 0.0125657966, 0],
    [0.0006268589, -0.0033428169, -0.0081710628],
    [0.0060610177, -0.0010906797, 0.0007477666],
    [0.0017994859, -0.0012084472, 0],
    [0, -0.0028421892, -0.0047223257],
  ],
  [ // second phase, plated yarn
    [0, 0, -0.001214875],
    [0.0048368003, 0.0033000728, 0],
    [0, -0.0035647742, 0],
    [0.0025739736, 0, 0.0198706432],
    [0, 0, 0],
    [0, 0.0078213074, 0],
    [0.0005263844, 0.001179424, 0],
    [0.0013927772, 0.0093550216, -0.0017172242],
    [0, 0, 0],
    [0, -0.0079229832, -0.0106922538],
  ],
];

function check(result) {
  if (result.status !== 'OK') throw Error('Invalid formed yarn: ' + JSON.stringify(result.diagnostics));
  return result;
}

function smoothTightBends(controls, radius) {
  const original = controls;
  // Smooth just the few controls adjacent to tight curvature maxima. The
  // chord-length weights give zero displacement on a nonuniform straight leg.
  for (let pass = 0; pass < 35; pass++) {
    const curve = check(createSpatialCurve({ type: 'catmull-rom', points: controls, unit: 'mm' })).curve;
    const weights = new Float64Array(controls.length);
    let maxBend = 0;
    for (const [i, seg] of curve.segments.entries()) {
      const d0 = seg.derivative(0), dm = seg.derivative(.5), d1 = seg.derivative(1);
      const a = d0.map((v,k) => 2*(d1[k] + v - 2*dm[k]));
      const b = d0.map((v,k) => d1[k] - v - a[k]);
      let bend = 0;
      for (let n=0; n<=8; n++) {
        const u=n*(.9999999/8), v=seg.derivative(u);
        const e=a.map((v,k)=>2*v*u+b[k]);
        const area=Math.hypot(v[1]*e[2]-v[2]*e[1], v[2]*e[0]-v[0]*e[2], v[0]*e[1]-v[1]*e[0]);
        bend=Math.max(bend,radius*area/Math.hypot(...v)**3);
      }
      maxBend=Math.max(maxBend,bend);
      const w=Math.min(1,Math.max(0,(bend-.68)/.26));
      for (let n=Math.max(0,i-1); n<=Math.min(i+2,controls.length-1); n++) weights[n]=Math.max(weights[n],w);
    }
    if (maxBend < .90) return controls;
    controls=controls.map((c,i)=>{
      if (!weights[i] || i===0 || i===controls.length-1) return c;
      const prev=controls[i-1], next=controls[i+1];
      const left=Math.hypot(...c.map((v,k)=>v-prev[k])),right=Math.hypot(...c.map((v,k)=>next[k]-v));
      return c.map((v,k)=>v+.36*weights[i]*((next[k]-v)/right-(v-prev[k])/left)*right*left/(left+right));
    });
  }
  return relaxCurvature(original, radius);
}

function relaxCurvature(referenceControls, radius) {
  const controls = referenceControls.map(point => point.slice());
  for (let pass = 0; pass < 100; pass++) {
    const curve = check(createSpatialCurve({ type: 'catmull-rom', points: controls, unit: 'mm' })).curve;
    const shifts = controls.map(() => [0, 0, 0, 0]);
    let maxBend = 0;
    for (const [index, seg] of curve.segments.entries()) {
      const d0 = seg.derivative(0), dm = seg.derivative(.5), d1 = seg.derivative(1);
      const a = d0.map((v, k) => 2 * (d1[k] + v - 2 * dm[k]));
      const b = d0.map((v, k) => d1[k] - v - a[k]);
      let peak = 0, gradient;
      for (let sample = 0; sample <= 8; sample++) {
        const u = sample * .99999999 / 8, v = seg.derivative(u), speed = Math.hypot(...v);
        const t = v.map(value => value / speed), acc = a.map((value, k) => 2 * value * u + b[k]);
        const along = acc.reduce((sum, value, k) => sum + value*t[k], 0);
        const normal = acc.map((value, k) => value - along*t[k]);
        const magnitude = Math.hypot(...normal), curvature = magnitude / (speed*speed);
        if (curvature*radius <= peak) continue;
        peak = curvature * radius;
        if (peak < .89) continue;
        const gAcceleration = normal.map(value => value / (magnitude*speed*speed));
        const gVelocity = t.map((value, k) => -2*curvature*value/speed - along*gAcceleration[k]/speed);
        const sq = u*u, g1 = [-.5+2*u-1.5*sq, -5*u+4.5*sq, .5+4*u-4.5*sq, -u+1.5*sq];
        const g2 = [2-3*u, -5+9*u, 4-9*u, -1+3*u];
        gradient = g1.map((value, j) => gVelocity.map((v, k) => radius*(v*value + gAcceleration[k]*g2[j])));
      }
      maxBend = Math.max(maxBend, peak);
      if (!gradient || peak <= .89) continue;
      let sumSq = 0;
      for (let j=0; j<4; j++) if (index+j>1 && index+j<controls.length)
        sumSq += gradient[j].reduce((sum,v)=>sum+v*v,0);
      for (let j=0; j<4; j++) {
        const i=index+j-1;
        if (i<=0 || i>=controls.length-1 || sumSq===0) continue;
        for (let k=0; k<3; k++) shifts[i][k] -= (peak-.87)*gradient[j][k]/sumSq;
        shifts[i][3]++;
      }
    }
    if (maxBend < .93) return controls;
    for (let i=1; i<controls.length-1; i++) {
      if (!shifts[i][3]) continue;
      for (let k=0; k<3; k++) controls[i][k] += .67 * shifts[i][k] / shifts[i][3];
    }
  }
  throw Error('Formed yarn exceeds its displayed circular bend radius.');
}

// Neutral thick-main-yarn fit. Each triple is an XYZ offset in display units.
const packingTerms = [
  [ // first phase, main yarn
    [0.0044200008, -0.006870681, 0.0067591556],
    [-0.0095022298, 0.0089824997, 0.0075801772],
    [0.0096408333, 0.0128508315, -0.0038380695],
    [0.013404159, 0.0028595123, 0.0052464763],
    [0.0060806552, 0.0167036541, -0.01793049],
    [-0.0775266554, 0.0266520937, 0.0010935601],
    [-0.0011870394, -0.0014495565, 0.0001091234],
    [0.0040068651, -0.0003868883, -0.0062874496],
    [-0.0013517439, -0.0127848187, 0.0106910448],
    [-0.0110873645, -0.001395794, -0.0169216375],
    [-0.0122955028, 0.0046601447, 0.0030319018],
    [0.0104726446, -0.0143184756, -0.0104999701],
    [-0.0008899023, -0.0019491259, 0.0149944358],
    [-0.0163556907, 0.0032666631, 0.0137856081],
    [0.0019808452, -0.0109557586, 0.0075349117],
    [0.0079894221, 0.033944715, 0.0296945063],
  ],
  [ // first phase, plated yarn
    [0.0014111521, -0.0018123502, -0.0072593532],
    [-0.0086345302, -0.0286562272, -0.0265076372],
    [0.007492612, 0.0059899672, 0.028961734],
    [-0.0099100926, -0.0044228867, -0.005134381],
    [-0.0106001199, 0.0197726638, -0.0037115166],
    [-0.0807380659, 0.0089151965, -0.0076811802],
    [-0.0016510866, 0.0105806411, -0.0007507874],
    [-0.0005430128, -0.0012354322, 0.0152409425],
    [0.0071276227, 0.00179964, 0.0007321893],
    [-0.008147789, 0.0001778454, -0.0274842787],
    [0.0031869964, 0.0266729803, -0.006347798],
    [0.0094970845, 0.0284596257, 0.0083701576],
    [-0.0035647308, -0.0039861187, 0.0115707926],
    [0.0026992843, -0.0325172674, -0.0332711776],
    [0.0079773697, -0.0177622714, 0.0047609477],
    [-0.0027631896, 0.0064184517, 0.0098338407],
  ],
  [ // second phase, main yarn
    [-0.0052251634, -0.0168765577, -0.0004871724],
    [-0.0078107223, 0.0062934061, 0.0017382046],
    [0.007400536, -0.0368079765, -0.0347261762],
    [0.0043151796, 0.0102067218, -0.0127333507],
    [-0.0037930332, 0.0096676682, -0.0297081157],
    [-0.0450442697, 0.0024146891, 0.0024824419],
    [0.0196989105, -0.0023216504, -0.0010279945],
    [0.0056764996, 0.0109198861, 0.0026153351],
    [0.0041806252, 0.0079783185, 0.0073768519],
    [0.0059151183, -0.0380223509, -0.067863636],
    [-0.0038299554, 0.022896217, 0.0103348014],
    [0.0079340981, -0.0507116771, -0.0012857008],
    [0.0074203287, 0.0021965388, -0.0062724741],
    [-0.0064903442, 0.00030795, 0.021262203],
    [-0.0096893705, -0.0238949645, -0.0288303823],
    [-0.0112979289, 0.0126544711, 0.0213577126],
  ],
  [ // second phase, plated yarn
    [0.0007640656, 0.01154264, 0.0022479672],
    [-0.0093280207, -0.0185039389, -0.0217482302],
    [-0.0205128456, -0.0175250261, 0.0171717378],
    [-0.0124948417, -0.0054701336, -0.0213851667],
    [-0.0034897368, 0.0329584179, 0.0008405381],
    [-0.0624443195, -0.0143631184, -0.004183949],
    [0.0161440079, 0.0013934304, 0.0006108132],
    [-0.0054930061, -0.010178499, 0.0088661651],
    [0.0151972284, 0.0080526986, -0.017065924],
    [0.0038697189, -0.0099560938, -0.016633495],
    [-0.0011776749, -0.0013997307, 0.0190866408],
    [0.0081322859, 0.0236796536, 0.006052188],
    [-0.0013932087, -0.0068411336, 0.0149119444],
    [0.0017636571, -0.0141143859, -0.0047815947],
    [-0.0077149363, -0.0110444232, -0.0156708234],
    [-0.018892434, -0.0055486539, 0.0075614249],
  ],
];
function widenControls(points, referenceControls, sourceRow, row, yarnIndex, termTable=packingTerms, depthGain=.03) {
  const terms = termTable[2*((row%2+2)%2)+yarnIndex];
  return points.map((point, i) => {
    const [x,y,z] = referenceControls[i], column=x/form.columnPitch;
    const angle=2*Math.PI*column, grid=2*Math.PI*(y/SOP_INTERLOCK_LAYOUT.courseStep-sourceRow);
    const phase=Math.PI/2*(column+row/2), s=Math.sin(angle), c=Math.cos(angle), sp=Math.sin(phase), cp=Math.cos(phase);
    const zn=z/form.depthSpan;
    const features=[1,s,c,Math.sin(2*angle),Math.cos(2*angle),zn,Math.sin(grid),Math.cos(grid),sp,cp,zn*s,zn*c,cp*s,sp*s,cp*c,sp*c];
    const target=[point[0],point[1],point[2]+depthGain*z];
    for (let n=0;n<terms.length;n++) for(let k=0;k<3;k++) target[k]+=terms[n][k]*features[n];
    return target;
  });
}

// Extra neutral clearance fit after the neighboring shoulders have been repositioned.
const shoulderClearance=[
  [ // first phase, main yarn
    [0.0014218732, -0.0018271908, 0.0003195667],
    [-0.0021314871, 0.0015513652, 0.0014953503],
    [0.0004873151, -0.0032557283, 0.0020635899],
    [0.0009976945, 0.0016069877, -0.0049549845],
    [-0.0008279402, -0.0025041901, 0.0031245592],
    [-0.0030731157, -0.0010606636, 0.0076238158],
    [0.0008109833, 0.0017802252, -0.002337529],
    [0.0017963049, 0.0006019902, -0.0008398552],
    [0.0033166716, -0.0002882603, -0.0081989618],
    [-0.0004079253, -0.0004037169, -0.0064415667],
    [0.0064355516, 0.0002271375, -0.000804731],
    [-0.0009463661, -0.0022164244, 0.0037447657],
    [-0.0075639392, -0.0003950026, 0.0024305254],
    [-0.0032252625, 0.0012336296, 0.0056000358],
    [-0.0029877099, -0.0052951023, -0.0046970848],
    [0.0031598232, 9.13477e-05, -0.0018911403],
  ],
  [ // first phase, plated yarn
    [0.0020623251, 0.0001004189, 0.0052062424],
    [0.001241276, 0.0009830116, -0.0033039932],
    [-0.000999659, -1.63e-08, -0.0021973553],
    [-0.0020374771, -0.0004412466, -0.0013941039],
    [-0.0004455976, -0.0012662428, 0.0063515107],
    [-0.0073773049, -0.0018675054, 0.0087326541],
    [0.0037199078, 0.0018476606, -0.0011855043],
    [-0.0013603144, -8.10494e-05, -0.0041331963],
    [0.0031087859, -0.001631348, -0.001543718],
    [-0.0031734975, -0.000809622, -0.0065407702],
    [0.0045741055, -0.0003901944, -0.0043158457],
    [-0.0039682714, 0, 0.0103025025],
    [-0.0060064522, 0.003077461, 0.0017975378],
    [0.0044520935, -0.0015161446, 0.0032933381],
    [0.0037067424, 0, 0.0023991332],
    [0.0023401122, 0.003341272, -0.0083108263],
  ],
  [ // second phase, main yarn
    [-0.0010102684, -0.0002737337, -0.002948984],
    [0.0019082198, 0.0031978874, 0.0055006231],
    [0.0022466374, 0.0027039435, -0.0043255761],
    [0.0023272209, 0.0010764279, -0.003266394],
    [-0.0008835336, 9.19707e-05, -0.0048778642],
    [-0.0031505623, 0.0021009756, -0.0005391044],
    [-0.0001751294, -0.0005752221, 1.83685e-05],
    [0.0029320114, -0.0010160025, 0.0010181683],
    [0.0020480542, -0.0046404966, -0.0048045428],
    [-0.0047391867, 0.001949129, -0.0062692492],
    [0.0025364274, -0.0015603907, -0.0153574565],
    [-0.0028074077, 0.00194392, -0.0109451249],
    [-0.001553551, 0.0056298139, 0.0128398465],
    [0.0033138418, 0.0059741959, 0.0117054931],
    [-0.0012261668, -0.0002228815, 0.0008031946],
    [0.0032259772, -0.0003658725, 0.0046151103],
  ],
  [ // second phase, plated yarn
    [0.0035931585, -0.0005831458, -3.43002e-05],
    [-0.0025971908, -0.0007230202, -0.0036575955],
    [-0.0087051766, -0.0017778355, 0.0001741325],
    [0.0051513032, 0.0042970474, -0.0025583267],
    [0.0039588629, -5.64162e-05, -0.0008407307],
    [-0.0017094489, 0.0005318275, 0.0025454125],
    [0.0029125182, 0.0003282931, 0.0018748546],
    [-0.0025016266, 0.0003574477, 0.0005991045],
    [0.0051643837, -0.0016465856, -0.0062425365],
    [-0.0055986459, 0.0011317548, -0.0059265529],
    [0.0055520095, 0, -0.0034629628],
    [-0.0060862672, -0.0020079758, 0.0040654406],
    [-0.0060791417, 0.002262417, -0.0004087572],
    [0.0074329434, 0.0005745979, 0.0021262615],
    [-0.0048084454, 0.0003996454, 0.003998432],
    [0.0008916027, -0.001521823, -0.0079512269],
  ],
];
// Repositions neighbors of the real R23 and R22 crown together. Coordinates use
// the display frame, periodic with the resolved glide. The two yarn radii stay fixed.
const shoulderFit=[13.65606,8.40285,-0.12,0.20976,0.62377,0.00312,0.00719,0.42927,-0.00865,13.36905,1.57554];
function dressShoulders(points, rowOrigin) {
  const [cx,cy,,gain,ry,slope,shoulder,depthWeight,amplitude,frequency,phase] = shoulderFit;
  const y0=cy+rowOrigin*form.courseStep,periodY=8*form.courseStep;
  return points.map(([x,y,z]) => {
    const nearest=Math.floor((x-cx)/form.columnPitch+.5);
    let tx=x,ty=y,tz=z;
    for(let j=-1; j<=1; j++) {
      const col=nearest+j, dx=x-(cx+form.columnPitch*col), origin=y0-2*form.courseStep*col;
      const dy=y-origin-periodY*Math.round((y-origin)/periodY);
      const r=Math.hypot(dx/.69,dy/ry), t=Math.max(0,Math.min(1,(r-.38)/.62));
      const w=1-t*t*(3-2*t);if(w===0)continue;
      const d=Math.max(0,Math.min(1,(-z+.02)/.36)), h=1-depthWeight+depthWeight*d*d*(3-2*d);
      const wave=amplitude*Math.sin(frequency*dx+phase)*Math.max(0,Math.min(1,(z+.23)/.15));
      tx+=w*dx*gain*h;
      ty+=w*(wave+(slope*dx+.040*shoulder*(1-(dx/.3)**2))*h);
      tz-=w*slope*dy*depthWeight;
    }
    return [tx,ty,tz];
  });
}

// Fitted neutral clearance for the circular surfaces over all 48 needle positions.
const clearanceTerms = [[[-0.00017691781,-0.00046028739,-0.00018368387],[0.00282956336,0.0017126426,0.00438435334],[-0.00063505404,-0.00257633646,-0.00105278317],[-0.00252729592,0.0044459491,-0.00191078687],[0.00200414974,-0.00348623179,-0.00035322053],[-0.0038,-0.00167037871,0.0054780221],[-0.00100047356,0.00194672878,-0.00087938763]],[[0.00021732236,0.00060634544,-0.00059537221],[0.00299354816,0.00313401131,-0.00072393176],[0.00001561707,0.00067771281,-0.00030441066],[-0.00107589961,0.00232317304,0.00151780216],[-0.00189430026,-0.00016308789,0.00333407952],[0.00218468818,-0.00481076483,0.0066647978],[-0.00023141986,0.00094148643,-0.00074873274]],[[0.00087984752,0.00080793849,0.00385584653],[0.00300727321,0.0009952386,0],[0.00319269957,0.00354643087,0.00457176094],[-0.00321247825,-0.00093211307,-0.00277238358],[0.00165545619,-0.00059999955,0.00069686759],[-0.00256806486,-0.00353732894,0.00748412171],[0.00220809821,0.0038,0.00321725085]],[[-0.00027140769,0,0.00149166241],[0.00234789347,0.00251463624,0.00206434738],[0.0003182509,0.0038,0.00329958132],[-0.00279867732,0.00183554432,-0.00039914227],[0.00050717812,-0.00198156472,-0.00109601613],[-0.0024402995,-0.00608872022,0.00369589164],[-0.00025942646,-0.00081192061,-0.00253959639]]];
function giveCircularClearance(points, group) {
  const coeff = clearanceTerms[group];
  return points.map(([x,y,z]) => {
    const wale=2*Math.PI*x/form.columnPitch, course=2*Math.PI*y/form.courseStep;
    const weights=[1,Math.sin(wale),Math.cos(wale),Math.sin(course),Math.cos(course),z/form.depthSpan,Math.sin(2*wale)];
    const moved=[x,y,z];
    for (let term=0; term<weights.length; term++)
      for (let axis=0; axis<3; axis++) moved[axis]+=coeff[term][axis]*weights[term];
    return moved;
  });
}

// The last source courses have open releases. Continue their lateral lay smoothly
// into the free edge without compressing course height or changing either radius.
// Coefficients are displayed-length ratios selected from the native terminal
// trajectories and orthographic aperture measurements, without physical calibration.
function layOpenUpperEdge(controls, sourceHeight, radius) {
  const start = (sourceHeight - form.openEdge.supportCourses) * form.courseStep;
  if (!controls.some(point => point[1] > start)) return controls;
  const ramp = form.openEdge.rampCourses * form.courseStep;
  const placed = controls.map(([x, y, z]) => {
    const u = Math.min(1, Math.max(0, (y - start) / ramp));
    const weight = u ** 3 * (10 + u * (-15 + 6 * u));
    return [x + form.openEdge.lateralPerDepth * weight * z, y, z * (1 + form.openEdge.depthScaleChange * weight)];
  });
  return relaxCurvature(placed, radius);
}

export function formSopYarnTube({ mesh, centerline, ringParameters }, cells, uvRepeat, layPhase, yarnIndex, radius, sourceHeight) {
  const sourceRow = cells[0].row;
  const phaseIndex = Math.round((layPhase - 1.5*Math.PI)/(Math.PI/4));
  const originRow = ((3*phaseIndex)%8+8)%8;
  const row = sourceRow - originRow;
  const slotTerms = corrections[2*((row%2+2)%2)+yarnIndex];
  let controls = layPhase === null ? centerline.controlPoints : centerline.controlPoints.map(([x,y,z]) => {
    const column = x / SOP_INTERLOCK_LAYOUT.columnPitch, angle = 2*Math.PI*column;
    const rowAngle = 2*Math.PI*(y / SOP_INTERLOCK_LAYOUT.courseStep - sourceRow);
    const glideAngle = Math.PI/2*(column + row/2);
    const u = form.depthSpan*Math.tanh(z/form.depthSpan);
    const point = [x+form.lateralLay*u, form.courseScale*y, z+(form.depthScale-1)*u];
    const features = [1, Math.sin(angle),Math.cos(angle),Math.sin(2*angle),Math.cos(2*angle),z/form.depthSpan,
      Math.sin(rowAngle),Math.cos(rowAngle),Math.sin(glideAngle),Math.cos(glideAngle)];
    for(let i=0;i<features.length;i++)for(let axis=0;axis<3;axis++)point[axis]+=features[i]*slotTerms[i][axis];
    return point;
  });
  if (layPhase !== null) {
    controls = smoothTightBends(controls, radius);
    controls = widenControls(controls, centerline.controlPoints, sourceRow, row, yarnIndex);
    radius *= yarnIndex === 0 ? form.mainRadiusScale : form.platedRadiusScale;
    controls = relaxCurvature(controls, radius);
    controls = dressShoulders(controls, originRow);
    controls = widenControls(controls, centerline.controlPoints, sourceRow, row, yarnIndex, shoulderClearance, 0);
    controls = relaxCurvature(controls, radius);
    controls = giveCircularClearance(controls, 2*((row%2+2)%2)+yarnIndex);
    controls = relaxCurvature(controls, radius);
    controls = layOpenUpperEdge(controls, sourceHeight, radius);
  }
  const curve = check(createSpatialCurve({ type: 'catmull-rom', points: controls, unit: 'mm' })).curve;
  const arc = check(measureSpatialLength(curve)).cumulativeLengths;
  const points = [], tangents = [], cumulativeLengths = [];
  for (const t of ringParameters) {
    const at = t * curve.segments.length, i = Math.min(Math.floor(at), curve.segments.length - 1);
    const seg = curve.segments[i], u = Math.min(1, at - i);
    points.push(seg.point(u));
    tangents.push(normalize(seg.derivative(u)));
    cumulativeLengths.push(u === 1 ? arc[i + 1] : arc[i] + check(integrateSpatialSegment(seg, {}, 0, u)).length);
  }
  const path = { status: 'OK', unit: 'mm', closed: false, points, tangents, cumulativeLengths, totalLength: arc.at(-1) };
  const frames = check(buildParallelTransportFrames(path));
  const tube = check(buildYarnTubeGeometry({ path, frames, radiusA: radius,
    radialSegments: mesh.counts.radialSegments, uvRepeatLength: uvRepeat, capEnds: false }));
  for (const c of cells) c.modelArcLength = arc[c.controlEnd] - arc[c.controlStart];
  return { mesh: tube, radius, centerline: { ...centerline, points, tangents, controlPoints: controls, continuity: curve.continuity } };
}

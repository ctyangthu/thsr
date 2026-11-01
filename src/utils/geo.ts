import mapData from '../../data/map.json';
import { Station, BoundingBox } from '../types/thsr';

export const ST: Station[] = [
  { i: 0, zh: '南港', en: 'Nangang', lat: 25.0533, lon: 121.6071 },
  { i: 1, zh: '台北', en: 'Taipei', lat: 25.0477, lon: 121.5170 },
  { i: 2, zh: '板橋', en: 'Banqiao', lat: 25.0144, lon: 121.4637 },
  { i: 3, zh: '桃園', en: 'Taoyuan', lat: 25.0129, lon: 121.2149 },
  { i: 4, zh: '新竹', en: 'Hsinchu', lat: 24.8082, lon: 121.0402 },
  { i: 5, zh: '苗栗', en: 'Miaoli', lat: 24.6055, lon: 120.8256 },
  { i: 6, zh: '台中', en: 'Taichung', lat: 24.1122, lon: 120.6158 },
  { i: 7, zh: '彰化', en: 'Changhua', lat: 23.8743, lon: 120.5749 },
  { i: 8, zh: '雲林', en: 'Yunlin', lat: 23.7363, lon: 120.4164 },
  { i: 9, zh: '嘉義', en: 'Chiayi', lat: 23.4595, lon: 120.3233 },
  { i: 10, zh: '台南', en: 'Tainan', lat: 22.9250, lon: 120.2857 },
  { i: 11, zh: '左營', en: 'Zuoying', lat: 22.6873, lon: 120.3077 },
];

export const VIA: [number, number][][] = [
  [[25.0493, 121.5778]],
  [[25.0335, 121.4999], [25.0262, 121.4850]],
  [[25.0030, 121.4300], [25.0300, 121.3720], [25.0340, 121.3100], [25.0220, 121.2550]],
  [[24.9550, 121.1700], [24.8850, 121.1000]],
  [[24.7420, 120.9680], [24.6720, 120.8920]],
  [[24.5000, 120.7920], [24.4050, 120.7520], [24.3050, 120.7050], [24.2050, 120.6450]],
  [[24.0000, 120.6000]],
  [[23.8120, 120.5020]],
  [[23.6000, 120.3720]],
  [[23.3000, 120.3100], [23.1000, 120.2920]],
  [[22.8000, 120.2910]],
];

export const LBL: Record<number, [number, number, 'start' | 'middle' | 'end']> = {
  0: [14, -1, 'start'],
  1: [0, -27, 'middle'],
  2: [-14, 8, 'end'],
};

export const MAP_CONFIG = mapData;
const [LON0, LAT0, LATR, K] = mapData.proj;
const COS = Math.cos((LATR * Math.PI) / 180);

export const proj = (lat: number, lon: number): [number, number] => [
  (lon - LON0) * COS * K,
  (LAT0 - lat) * K,
];

export const KM_PER_UNIT_GEO = 0.11119; // 1/1000° of latitude

// spline calculation
function cr(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  u: number
): [number, number] {
  const d = (a: [number, number], b: [number, number]) =>
    Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
  const t0 = 0;
  const t1 = t0 + d(p0, p1);
  const t2 = t1 + d(p1, p2);
  const t3 = t2 + d(p2, p3);
  const t = t1 + (t2 - t1) * u;
  const L = (
    a: [number, number],
    b: [number, number],
    ta: number,
    tb: number
  ): [number, number] => [
    ((tb - t) / (tb - ta)) * a[0] + ((t - ta) / (tb - ta)) * b[0],
    ((tb - t) / (tb - ta)) * a[1] + ((t - ta) / (tb - ta)) * b[1],
  ];
  const A1 = L(p0, p1, t0, t1);
  const A2 = L(p1, p2, t1, t2);
  const A3 = L(p2, p3, t2, t3);
  const B1 = L(A1, A2, t0, t2);
  const B2 = L(A2, A3, t1, t3);
  return L(B1, B2, t1, t2);
}

const ctrl: [number, number][] = [];
const ctrlStation = new Map<number, number>();

ST.forEach((s, i) => {
  ctrlStation.set(ctrl.length, i);
  ctrl.push(proj(s.lat, s.lon));
  if (VIA[i]) {
    VIA[i].forEach(([la, lo]) => ctrl.push(proj(la, lo)));
  }
});

export const PX: number[] = [];
export const PY: number[] = [];
export const CS: number[] = [];
export const STS: number[] = new Array(ST.length);

const pushPt = (p: [number, number]) => {
  if (PX.length) {
    CS.push(
      CS[CS.length - 1] + Math.hypot(p[0] - PX[PX.length - 1], p[1] - PY[PY.length - 1])
    );
  } else {
    CS.push(0);
  }
  PX.push(p[0]);
  PY.push(p[1]);
};

for (let i = 0; i < ctrl.length - 1; i++) {
  const p1 = ctrl[i];
  const p2 = ctrl[i + 1];
  const p0 = ctrl[i - 1] || [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
  const p3 = ctrl[i + 2] || [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
  const n = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 10));
  for (let j = 0; j < n; j++) {
    pushPt(j === 0 ? p1 : cr(p0, p1, p2, p3, j / n));
    if (j === 0 && ctrlStation.has(i)) {
      STS[ctrlStation.get(i)!] = CS[CS.length - 1];
    }
  }
}
pushPt(ctrl[ctrl.length - 1]);
STS[ST.length - 1] = CS[CS.length - 1];

export const LINE_LEN = CS[CS.length - 1];
export const KMU = 350 / LINE_LEN; // scale to the ~350 km Nangang–Zuoying route length

export function at(s: number): { x: number; y: number; tx: number; ty: number } {
  s = Math.max(0, Math.min(LINE_LEN, s));
  let lo = 0;
  let hi = CS.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (CS[m] <= s) lo = m;
    else hi = m;
  }
  const dx = PX[hi] - PX[lo];
  const dy = PY[hi] - PY[lo];
  const L = Math.hypot(dx, dy) || 1;
  const f = (s - CS[lo]) / (CS[hi] - CS[lo] || 1);
  return { x: PX[lo] + dx * f, y: PY[lo] + dy * f, tx: dx / L, ty: dy / L };
}

// trapezoidal speed profile: share `a` of the run accelerating and decelerating
export const prof = (u: number, a: number): number => {
  const v = 1 / (1 - a);
  return u < a
    ? (v * u * u) / (2 * a)
    : u > 1 - a
    ? 1 - (v * (1 - u) * (1 - u)) / (2 * a)
    : v * (a / 2 + (u - a));
};

export const vprof = (u: number, a: number): number => {
  const v = 1 / (1 - a);
  return u < a ? (v * u) / a : u > 1 - a ? (v * (1 - u)) / a : v;
};

export const trackD =
  'M' + PX.map((x, i) => x.toFixed(1) + ',' + PY[i].toFixed(1)).join('L');

export const tropicY = (LAT0 - 23.4365) * K;

export function stationBox(a: number, b: number, pad: number): BoundingBox {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = a; i <= b; i++) {
    const p = at(STS[i]);
    xs.push(p.x);
    ys.push(p.y);
  }
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const px = Math.max(80, (x1 - x0) * pad);
  const py = Math.max(80, (y1 - y0) * pad);
  return {
    x: x0 - px * 1.6,
    y: y0 - py,
    w: x1 - x0 + px * 3.2,
    h: y1 - y0 + py * 2,
  };
}

export const REGIONS: Record<string, () => BoundingBox> = {
  all: () => ({ x: 0, y: 0, w: mapData.w, h: mapData.h }),
  line: () => stationBox(0, 11, 0.06),
  north: () => stationBox(0, 4, 0.18),
  mid: () => stationBox(5, 8, 0.14),
  south: () => stationBox(8, 11, 0.12),
};

export function fitBox(b: BoundingBox, ar: number = 0.7): BoundingBox {
  let { x, y, w, h } = b;
  if (w / h < ar) {
    const nw = h * ar;
    x -= (nw - w) / 2;
    w = nw;
  } else {
    const nh = w / ar;
    y -= (nh - h) / 2;
    h = nh;
  }
  return { x, y, w, h };
}

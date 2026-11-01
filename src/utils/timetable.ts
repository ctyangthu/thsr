import timetableData from '../../data/timetable-2026-02-02.json';
import {
  RawTrain,
  Train,
  StopInfo,
  RouteStop,
  TrainState,
  TrainPos,
  ActiveTrain,
} from '../types/thsr';
import { ST, STS, KMU, prof, vprof } from './geo';

export const DAY = ['一', '二', '三', '四', '五', '六', '日'];
export const PRE = 8;
export const DWELL = 1;
export const POST = 3;

export const toMin = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

export const fmt = (m: number): string => {
  const rounded = ((Math.round(m) % 1440) + 1440) % 1440;
  return (
    String(Math.floor(rounded / 60)).padStart(2, '0') +
    ':' +
    String(rounded % 60).padStart(2, '0')
  );
};

export const TRAINS: Train[] = (timetableData as RawTrain[]).map((r) => {
  const order =
    r.dir === 'S'
      ? Array.from({ length: 12 }, (_, i) => i)
      : Array.from({ length: 12 }, (_, i) => 11 - i);
  const stops: StopInfo[] = [];
  const route: RouteStop[] = [];
  let prev = -1;
  let off = 0;

  for (const i of order) {
    const v = r.t[i];
    if (v == null) continue;
    if (v === '─') {
      route.push({ st: i, pass: true });
      continue;
    }
    let m = toMin(v) + off;
    if (prev >= 0 && m < prev) {
      off += 1440;
      m += 1440;
    }
    prev = m;
    const s: StopInfo = { st: i, time: m, arr: m, dep: m };
    stops.push(s);
    route.push(s);
  }

  stops.forEach((s, k) => {
    if (k === 0) {
      s.arr = s.time - PRE;
      s.dep = s.time;
    } else if (k === stops.length - 1) {
      s.arr = s.time;
      s.dep = s.time + POST;
    } else {
      s.arr = s.time - DWELL;
      s.dep = s.time;
    }
  });

  const daily = r.days.every(Boolean);
  return {
    no: r.no,
    dir: r.dir,
    days: r.days,
    daily,
    stops,
    route,
    from: stops[0].st,
    to: stops[stops.length - 1].st,
    start: stops[0].arr,
    end: stops[stops.length - 1].dep,
    first: stops[0].time,
    last: stops[stops.length - 1].time,
    stopAt: new Map(stops.map((s) => [s.st, s])),
    nStops: stops.length,
  };
});

export const BYNO = new Map<string, Train>(TRAINS.map((t) => [t.no, t]));

export const DAYTRAINS: Train[][] = DAY.map((_, d) =>
  TRAINS.filter((t) => t.days[d])
);

export const DAILY_N = TRAINS.filter((t) => t.daily).length;

export const typeLabel = (tr: Train): string =>
  tr.nStops === 12 ? '每站停靠' : `停靠 ${tr.nStops} 站`;

export const daysLabel = (tr: Train): string =>
  tr.daily
    ? '每日行駛'
    : '週' + tr.days.map((v, i) => (v ? DAY[i] : '')).join('') + ' 行駛';

export function trainState(tr: Train, t: number): TrainState | null {
  if (t < tr.start || t > tr.end) return null;
  const S = tr.stops;
  for (let k = 0; k < S.length; k++) {
    const s = S[k];
    if (t < s.arr) {
      const a = S[k - 1];
      return {
        mode: 'run',
        from: a,
        to: s,
        k,
        u: (t - a.dep) / (s.arr - a.dep),
      };
    }
    if (t <= s.dep) {
      return {
        mode: k === 0 ? 'wait' : k === S.length - 1 ? 'arrived' : 'dwell',
        at: s,
        k,
      };
    }
  }
  return null;
}

export function trainPos(tr: Train, st: TrainState): TrainPos {
  if (st.mode !== 'run') return { s: STS[st.at.st], v: 0 };
  const sa = STS[st.from.st];
  const sb = STS[st.to.st];
  const dur = (st.to.arr - st.from.dep) / 60;
  const km = Math.abs(sb - sa) * KMU;
  const avg = km / dur;
  const a = Math.min(0.42, Math.max(0.1, 1 - avg / 285));
  return {
    s: sa + (sb - sa) * prof(st.u, a),
    v: avg * vprof(st.u, a),
  };
}

export function computeActiveTrains(day: number, min: number): ActiveTrain[] {
  const list: ActiveTrain[] = [];
  const dayList = DAYTRAINS[day] || [];
  for (const tr of dayList) {
    if (min < tr.start || min > tr.end) continue;
    const st = trainState(tr, min);
    if (!st) continue;
    list.push({ tr, st, pos: trainPos(tr, st) });
  }
  return list;
}

export { ST, STS } from './geo';

export function statusText(tr: Train, st: TrainState | null): string {
  if (!st) return '';
  if (st.mode === 'wait') return `${ST[tr.from].zh} 待發`;
  if (st.mode === 'dwell') return `停靠 ${ST[st.at.st].zh}`;
  if (st.mode === 'arrived') return `已抵達 ${ST[tr.to].zh}`;
  if (st.mode === 'run') return `${ST[st.from.st].zh} → ${ST[st.to.st].zh}`;
  return '';
}

export function nextStop(
  tr: Train,
  st: TrainState
): [label: string, time: number] {
  if (st.mode === 'wait') return [ST[tr.from].zh + ' 開', st.at.time];
  if (st.mode === 'dwell') return [ST[st.at.st].zh + ' 開', st.at.time];
  if (st.mode === 'arrived') return ['抵達', st.at.time];
  if (st.mode === 'run') return ['下一站 ' + ST[st.to.st].zh, st.to.time];
  return ['', 0];
}

export const progress = (tr: Train, t: number): number =>
  Math.max(0, Math.min(1, (t - tr.first) / (tr.last - tr.first)));

// Taipei Time helper
const tpFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const WD: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export interface TaipeiTime {
  y: number;
  mo: number;
  d: number;
  wd: number;
  h: number;
  sec: number;
}

export function taipeiNow(): TaipeiTime {
  const now = new Date();
  const p: Record<string, string> = {};
  for (const x of tpFmt.formatToParts(now)) p[x.type] = x.value;
  const h = +p.hour % 24;
  const sec =
    h * 3600 + +p.minute * 60 + +p.second + now.getMilliseconds() / 1000;
  return {
    y: +p.year,
    mo: +p.month,
    d: +p.day,
    wd: WD[p.weekday] ?? 0,
    h,
    sec,
  };
}

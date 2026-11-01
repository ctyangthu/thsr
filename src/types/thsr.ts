export interface Station {
  i: number;
  zh: string;
  en: string;
  lat: number;
  lon: number;
}

export interface RawTrain {
  no: string;
  dir: 'S' | 'N';
  days: number[];
  t: (string | null)[];
}

export interface StopInfo {
  st: number;
  time: number; // minutes from midnight (can exceed 1440 for next day)
  arr: number;
  dep: number;
  pass?: boolean;
}

export interface RouteStop {
  st: number;
  time?: number;
  pass?: boolean;
}

export interface Train {
  no: string;
  dir: 'S' | 'N';
  days: number[];
  daily: boolean;
  stops: StopInfo[];
  route: RouteStop[];
  from: number;
  to: number;
  start: number;
  end: number;
  first: number;
  last: number;
  stopAt: Map<number, StopInfo>;
  nStops: number;
}

export type TrainMode = 'run' | 'wait' | 'dwell' | 'arrived';

export interface TrainRunState {
  mode: 'run';
  from: StopInfo;
  to: StopInfo;
  k: number;
  u: number;
}

export interface TrainStopState {
  mode: 'wait' | 'dwell' | 'arrived';
  at: StopInfo;
  k: number;
}

export type TrainState = TrainRunState | TrainStopState;

export interface TrainPos {
  s: number;
  v: number;
}

export interface ActiveTrain {
  tr: Train;
  st: TrainState;
  pos: TrainPos;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type RegionKey = 'all' | 'line' | 'north' | 'mid' | 'south';
export type TabKey = 'run' | 'board' | 'tt';

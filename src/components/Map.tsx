import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ActiveTrain, BoundingBox, RegionKey } from '../types/thsr';
import {
  MAP_CONFIG,
  ST,
  STS,
  LBL,
  at,
  proj,
  trackD,
  tropicY,
  REGIONS,
  fitBox,
  KM_PER_UNIT_GEO,
} from '../utils/geo';

interface MapProps {
  activeTrains: ActiveTrain[];
  selectedTrainNo: string | null;
  selectedStationIdx: number;
  region: RegionKey;
  targetVb: BoundingBox | null;
  onSelectTrain: (no: string | null) => void;
  onSelectStation: (idx: number) => void;
  onSetRegion: (region: RegionKey) => void;
  onJumpToTime: (min: number) => void;
  min: number;
  dayText: string;
}

const BODY_PATH =
  'M-14,-4H6C10,-4 13,-2.4 15.5,0C13,2.4 10,4 6,4H-14Q-15.5,4 -15.5,2.5V-2.5Q-15.5,-4 -14,-4Z';

const FIXED_SEAS: [string, number, number, string][] = [
  ['臺灣海峽', 24.35, 119.85, ''],
  ['太平洋', 22.95, 121.78, ''],
  ['北回歸線 23.5°N', 23.4365, 121.13, 'small'],
  ['澎湖', 23.42, 119.52, 'small'],
];

export const MapComponent: React.FC<MapProps> = ({
  activeTrains,
  selectedTrainNo,
  selectedStationIdx,
  region,
  targetVb,
  onSelectTrain,
  onSelectStation,
  onSetRegion,
  onJumpToTime,
  min,
  dayText,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const W = MAP_CONFIG.w;
  const H = MAP_CONFIG.h;

  const [vb, setVb] = useState<BoundingBox>({ x: 0, y: 0, w: W, h: H });
  const [pxPerUnit, setPxPerUnit] = useState<number>(1);
  const [scaleKm, setScaleKm] = useState<number>(50);
  const [scaleWidthPx, setScaleWidthPx] = useState<number>(60);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Animation ref for smooth flying
  const flyRef = useRef<{
    from: BoundingBox;
    to: BoundingBox;
    t0: number;
    dur: number;
  } | null>(null);

  const ptrsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragRef = useRef<{
    x: number;
    y: number;
    vb: BoundingBox;
    moved: boolean;
    pinch: { d: number } | null;
  } | null>(null);

  // Measure and update viewBox projection
  const measure = useCallback(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ppu = Math.min(rect.width / vb.w, rect.height / vb.h) || 1;
    setPxPerUnit(ppu);

    const pxPerKm = ppu / KM_PER_UNIT_GEO;
    const kmOptions = [5, 10, 20, 50, 100, 200];
    const chosenKm = kmOptions.find((v) => v * pxPerKm >= 55) || 200;
    setScaleKm(chosenKm);
    setScaleWidthPx(Math.round(chosenKm * pxPerKm));
  }, [vb.w, vb.h]);

  useEffect(() => {
    measure();
    const handleResize = () => measure();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measure]);

  // Initial layout fit
  useEffect(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (Math.min(rect.width / W, rect.height / H) < 0.17) {
      const lineBox = fitBox(REGIONS.line(), rect.width / (rect.height || 1));
      setVb(lineBox);
      onSetRegion('line');
    }
  }, [W, H, onSetRegion]);

  // Target viewBox animation when region changes or train is located
  useEffect(() => {
    if (!targetVb) return;
    const rect = svgRef.current?.getBoundingClientRect();
    const ar = rect ? rect.width / (rect.height || 1) : 0.7;
    const target = fitBox(targetVb, ar);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setVb(target);
      flyRef.current = null;
    } else {
      flyRef.current = {
        from: { ...vb },
        to: target,
        t0: performance.now(),
        dur: 520,
      };
    }
  }, [targetVb]);

  // Smooth flying animation loop
  useEffect(() => {
    let animId: number;
    const step = (now: number) => {
      if (flyRef.current) {
        let u = Math.min(1, (now - flyRef.current.t0) / flyRef.current.dur);
        u = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        const curVb: BoundingBox = {
          x:
            flyRef.current.from.x +
            (flyRef.current.to.x - flyRef.current.from.x) * u,
          y:
            flyRef.current.from.y +
            (flyRef.current.to.y - flyRef.current.from.y) * u,
          w:
            flyRef.current.from.w +
            (flyRef.current.to.w - flyRef.current.from.w) * u,
          h:
            flyRef.current.from.h +
            (flyRef.current.to.h - flyRef.current.from.h) * u,
        };
        setVb(curVb);
        if (u >= 1) {
          flyRef.current = null;
        }
      }
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, []);

  const clientToSvg = (cx: number, cy: number): [number, number] => {
    if (!svgRef.current) return [0, 0];
    const r = svgRef.current.getBoundingClientRect();
    const s = pxPerUnit;
    const ox = (r.width - vb.w * s) / 2;
    const oy = (r.height - vb.h * s) / 2;
    return [vb.x + (cx - r.left - ox) / s, vb.y + (cy - r.top - oy) / s];
  };

  const zoomAt = (factor: number, cx: number, cy: number) => {
    const nw = Math.min(W * 1.4, Math.max(W / 45, vb.w / factor));
    factor = vb.w / nw;
    const [px, py] = clientToSvg(cx, cy);
    setVb((prev) => ({
      x: px - (px - prev.x) / factor,
      y: py - (py - prev.y) / factor,
      w: prev.w / factor,
      h: prev.h / factor,
    }));
    flyRef.current = null;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * 0.0016), e.clientX, e.clientY);
  };

  // Pointer drag & pinch zoom
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      vb: { ...vb },
      moved: false,
      pinch: null,
    };
    if (ptrsRef.current.size === 2) {
      const [a, b] = Array.from(ptrsRef.current.values());
      dragRef.current.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      dragRef.current.moved = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || !ptrsRef.current.has(e.pointerId)) return;
    const prev = ptrsRef.current.get(e.pointerId)!;
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ptrsRef.current.size === 2 && drag.pinch) {
      const [a, b] = Array.from(ptrsRef.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(d / drag.pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      drag.pinch.d = d;
      return;
    }

    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 5) {
      drag.moved = true;
      setIsDragging(true);
      flyRef.current = null;
    }
    if (drag.moved) {
      setVb((prevVb) => ({
        ...prevVb,
        x: prevVb.x - (e.clientX - prev.x) / pxPerUnit,
        y: prevVb.y - (e.clientY - prev.y) / pxPerUnit,
      }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (drag && !drag.moved && e.type === 'pointerup') {
      // Check if user clicked on a train or station
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const trainElem = target?.closest('[data-no]') as HTMLElement | null;
      const stationElem = target?.closest('[data-st]') as HTMLElement | null;
      if (trainElem) {
        onSelectTrain(trainElem.dataset.no || null);
      } else if (stationElem) {
        onSelectStation(Number(stationElem.dataset.st));
      }
    }
    ptrsRef.current.delete(e.pointerId);
    if (!ptrsRef.current.size) {
      dragRef.current = null;
      setIsDragging(false);
    }
  };

  // Zoom buttons
  const handleZoomIn = () => {
    if (!svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    zoomAt(1.6, r.left + r.width / 2, r.top + r.height / 2);
  };

  const handleZoomOut = () => {
    if (!svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    zoomAt(1 / 1.6, r.left + r.width / 2, r.top + r.height / 2);
  };

  // Constant scale factor for labels and icons
  const k = 1 / pxPerUnit;
  const size =
    pxPerUnit < 0.17
      ? 0.56
      : pxPerUnit < 0.3
      ? 0.68
      : pxPerUnit < 0.6
      ? 0.85
      : 1.05;
  const showLabels = pxPerUnit > 0.62;

  const nS = activeTrains.filter((a) => a.tr.dir === 'S').length;
  const nN = activeTrains.length - nS;
  const isOffHours = activeTrains.length === 0;

  return (
    <section className="mapwrap" aria-label="台灣高鐵路線圖">
      <svg
        ref={svgRef}
        id="map"
        role="img"
        aria-label="台灣地圖與高鐵列車位置"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className={isDragging ? 'dragging' : ''}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Ocean Background */}
        <rect
          id="sea"
          x={-W}
          y={-H}
          width={W * 3}
          height={H * 3}
          fill="var(--sea)"
        />

        {/* Taiwan Counties */}
        <g className="land">
          {MAP_CONFIG.counties.map((c, idx) => (
            <path key={idx} d={c.d}>
              <title>{c.name}</title>
            </path>
          ))}
        </g>

        {/* Tropic of Cancer Line */}
        <path
          className="tropic"
          d={`M-${W} ${tropicY}H${W * 2}`}
          vectorEffect="non-scaling-stroke"
        />

        {/* Geographic Labels (Fixed Screen Size) */}
        <g id="fixedLabels">
          {FIXED_SEAS.map(([txt, lat, lon, cls], idx) => {
            const [x, y] = proj(lat, lon);
            return (
              <g
                key={idx}
                transform={`translate(${x} ${y}) scale(${k})`}
              >
                <text
                  className={`sea-label ${cls}`}
                  textAnchor="middle"
                  y={cls ? -5 : 0}
                >
                  {txt}
                </text>
              </g>
            );
          })}
        </g>

        {/* High Speed Rail Track Line */}
        <path id="trackCasing" d={trackD} />
        <path id="track" d={trackD} />

        {/* Stations */}
        <g id="stations">
          {ST.map((s) => {
            const pos = at(STS[s.i]);
            const [lx, ly, anc] = LBL[s.i] || [-14, 1, 'end'];
            const isSelected = selectedStationIdx === s.i;
            return (
              <g
                key={s.i}
                className={`st ${isSelected ? 'sel' : ''}`}
                data-st={s.i}
                role="button"
                aria-label={`${s.zh}站`}
                transform={`translate(${pos.x} ${pos.y}) scale(${k})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectStation(s.i);
                }}
              >
                <circle className="hit" r={13} />
                <circle className="dot" r={5} />
                <text className="zh" x={lx} y={ly} textAnchor={anc}>
                  {s.zh}
                </text>
                <text className="en" x={lx} y={ly + 11} textAnchor={anc}>
                  {s.en}
                </text>
              </g>
            );
          })}
        </g>

        {/* Trains and Train Labels */}
        <g id="trains">
          {activeTrains.map(({ tr, st, pos }) => {
            const p = at(pos.s);
            const hx = tr.dir === 'S' ? p.tx : -p.tx;
            const hy = tr.dir === 'S' ? p.ty : -p.ty;
            const off = (3 + 4.5 * size) * k;
            const x = p.x + hy * off;
            const y = p.y - hx * off;
            const ang = (Math.atan2(hy, hx) * 180) / Math.PI;
            const isSelected = selectedTrainNo === tr.no;
            const isDwell = st.mode !== 'run';

            return (
              <g
                key={tr.no}
                className={`trn ${tr.dir} ${isSelected ? 'sel' : ''} ${
                  isDwell ? 'dwell' : ''
                }`}
                data-no={tr.no}
                role="button"
                aria-label={`車次 ${tr.no}`}
                transform={`translate(${x.toFixed(1)} ${y.toFixed(
                  1
                )}) rotate(${ang.toFixed(1)}) scale(${(
                  k *
                  size *
                  (isSelected ? 1.35 : 1)
                ).toFixed(4)})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTrain(tr.no);
                }}
              >
                <circle className="ring" r={11} />
                <circle className="hit" r={15} />
                <path className="body" d={BODY_PATH} />
                <path
                  className="stripe"
                  d="M-13,1.7H7C10,1.7 12,1.1 14.2,0"
                />
                <path
                  className="glass"
                  d="M8.5,-2.6C10.5,-2.3 12,-1.6 13,-.7L8.5,-.7Z"
                />
              </g>
            );
          })}
        </g>

        {/* Train Labels */}
        <g id="trainLabels">
          {activeTrains.map(({ tr, pos }) => {
            const p = at(pos.s);
            const hx = tr.dir === 'S' ? p.tx : -p.tx;
            const hy = tr.dir === 'S' ? p.ty : -p.ty;
            const off = (3 + 4.5 * size) * k;
            const lx = p.x + hy * off * 3.3;
            const ly = p.y - hx * off * 3.3;
            const isSelected = selectedTrainNo === tr.no;
            const shouldDisplay = showLabels || isSelected;

            if (!shouldDisplay) return null;

            const textAnchor =
              Math.abs(hy) < 0.35 ? 'middle' : hy > 0 ? 'start' : 'end';

            return (
              <text
                key={tr.no}
                className={`tlabel ${tr.dir}`}
                transform={`translate(${lx.toFixed(1)} ${(ly + 4 * k).toFixed(
                  1
                )}) scale(${k.toFixed(4)})`}
                textAnchor={textAnchor}
              >
                {tr.no}
              </text>
            );
          })}
        </g>
      </svg>

      {/* Map Legend */}
      <div className="ov legend" aria-live="polite">
        <div className="row">
          <span className="sw S"></span>南下
          <b id="lgS">{nS}</b>
          <small>往左營</small>
        </div>
        <div className="row">
          <span className="sw N"></span>北上
          <b id="lgN">{nN}</b>
          <small>往南港</small>
        </div>
        <small>列車靠左行駛 · 虛框為停靠中</small>
      </div>

      {/* Map Controls */}
      <div className="mapctl">
        <div className="ov scalebar">
          <i id="scaleBar" style={{ width: `${scaleWidthPx}px` }}></i>
          <span id="scaleTxt">{scaleKm} km</span>
        </div>
        <div className="ov regions" role="group" aria-label="地圖範圍">
          {(['all', 'line', 'north', 'mid', 'south'] as RegionKey[]).map(
            (r) => {
              const labelMap: Record<RegionKey, string> = {
                all: '全島',
                line: '全線',
                north: '北部',
                mid: '中部',
                south: '南部',
              };
              return (
                <button
                  key={r}
                  type="button"
                  data-r={r}
                  aria-pressed={region === r}
                  onClick={() => onSetRegion(r)}
                >
                  {labelMap[r]}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Zoom Buttons */}
      <div className="ov zoom">
        <button
          type="button"
          id="zIn"
          aria-label="放大"
          onClick={handleZoomIn}
        >
          +
        </button>
        <button
          type="button"
          id="zOut"
          aria-label="縮小"
          onClick={handleZoomOut}
        >
          −
        </button>
      </div>

      {/* Off-Hours Overlay */}
      {isOffHours && (
        <div className="ov offhours" id="offhours">
          <b>目前沒有列車運行</b>
          <span id="offText">
            {min < 600
              ? `首班車約 05:50 發車（${dayText}）。`
              : `末班車已於約 00:05 抵達（${dayText}班表）。`}
          </span>
          <div style={{ marginTop: '10px' }}>
            <button
              type="button"
              className="btn"
              data-jump="480"
              onClick={() => onJumpToTime(480)}
            >
              看 08:00 尖峰
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

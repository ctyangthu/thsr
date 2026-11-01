import React from 'react';
import {
  BYNO,
  DAY,
  ST,
  STS,
  fmt,
  typeLabel,
  daysLabel,
  trainState,
  trainPos,
  statusText,
  nextStop,
} from '../utils/timetable';

interface DetailCardProps {
  trainNo: string;
  day: number;
  min: number;
  onClose: () => void;
  onLocate: (trainNo: string) => void;
}

export const DetailCard: React.FC<DetailCardProps> = ({
  trainNo,
  day,
  min,
  onClose,
  onLocate,
}) => {
  const tr = BYNO.get(trainNo);
  if (!tr) return null;

  const runsToday = Boolean(tr.days[day]);
  const st = runsToday ? trainState(tr, min) : null;
  const pos = st ? trainPos(tr, st) : null;

  const phase = !runsToday
    ? 'off'
    : st
    ? st.mode
    : min < tr.start
    ? 'before'
    : 'after';

  // Which stations has the train already passed?
  const sNow = pos ? pos.s : phase === 'after' ? Infinity : -Infinity;
  const isSouth = tr.dir === 'S';
  const passed = (stIdx: number) => {
    if (phase === 'after') return true;
    if (!pos) return false;
    return isSouth ? STS[stIdx] < sNow - 0.5 : STS[stIdx] > sNow + 0.5;
  };

  return (
    <section className="card" id="detail" aria-live="polite">
      <div className="detail-head">
        <span className={`tno ${tr.dir}`}>{tr.no}</span>
        <div className="grow">
          <h3>
            {ST[tr.from].zh} → {ST[tr.to].zh}
          </h3>
          <p>
            {tr.dir === 'S' ? '南下' : '北上'} · {typeLabel(tr)} · {fmt(tr.first)}–
            {fmt(tr.last)} · 行車 {Math.round(tr.last - tr.first)} 分
          </p>
        </div>
        <div className="detail-actions">
          {pos && (
            <button
              type="button"
              className="btn"
              id="dLocate"
              onClick={() => onLocate(tr.no)}
            >
              定位
            </button>
          )}
          <button
            type="button"
            className="btn icon"
            id="dClose"
            aria-label="關閉"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>

      {/* N700ST Train Side Artwork */}
      <svg
        className="train-art"
        viewBox="0 0 420 66"
        role="img"
        aria-label="N700ST 列車側視圖"
      >
        <path d="M0 61H420" stroke="var(--rule)" strokeWidth="2" />
        <g fill="var(--train-black)">
          <rect x="150" y="50" width="56" height="7" rx="2" />
          <rect x="318" y="50" width="56" height="7" rx="2" />
        </g>
        <g fill="var(--muted)">
          <circle cx="162" cy="57" r="4" />
          <circle cx="194" cy="57" r="4" />
          <circle cx="330" cy="57" r="4" />
          <circle cx="362" cy="57" r="4" />
        </g>
        <path
          d="M398 13H128C88 13 56 22 30 34C14 41 4 46 4 49.5C4 52 9 53 20 53H398Z"
          fill="var(--train-white)"
          stroke="var(--coast)"
          strokeWidth="1.2"
        />
        <path
          d="M402 13H420V53H402Z"
          fill="var(--train-white)"
          stroke="var(--coast)"
          strokeWidth="1.2"
        />
        <path
          d="M60 25C80 19 104 17 124 17V27L66 29Z"
          fill="var(--train-glass)"
        />
        <g fill="var(--train-glass)">
          {Array.from({ length: 13 }, (_, i) => (
            <rect
              key={i}
              x={142 + i * 19}
              y="22"
              width="13"
              height="8"
              rx="2"
            />
          ))}
          <rect x="405" y="22" width="13" height="8" rx="2" />
        </g>
        <rect
          x="384"
          y="19"
          width="10"
          height="30"
          rx="1.5"
          fill="none"
          stroke="var(--coast)"
        />
        <path
          d="M8 48C40 41 80 37 132 37H398M402 37H420"
          fill="none"
          stroke="var(--train-orange)"
          strokeWidth="3.2"
        />
        <path
          d="M12 50.5C46 45 86 42.5 132 42.5H398M402 42.5H420"
          fill="none"
          stroke="var(--train-black)"
          strokeWidth="2.2"
        />
      </svg>

      {/* Dynamic Status Bar */}
      <div className="status">
        {phase === 'off' && (
          <>
            <span>週{DAY[day]}不行駛</span>
            <span>{daysLabel(tr)}</span>
          </>
        )}
        {phase === 'before' && (
          <>
            <span>尚未發車</span>
            <span>
              {ST[tr.from].zh} <b className="num">{fmt(tr.first)}</b> 開
            </span>
          </>
        )}
        {phase === 'after' && (
          <>
            <span>已抵達 {ST[tr.to].zh}</span>
            <span>
              <b className="num">{fmt(tr.last)}</b> 到
            </span>
          </>
        )}
        {phase !== 'off' && phase !== 'before' && phase !== 'after' && st && (
          <>
            <b>{statusText(tr, st)}</b>
            {(() => {
              const [nl, nt] = nextStop(tr, st);
              return (
                <span>
                  {nl} <b className="num">{fmt(nt)}</b>
                </span>
              );
            })()}
            {pos && (
              <span className="spd">
                <span id="dSpd">{Math.round(pos.v)}</span>
                <small>km/h 估</small>
              </span>
            )}
          </>
        )}
      </div>

      {/* Days of Operation */}
      <div className="dayrow">
        <span>行駛日</span>
        <span className="dd">
          {tr.days.map((v, k) => (
            <i
              key={k}
              className={`${v ? 'on' : ''} ${k === day ? 'cur' : ''}`}
            >
              {DAY[k]}
            </i>
          ))}
        </span>
        <span>{tr.daily ? '每日' : '指定星期'}</span>
      </div>

      {/* Stops Timeline */}
      <ol className="stops">
        {tr.route.map((r, idx) => {
          const here =
            st && st.mode !== 'run' && st.at.st === r.st;
          const nxt = st && st.mode === 'run' && st.to.st === r.st;
          const isDone = passed(r.st);

          const cls = [
            r.pass ? 'pass' : '',
            here ? 'now' : nxt ? 'next' : isDone ? 'done' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const tag = r.pass
            ? '通過'
            : here
            ? st?.mode === 'wait'
              ? '待發'
              : st?.mode === 'arrived'
              ? '已抵達'
              : '停靠中'
            : nxt
            ? '下一站'
            : r.st === tr.from
            ? '始發'
            : r.st === tr.to
            ? '終點'
            : '';

          return (
            <li key={idx} className={cls}>
              <span className="t">{r.pass ? '—' : fmt(r.time!)}</span>
              <span className="pin">
                <i></i>
              </span>
              <span>{ST[r.st].zh}</span>
              <span className="tag">{tag}</span>
            </li>
          );
        })}
      </ol>

      <p className="fleet">
        N700ST 為台灣高鐵新世代列車，以日本 N700S 為基礎，由日立東芝聯盟製造，共購置 12 組。首組 2026 年 7 月出廠，預計 2027 年 7 月 1 日投入營運；本系統以 N700ST 呈現所有車次。
      </p>
    </section>
  );
};

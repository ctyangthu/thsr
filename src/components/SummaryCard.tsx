import React from 'react';
import { DAY, DAYTRAINS, DAILY_N } from '../utils/timetable';

interface SummaryCardProps {
  day: number;
  activeCount: number;
  onSelectDay: (day: number) => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  day,
  activeCount,
  onSelectDay,
}) => {
  const currentList = DAYTRAINS[day] || [];
  const total = currentList.length;
  const countS = currentList.filter((t) => t.dir === 'S').length;
  const countN = currentList.filter((t) => t.dir === 'N').length;

  const max = Math.max(...DAYTRAINS.map((l) => l.length));
  const extra = total - DAILY_N;

  const peak = DAYTRAINS.map((l, i) => [l.length, i] as [number, number]).sort(
    (a, b) => b[0] - a[0]
  );
  const low = peak[6][0];
  const lowDays = DAYTRAINS.map((l, i) => (l.length === low ? DAY[i] : ''))
    .join('')
    .split('')
    .join('、');

  return (
    <section className="card" aria-labelledby="sumTitle">
      <div className="card-head">
        <h2 id="sumTitle">週{DAY[day]}運行概況</h2>
        <small>點選長條切換星期</small>
      </div>

      <div className="kpis">
        <div className="kpi">
          <b id="kTotal">{total}</b>
          <span>本日班次</span>
        </div>
        <div className="kpi S">
          <b id="kS">{countS}</b>
          <span>南下</span>
        </div>
        <div className="kpi N">
          <b id="kN">{countN}</b>
          <span>北上</span>
        </div>
        <div className="kpi">
          <b id="kRun">{activeCount}</b>
          <span>目前運行</span>
        </div>
      </div>

      <div className="week" id="week">
        {DAYTRAINS.map((l, i) => {
          const x = l.length - DAILY_N;
          const barHeight = (l.length / max) * 76;
          const extraPercent = (x / l.length) * 100;
          const isSelected = i === day;

          return (
            <button
              key={i}
              type="button"
              className="wk"
              data-d={i}
              aria-pressed={isSelected}
              aria-label={`週${DAY[i]} ${l.length} 班`}
              onClick={() => onSelectDay(i)}
            >
              <span className="cnt">{l.length}</span>
              <span className="bar" style={{ height: `${barHeight.toFixed(1)}px` }}>
                <i className="x" style={{ height: `${extraPercent.toFixed(1)}%` }}></i>
                <i className="b" style={{ flex: 1 }}></i>
              </span>
              <span className="lab">{DAY[i]}</span>
            </button>
          );
        })}
      </div>

      <div className="wk-legend">
        <span>
          <i style={{ background: 'var(--bar-base)' }}></i>每日行駛
        </span>
        <span>
          <i style={{ background: 'var(--accent)' }}></i>僅指定星期行駛
        </span>
      </div>

      <p className="note" id="sumNote">
        每日固定行駛 <b>{DAILY_N}</b> 班；週{DAY[day]}另有 <b>{extra}</b> 班僅於指定星期行駛的車次。班次最多為週
        {DAY[peak[0][1]]}（{peak[0][0]} 班）與週{DAY[peak[1][1]]}（{peak[1][0]} 班），最少為週
        {lowDays}（各 {low} 班）。
      </p>
    </section>
  );
};

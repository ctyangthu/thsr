import React, { useState } from 'react';
import {
  ActiveTrain,
  TabKey,
} from '../types/thsr';
import {
  DAY,
  ST,
  TRAINS,
  DAYTRAINS,
  fmt,
  typeLabel,
  daysLabel,
  statusText,
  nextStop,
  progress,
} from '../utils/timetable';

interface TabsCardProps {
  activeTrains: ActiveTrain[];
  selectedTrainNo: string | null;
  selectedStationIdx: number;
  tab: TabKey;
  day: number;
  min: number;
  onSelectTab: (tab: TabKey) => void;
  onSelectTrain: (no: string) => void;
  onSelectStation: (idx: number) => void;
  onJumpToTime: (min: number) => void;
}

export const TabsCard: React.FC<TabsCardProps> = ({
  activeTrains,
  selectedTrainNo,
  selectedStationIdx,
  tab,
  day,
  min,
  onSelectTab,
  onSelectTrain,
  onSelectStation,
  onJumpToTime,
}) => {
  // Timetable local filters
  const [ttDir, setTtDir] = useState<'S' | 'N'>('S');
  const [ttOnly, setTtOnly] = useState<boolean>(true);
  const [ttQuery, setTtQuery] = useState<string>('');

  // Sorted active trains
  const runningList = [...activeTrains].sort((a, b) =>
    a.tr.dir === b.tr.dir ? a.tr.first - b.tr.first : a.tr.dir === 'S' ? -1 : 1
  );
  const nS = runningList.filter((a) => a.tr.dir === 'S').length;

  // Station board departures
  const getDepartures = (dir: 'S' | 'N') => {
    return (DAYTRAINS[day] || [])
      .filter(
        (tr) =>
          tr.dir === dir &&
          tr.to !== selectedStationIdx &&
          tr.stopAt.has(selectedStationIdx) &&
          tr.stopAt.get(selectedStationIdx)!.time >= min - 0.5
      )
      .sort(
        (a, b) =>
          a.stopAt.get(selectedStationIdx)!.time -
          b.stopAt.get(selectedStationIdx)!.time
      )
      .slice(0, 6);
  };

  // Timetable rows
  const ttOrder =
    ttDir === 'S'
      ? Array.from({ length: 12 }, (_, i) => i)
      : Array.from({ length: 12 }, (_, i) => 11 - i);

  const ttRows = TRAINS.filter(
    (tr) =>
      tr.dir === ttDir &&
      (!ttOnly || tr.days[day]) &&
      (!ttQuery || tr.no.includes(ttQuery))
  ).sort((a, b) => a.first - b.first);

  const activeTrainNos = new Set(activeTrains.map((a) => a.tr.no));

  return (
    <section className="card">
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          id="tab-run"
          aria-selected={tab === 'run'}
          onClick={() => onSelectTab('run')}
        >
          運行中
          <span id="tabRunN">{activeTrains.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="tab-board"
          aria-selected={tab === 'board'}
          onClick={() => onSelectTab('board')}
        >
          車站看板
        </button>
        <button
          type="button"
          role="tab"
          id="tab-tt"
          aria-selected={tab === 'tt'}
          onClick={() => onSelectTab('tt')}
        >
          時刻表
        </button>
      </div>

      {/* Pane 1: 運行中 (Running list) */}
      <div id="pane-run" hidden={tab !== 'run'}>
        {!runningList.length ? (
          <div className="empty">
            此刻沒有列車運行（週{DAY[day]} {fmt(min)}）。
            <button
              type="button"
              className="btn"
              data-jump="480"
              onClick={() => onJumpToTime(480)}
            >
              看 08:00 尖峰
            </button>
          </div>
        ) : (
          <>
            <div className="subhead">
              <span>
                南下 <b>{nS}</b> · 北上 <b>{runningList.length - nS}</b>
              </span>
              <span>依起站發車時間排序</span>
            </div>
            <ul className="runlist">
              {runningList.map(({ tr, st }) => {
                const [nl, nt] = nextStop(tr, st);
                const isSelected = selectedTrainNo === tr.no;
                const pct = (progress(tr, min) * 100).toFixed(1);

                return (
                  <li key={tr.no}>
                    <button
                      type="button"
                      className={`runrow ${tr.dir} ${isSelected ? 'sel' : ''}`}
                      onClick={() => onSelectTrain(tr.no)}
                    >
                      <span className={`tno ${tr.dir}`}>{tr.no}</span>
                      <span className="rm">
                        <b>
                          {ST[tr.from].zh} → {ST[tr.to].zh}
                        </b>
                        <small>
                          {statusText(tr, st)} · {typeLabel(tr)}
                          {tr.daily ? '' : ' · 指定日'}
                        </small>
                      </span>
                      <span className="rn">
                        <small>{nl}</small>
                        <b>{fmt(nt)}</b>
                      </span>
                      <span className="pg">
                        <i style={{ width: `${pct}%` }}></i>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Pane 2: 車站看板 (Station Departure Board) */}
      <div id="pane-board" hidden={tab !== 'board'}>
        <div className="stchips" role="group" aria-label="選擇車站">
          {ST.map((s) => (
            <button
              key={s.i}
              type="button"
              aria-pressed={selectedStationIdx === s.i}
              onClick={() => onSelectStation(s.i)}
            >
              {s.zh}
            </button>
          ))}
        </div>

        <div className="board">
          <div className="board-head">
            <div>
              <b>{ST[selectedStationIdx].zh}</b>
              <span>{ST[selectedStationIdx].en}</span>
            </div>
            <time>{fmt(min)}</time>
          </div>

          {/* Southbound */}
          {selectedStationIdx !== 11 && (
            <div className="bdir">
              <h4>
                <span>南下 往左營</span>
                <span>時刻 · 車次 · 終點</span>
              </h4>
              {(() => {
                const deps = getDepartures('S');
                if (!deps.length) {
                  return <div className="bnone">本日南下班次已結束</div>;
                }
                return deps.map((tr) => {
                  const s = tr.stopAt.get(selectedStationIdx)!;
                  const dt = s.time - min;
                  let note: string;
                  let hot = false;
                  if (min >= s.arr && min <= s.dep) {
                    note = tr.from === selectedStationIdx ? '待發' : '停靠中';
                    hot = true;
                  } else if (dt <= 5) {
                    note = `${Math.max(1, Math.ceil(dt))} 分後`;
                    hot = true;
                  } else {
                    note = `${Math.ceil(dt)} 分後`;
                  }

                  return (
                    <div
                      key={tr.no}
                      className="brow"
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelectTrain(tr.no)}
                    >
                      <span className="bt">{fmt(s.time)}</span>
                      <span className="bn">{tr.no}</span>
                      <span className="bd">
                        往 {ST[tr.to].zh}
                        <small>{typeLabel(tr)}</small>
                      </span>
                      <span className={`bs ${hot ? 'hot' : ''}`}>{note}</span>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* Northbound */}
          {selectedStationIdx !== 0 && (
            <div className="bdir">
              <h4>
                <span>北上 往南港</span>
                <span>時刻 · 車次 · 終點</span>
              </h4>
              {(() => {
                const deps = getDepartures('N');
                if (!deps.length) {
                  return <div className="bnone">本日北上班次已結束</div>;
                }
                return deps.map((tr) => {
                  const s = tr.stopAt.get(selectedStationIdx)!;
                  const dt = s.time - min;
                  let note: string;
                  let hot = false;
                  if (min >= s.arr && min <= s.dep) {
                    note = tr.from === selectedStationIdx ? '待發' : '停靠中';
                    hot = true;
                  } else if (dt <= 5) {
                    note = `${Math.max(1, Math.ceil(dt))} 分後`;
                    hot = true;
                  } else {
                    note = `${Math.ceil(dt)} 分後`;
                  }

                  return (
                    <div
                      key={tr.no}
                      className="brow"
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelectTrain(tr.no)}
                    >
                      <span className="bt">{fmt(s.time)}</span>
                      <span className="bn">{tr.no}</span>
                      <span className="bd">
                        往 {ST[tr.to].zh}
                        <small>{typeLabel(tr)}</small>
                      </span>
                      <span className={`bs ${hot ? 'hot' : ''}`}>{note}</span>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          <div className="board-foot">
            週{DAY[day]}班表 · 依時刻表推算，非即時誤點資訊
          </div>
        </div>
      </div>

      {/* Pane 3: 時刻表 (Timetable) */}
      <div id="pane-tt" hidden={tab !== 'tt'}>
        <div className="ttbar">
          <div className="seg">
            <button
              type="button"
              data-d="S"
              aria-pressed={ttDir === 'S'}
              onClick={() => setTtDir('S')}
            >
              南下
            </button>
            <button
              type="button"
              data-d="N"
              aria-pressed={ttDir === 'N'}
              onClick={() => setTtDir('N')}
            >
              北上
            </button>
          </div>
          <label>
            <input
              type="checkbox"
              checked={ttOnly}
              onChange={(e) => setTtOnly(e.target.checked)}
            />{' '}
            只列本日行駛
          </label>
          <input
            type="search"
            placeholder="車次"
            inputMode="numeric"
            aria-label="搜尋車次"
            value={ttQuery}
            onChange={(e) => setTtQuery(e.target.value.trim())}
          />
        </div>

        <div className="ttwrap">
          <table className="tt">
            <thead>
              <tr>
                <th>車次</th>
                <th>行駛日</th>
                {ttOrder.map((i) => (
                  <th key={i}>{ST[i].zh}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ttRows.map((tr) => {
                const passSet = new Set(
                  tr.route.filter((r) => r.pass).map((r) => r.st)
                );
                const on = Boolean(tr.days[day]);
                const isRun = on && activeTrainNos.has(tr.no);
                const isGone = on && min > tr.end;
                const isSel = selectedTrainNo === tr.no;

                const trClass = [
                  !on ? 'off' : '',
                  isRun ? 'run' : '',
                  isGone ? 'gone' : '',
                  isSel ? 'sel' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <tr
                    key={tr.no}
                    className={trClass}
                    onClick={() => onSelectTrain(tr.no)}
                  >
                    <td className="no">{tr.no}</td>
                    <td>
                      <span className="dd mini" title={daysLabel(tr)}>
                        {tr.days.map((v, k) => (
                          <i
                            key={k}
                            className={`${v ? 'on' : ''} ${
                              k === day ? 'cur' : ''
                            }`}
                          ></i>
                        ))}
                      </span>
                    </td>
                    {ttOrder.map((stIdx) => {
                      const s = tr.stopAt.get(stIdx);
                      return (
                        <td key={stIdx}>
                          {s ? (
                            fmt(s.time)
                          ) : passSet.has(stIdx) ? (
                            <span className="ps">↓</span>
                          ) : (
                            ''
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="ttcount">
          {ttDir === 'S' ? '南下' : '北上'} {ttRows.length} 班
          {ttOnly
            ? `（週${DAY[day]}行駛）`
            : '（全部車次，淡色為本日不行駛）'}{' '}
          · 「↓」為通過不停
        </p>
      </div>
    </section>
  );
};

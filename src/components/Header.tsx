import React from 'react';
import { DAY, DAYTRAINS, fmt } from '../utils/timetable';

interface HeaderProps {
  mode: 'live' | 'sim';
  playing: boolean;
  speed: number;
  min: number;
  day: number;
  todayWd: number;
  liveSecs: number;
  whenText: string;
  onSelectDay: (day: number) => void;
  onDateChange: (dateStr: string) => void;
  onGoLive: () => void;
  onTogglePlay: () => void;
  onChangeSpeed: (speed: number) => void;
  onSliderChange: (val: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  playing,
  speed,
  min,
  day,
  todayWd,
  liveSecs,
  whenText,
  onSelectDay,
  onDateChange,
  onGoLive,
  onTogglePlay,
  onChangeSpeed,
  onSliderChange,
}) => {
  const isLive = mode === 'live';
  const isPlaying = isLive || playing;

  // Format current clock display
  let secs = isLive ? liveSecs : min * 60;
  secs = ((secs % 86400) + 86400) % 86400;
  const clockText = [
    Math.floor(secs / 3600),
    Math.floor(secs / 60) % 60,
    Math.floor(secs) % 60,
  ]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');

  const pillText = isLive
    ? '即時'
    : playing
    ? `模擬 ${speed}×`
    : '模擬 · 暫停';

  return (
    <header className="top">
      <div className="brand">
        <svg width="46" height="28" viewBox="0 0 46 28" aria-hidden="true">
          <path
            d="M45 6H22C14 6 7 10 3 17C2 19 2 21 4 22H45Z"
            fill="var(--train-white)"
            stroke="var(--ink)"
            strokeWidth="1.4"
          />
          <path
            d="M4 20C12 17 20 16 30 16H45"
            fill="none"
            stroke="var(--train-orange)"
            strokeWidth="2.2"
          />
          <path
            d="M5 21.5C13 19.5 21 19 30 19H45"
            fill="none"
            stroke="var(--train-black)"
            strokeWidth="1.6"
          />
          <path
            d="M13 12C17 9.5 21 9 26 9V12.5L13 13.5Z"
            fill="var(--train-glass)"
          />
        </svg>
        <div>
          <h1>台灣高鐵動態系統</h1>
          <p>南港 ⇄ 左營 · 12 站 · N700ST · 2026/2/2 起適用時刻表</p>
        </div>
      </div>

      <div className="clock">
        <time id="clock" className="num">
          {clockText}
        </time>
        <div className="when">
          <span className={`pill ${isLive ? 'live' : 'sim'}`}>
            <i></i>
            <span>{pillText}</span>
          </span>
          <b id="whenText">{whenText}</b>
        </div>
      </div>

      <div className="toolbar">
        <div className="days" role="group" aria-label="選擇星期班表">
          {DAY.map((d, i) => {
            const count = DAYTRAINS[i]?.length ?? 0;
            const isSelected = i === day;
            const isToday = i === todayWd;
            return (
              <button
                key={i}
                type="button"
                aria-pressed={isSelected}
                className={isToday ? 'today' : ''}
                title={`週${d}班表：${count} 班`}
                onClick={() => onSelectDay(i)}
              >
                <b>{d}</b>
                <span>{count}</span>
              </button>
            );
          })}
        </div>

        <label className="field" htmlFor="datePick">
          指定日期{' '}
          <input
            type="date"
            id="datePick"
            onChange={(e) => onDateChange(e.target.value)}
          />
        </label>

        <div className="play">
          <button
            type="button"
            className="btn"
            id="liveBtn"
            aria-pressed={isLive}
            title="回到台灣現在時間"
            onClick={onGoLive}
          >
            ● 即時
          </button>
          <button
            type="button"
            className="btn icon"
            id="playBtn"
            aria-label={isPlaying ? '暫停' : '播放'}
            onClick={onTogglePlay}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <select
            id="speedSel"
            className="btn"
            aria-label="模擬速度"
            value={speed}
            onChange={(e) => onChangeSpeed(Number(e.target.value))}
          >
            <option value="1">1×</option>
            <option value="10">10×</option>
            <option value="60">60×</option>
            <option value="300">300×</option>
            <option value="900">900×</option>
          </select>
          <input
            type="range"
            id="slider"
            min={300}
            max={1500}
            step={1}
            value={Math.max(300, Math.min(1500, Math.floor(min)))}
            aria-label="模擬時間"
            onChange={(e) => onSliderChange(Number(e.target.value))}
          />
          <output id="sliderOut" htmlFor="slider">
            {fmt(Math.floor(min))}
          </output>
        </div>
      </div>
    </header>
  );
};

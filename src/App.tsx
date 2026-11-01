import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActiveTrain,
  BoundingBox,
  RegionKey,
  TabKey,
} from './types/thsr';
import {
  DAY,
  taipeiNow,
  TaipeiTime,
  computeActiveTrains,
} from './utils/timetable';
import { at, REGIONS } from './utils/geo';
import { Header } from './components/Header';
import { MapComponent } from './components/Map';
import { SummaryCard } from './components/SummaryCard';
import { DetailCard } from './components/DetailCard';
import { TabsCard } from './components/TabsCard';

export const App: React.FC = () => {
  // Simulation / Live state
  const [mode, setMode] = useState<'live' | 'sim'>('live');
  const [playing, setPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(60);
  const [day, setDay] = useState<number>(0);
  const [min, setMin] = useState<number>(480);
  const [simDate, setSimDate] = useState<{ y: number; mo: number; d: number } | null>(null);
  const [liveDate, setLiveDate] = useState<TaipeiTime>(taipeiNow());
  const [isLate, setIsLate] = useState<boolean>(false);

  // Selection & UI navigation
  const [selectedTrainNo, setSelectedTrainNo] = useState<string | null>(null);
  const [selectedStationIdx, setSelectedStationIdx] = useState<number>(6); // Default Taichung (6)
  const [tab, setTab] = useState<TabKey>('run');
  const [region, setRegion] = useState<RegionKey>('all');
  const [targetVb, setTargetVb] = useState<BoundingBox | null>(null);

  // Active trains list
  const [activeTrains, setActiveTrains] = useState<ActiveTrain[]>([]);

  // Refs for animation loop
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const dayRef = useRef(day);
  dayRef.current = day;
  const minRef = useRef(min);
  minRef.current = min;
  const simDateRef = useRef(simDate);
  simDateRef.current = simDate;

  // Sync Live time with Asia/Taipei timezone
  const syncLiveTime = useCallback(() => {
    const n = taipeiNow();
    const late = n.h < 2;
    const computedDay = late ? (n.wd + 6) % 7 : n.wd;
    const computedMin = n.sec / 60 + (late ? 1440 : 0);

    setLiveDate(n);
    setIsLate(late);
    setDay(computedDay);
    setMin(computedMin);
    dayRef.current = computedDay;
    minRef.current = computedMin;
  }, []);

  // Enter simulation mode
  const enterSim = useCallback((play = true) => {
    setMode('sim');
    setPlaying(play);
  }, []);

  // Back to real live time
  const handleGoLive = useCallback(() => {
    setMode('live');
    setSimDate(null);
    simDateRef.current = null;
    const dateInput = document.getElementById('datePick') as HTMLInputElement | null;
    if (dateInput) dateInput.value = '';
    syncLiveTime();
  }, [syncLiveTime]);

  // Select day of week
  const handleSelectDay = useCallback(
    (d: number, dateObj: { y: number; mo: number; d: number } | null = null) => {
      enterSim(true);
      setDay(d);
      dayRef.current = d;
      setSimDate(dateObj);
      simDateRef.current = dateObj;
      if (!dateObj) {
        const dateInput = document.getElementById('datePick') as HTMLInputElement | null;
        if (dateInput) dateInput.value = '';
      }
    },
    [enterSim]
  );

  // Date picker change
  const handleDateChange = useCallback(
    (dateStr: string) => {
      if (!dateStr) return;
      const [y, m, d] = dateStr.split('-').map(Number);
      const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
      handleSelectDay(wd, { y, mo: m, d });
    },
    [handleSelectDay]
  );

  // Jump to specific minute (e.g. 480 for 08:00)
  const handleJumpToTime = useCallback(
    (targetMin: number) => {
      enterSim(modeRef.current === 'sim' ? playingRef.current : false);
      setMin(targetMin);
      minRef.current = targetMin;
    },
    [enterSim]
  );

  // Toggle play/pause
  const handleTogglePlay = useCallback(() => {
    if (mode === 'live') {
      enterSim(false);
    } else {
      setPlaying((prev) => !prev);
    }
  }, [mode, enterSim]);

  // Speed change
  const handleChangeSpeed = useCallback(
    (newSpeed: number) => {
      setSpeed(newSpeed);
      if (mode === 'live') {
        enterSim(true);
      } else {
        setPlaying(true);
      }
    },
    [mode, enterSim]
  );

  // Slider scrub
  const handleSliderChange = useCallback(
    (newMin: number) => {
      enterSim(modeRef.current === 'sim' ? playingRef.current : false);
      setMin(newMin);
      minRef.current = newMin;
    },
    [enterSim]
  );

  // Set region preset
  const handleSetRegion = useCallback((newRegion: RegionKey) => {
    setRegion(newRegion);
    if (REGIONS[newRegion]) {
      setTargetVb(REGIONS[newRegion]());
    }
  }, []);

  // Select station
  const handleSelectStation = useCallback(
    (idx: number, fromMap = false) => {
      setSelectedStationIdx(idx);
      if (fromMap) {
        setTab('board');
      }
    },
    []
  );

  // Select train
  const handleSelectTrain = useCallback((no: string | null) => {
    setSelectedTrainNo(no);
    if (no && window.innerWidth <= 960) {
      setTimeout(() => {
        const detailEl = document.getElementById('detail');
        if (detailEl) {
          const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          detailEl.scrollIntoView({
            behavior: prefersReduced ? 'auto' : 'smooth',
            block: 'start',
          });
        }
      }, 50);
    }
  }, []);

  // Locate train on map
  const handleLocateTrain = useCallback(
    (no: string) => {
      const active = activeTrains.find((x) => x.tr.no === no);
      if (!active) return;
      const p = at(active.pos.s);
      const w = 700;
      setTargetVb({
        x: p.x - w / 2,
        y: p.y - w / 2,
        w,
        h: w,
      });
      setRegion('all');
    },
    [activeTrains]
  );

  // Animation frame loop for simulation & clock updates
  useEffect(() => {
    syncLiveTime();
    let lastTime = performance.now();
    let animId: number;

    const frame = (now: number) => {
      const dt = Math.min(1, (now - lastTime) / 1000);
      lastTime = now;

      if (modeRef.current === 'live') {
        const n = taipeiNow();
        const late = n.h < 2;
        const computedDay = late ? (n.wd + 6) % 7 : n.wd;
        const computedMin = n.sec / 60 + (late ? 1440 : 0);

        setLiveDate(n);
        setIsLate(late);
        setDay(computedDay);
        setMin(computedMin);
        dayRef.current = computedDay;
        minRef.current = computedMin;
      } else if (playingRef.current) {
        let curMin = minRef.current + (dt * speedRef.current) / 60;
        if (curMin > 1500) {
          curMin = 300;
          const nextDay = (dayRef.current + 1) % 7;
          setDay(nextDay);
          dayRef.current = nextDay;

          if (simDateRef.current) {
            const nextDate = new Date(
              Date.UTC(
                simDateRef.current.y,
                simDateRef.current.mo - 1,
                simDateRef.current.d + 1
              )
            );
            const nextSimDate = {
              y: nextDate.getUTCFullYear(),
              mo: nextDate.getUTCMonth() + 1,
              d: nextDate.getUTCDate(),
            };
            setSimDate(nextSimDate);
            simDateRef.current = nextSimDate;
          }
        }
        setMin(curMin);
        minRef.current = curMin;
      }

      // Compute active trains
      const curTrains = computeActiveTrains(dayRef.current, minRef.current);
      setActiveTrains(curTrains);

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [syncLiveTime]);

  // Formatted when description string
  let whenText = '';
  if (mode === 'live') {
    whenText =
      `${liveDate.y}/${liveDate.mo}/${liveDate.d}（${DAY[liveDate.wd]}）` +
      (isLate ? ` · 週${DAY[day]}班表延續` : '');
  } else if (simDate) {
    whenText = `${simDate.y}/${simDate.mo}/${simDate.d}（${DAY[day]}）· 週${DAY[day]}班表`;
  } else {
    whenText = `週${DAY[day]}班表`;
  }

  return (
    <div className="app">
      <Header
        mode={mode}
        playing={playing}
        speed={speed}
        min={min}
        day={day}
        todayWd={liveDate.wd}
        liveSecs={liveDate.sec}
        whenText={whenText}
        onSelectDay={handleSelectDay}
        onDateChange={handleDateChange}
        onGoLive={handleGoLive}
        onTogglePlay={handleTogglePlay}
        onChangeSpeed={handleChangeSpeed}
        onSliderChange={handleSliderChange}
      />

      <main className="main-grid">
        <MapComponent
          activeTrains={activeTrains}
          selectedTrainNo={selectedTrainNo}
          selectedStationIdx={selectedStationIdx}
          region={region}
          targetVb={targetVb}
          onSelectTrain={handleSelectTrain}
          onSelectStation={(idx) => handleSelectStation(idx, true)}
          onSetRegion={handleSetRegion}
          onJumpToTime={handleJumpToTime}
          min={min}
          dayText={`週${DAY[day]}`}
        />

        <aside className="rail">
          <SummaryCard
            day={day}
            activeCount={activeTrains.length}
            onSelectDay={handleSelectDay}
          />

          {selectedTrainNo && (
            <DetailCard
              trainNo={selectedTrainNo}
              day={day}
              min={min}
              onClose={() => setSelectedTrainNo(null)}
              onLocate={handleLocateTrain}
            />
          )}

          <TabsCard
            activeTrains={activeTrains}
            selectedTrainNo={selectedTrainNo}
            selectedStationIdx={selectedStationIdx}
            tab={tab}
            day={day}
            min={min}
            onSelectTab={setTab}
            onSelectTrain={handleSelectTrain}
            onSelectStation={(idx) => handleSelectStation(idx, false)}
            onJumpToTime={handleJumpToTime}
          />

          <p className="foot">
            資料來源：台灣高鐵〈2026/2/2 起適用時刻表〉（
            <a
              href="https://www.thsrc.com.tw/ArticleContent/a3b630bb-1066-4352-a1ef-58c7b4e8ef7c"
              target="_blank"
              rel="noopener noreferrer"
            >
              thsrc.com.tw
            </a>
            ）。列車位置依時刻表推算（停站 1
            分鐘、加減速估算），不含誤點等即時資訊；國定假日與連假疏運期間依高鐵另行公告之時刻表行駛，本系統未納入。
          </p>
        </aside>
      </main>
    </div>
  );
};
export default App;

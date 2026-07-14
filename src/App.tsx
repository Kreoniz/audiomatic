import { useEffect, useMemo, useRef, useState } from 'react';
import { InstrumentStage, type InstrumentStageHandle } from './components/InstrumentStage';
import { RangeControl } from './components/RangeControl';
import { AudioEngine } from './lib/audio';
import { canRecord, downloadBlob, recordCanvas } from './lib/recording';
import { THEMES } from './lib/themes';
import {
  DEFAULT_SETTINGS,
  type InstrumentSettings,
  type KeyId,
  type ProgressionId,
  type RhythmId,
  type ScaleId,
  type ThemeId,
} from './types';

const STORAGE_KEY = 'audiomatic:settings:v1';

function restoreSettings(): InstrumentSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function App() {
  const [settings, setSettings] = useState<InstrumentSettings>(restoreSettings);
  const [paused, setPaused] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [recording, setRecording] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const stageRef = useRef<InstrumentStageHandle>(null);
  const audio = useMemo(() => new AudioEngine(), []);
  const theme = THEMES[settings.theme];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  const patchSettings = (patch: Partial<InstrumentSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  const wakeAudio = async () => {
    if (!settings.soundEnabled) return;
    await audio.start();
    setAudioReady(true);
  };

  const newVariation = () => {
    setSeed(Math.floor(Math.random() * 1_000_000));
    setNotice('New composition generated');
    window.setTimeout(() => setNotice(''), 1800);
  };

  const startRecording = async (duration: number) => {
    const canvas = stageRef.current?.canvas;
    if (!canvas || recording !== null) return;
    if (!canRecord()) {
      setNotice('Recording is not supported in this browser');
      return;
    }

    try {
      if (settings.soundEnabled) {
        await audio.start();
        setAudioReady(true);
      }
      setPaused(false);
      setRecording(duration);
      const blob = await recordCanvas({
        canvas,
        audioTracks: settings.soundEnabled ? audio.getRecordingTracks() : [],
        duration,
        onTick: setRecording,
      });
      downloadBlob(blob, `audiomatic-${settings.theme}-${seed}.webm`);
      setNotice('Your performance is ready');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Recording failed');
    } finally {
      setRecording(null);
      window.setTimeout(() => setNotice(''), 2600);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="Audiomatic home">
          <span className="brand__mark"><i /><i /><i /></span>
          <span>AUDIOMATIC</span>
        </a>
        <div className="topbar__meta">
          <span>ORBITAL CLOCK</span>
          <span className="status-pill"><i /> AUDIOVISUAL</span>
        </div>
      </header>

      <section className="hero-copy">
        <p className="eyebrow">TIME, COMPOSED</p>
        <h1>Make motion<br /><em>sound inevitable.</em></h1>
        <p className="lede">A perpetual clock of glass and light: familiar enough to follow, alive enough to never quite repeat.</p>
      </section>

      <section className="workspace">
        <div className="stage-column">
          <InstrumentStage
            ref={stageRef}
            settings={settings}
            audio={audio}
            audioReady={audioReady}
            paused={paused}
            seed={seed}
            onWakeAudio={wakeAudio}
          />
          <div className="transport">
            <button className="transport__primary" onClick={() => setPaused((value) => !value)}>
              <span>{paused ? '▶' : 'Ⅱ'}</span> {paused ? 'Play' : 'Pause'}
            </button>
            <button onClick={newVariation}>↻ New variation</button>
            <div className="transport__seed">SEED <strong>{String(seed).padStart(6, '0')}</strong></div>
          </div>
        </div>

        <aside className="control-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ART DIRECTION</span>
              <h2>Atmosphere</h2>
            </div>
            <span className="panel-index">01</span>
          </div>

          <div className="theme-switcher">
            {(Object.keys(THEMES) as ThemeId[]).map((themeId) => (
              <button
                key={themeId}
                className={settings.theme === themeId ? 'active' : ''}
                onClick={() => patchSettings({ theme: themeId })}
              >
                <span className={`theme-swatch theme-swatch--${themeId}`} />
                <span><strong>{THEMES[themeId].label}</strong><small>{THEMES[themeId].description}</small></span>
              </button>
            ))}
          </div>

          <div className="panel-divider" />
          <div className="panel-heading panel-heading--compact">
            <div><span className="eyebrow">COMPOSITION</span><h2>Movement</h2></div>
            <span className="panel-index">02</span>
          </div>

          <div className="ranges">
            <RangeControl label="Tempo" hint="Musical and orbital pulse" value={settings.energy} valueLabel={`${Math.round(62 + settings.energy * 0.78)} bpm`} onChange={(energy) => patchSettings({ energy })} />
            <RangeControl label="Voices" hint="Number of orbiting marbles" value={settings.density} valueLabel={`${5 + Math.round(settings.density / 14)}`} onChange={(density) => patchSettings({ density })} />
            <RangeControl label="Drift" hint="Predictability versus surprise" value={settings.drift} valueLabel={`${settings.drift}%`} onChange={(drift) => patchSettings({ drift })} />
            <RangeControl label="Afterglow" hint="Length of light trails" value={settings.trails} onChange={(trails) => patchSettings({ trails })} />
          </div>

          <div className="panel-divider" />
          <div className="panel-heading panel-heading--compact">
            <div><span className="eyebrow">MUSIC SYSTEM</span><h2>Shape the score</h2></div>
            <span className="panel-index">03</span>
          </div>

          <label className="select-control">
            <span><strong>Key</strong><small>Tonal center of the piece</small></span>
            <select value={settings.key} onChange={(event) => patchSettings({ key: event.target.value as KeyId })}>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="Eb">E♭</option>
              <option value="F">F</option>
              <option value="G">G</option>
              <option value="A">A</option>
            </select>
          </label>

          <label className="select-control">
            <span><strong>Musical scale</strong><small>Notes stay harmonically related</small></span>
            <select value={settings.scale} onChange={(event) => patchSettings({ scale: event.target.value as ScaleId })}>
              <option value="pentatonic">Pentatonic</option>
              <option value="minor">Natural minor</option>
              <option value="major">Major</option>
            </select>
          </label>

          <label className="select-control">
            <span><strong>Progression</strong><small>Slow harmonic movement</small></span>
            <select value={settings.progression} onChange={(event) => patchSettings({ progression: event.target.value as ProgressionId })}>
              <option value="orbit">Orbit</option>
              <option value="nocturne">Nocturne</option>
              <option value="sunrise">Sunrise</option>
            </select>
          </label>

          <label className="select-control">
            <span><strong>Rhythm</strong><small>Speed of the orbital polyrhythm</small></span>
            <select value={settings.rhythm} onChange={(event) => patchSettings({ rhythm: event.target.value as RhythmId })}>
              <option value="sparse">Sparse</option>
              <option value="flowing">Flowing</option>
              <option value="pulse">Pulse</option>
            </select>
          </label>

          <div className="ranges sound-ranges">
            <RangeControl label="Warmth" hint="Soft versus crystalline" value={settings.warmth} valueLabel={`${settings.warmth}%`} onChange={(warmth) => patchSettings({ warmth })} />
            <RangeControl label="Space" hint="Echo and atmosphere" value={settings.space} valueLabel={`${settings.space}%`} onChange={(space) => patchSettings({ space })} />
            <RangeControl label="Note length" hint="Plucked versus connected" value={settings.noteLength} valueLabel={`${settings.noteLength}%`} onChange={(noteLength) => patchSettings({ noteLength })} />
          </div>

          <label className="toggle-control">
            <span><strong>Harmonic bed</strong><small>Inner sphere opens each chord</small></span>
            <input type="checkbox" checked={settings.padEnabled} onChange={(event) => patchSettings({ padEnabled: event.target.checked })} />
            <i />
          </label>

          <label className="toggle-control">
            <span><strong>Bass pulse</strong><small>Follows the inner sphere gate</small></span>
            <input type="checkbox" checked={settings.bassEnabled} onChange={(event) => patchSettings({ bassEnabled: event.target.checked })} />
            <i />
          </label>

          <label className="toggle-control">
            <span><strong>Sound engine</strong><small>Every note comes from a crossing</small></span>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(event) => patchSettings({ soundEnabled: event.target.checked })}
            />
            <i />
          </label>

          <div className="panel-divider" />
          <div className="panel-heading panel-heading--compact">
            <div><span className="eyebrow">CAPTURE</span><h2>Record the moment</h2></div>
            <span className="panel-index">04</span>
          </div>
          <div className="record-copy">
            <span>WEBM · 60 FPS · LIVE AUDIO</span>
            <p>Recording happens locally. Nothing leaves your browser.</p>
          </div>
          <div className="record-actions">
            {[10, 20, 30].map((duration) => (
              <button key={duration} disabled={recording !== null} onClick={() => startRecording(duration)}>
                {recording !== null ? (duration === 10 ? `● ${recording}s` : `${duration}s`) : `${duration}s`}
              </button>
            ))}
          </div>
        </aside>
      </section>

      <footer>
        <span>BUILT FOR BEAUTIFUL ACCIDENTS</span>
        <span>{theme.label.toUpperCase()} MODE / {settings.scale.toUpperCase()}</span>
      </footer>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}

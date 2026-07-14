import { useEffect, useMemo, useRef, useState } from 'react';
import { InstrumentStage, type InstrumentStageHandle } from './components/InstrumentStage';
import { RangeControl } from './components/RangeControl';
import { AudioEngine } from './lib/audio';
import { canRecord, downloadBlob, recordCanvas } from './lib/recording';
import { THEMES } from './lib/themes';
import { DEFAULT_SETTINGS, type InstrumentSettings, type ScaleId, type ThemeId } from './types';

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
      if (settings.soundEnabled) await audio.start();
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
          <span>MARBLE ORCHESTRA</span>
          <span className="status-pill"><i /> GENERATIVE</span>
        </div>
      </header>

      <section className="hero-copy">
        <p className="eyebrow">PHYSICS, COMPOSED</p>
        <h1>Make gravity<br /><em>sound beautiful.</em></h1>
        <p className="lede">Shape a living score of glass, timber and light—then capture the performance as your own.</p>
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
            <RangeControl label="Energy" hint="Gravity & velocity" value={settings.energy} onChange={(energy) => patchSettings({ energy })} />
            <RangeControl label="Density" hint="Number of performers" value={settings.density} onChange={(density) => patchSettings({ density })} />
            <RangeControl label="Afterglow" hint="Length of light trails" value={settings.trails} onChange={(trails) => patchSettings({ trails })} />
          </div>

          <label className="select-control">
            <span><strong>Musical scale</strong><small>Notes stay harmonically related</small></span>
            <select value={settings.scale} onChange={(event) => patchSettings({ scale: event.target.value as ScaleId })}>
              <option value="pentatonic">Pentatonic</option>
              <option value="minor">Natural minor</option>
              <option value="major">Major</option>
            </select>
          </label>

          <label className="toggle-control">
            <span><strong>Sound engine</strong><small>Collision-driven synthesis</small></span>
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
            <span className="panel-index">03</span>
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

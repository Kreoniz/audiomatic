export type ThemeId = 'luminous' | 'tactile' | 'editorial';
export type ScaleId = 'pentatonic' | 'minor' | 'major';
export type KeyId = 'C' | 'D' | 'Eb' | 'F' | 'G' | 'A';
export type ProgressionId = 'orbit' | 'nocturne' | 'sunrise';
export type RhythmId = 'sparse' | 'flowing' | 'pulse';

export interface InstrumentSettings {
  theme: ThemeId;
  energy: number;
  density: number;
  drift: number;
  trails: number;
  scale: ScaleId;
  key: KeyId;
  progression: ProgressionId;
  rhythm: RhythmId;
  warmth: number;
  space: number;
  noteLength: number;
  bassEnabled: boolean;
  padEnabled: boolean;
  soundEnabled: boolean;
}

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  colors: {
    background: string;
    backgroundGlow: string;
    surface: string;
    surfaceEdge: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    muted: string;
  };
}

export const DEFAULT_SETTINGS: InstrumentSettings = {
  theme: 'luminous',
  energy: 48,
  density: 42,
  drift: 34,
  trails: 66,
  scale: 'pentatonic',
  key: 'C',
  progression: 'orbit',
  rhythm: 'flowing',
  warmth: 62,
  space: 54,
  noteLength: 58,
  bassEnabled: true,
  padEnabled: true,
  soundEnabled: true,
};

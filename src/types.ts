export type ThemeId = 'luminous' | 'tactile' | 'editorial';
export type ScaleId = 'pentatonic' | 'minor' | 'major';

export interface InstrumentSettings {
  theme: ThemeId;
  energy: number;
  density: number;
  drift: number;
  trails: number;
  scale: ScaleId;
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
  soundEnabled: true,
};

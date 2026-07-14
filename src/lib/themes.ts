import type { ThemeDefinition, ThemeId } from '../types';

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  luminous: {
    id: 'luminous',
    label: 'Luminous',
    description: 'Glass, aurora and midnight air',
    colors: {
      background: '#06100f',
      backgroundGlow: '#173f37',
      surface: '#16342f',
      surfaceEdge: '#72e7c2',
      primary: '#a5f2d8',
      secondary: '#c7a6ff',
      accent: '#f6d58b',
      text: '#effff9',
      muted: '#8ca9a0',
    },
  },
  tactile: {
    id: 'tactile',
    label: 'Tactile',
    description: 'Warm timber and painted toys',
    colors: {
      background: '#211510',
      backgroundGlow: '#6b3525',
      surface: '#6f4532',
      surfaceEdge: '#f1bd77',
      primary: '#ffcf75',
      secondary: '#ef6f61',
      accent: '#74c6a4',
      text: '#fff8ea',
      muted: '#bca593',
    },
  },
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    description: 'Ink, paper and precise geometry',
    colors: {
      background: '#f1efe9',
      backgroundGlow: '#d4d7cf',
      surface: '#deddd7',
      surfaceEdge: '#202522',
      primary: '#202522',
      secondary: '#d0523f',
      accent: '#356e65',
      text: '#151a17',
      muted: '#6f746f',
    },
  },
};

import { extendTheme } from '@mui/joy/styles';

// MovieNight theme: projection-booth black with the brand gold as the one
// signal. Surfaces, text and rules read the Hallmark tokens in `tokens.css`
// (`--color-*`), so the CSS and Joy share one source. The primary and neutral
// ramps stay literal because Joy derives channel values from them.
const theme = extendTheme({
  fontFamily: {
    display: 'var(--font-display)',
    body: 'var(--font-body)',
    code: 'var(--font-mono)',
  },
  fontWeight: {
    sm: 400,
    md: 400,
    lg: 600,
    xl: 800,
  },
  radius: {
    xs: '3px',
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
  },
  typography: {
    h1: { fontWeight: 800, letterSpacing: 0, lineHeight: 1 },
    h2: { fontWeight: 800, letterSpacing: 0, lineHeight: 1 },
    h3: { fontWeight: 800, letterSpacing: 0, lineHeight: 1.05 },
    h4: { fontWeight: 800, letterSpacing: 0, lineHeight: 1.1 },
  },
  colorSchemes: {
    dark: {
      palette: {
        primary: {
          50: '#fffbf0',
          100: '#fff3cc',
          200: '#ffe999',
          300: '#ffdc66',
          400: '#ffd133',
          500: '#f5c518',
          600: '#c9a000',
          700: '#9d7d00',
          800: '#715a00',
          900: '#453700',
          solidBg: 'var(--color-accent)',
          solidColor: 'var(--color-accent-ink)',
          solidHoverBg: '#ffd133',
          solidActiveBg: '#c9a000',
          outlinedBorder: 'rgba(245, 197, 24, 0.55)',
          outlinedColor: '#ffd133',
          outlinedHoverBg: 'rgba(245, 197, 24, 0.10)',
          softBg: 'rgba(245, 197, 24, 0.14)',
          softColor: '#ffd133',
          softHoverBg: 'rgba(245, 197, 24, 0.22)',
          plainColor: '#ffd133',
          plainHoverBg: 'rgba(245, 197, 24, 0.10)',
        },
        danger: {
          500: '#e5534b',
          solidBg: '#c4382f',
          solidHoverBg: '#d9443a',
          outlinedBorder: 'rgba(229, 83, 75, 0.6)',
          outlinedColor: '#f08a83',
          plainColor: '#f08a83',
          softBg: 'rgba(229, 83, 75, 0.14)',
          softColor: '#f4a29c',
        },
        success: {
          500: '#4fb985',
          solidBg: '#2f7d57',
          plainColor: '#7fd1a8',
          softBg: 'rgba(79, 185, 133, 0.14)',
          softColor: '#8fd8b3',
        },
        warning: {
          500: '#f5a623',
          softBg: 'rgba(245, 166, 35, 0.14)',
          softColor: '#fbc45a',
        },
        // Warm greys to match the paper (hue ~70), replacing the old navy ramp.
        neutral: {
          50: '#f3f0ea',
          100: '#e3ded5',
          200: '#c9c3b8',
          300: '#aaa398',
          400: '#8a8378',
          500: '#6d675d',
          600: '#524d45',
          700: '#3a3631',
          800: '#2a2724',
          900: '#1d1b19',
          outlinedBorder: 'var(--color-rule-strong)',
          outlinedColor: 'var(--color-ink-2)',
          outlinedHoverBg: 'var(--color-hover)',
          softBg: 'var(--color-hover)',
          softColor: 'var(--color-ink-2)',
          softHoverBg: 'rgba(243, 240, 234, 0.08)',
          plainColor: 'var(--color-ink-2)',
          plainHoverBg: 'var(--color-hover)',
        },
        background: {
          body: 'var(--color-paper)',
          surface: 'var(--color-paper-2)',
          popup: 'var(--color-paper-3)',
          level1: 'var(--color-paper-2)',
          level2: 'var(--color-paper-3)',
          level3: 'var(--color-rule-strong)',
          backdrop: 'var(--color-scrim)',
        },
        text: {
          primary: 'var(--color-ink)',
          secondary: 'var(--color-ink-2)',
          tertiary: 'var(--color-muted)',
          icon: 'var(--color-ink-2)',
        },
        divider: 'var(--color-rule)',
        focusVisible: 'var(--color-focus)',
      },
    },
  },
  components: {
    JoySheet: {
      styleOverrides: {
        root: {
          '--Sheet-background': 'var(--joy-palette-background-surface)',
        },
      },
    },
    JoyInput: {
      styleOverrides: {
        root: {
          '--Input-focusedHighlight': 'var(--color-focus)',
          backgroundColor: 'var(--color-paper-2)',
          borderColor: 'var(--color-rule-strong)',
          '&:hover': { borderColor: 'var(--color-muted)' },
        },
      },
    },
    JoyButton: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          fontWeight: 600,
          transitionProperty: 'background-color, color, border-color',
          transitionDuration: 'var(--dur-micro)',
          '&:active': { transform: 'translateY(1px)' },
          '&:disabled, &[aria-disabled="true"]': { opacity: 0.55, cursor: 'not-allowed' },
          '&:focus-visible': {
            outline: '2px solid var(--joy-palette-focusVisible)',
            outlineOffset: '2px',
          },
        },
      },
    },
    JoyIconButton: {
      styleOverrides: {
        root: {
          '&:active': { transform: 'translateY(1px)' },
          '&:disabled': { opacity: 0.55, cursor: 'not-allowed' },
          '&:focus-visible': {
            outline: '2px solid var(--joy-palette-focusVisible)',
            outlineOffset: '2px',
            opacity: 1,
          },
        },
      },
    },
    JoyChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.75rem',
          borderRadius: '4px',
        },
      },
    },
    JoyModalDialog: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          boxShadow: 'none',
          border: '1px solid var(--color-rule-strong)',
        },
      },
    },
  },
});

export default theme;

// Shows repaint the whole `primary` palette from gold → sky blue. These override
// the Joy-generated `--joy-palette-primary-*` custom properties on :root while the
// Shows kind is active (see KindPalette), so every `primary.*` reference and the
// mainChannel-based rgba() composites switch together. Mirrors the gold scale's
// structure so solid/outlined/soft/plain variants all track. The Hallmark
// `--color-accent` / `--color-focus` tokens are repainted too, so raw CSS follows.
export const SHOW_PALETTE_VARS: Record<string, string> = {
  '--joy-palette-primary-50': '#f0f9ff',
  '--joy-palette-primary-100': '#e0f2fe',
  '--joy-palette-primary-200': '#bae6fd',
  '--joy-palette-primary-300': '#7dd3fc',
  '--joy-palette-primary-400': '#38bdf8',
  '--joy-palette-primary-500': '#0ea5e9',
  '--joy-palette-primary-600': '#0284c7',
  '--joy-palette-primary-700': '#0369a1',
  '--joy-palette-primary-800': '#075985',
  '--joy-palette-primary-900': '#0c4a6e',
  '--joy-palette-primary-mainChannel': '14 165 233',
  '--joy-palette-primary-solidBg': '#0ea5e9',
  '--joy-palette-primary-solidColor': 'var(--color-accent-ink)',
  '--joy-palette-primary-solidHoverBg': '#38bdf8',
  '--joy-palette-primary-solidActiveBg': '#0284c7',
  '--joy-palette-primary-outlinedBorder': 'rgba(14, 165, 233, 0.55)',
  '--joy-palette-primary-outlinedColor': '#38bdf8',
  '--joy-palette-primary-outlinedHoverBg': 'rgba(14, 165, 233, 0.10)',
  '--joy-palette-primary-softBg': 'rgba(14, 165, 233, 0.14)',
  '--joy-palette-primary-softColor': '#7dd3fc',
  '--joy-palette-primary-softHoverBg': 'rgba(14, 165, 233, 0.22)',
  '--joy-palette-primary-plainColor': '#38bdf8',
  '--joy-palette-primary-plainHoverBg': 'rgba(14, 165, 233, 0.10)',
  '--color-accent': '#0ea5e9',
  '--color-focus': '#0ea5e9',
};

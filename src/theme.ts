import { extendTheme } from '@mui/joy/styles';

// Cinema-inspired dark theme
// Primary accent: warm gold (#f5c518) — classic movie gold
// Background: deep navy-black (#0d0f1a)
// Surfaces: layered dark blues (#141624, #1c1f30, #242840)
const theme = extendTheme({
  defaultColorScheme: 'dark',
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
          solidBg: '#f5c518',
          solidColor: '#0d0f1a',
          solidHoverBg: '#ffd133',
          solidActiveBg: '#c9a000',
          outlinedBorder: '#f5c518',
          outlinedColor: '#f5c518',
          outlinedHoverBg: 'rgba(245, 197, 24, 0.10)',
          softBg: 'rgba(245, 197, 24, 0.15)',
          softColor: '#ffd133',
          softHoverBg: 'rgba(245, 197, 24, 0.22)',
          plainColor: '#f5c518',
          plainHoverBg: 'rgba(245, 197, 24, 0.10)',
        },
        danger: {
          500: '#e04040',
          solidBg: '#c62828',
          solidHoverBg: '#e53935',
          outlinedBorder: '#e04040',
          outlinedColor: '#e04040',
          softBg: 'rgba(224, 64, 64, 0.15)',
          softColor: '#ef9a9a',
        },
        success: {
          500: '#4caf82',
          solidBg: '#2e7d58',
          softBg: 'rgba(76, 175, 130, 0.15)',
          softColor: '#80cfa9',
        },
        warning: {
          500: '#f5a623',
          softBg: 'rgba(245, 166, 35, 0.15)',
          softColor: '#fbc45a',
        },
        neutral: {
          50: '#f0f2f8',
          100: '#d4d8ec',
          200: '#b0b6d4',
          300: '#8c93bc',
          400: '#6870a4',
          500: '#555d90',
          600: '#3d4470',
          700: '#282e50',
          800: '#1c1f30',
          900: '#141624',
          outlinedBorder: '#2a2e4a',
          outlinedColor: '#9097b8',
          softBg: 'rgba(255,255,255,0.06)',
          softColor: '#b0b6d4',
          plainColor: '#9097b8',
          plainHoverBg: 'rgba(255,255,255,0.06)',
        },
        background: {
          body: '#0d0f1a',
          surface: '#141624',
          popup: '#1c1f30',
          level1: '#1c1f30',
          level2: '#242840',
          level3: '#2c3050',
        },
        text: {
          primary: '#f0f2f8',
          secondary: '#9097b8',
          tertiary: '#565a7a',
          icon: '#9097b8',
        },
        divider: 'rgba(255, 255, 255, 0.08)',
        focusVisible: 'rgba(245, 197, 24, 0.5)',
      },
    },
  },
  components: {
    JoyTable: {
      styleOverrides: {
        root: {
          '--TableCell-headBackground': '#1c1f30',
          '--TableCell-selectedBackground': 'rgba(245, 197, 24, 0.08)',
          '--Table-headerUnderlineThickness': '1px',
          '--TableRow-hoverBackground': 'rgba(255, 255, 255, 0.04)',
          '--TableCell-paddingX': '16px',
          '--TableCell-paddingY': '12px',
        },
      },
    },
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
          '--Input-focusedHighlight': '#f5c518',
          backgroundColor: '#1c1f30',
          borderColor: '#2a2e4a',
          '&:hover': { borderColor: '#363a5a' },
        },
      },
    },
    JoyButton: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          fontWeight: 600,
        },
      },
    },
    JoyChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.7rem',
        },
      },
    },
  },
});

export default theme;

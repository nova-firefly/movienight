import React, { useEffect } from 'react';
import { useKind } from '../../contexts/KindContext';
import { SHOW_PALETTE_VARS } from '../../theme';

/**
 * Repaints the Joy `primary` palette (gold → blue) while the Shows kind is
 * active by overriding the `--joy-palette-primary-*` custom properties on the
 * document root. Applying at :root (rather than a wrapper) means portalled
 * modals/tooltips switch too. Renders nothing.
 */
export const KindPalette: React.FC = () => {
  const { kind } = useKind();

  useEffect(() => {
    const root = document.documentElement;
    const keys = Object.keys(SHOW_PALETTE_VARS);
    if (kind === 'show') {
      for (const [name, value] of Object.entries(SHOW_PALETTE_VARS)) {
        root.style.setProperty(name, value);
      }
    } else {
      for (const name of keys) root.style.removeProperty(name);
    }
    return () => {
      for (const name of keys) root.style.removeProperty(name);
    };
  }, [kind]);

  return null;
};

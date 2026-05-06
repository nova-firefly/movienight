import React from 'react';
import { Box } from '@mui/joy';

export type PosterSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_PX: Record<PosterSize, { w: number; h: number; r: number }> = {
  xs: { w: 28, h: 42, r: 3 }, // table rows
  sm: { w: 40, h: 60, r: 4 }, // movie cards
  md: { w: 52, h: 78, r: 4 }, // inbox modal
  lg: { w: 92, h: 138, r: 6 }, // larger thumbnails
};

interface PosterProps {
  url?: string | null;
  alt?: string;
  size?: PosterSize;
}

const Poster: React.FC<PosterProps> = ({ url, alt = '', size = 'sm' }) => {
  const { w, h, r } = SIZE_PX[size];

  if (!url) {
    return (
      <Box
        sx={{
          width: w,
          height: h,
          bgcolor: 'background.level2',
          borderRadius: `${r}px`,
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      width={w}
      height={h}
      style={{
        width: w,
        height: h,
        objectFit: 'cover',
        borderRadius: r,
        flexShrink: 0,
        backgroundColor: 'var(--joy-palette-background-level2)',
      }}
    />
  );
};

export default Poster;

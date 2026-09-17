import React from 'react';
import { Chip } from '@mui/joy';
import { useKind } from '../../contexts/KindContext';

interface ThisOrThatBannerProps {
  hasEloData: boolean;
  isAuthenticated: boolean;
  onShowThisOrThat?: () => void;
}

const ThisOrThatBanner: React.FC<ThisOrThatBannerProps> = ({
  hasEloData,
  isAuthenticated,
  onShowThisOrThat,
}) => {
  const { kind } = useKind();
  if (!isAuthenticated || !onShowThisOrThat) return null;

  return (
    <Chip
      variant="soft"
      color="primary"
      size="sm"
      onClick={onShowThisOrThat}
      sx={{
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '0.7rem',
        opacity: 0.75,
        transition: 'opacity 0.15s',
        '&:hover': { opacity: 1 },
      }}
    >
      {hasEloData ? '▸ Keep ranking' : `▸ Rank ${kind === 'show' ? 'shows' : 'movies'}`}
    </Chip>
  );
};

export default ThisOrThatBanner;

import React from 'react';
import { Chip } from '@mui/joy';
import { Scale } from 'lucide-react';
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
      size="md"
      onClick={onShowThisOrThat}
      startDecorator={<Scale size={14} strokeWidth={2.25} aria-hidden />}
      sx={{ cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)' }}
    >
      {hasEloData ? 'Keep ranking' : `Rank ${kind === 'show' ? 'shows' : 'movies'}`}
    </Chip>
  );
};

export default ThisOrThatBanner;

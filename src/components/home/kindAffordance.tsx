import React from 'react';
import { Box, Button, Chip, Tooltip, Typography } from '@mui/joy';
import { BookmarkPlus, Film, Tv } from 'lucide-react';
import { ContentKind, Show } from '../../models/Content';

// Kind affordance helpers shared by ContentRow and ContentCard so the two never
// drift. Accent colours come from the --mn-kind-* tokens in index.css.

export const kindAccent = (kind: ContentKind) =>
  kind === 'show' ? 'var(--mn-kind-show)' : 'var(--mn-kind-movie)';

export const kindTint = (kind: ContentKind) =>
  kind === 'show' ? 'var(--mn-kind-show-tint)' : 'var(--mn-kind-movie-tint)';

// Kind label: icon + text, so kind is never conveyed by colour alone (WCAG 1.4.1).
// Set quiet (no fill) because every row carries one; the rank numeral is the loud part.
export const KindChip: React.FC<{ kind: ContentKind }> = ({ kind }) => {
  const isShow = kind === 'show';
  const Icon = isShow ? Tv : Film;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        color: kindAccent(kind),
        flexShrink: 0,
      }}
    >
      <Icon size={12} strokeWidth={2.25} aria-hidden />
      {isShow ? 'Show' : 'Movie'}
    </Box>
  );
};

// The queue's signature: the rank set in the marquee face. The top three take
// the kind colour; the rest sit back in muted ink.
export const RankNumeral: React.FC<{ rank: number; kind: ContentKind; size?: 'md' | 'lg' }> = ({
  rank,
  kind,
  size = 'lg',
}) => (
  <Typography
    component="span"
    aria-label={`Rank ${rank}`}
    sx={{
      fontFamily: 'display',
      fontWeight: 800,
      fontSize: size === 'lg' ? '2.25rem' : '1.75rem',
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
      color: rank <= 3 ? kindAccent(kind) : 'text.tertiary',
      display: 'inline-block',
      minWidth: size === 'lg' ? '2.5ch' : '2ch',
      textAlign: 'right',
    }}
  >
    {rank}
  </Typography>
);

// "N seasons, N episodes, year" for shows. Empty string when nothing is known.
export function showMetaLine(show: Show): string {
  const parts = [
    show.number_of_seasons != null
      ? `${show.number_of_seasons} season${show.number_of_seasons === 1 ? '' : 's'}`
      : null,
    show.number_of_episodes != null
      ? `${show.number_of_episodes} episode${show.number_of_episodes === 1 ? '' : 's'}`
      : null,
    show.first_air_year || null,
  ].filter(Boolean);
  return parts.join(', ');
}

// Episode-progress chip (e.g. "S2 E4"). Renders nothing until a value exists,
// so it stays invisible until the episode-progress feature (issue: TV Shows —
// episode progress) populates `Show.episode_progress`. The layout row that hosts
// it collapses when empty, so there is no placeholder clutter (D-12 intent —
// reserve the concept, not visible space).
export const EpisodeProgressChip: React.FC<{ value?: string | null }> = ({ value }) => {
  if (!value) return null;
  return (
    <Chip
      size="sm"
      variant="soft"
      sx={{
        '--Chip-minHeight': '18px',
        fontSize: '0.6rem',
        fontWeight: 700,
        bgcolor: 'var(--mn-kind-show-tint)',
        color: 'var(--mn-kind-show)',
        flexShrink: 0,
      }}
    >
      {value}
    </Chip>
  );
};

// Episode-progress control (issue #107). Replaces a bare pencil, which didn't
// say what it edited: with no progress yet it reads "Track progress"; once set,
// the "S2 E4" value is itself the button. Without `onEdit` (signed out) it is
// the read-only chip. `touch` sizes it to a 44px target for the phone card;
// otherwise it stays quiet until its row is hovered, like the other row actions.
export const EpisodeProgressControl: React.FC<{
  title: string;
  value?: string | null;
  onEdit?: () => void;
  touch?: boolean;
}> = ({ title, value, onEdit, touch = false }) => {
  if (!onEdit) return <EpisodeProgressChip value={value} />;
  const size = touch
    ? { minHeight: 44, px: 1.25 }
    : { '--Button-minHeight': '26px', minHeight: 26, px: 1, py: 0 };
  if (value) {
    return (
      <Tooltip title="Update progress" arrow>
        <Button
          size="sm"
          variant="soft"
          onClick={onEdit}
          aria-label={`Update progress for ${title}, now ${value}`}
          sx={{
            ...size,
            fontSize: 'var(--joy-fontSize-xs)',
            fontWeight: 700,
            bgcolor: 'var(--mn-kind-show-tint)',
            color: 'var(--mn-kind-show)',
            flexShrink: 0,
            '&:hover': {
              bgcolor: 'color-mix(in oklab, var(--mn-kind-show) 24%, transparent)',
            },
          }}
        >
          {value}
        </Button>
      </Tooltip>
    );
  }
  return (
    <Button
      size="sm"
      variant="plain"
      color="neutral"
      startDecorator={<BookmarkPlus size={14} strokeWidth={2.25} />}
      onClick={onEdit}
      aria-label={`Track progress for ${title}`}
      sx={{
        ...size,
        fontSize: 'var(--joy-fontSize-xs)',
        fontWeight: 600,
        color: 'text.secondary',
        flexShrink: 0,
        ...(touch
          ? {}
          : {
              opacity: 0.6,
              transitionProperty: 'opacity',
              transitionDuration: 'var(--dur-micro)',
              'tr:hover &, &:hover, &:focus-visible': { opacity: 1 },
            }),
      }}
    >
      Track progress
    </Button>
  );
};

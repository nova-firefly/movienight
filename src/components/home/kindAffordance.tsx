import React from 'react';
import { Box, Chip } from '@mui/joy';
import { Film, Tv } from 'lucide-react';
import { ContentKind, Show } from '../../models/Content';

// Kind affordance helpers shared by ContentRow and ContentCard so the two never
// drift. Accent colours come from the --mn-kind-* tokens in index.css.

export const kindAccent = (kind: ContentKind) =>
  kind === 'show' ? 'var(--mn-kind-show)' : 'var(--mn-kind-movie)';

export const kindTint = (kind: ContentKind) =>
  kind === 'show' ? 'var(--mn-kind-show-tint)' : 'var(--mn-kind-movie-tint)';

// Kind chip: icon + text, so kind is never conveyed by colour alone (WCAG 1.4.1).
export const KindChip: React.FC<{ kind: ContentKind }> = ({ kind }) => {
  const isShow = kind === 'show';
  const Icon = isShow ? Tv : Film;
  return (
    <Chip
      size="sm"
      variant="soft"
      startDecorator={<Icon size={11} strokeWidth={2.5} aria-hidden />}
      sx={{
        '--Chip-minHeight': '18px',
        '--Chip-gap': '2px',
        fontSize: '0.6rem',
        fontWeight: 700,
        bgcolor: kindTint(kind),
        color: kindAccent(kind),
        flexShrink: 0,
      }}
    >
      {isShow ? 'Show' : 'Movie'}
    </Chip>
  );
};

// "N seasons · N episodes · year" for shows. Empty string when nothing is known.
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
  return parts.join(' · ');
}

// Episode-progress chip (e.g. "S2 · E4"). Renders nothing until a value exists,
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

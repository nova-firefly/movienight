import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/joy';
import { Movie } from '../../models/Movies';
import Poster from '../common/Poster';

export interface MovieRowProps {
  movie: Movie;
  isAdmin: boolean;
  canMarkWatched: boolean;
  onMarkWatched: (id: string, title: string) => void;
  onDelete: (id: string, title: string) => void;
  onToggleSeen: (id: string, currentlySeen: boolean) => void;
  isAuthenticated: boolean;
  isRecentlyAdded?: boolean;
}

const cellStyle: React.CSSProperties = {
  verticalAlign: 'middle',
  padding: '8px 16px',
};

const cellStyleNarrow: React.CSSProperties = {
  verticalAlign: 'middle',
  padding: '12px 16px',
};

const cellStyleNoWrap: React.CSSProperties = {
  ...cellStyleNarrow,
  whiteSpace: 'nowrap',
};

const cellStyleCenter: React.CSSProperties = {
  verticalAlign: 'middle',
  padding: '12px 8px',
  textAlign: 'center',
};

const cellStyleSeen: React.CSSProperties = {
  verticalAlign: 'middle',
  padding: '0 4px',
  textAlign: 'center',
};

const cellStyleActions: React.CSSProperties = {
  verticalAlign: 'middle',
  padding: '0 12px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

const recentlyAddedRowStyle: React.CSSProperties = {
  background: 'rgba(var(--joy-palette-primary-mainChannel) / 0.06)',
  boxShadow: 'inset 3px 0 0 var(--joy-palette-primary-400)',
};

const MovieRow: React.FC<MovieRowProps> = ({
  movie,
  isAdmin,
  canMarkWatched,
  onMarkWatched,
  onDelete,
  onToggleSeen,
  isAuthenticated,
  isRecentlyAdded = false,
}) => {
  const isSeen = movie.myTags?.some((t) => t.tag.slug === 'seen') ?? false;
  const seenByUsers = (movie.userTags ?? []).filter((t) => t.tag.slug === 'seen');
  const seenCount = seenByUsers.length;
  const seenNames = seenByUsers.map((t) => t.user.display_name || t.user.username);
  const seenLabel = isSeen ? `Remove "Seen it" from ${movie.title}` : `Mark ${movie.title} as seen`;
  const seenTooltip =
    seenCount > 0
      ? `Seen by: ${seenNames.join(', ')}`
      : isSeen
        ? 'Remove "Seen it"'
        : "I've seen this";

  return (
    <tr style={isRecentlyAdded ? recentlyAddedRowStyle : undefined}>
      {/* Title */}
      <td style={cellStyle}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Poster url={movie.poster_url} size="xs" />
          <Typography level="body-sm" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {movie.title}
          </Typography>
        </Box>
      </td>

      {/* Suggested by */}
      <td style={cellStyleNarrow}>
        <Chip size="sm" variant="soft" color="neutral" sx={{ fontWeight: 500 }}>
          {movie.requester}
        </Chip>
      </td>

      {/* Date */}
      <td style={cellStyleNoWrap}>
        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
          {new Date(movie.date_submitted).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </Typography>
      </td>

      {/* TMDB */}
      <td style={cellStyleCenter}>
        {movie.tmdb_id ? (
          <a
            href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${movie.title} on TMDB (opens in new tab)`}
            style={{ color: 'var(--joy-palette-primary-500)', fontSize: '0.75rem' }}
          >
            ↗
          </a>
        ) : null}
      </td>

      {/* Seen it */}
      {isAuthenticated && (
        <td style={cellStyleSeen}>
          <Tooltip title={seenTooltip} placement="top" arrow>
            <IconButton
              size="sm"
              variant={isSeen ? 'soft' : 'plain'}
              color={isSeen ? 'warning' : 'neutral'}
              onClick={() => onToggleSeen(movie.id, isSeen)}
              aria-label={seenLabel}
              aria-pressed={isSeen}
              sx={{
                opacity: isSeen ? 0.95 : 0.5,
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 1 },
                fontSize: '0.85rem',
              }}
            >
              <span aria-hidden="true">{isSeen ? '👁' : '👁‍🗨'}</span>
              {seenCount > 0 && (
                <Typography
                  component="span"
                  level="body-xs"
                  sx={{ ml: 0.25, fontWeight: 700, fontSize: '0.6rem' }}
                  aria-label={`Seen by ${seenCount}`}
                >
                  {seenCount}
                </Typography>
              )}
            </IconButton>
          </Tooltip>
        </td>
      )}

      {/* Actions */}
      {(canMarkWatched || isAdmin) && (
        <td style={cellStyleActions}>
          {canMarkWatched && (
            <IconButton
              size="sm"
              color="success"
              variant="plain"
              onClick={() => onMarkWatched(movie.id, movie.title)}
              aria-label={`Mark "${movie.title}" as done`}
              title={`Mark "${movie.title}" as done`}
              sx={{
                opacity: 0.5,
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 1 },
                mr: isAdmin ? 0.5 : 0,
              }}
            >
              <span aria-hidden="true">✓</span>
            </IconButton>
          )}
          {isAdmin && (
            <IconButton
              size="sm"
              color="danger"
              variant="plain"
              onClick={() => onDelete(movie.id, movie.title)}
              aria-label={`Remove "${movie.title}"`}
              title={`Remove "${movie.title}"`}
              sx={{
                opacity: 0.5,
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 1 },
              }}
            >
              <span aria-hidden="true">✕</span>
            </IconButton>
          )}
        </td>
      )}
    </tr>
  );
};

export default MovieRow;

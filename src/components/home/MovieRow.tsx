import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/joy';
import { Movie } from '../../models/Movies';

export interface MovieRowProps {
  movie: Movie;
  isAdmin: boolean;
  canMarkWatched: boolean;
  onMarkWatched: (id: string, title: string) => void;
  onDelete: (id: string, title: string) => void;
  onToggleSeen: (id: string, currentlySeen: boolean) => void;
  isAuthenticated: boolean;
}

const MovieRow: React.FC<MovieRowProps> = ({
  movie,
  isAdmin,
  canMarkWatched,
  onMarkWatched,
  onDelete,
  onToggleSeen,
  isAuthenticated,
}) => {
  const isSeen = movie.myTags?.some((t) => t.tag.slug === 'seen') ?? false;
  const seenByUsers = (movie.userTags ?? []).filter((t) => t.tag.slug === 'seen');
  const seenCount = seenByUsers.length;
  const seenNames = seenByUsers.map((t) => t.user.display_name || t.user.username);

  return (
    <tr>
      {/* Title */}
      <td style={{ verticalAlign: 'middle', padding: '8px 16px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {movie.poster_url ? (
            <img
              src={movie.poster_url}
              alt=""
              style={{
                width: 28,
                height: 42,
                objectFit: 'cover',
                borderRadius: 3,
                flexShrink: 0,
              }}
            />
          ) : (
            <Box
              sx={{
                width: 28,
                height: 42,
                bgcolor: 'background.level2',
                borderRadius: '3px',
                flexShrink: 0,
              }}
            />
          )}
          <Typography level="body-sm" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {movie.title}
          </Typography>
        </Box>
      </td>

      {/* Suggested by */}
      <td style={{ verticalAlign: 'middle', padding: '12px 16px' }}>
        <Chip size="sm" variant="soft" color="neutral" sx={{ fontWeight: 500 }}>
          {movie.requester}
        </Chip>
      </td>

      {/* Date */}
      <td style={{ verticalAlign: 'middle', padding: '12px 16px', whiteSpace: 'nowrap' }}>
        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
          {new Date(movie.date_submitted).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </Typography>
      </td>

      {/* TMDB */}
      <td style={{ verticalAlign: 'middle', padding: '12px 8px', textAlign: 'center' }}>
        {movie.tmdb_id ? (
          <a
            href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--joy-palette-primary-500)', fontSize: '0.75rem' }}
          >
            ↗
          </a>
        ) : null}
      </td>

      {/* Seen it */}
      {isAuthenticated && (
        <td style={{ verticalAlign: 'middle', padding: '0 4px', textAlign: 'center' }}>
          <Tooltip
            title={
              seenCount > 0
                ? `Seen by: ${seenNames.join(', ')}`
                : isSeen
                  ? 'Remove "Seen it"'
                  : "I've seen this"
            }
            placement="top"
            arrow
          >
            <IconButton
              size="sm"
              variant="plain"
              color={isSeen ? 'warning' : 'neutral'}
              onClick={() => onToggleSeen(movie.id, isSeen)}
              sx={{
                opacity: isSeen ? 0.9 : 0.35,
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 1 },
                fontSize: '0.85rem',
              }}
            >
              {isSeen ? '👁' : '👁‍🗨'}
              {seenCount > 0 && (
                <Typography
                  component="span"
                  level="body-xs"
                  sx={{ ml: 0.25, fontWeight: 700, fontSize: '0.6rem' }}
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
        <td
          style={{
            verticalAlign: 'middle',
            padding: '0 12px',
            textAlign: 'right',
            whiteSpace: 'nowrap',
          }}
        >
          {canMarkWatched && (
            <IconButton
              size="sm"
              color="success"
              variant="plain"
              onClick={() => onMarkWatched(movie.id, movie.title)}
              title={`Mark "${movie.title}" as done`}
              sx={{
                opacity: 0.5,
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 1 },
                mr: isAdmin ? 0.5 : 0,
              }}
            >
              ✓
            </IconButton>
          )}
          {isAdmin && (
            <IconButton
              size="sm"
              color="danger"
              variant="plain"
              onClick={() => onDelete(movie.id, movie.title)}
              title={`Remove "${movie.title}"`}
              sx={{
                opacity: 0.5,
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 1 },
              }}
            >
              ✕
            </IconButton>
          )}
        </td>
      )}
    </tr>
  );
};

export default MovieRow;

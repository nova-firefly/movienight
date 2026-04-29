import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip, Sheet } from '@mui/joy';
import { Movie } from '../../models/Movies';

interface MovieCardProps {
  movie: Movie;
  rank?: number;
  isAdmin: boolean;
  canMarkWatched: boolean;
  onMarkWatched: (id: string, title: string) => void;
  onDelete: (id: string, title: string) => void;
  onToggleSeen: (id: string, currentlySeen: boolean) => void;
  isAuthenticated: boolean;
}

const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  rank,
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
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: 'md',
        mb: 1,
        p: 1.5,
        borderColor: 'var(--mn-border-vis)',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        {/* Rank */}
        {rank != null && (
          <Typography
            level="body-xs"
            sx={{
              fontWeight: 700,
              color: rank <= 3 ? 'primary.400' : 'text.tertiary',
              minWidth: 20,
              textAlign: 'right',
              pt: 0.5,
              flexShrink: 0,
            }}
          >
            {rank}
          </Typography>
        )}
        {/* Poster */}
        {movie.poster_url ? (
          <img
            src={movie.poster_url}
            alt=""
            style={{
              width: 40,
              height: 60,
              objectFit: 'cover',
              borderRadius: 4,
              flexShrink: 0,
            }}
          />
        ) : (
          <Box
            sx={{
              width: 40,
              height: 60,
              bgcolor: 'background.level2',
              borderRadius: '4px',
              flexShrink: 0,
            }}
          />
        )}

        {/* Details */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography level="body-sm" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {movie.title}
            {movie.tmdb_id && (
              <a
                href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--joy-palette-primary-500)',
                  fontSize: '0.7rem',
                  marginLeft: 4,
                }}
              >
                ↗
              </a>
            )}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
            <Chip
              size="sm"
              variant="soft"
              color="neutral"
              sx={{ fontWeight: 500, fontSize: '0.65rem' }}
            >
              {movie.requester}
            </Chip>
            <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
              {new Date(movie.date_submitted).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Actions */}
      {(isAuthenticated || canMarkWatched || isAdmin) && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 0.5,
            mt: 1,
            pt: 0.5,
            borderTop: '1px solid',
            borderColor: 'var(--mn-border)',
          }}
        >
          {isAuthenticated && (
            <Tooltip
              title={
                seenCount > 0
                  ? `Seen by: ${seenNames.join(', ')}`
                  : isSeen
                    ? 'Remove "Seen it"'
                    : "I've seen this"
              }
              arrow
            >
              <IconButton
                size="sm"
                variant="plain"
                color={isSeen ? 'warning' : 'neutral'}
                onClick={() => onToggleSeen(movie.id, isSeen)}
                sx={{
                  opacity: isSeen ? 0.9 : 0.35,
                  '&:hover': { opacity: 1 },
                  fontSize: '0.85rem',
                  minWidth: 36,
                  minHeight: 36,
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
          )}
          {canMarkWatched && (
            <IconButton
              size="sm"
              color="success"
              variant="soft"
              onClick={() => onMarkWatched(movie.id, movie.title)}
              sx={{ minWidth: 36, minHeight: 36 }}
            >
              ✓
            </IconButton>
          )}
          {isAdmin && (
            <IconButton
              size="sm"
              color="danger"
              variant="soft"
              onClick={() => onDelete(movie.id, movie.title)}
              sx={{ minWidth: 36, minHeight: 36 }}
            >
              ✕
            </IconButton>
          )}
        </Box>
      )}
    </Sheet>
  );
};

export default MovieCard;

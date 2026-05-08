import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip, Sheet } from '@mui/joy';
import Poster from '../common/Poster';

interface WatchHistoryCardProps {
  movie: any;
  canUnwatch: boolean;
  onUnwatch: (id: string, title: string) => void;
}

const WatchHistoryCard: React.FC<WatchHistoryCardProps> = ({ movie, canUnwatch, onUnwatch }) => (
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
      {/* Poster */}
      <Poster url={movie.poster_url} size="sm" />

      {/* Details */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography level="body-sm" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {movie.title}
          {movie.tmdb_id && (
            <a
              href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${movie.title} on TMDB (opens in new tab)`}
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
            {movie.watched_at
              ? new Date(movie.watched_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}
          </Typography>
        </Box>
      </Box>

      {/* Requeue action */}
      {canUnwatch && (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title="Watch again — put back in queue" arrow>
            <IconButton
              size="sm"
              color="primary"
              variant="soft"
              onClick={() => onUnwatch(movie.id, movie.title)}
              aria-label={`Watch "${movie.title}" again`}
              sx={{ minWidth: 36, minHeight: 36 }}
            >
              <span aria-hidden="true">↩</span>
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  </Sheet>
);

export default WatchHistoryCard;

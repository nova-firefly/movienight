import React from 'react';
import { Box, Typography, Chip, Button } from '@mui/joy';

interface ThisOrThatMovie {
  id: string;
  title: string;
  tmdb_id: number | null;
  poster_url: string | null;
  release_year: string | null;
  director: string | null;
  cast: string[];
  tags: string[];
}

interface MovieCompareCardProps {
  movie: ThisOrThatMovie;
  onPick: (id: string) => void;
  disabled?: boolean;
}

const MovieCompareCard: React.FC<MovieCompareCardProps> = ({ movie, onPick, disabled }) => (
  <Box
    onClick={() => {
      if (disabled) return;
      (document.activeElement as HTMLElement)?.blur();
      onPick(movie.id);
    }}
    sx={{
      flex: 1,
      cursor: disabled ? 'default' : 'pointer',
      borderRadius: 'lg',
      overflow: 'hidden',
      bgcolor: 'background.surface',
      border: '2px solid',
      borderColor: 'divider',
      transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
      opacity: disabled ? 0.5 : 1,
      '&:focus, &:focus-visible, &:focus-within': {
        outline: 'none',
        borderColor: 'divider',
      },
      '& .Mui-focusVisible': {
        outline: 'none',
        boxShadow: 'none',
        '--joy-focus-thickness': '0px',
      },
      '&:hover': disabled
        ? {}
        : {
            borderColor: 'primary.400',
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          },
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    {/* Poster */}
    <Box
      sx={{
        width: '100%',
        maxHeight: { xs: 'calc(50dvh - 80px)', sm: 'calc(70dvh - 100px)' },
        aspectRatio: '2/3',
        bgcolor: 'background.level2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {movie.poster_url ? (
        <img
          src={movie.poster_url}
          alt={movie.title}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <Typography level="body-sm" sx={{ color: 'text.tertiary', textAlign: 'center', px: 2 }}>
          No poster available
        </Typography>
      )}
    </Box>

    {/* Info */}
    <Box
      sx={{
        p: { xs: 0.75, sm: 1.5 },
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 0.25, sm: 0.5 },
      }}
    >
      <Typography
        level="title-sm"
        sx={{ fontWeight: 700, fontSize: { xs: '0.75rem', sm: '0.95rem' }, lineHeight: 1.3 }}
      >
        {movie.title}
        {movie.release_year && (
          <Typography component="span" level="body-xs" sx={{ color: 'text.secondary', ml: 0.5 }}>
            ({movie.release_year})
          </Typography>
        )}
      </Typography>

      {movie.director && (
        <Typography
          level="body-xs"
          sx={{ color: 'text.secondary', fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
        >
          {movie.director}
        </Typography>
      )}

      {movie.cast.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
          {movie.cast.map((name) => (
            <Chip
              key={name}
              size="sm"
              variant="soft"
              color="neutral"
              sx={{ '--Chip-minHeight': '20px', fontSize: { xs: '0.6rem', sm: '0.7rem' } }}
            >
              {name}
            </Chip>
          ))}
        </Box>
      )}

      {movie.tags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
          {movie.tags.map((tag) => (
            <Chip
              key={tag}
              size="sm"
              variant="outlined"
              color="primary"
              sx={{ '--Chip-minHeight': '20px', fontSize: { xs: '0.6rem', sm: '0.7rem' } }}
            >
              {tag}
            </Chip>
          ))}
        </Box>
      )}

      {!movie.tmdb_id && (
        <Typography level="body-xs" sx={{ color: 'text.tertiary', fontStyle: 'italic' }}>
          No TMDB match
        </Typography>
      )}

      <Box sx={{ mt: 'auto', pt: { xs: 0.5, sm: 0.75 } }}>
        <Button
          variant="solid"
          color="primary"
          fullWidth
          size="sm"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement).blur();
            onPick(movie.id);
          }}
          sx={{
            fontWeight: 700,
            color: '#0d0f1a',
            fontSize: { xs: '0.75rem', sm: '0.875rem' },
            '&:focus, &:focus-visible, &.Mui-focusVisible': {
              outline: 'none',
              outlineOffset: 0,
              boxShadow: 'none',
              '--joy-focus-thickness': '0px',
            },
          }}
        >
          Pick This One
        </Button>
      </Box>
    </Box>
  </Box>
);

export default MovieCompareCard;

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
    onClick={() => !disabled && onPick(movie.id)}
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
      '&:hover': disabled ? {} : {
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
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Typography level="body-sm" sx={{ color: 'text.tertiary', textAlign: 'center', px: 2 }}>
          No poster available
        </Typography>
      )}
    </Box>

    {/* Info */}
    <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography level="title-md" sx={{ fontWeight: 700 }}>
        {movie.title}
        {movie.release_year && (
          <Typography component="span" level="body-sm" sx={{ color: 'text.secondary', ml: 0.75 }}>
            ({movie.release_year})
          </Typography>
        )}
      </Typography>

      {movie.director && (
        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
          Directed by {movie.director}
        </Typography>
      )}

      {movie.cast.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {movie.cast.map((name) => (
            <Chip key={name} size="sm" variant="soft" color="neutral">
              {name}
            </Chip>
          ))}
        </Box>
      )}

      {movie.tags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {movie.tags.map((tag) => (
            <Chip key={tag} size="sm" variant="outlined" color="primary">
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

      <Box sx={{ mt: 'auto', pt: 1 }}>
        <Button
          variant="solid"
          color="primary"
          fullWidth
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onPick(movie.id); }}
          sx={{ fontWeight: 700, color: '#0d0f1a' }}
        >
          Pick This One
        </Button>
      </Box>
    </Box>
  </Box>
);

export default MovieCompareCard;

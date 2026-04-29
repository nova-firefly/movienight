import React, { useState, useEffect } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client';
import { Box, Button, Autocomplete, AutocompleteOption, ListItemContent } from '@mui/joy';
import { SEARCH_TMDB, ADD_MOVIE, SET_MOVIE_TAG, GET_MOVIES } from '../../graphql/queries';
import { useToast } from '../../contexts/ToastContext';
import { useDebounce } from '../../utils/useDebounce';

type TmdbOption = {
  tmdb_id: number;
  title: string;
  release_year: string | null;
  overview: string | null;
};

const AddMovieForm: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [title, setTitle] = useState('');
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [tmdbOptions, setTmdbOptions] = useState<TmdbOption[]>([]);
  const [lastAddedMovieId, setLastAddedMovieId] = useState<string | null>(null);

  const debouncedTitle = useDebounce(title, 400);

  const [searchTmdb, { loading: tmdbSearching }] = useLazyQuery(SEARCH_TMDB, {
    onCompleted: (d) => setTmdbOptions(d.searchTmdb || []),
    onError: () => setTmdbOptions([]),
  });

  useEffect(() => {
    if (debouncedTitle.trim().length >= 2) {
      searchTmdb({ variables: { query: debouncedTitle } });
    } else {
      setTmdbOptions([]);
    }
  }, [debouncedTitle, searchTmdb]);

  const [addMovie, { loading: adding }] = useMutation(ADD_MOVIE, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

  const [setMovieTag] = useMutation(SET_MOVIE_TAG, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      showError('Please enter a movie title.');
      return;
    }
    try {
      const { data: addData } = await addMovie({
        variables: { title: title.trim(), tmdb_id: tmdbId },
      });
      showSuccess('Added to the list!');
      setLastAddedMovieId(addData?.addMovie?.id ?? null);
      setTitle('');
      setTmdbId(null);
      setTmdbOptions([]);
      setTimeout(() => setLastAddedMovieId(null), 5000);
    } catch (error: any) {
      showError(`Error: ${error.message}`);
    }
  };

  const handleMarkSeen = async () => {
    if (!lastAddedMovieId) return;
    try {
      await setMovieTag({ variables: { movieId: lastAddedMovieId, tagSlug: 'seen' } });
      setLastAddedMovieId(null);
    } catch (err: any) {
      showError(`Error: ${err.message}`);
    }
  };

  const isSearching = tmdbSearching || (debouncedTitle !== title && title.trim().length >= 2);

  return (
    <Box sx={{ mb: 4 }}>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', gap: 1, maxWidth: 520, mx: 'auto' }}>
          <Autocomplete
            freeSolo
            loading={isSearching}
            options={tmdbOptions}
            getOptionLabel={(option) =>
              typeof option === 'string'
                ? option
                : option.release_year
                  ? `${option.title} (${option.release_year})`
                  : option.title
            }
            inputValue={title}
            onInputChange={(_, value) => {
              setTitle(value);
              if (!value) setTmdbId(null);
            }}
            onChange={(_, value) => {
              if (value && typeof value !== 'string') {
                setTitle(value.title);
                setTmdbId(value.tmdb_id);
              }
            }}
            renderOption={(props, option) => (
              <AutocompleteOption {...props} key={option.tmdb_id}>
                <ListItemContent>
                  <strong>{option.title}</strong>
                  {option.release_year && ` (${option.release_year})`}
                </ListItemContent>
              </AutocompleteOption>
            )}
            placeholder="Suggest a movie title..."
            sx={{
              flex: 1,
              bgcolor: 'background.surface',
              '--Input-focusedHighlight': 'var(--joy-palette-primary-500)',
            }}
          />
          <Button
            type="submit"
            color="primary"
            variant="solid"
            loading={adding}
            sx={{ fontWeight: 700, color: '#0d0f1a', px: 3 }}
          >
            Add
          </Button>
        </Box>
      </form>

      {lastAddedMovieId && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            mt: 1.5,
          }}
        >
          <Button
            size="sm"
            variant="soft"
            color="neutral"
            onClick={handleMarkSeen}
            sx={{ fontSize: '0.75rem', py: 0.25 }}
          >
            I've seen this
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default AddMovieForm;

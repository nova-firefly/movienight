import React, { useState, useEffect } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client';
import { Box, Button, Autocomplete, AutocompleteOption, ListItemContent } from '@mui/joy';
import { SEARCH_TMDB, ADD_MOVIE, GET_MOVIES } from '../../graphql/queries';
import { useToast } from '../../contexts/ToastContext';
import { useDebounce } from '../../utils/useDebounce';

type TmdbOption = {
  tmdb_id: number;
  title: string;
  release_year: string | null;
  overview: string | null;
};

interface AddMovieFormProps {
  onMovieAdded?: (id: string) => void;
}

const AddMovieForm: React.FC<AddMovieFormProps> = ({ onMovieAdded }) => {
  const { showSuccess, showError } = useToast();
  const [title, setTitle] = useState('');
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [tmdbOptions, setTmdbOptions] = useState<TmdbOption[]>([]);

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
      const newId = addData?.addMovie?.id;
      if (newId && onMovieAdded) onMovieAdded(newId);
      setTitle('');
      setTmdbId(null);
      setTmdbOptions([]);
    } catch (error: any) {
      showError(`Error: ${error.message}`);
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
    </Box>
  );
};

export default AddMovieForm;

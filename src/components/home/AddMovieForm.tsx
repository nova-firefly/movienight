import React, { useState, useEffect } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client';
import { Box, Button, Autocomplete, AutocompleteOption, ListItemContent } from '@mui/joy';
import {
  SEARCH_TMDB,
  ADD_MOVIE,
  GET_MOVIES,
  SEARCH_TMDB_SHOWS,
  ADD_SHOW,
  GET_SHOWS,
} from '../../graphql/queries';
import { ContentKind } from '../../models/Content';
import { useToast } from '../../contexts/ToastContext';
import { useDebounce } from '../../utils/useDebounce';

type TmdbOption = {
  tmdb_id: number;
  title: string;
  release_year: string | null;
  overview: string | null;
};

interface AddMovieFormProps {
  kind: ContentKind;
  onMovieAdded?: (id: string) => void;
}

const AddMovieForm: React.FC<AddMovieFormProps> = ({ kind, onMovieAdded }) => {
  const { showSuccess, showError } = useToast();
  const isShow = kind === 'show';
  const noun = isShow ? 'show' : 'movie';
  const [title, setTitle] = useState('');
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [tmdbOptions, setTmdbOptions] = useState<TmdbOption[]>([]);

  const debouncedTitle = useDebounce(title, 400);

  const [searchTmdb, { loading: tmdbSearching }] = useLazyQuery(
    isShow ? SEARCH_TMDB_SHOWS : SEARCH_TMDB,
    {
      onCompleted: (d) => {
        // Shows return first_air_year; normalise to release_year for display.
        const raw = isShow ? d.searchTmdbShows : d.searchTmdb;
        setTmdbOptions(
          (raw || []).map((r: any) => ({
            tmdb_id: r.tmdb_id,
            title: r.title,
            release_year: isShow ? r.first_air_year : r.release_year,
            overview: r.overview,
          })),
        );
      },
      onError: () => setTmdbOptions([]),
      fetchPolicy: 'network-only',
    },
  );

  // Reset in-flight search state when the kind changes.
  useEffect(() => {
    setTitle('');
    setTmdbId(null);
    setTmdbOptions([]);
  }, [kind]);

  useEffect(() => {
    if (debouncedTitle.trim().length >= 2) {
      searchTmdb({ variables: { query: debouncedTitle } });
    } else {
      setTmdbOptions([]);
    }
  }, [debouncedTitle, searchTmdb]);

  const [addMovie, { loading: adding }] = useMutation(isShow ? ADD_SHOW : ADD_MOVIE, {
    refetchQueries: [{ query: isShow ? GET_SHOWS : GET_MOVIES }],
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      showError(`Please enter a ${noun} title.`);
      return;
    }
    try {
      const { data: addData } = await addMovie({
        variables: { title: title.trim(), tmdb_id: tmdbId },
      });
      showSuccess('Added to the list!');
      const newId = isShow ? addData?.addShow?.id : addData?.addMovie?.id;
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
            placeholder={`Suggest a ${noun} title...`}
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

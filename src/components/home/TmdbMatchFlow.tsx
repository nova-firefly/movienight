import React, { useState, useEffect } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client';
import {
  SEARCH_TMDB,
  MATCH_MOVIE,
  GET_MOVIES,
  SEARCH_TMDB_SHOWS,
  MATCH_SHOW,
  GET_SHOWS,
} from '../../graphql/queries';
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Button,
  Box,
  CircularProgress,
  Divider,
} from '@mui/joy';
import { ContentItem, ContentKind } from '../../models/Content';

type TmdbResult = {
  tmdb_id: number;
  title: string;
  release_year: string | null;
  overview: string | null;
};

interface Props {
  kind: ContentKind;
  movies: ContentItem[];
  onClose: () => void;
}

const TmdbMatchFlow: React.FC<Props> = ({ kind, movies, onClose }) => {
  const isShow = kind === 'show';
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<TmdbResult[]>([]);

  const current = movies[index];

  const [searchError, setSearchError] = useState<string | null>(null);

  const [searchTmdb, { loading: searching }] = useLazyQuery(
    isShow ? SEARCH_TMDB_SHOWS : SEARCH_TMDB,
    {
      onCompleted: (d) => {
        const raw = isShow ? d.searchTmdbShows : d.searchTmdb;
        setResults(
          (raw || []).map((r: any) => ({
            tmdb_id: r.tmdb_id,
            title: r.title,
            release_year: isShow ? r.first_air_year : r.release_year,
            overview: r.overview,
          })),
        );
        setSearchError(null);
      },
      onError: (e) => setSearchError(e.message),
      fetchPolicy: 'network-only',
    },
  );

  const [matchMovie, { loading: matching }] = useMutation(isShow ? MATCH_SHOW : MATCH_MOVIE, {
    refetchQueries: [{ query: isShow ? GET_SHOWS : GET_MOVIES }],
  });

  useEffect(() => {
    if (current) {
      setResults([]);
      setSearchError(null);
      searchTmdb({ variables: { query: current.title } });
    }
  }, [current, searchTmdb]);

  const advance = () => {
    if (index + 1 >= movies.length) {
      onClose();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const handlePick = async (tmdbId: number, tmdbTitle: string) => {
    await matchMovie({ variables: { id: current.id, tmdb_id: tmdbId, title: tmdbTitle } });
    advance();
  };

  return (
    <Modal open onClose={onClose}>
      <ModalDialog sx={{ maxWidth: 460, width: '100%', p: 3 }}>
        <ModalClose aria-label="Close TMDB match flow" />

        {!current ? (
          <>
            <Typography level="title-md">All done!</Typography>
            <Typography level="body-sm" sx={{ color: 'text.secondary', mt: 0.5 }}>
              No more unmatched movies.
            </Typography>
            <Button onClick={onClose} sx={{ mt: 2 }}>
              Close
            </Button>
          </>
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography level="title-md">Match with TMDB</Typography>
              <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 0.25 }}>
                {index + 1} of {movies.length}
              </Typography>
            </Box>

            <Typography level="body-sm" sx={{ fontWeight: 600, mb: 1.5 }}>
              "{current.title}"
            </Typography>

            <Divider sx={{ mb: 1.5 }} />

            {searching ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size="sm" />
              </Box>
            ) : searchError ? (
              <Typography level="body-sm" sx={{ color: 'danger.400', py: 2, textAlign: 'center' }}>
                Search failed: {searchError}
              </Typography>
            ) : results.length === 0 ? (
              <Typography
                level="body-sm"
                sx={{ color: 'text.tertiary', py: 2, textAlign: 'center' }}
              >
                No results found.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.75,
                  maxHeight: 320,
                  overflowY: 'auto',
                }}
              >
                {results.map((r) => (
                  <Button
                    key={r.tmdb_id}
                    variant="outlined"
                    color="neutral"
                    disabled={matching}
                    onClick={() => handlePick(r.tmdb_id, r.title)}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      fontWeight: 500,
                      px: 1.5,
                    }}
                  >
                    {r.title}
                    {r.release_year && (
                      <Typography
                        component="span"
                        level="body-xs"
                        sx={{ ml: 1, color: 'text.tertiary' }}
                      >
                        {r.release_year}
                      </Typography>
                    )}
                  </Button>
                ))}
              </Box>
            )}

            <Button
              variant="plain"
              color="neutral"
              onClick={advance}
              disabled={matching}
              sx={{ mt: 2, alignSelf: 'flex-end' }}
            >
              Skip
            </Button>
          </>
        )}
      </ModalDialog>
    </Modal>
  );
};

export default TmdbMatchFlow;

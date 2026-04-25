import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import {
  GET_MOVIES,
  ADD_MOVIE,
  DELETE_MOVIE,
  MARK_WATCHED,
  SEARCH_TMDB,
  SEED_MOVIES,
  GET_APP_INFO,
  MY_CONNECTIONS,
  PENDING_CONNECTION_REQUESTS,
  COMBINED_LIST,
  NEW_MOVIES_FROM_CONNECTIONS,
  SET_MOVIE_INTEREST,
  SOLO_MOVIES,
} from '../../graphql/queries';
import {
  Autocomplete,
  AutocompleteOption,
  Box,
  Button,
  Typography,
  Sheet,
  Chip,
  IconButton,
  ListItemContent,
  CircularProgress,
} from '@mui/joy';
import TmdbMatchFlow from './TmdbMatchFlow';
import { Movie } from '../../models/Movies';
import { useAuth } from '../../contexts/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

type TmdbOption = {
  tmdb_id: number;
  title: string;
  release_year: string | null;
  overview: string | null;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ── Movie row ─────────────────────────────────────────────────────────────────

interface MovieRowProps {
  movie: Movie;
  isAdmin: boolean;
  canMarkWatched: boolean;
  onMarkWatched: (id: string, title: string) => void;
  onDelete: (id: string, title: string) => void;
  isAuthenticated: boolean;
}

const MovieRow: React.FC<MovieRowProps> = ({
  movie,
  isAdmin,
  canMarkWatched,
  onMarkWatched,
  onDelete,
  isAuthenticated,
}) => (
  <tr>
    {/* Title */}
    <td style={{ verticalAlign: 'middle', padding: '12px 16px' }}>
      <Typography level="body-sm" sx={{ fontWeight: 600, color: 'text.primary' }}>
        {movie.title}
      </Typography>
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
            title={`Mark "${movie.title}" as watched`}
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

// ── Page ──────────────────────────────────────────────────────────────────────

interface HomePageProps {
  onShowThisOrThat?: () => void;
  onShowConnections?: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onShowThisOrThat, onShowConnections }) => {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.is_admin ?? false;

  const [title, setTitle] = useState('');
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [tmdbOptions, setTmdbOptions] = useState<TmdbOption[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [matchFlowOpen, setMatchFlowOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // Connections data (only when authenticated)
  const { data: connectionsData } = useQuery(MY_CONNECTIONS, { skip: !isAuthenticated });
  const { data: pendingData } = useQuery(PENDING_CONNECTION_REQUESTS, {
    skip: !isAuthenticated,
    pollInterval: 10000,
  });
  const { data: combinedData, loading: combinedLoading } = useQuery(COMBINED_LIST, {
    variables: { connectionId: selectedConnectionId },
    skip: !selectedConnectionId,
    fetchPolicy: 'cache-and-network',
  });

  // Movie interest data (only when authenticated)
  const { data: pendingMoviesData } = useQuery(NEW_MOVIES_FROM_CONNECTIONS, {
    skip: !isAuthenticated,
    pollInterval: 10000,
  });
  const { data: soloData } = useQuery(SOLO_MOVIES, {
    skip: !isAuthenticated,
    pollInterval: 15000,
  });
  const [setMovieInterest] = useMutation(SET_MOVIE_INTEREST, {
    refetchQueries: [
      { query: NEW_MOVIES_FROM_CONNECTIONS },
      { query: SOLO_MOVIES },
      ...(selectedConnectionId
        ? [{ query: COMBINED_LIST, variables: { connectionId: selectedConnectionId } }]
        : []),
    ],
  });

  const connections = connectionsData?.myConnections || [];
  const incomingPending =
    pendingData?.pendingConnectionRequests?.filter((r: any) => r.direction === 'received') || [];
  const isCombinedView = selectedConnectionId !== null;
  const pendingMovies = pendingMoviesData?.newMoviesFromConnections || [];
  const soloMovies: Movie[] = soloData?.soloMovies ?? [];

  const debouncedTitle = useDebounce(title, 400);

  const { data } = useQuery(GET_MOVIES, {
    pollInterval: 5000,
  });

  const [searchTmdb] = useLazyQuery(SEARCH_TMDB, {
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

  const [addMovie] = useMutation(ADD_MOVIE, {
    refetchQueries: [{ query: GET_MOVIES }],
  });
  const [markWatched] = useMutation(MARK_WATCHED, {
    refetchQueries: [{ query: GET_MOVIES }],
  });
  const [deleteMovie] = useMutation(DELETE_MOVIE, {
    refetchQueries: [{ query: GET_MOVIES }],
  });
  const [seedMovies, { loading: seeding }] = useMutation(SEED_MOVIES, {
    refetchQueries: [{ query: GET_MOVIES }],
  });
  const { data: appInfoData } = useQuery(GET_APP_INFO, { fetchPolicy: 'cache-first' });
  const isProd = appInfoData?.appInfo?.isProduction ?? true;

  const movies: Movie[] = data?.movies ?? [];

  // Check if the current user has any personal Elo data
  const hasEloData = isAuthenticated && movies.some((m) => m.elo_rank != null);

  const unmatchedMovies = movies.filter(
    (m) => !m.tmdb_id && (isAdmin || (user && String(m.requested_by) === String(user.id))),
  );

  const handleMarkWatched = async (id: string, movieTitle: string) => {
    if (!window.confirm(`Mark "${movieTitle}" as watched? It will be removed from the watchlist.`))
      return;
    try {
      await markWatched({ variables: { id } });
    } catch (err: any) {
      setErrorMessage(`Error marking movie as watched: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, movieTitle: string) => {
    if (!window.confirm(`Remove "${movieTitle}" from the list?`)) return;
    try {
      await deleteMovie({ variables: { id } });
    } catch (err: any) {
      setErrorMessage(`Error removing movie: ${err.message}`);
    }
  };

  const handleSeed = async () => {
    if (!window.confirm('This will DELETE all existing movies and seed 30 new ones. Continue?'))
      return;
    try {
      await seedMovies();
      setSuccessMessage('Seeded 30 movies!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(`Seed failed: ${err.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Please enter a movie title.');
      return;
    }
    try {
      await addMovie({ variables: { title: title.trim(), tmdb_id: tmdbId } });
      setSuccessMessage('Added to the list!');
      setTitle('');
      setTmdbId(null);
      setTmdbOptions([]);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(`Error: ${error.message}`);
    }
  };

  // Column count for colSpan calculations
  const colCount =
    1 + // title
    1 + // suggested by
    1 + // added
    1 + // tmdb
    (isAuthenticated ? 1 : 0); // actions

  return (
    <Box
      component="main"
      sx={{
        flex: 1,
        bgcolor: 'background.body',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 3, sm: 5 },
      }}
    >
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        {/* Page header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
          <Typography level="h2" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
            Movie List
          </Typography>
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            {movies.length === 0
              ? 'No movies yet — suggest one!'
              : `${movies.length} movie${movies.length !== 1 ? 's' : ''} in the queue`}
          </Typography>
        </Box>

        {/* View selector — segmented control */}
        {isAuthenticated && connections.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 0.5,
              mb: 3,
            }}
          >
            <Button
              variant={!isCombinedView ? 'soft' : 'plain'}
              color="neutral"
              size="sm"
              onClick={() => setSelectedConnectionId(null)}
              sx={{
                fontWeight: 600,
                color: !isCombinedView ? 'primary.400' : 'text.secondary',
                '&:hover': { color: 'primary.300' },
              }}
            >
              My List
            </Button>
            {connections.map((conn: any) => (
              <Button
                key={conn.id}
                variant={selectedConnectionId === conn.id ? 'soft' : 'plain'}
                color="neutral"
                size="sm"
                onClick={() => setSelectedConnectionId(conn.id)}
                sx={{
                  fontWeight: 600,
                  color: selectedConnectionId === conn.id ? 'primary.400' : 'text.secondary',
                  '&:hover': { color: 'primary.300' },
                }}
              >
                {conn.user.display_name || conn.user.username} + Me
              </Button>
            ))}
          </Box>
        )}

        {/* Pending connection request banner */}
        {isAuthenticated && incomingPending.length > 0 && (
          <Box
            sx={{
              mb: 3,
              p: 1.5,
              borderRadius: 'md',
              bgcolor: 'warning.softBg',
              border: '1px solid',
              borderColor: 'warning.outlinedBorder',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            <Typography level="body-sm" sx={{ color: 'warning.softColor' }}>
              {incomingPending.length === 1
                ? `${incomingPending[0].user.display_name || incomingPending[0].user.username} wants to connect`
                : `${incomingPending.length} pending connection requests`}
            </Typography>
            {onShowConnections && (
              <Button
                variant="soft"
                color="warning"
                size="sm"
                onClick={onShowConnections}
                sx={{ fontWeight: 700 }}
              >
                View
              </Button>
            )}
          </Box>
        )}

        {/* New movies from connections — review banner */}
        {isAuthenticated && !isCombinedView && pendingMovies.length > 0 && (
          <Sheet
            variant="outlined"
            sx={{
              mb: 3,
              p: 2,
              borderRadius: 'md',
              bgcolor: 'primary.softBg',
              borderColor: 'primary.outlinedBorder',
            }}
          >
            <Typography
              level="title-sm"
              sx={{ fontWeight: 700, mb: 1.5, color: 'primary.softColor' }}
            >
              New movies from your connections
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {pendingMovies.map((item: any) => (
                <Box
                  key={item.movie.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 1,
                    borderRadius: 'sm',
                    bgcolor: 'background.level1',
                  }}
                >
                  <Box>
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                      {item.movie.title}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                      added by {item.addedBy.display_name || item.addedBy.username}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Button
                      size="sm"
                      variant="soft"
                      color="success"
                      onClick={() =>
                        setMovieInterest({
                          variables: { movieId: item.movie.id, interested: true },
                        })
                      }
                    >
                      I'm in
                    </Button>
                    <Button
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={() =>
                        setMovieInterest({
                          variables: { movieId: item.movie.id, interested: false },
                        })
                      }
                    >
                      Pass
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          </Sheet>
        )}

        {/* This or That indicator */}
        {!isCombinedView && movies.length >= 2 && (
          <Box
            sx={{
              mb: 3,
              p: 1.5,
              borderRadius: 'md',
              bgcolor: 'primary.softBg',
              border: '1px solid',
              borderColor: 'primary.outlinedBorder',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            {isAuthenticated ? (
              <>
                <Typography level="body-sm" sx={{ color: 'primary.softColor' }}>
                  {hasEloData
                    ? 'Keep ranking movies!'
                    : 'Rate movies to get your personal ranking.'}
                </Typography>
                {onShowThisOrThat && (
                  <Button
                    variant="soft"
                    color="primary"
                    size="sm"
                    onClick={onShowThisOrThat}
                    sx={{ fontWeight: 700 }}
                  >
                    This or That
                  </Button>
                )}
              </>
            ) : (
              <Typography level="body-sm" sx={{ color: 'primary.softColor' }}>
                Sign in to rank movies with This or That
              </Typography>
            )}
          </Box>
        )}

        {/* Add movie form */}
        {isAuthenticated && (
          <Box sx={{ mb: 4 }}>
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', gap: 1, maxWidth: 520, mx: 'auto' }}>
                <Autocomplete
                  freeSolo
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
                  sx={{ fontWeight: 700, color: '#0d0f1a', px: 3 }}
                >
                  Add
                </Button>
              </Box>
            </form>

            {successMessage && (
              <Typography
                level="body-sm"
                sx={{ textAlign: 'center', mt: 1.5, color: 'success.400', fontWeight: 600 }}
              >
                {successMessage}
              </Typography>
            )}
            {errorMessage && (
              <Typography
                level="body-sm"
                sx={{ textAlign: 'center', mt: 1.5, color: 'danger.400', fontWeight: 600 }}
              >
                {errorMessage}
              </Typography>
            )}
          </Box>
        )}

        {/* TMDB match flow */}
        {isAuthenticated && unmatchedMovies.length > 0 && (
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Button
              variant="outlined"
              color="neutral"
              size="sm"
              onClick={() => setMatchFlowOpen(true)}
            >
              Match {unmatchedMovies.length} unmatched movie
              {unmatchedMovies.length !== 1 ? 's' : ''} with TMDB
            </Button>
          </Box>
        )}
        {matchFlowOpen && (
          <TmdbMatchFlow movies={unmatchedMovies} onClose={() => setMatchFlowOpen(false)} />
        )}

        {/* Unauthenticated prompt */}
        {!isAuthenticated && movies.length === 0 && (
          <Typography level="body-sm" sx={{ textAlign: 'center', color: 'text.tertiary', mb: 4 }}>
            Sign in to suggest movies.
          </Typography>
        )}

        {/* Combined view */}
        {isCombinedView && (
          <>
            {combinedLoading && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size="sm" />
              </Box>
            )}
            {!combinedLoading && combinedData?.combinedList && (
              <>
                {combinedData.combinedList.rankings.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                      No rankings to combine yet. Both users need to do some "This or That"
                      comparisons first!
                    </Typography>
                  </Box>
                ) : (
                  <Sheet
                    variant="outlined"
                    sx={{
                      borderRadius: 'md',
                      overflow: 'clip',
                      borderColor: 'var(--mn-border-vis)',
                    }}
                  >
                    <Box sx={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          minWidth: 480,
                          borderCollapse: 'collapse',
                          tableLayout: 'auto',
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: 'var(--mn-bg-elevated)',
                              borderBottom: '1px solid var(--mn-border-vis)',
                            }}
                          >
                            <th style={combinedThStyle}>#</th>
                            <th style={{ ...combinedThStyle, textAlign: 'left' }}>Title</th>
                            <th style={combinedThStyle}>You</th>
                            <th style={combinedThStyle}>
                              {combinedData.combinedList.connection.user.display_name ||
                                combinedData.combinedList.connection.user.username}
                            </th>
                            <th style={combinedThStyle}>Combined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combinedData.combinedList.rankings.map((r: any, idx: number) => (
                            <tr key={r.movie.id}>
                              <td style={{ ...combinedTdStyle, textAlign: 'center', width: 48 }}>
                                <Typography
                                  level="body-xs"
                                  sx={{
                                    fontWeight: 700,
                                    color: idx < 3 ? 'primary.400' : 'text.tertiary',
                                  }}
                                >
                                  {idx + 1}
                                </Typography>
                              </td>
                              <td style={combinedTdStyle}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                                    {r.movie.title}
                                  </Typography>
                                  {!r.bothRated && (
                                    <Chip size="sm" variant="soft" color="neutral">
                                      partial
                                    </Chip>
                                  )}
                                </Box>
                              </td>
                              <td style={{ ...combinedTdStyle, textAlign: 'center' }}>
                                {r.userAElo != null ? (
                                  <Chip
                                    size="sm"
                                    variant="soft"
                                    color={r.userAElo >= 1000 ? 'success' : 'warning'}
                                  >
                                    {Math.round(r.userAElo)}
                                  </Chip>
                                ) : (
                                  <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                                    --
                                  </Typography>
                                )}
                              </td>
                              <td style={{ ...combinedTdStyle, textAlign: 'center' }}>
                                {r.userBElo != null ? (
                                  <Chip
                                    size="sm"
                                    variant="soft"
                                    color={r.userBElo >= 1000 ? 'success' : 'warning'}
                                  >
                                    {Math.round(r.userBElo)}
                                  </Chip>
                                ) : (
                                  <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                                    --
                                  </Typography>
                                )}
                              </td>
                              <td style={{ ...combinedTdStyle, textAlign: 'center' }}>
                                <Chip size="sm" variant="solid" color="primary">
                                  {Math.round(r.combinedElo)}
                                </Chip>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Box>
                  </Sheet>
                )}
              </>
            )}
          </>
        )}

        {/* Movie table (personal view) */}
        {!isCombinedView && (
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: 'md',
              overflow: 'clip',
              borderColor: 'var(--mn-border-vis)',
            }}
          >
            <Box sx={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: 540,
                  borderCollapse: 'collapse',
                  tableLayout: 'auto',
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: 'var(--mn-bg-elevated)',
                      borderBottom: '1px solid var(--mn-border-vis)',
                    }}
                  >
                    <th
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--mn-text-muted)',
                      }}
                    >
                      Title
                    </th>
                    <th
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--mn-text-muted)',
                      }}
                    >
                      Suggested by
                    </th>
                    <th
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--mn-text-muted)',
                      }}
                    >
                      Added
                    </th>
                    <th
                      style={{
                        padding: '10px 8px',
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--mn-text-muted)',
                      }}
                    >
                      TMDB
                    </th>
                    {isAuthenticated && (
                      <th
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: 'var(--mn-text-muted)',
                        }}
                      />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {movies.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colCount}
                        style={{
                          padding: '48px 16px',
                          textAlign: 'center',
                          color: 'var(--mn-text-muted)',
                          fontSize: '0.875rem',
                        }}
                      >
                        No movies yet. Be the first to suggest one!
                      </td>
                    </tr>
                  ) : (
                    movies.map((movie) => (
                      <MovieRow
                        key={movie.id}
                        movie={movie}
                        isAdmin={isAdmin}
                        canMarkWatched={
                          isAdmin ||
                          (isAuthenticated && String(movie.requested_by) === String(user?.id))
                        }
                        onMarkWatched={handleMarkWatched}
                        onDelete={handleDelete}
                        isAuthenticated={isAuthenticated}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </Box>
          </Sheet>
        )}

        {/* Solo Queue — movies all connections passed on */}
        {!isCombinedView && isAuthenticated && soloMovies.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography
              level="title-sm"
              sx={{ fontWeight: 700, mb: 0.5, textAlign: 'center', color: 'text.secondary' }}
            >
              Solo Queue
            </Typography>
            <Typography level="body-xs" sx={{ textAlign: 'center', color: 'text.tertiary', mb: 2 }}>
              Your connections passed on these — watch them on your own!
            </Typography>
            <Sheet
              variant="outlined"
              sx={{
                borderRadius: 'md',
                overflow: 'clip',
                borderColor: 'var(--mn-border-vis)',
                opacity: 0.75,
              }}
            >
              <Box sx={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    minWidth: 480,
                    borderCollapse: 'collapse',
                    tableLayout: 'auto',
                  }}
                >
                  <tbody>
                    {soloMovies.map((movie) => (
                      <MovieRow
                        key={movie.id}
                        movie={movie}
                        isAdmin={isAdmin}
                        canMarkWatched={true}
                        onMarkWatched={handleMarkWatched}
                        onDelete={handleDelete}
                        isAuthenticated={isAuthenticated}
                      />
                    ))}
                  </tbody>
                </table>
              </Box>
            </Sheet>
          </Box>
        )}

        {/* Seed button — admin only, test env only */}
        {isAdmin && !isProd && (
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Button
              variant="outlined"
              color="warning"
              size="sm"
              loading={seeding}
              onClick={handleSeed}
            >
              Seed 30 Movies (Dev Only)
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

const combinedThStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'center',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--mn-text-muted)',
};

const combinedTdStyle: React.CSSProperties = {
  padding: '12px',
  verticalAlign: 'middle',
};

export default HomePage;

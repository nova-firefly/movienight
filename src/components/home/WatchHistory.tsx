import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Box,
  Button,
  Typography,
  Sheet,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/joy';
import { WATCHED_MOVIES, UNWATCH_MOVIE, GET_MOVIES } from '../../graphql/queries';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../hooks/useConfirm';
import ConfirmDialog from '../common/ConfirmDialog';
import WatchHistoryCard from './WatchHistoryCard';

const PAGE_SIZE = 25;

const WatchHistory: React.FC = () => {
  const { user } = useAuth();
  const { showError } = useToast();
  const { confirm, dialogProps } = useConfirm();
  const isAdmin = user?.is_admin ?? false;
  const [offset, setOffset] = useState(0);

  const { data, loading } = useQuery(WATCHED_MOVIES, {
    variables: { limit: PAGE_SIZE, offset },
    fetchPolicy: 'cache-and-network',
  });

  const [unwatchMovie] = useMutation(UNWATCH_MOVIE, {
    refetchQueries: [
      { query: WATCHED_MOVIES, variables: { limit: PAGE_SIZE, offset } },
      { query: GET_MOVIES },
    ],
  });

  const movies = data?.watchedMovies ?? [];

  const handleUnwatch = async (id: string, title: string) => {
    const ok = await confirm({
      title: 'Watch again?',
      message: `"${title}" will go back to the end of the queue.`,
      confirmText: 'Requeue',
      confirmColor: 'primary',
    });
    if (!ok) return;
    try {
      await unwatchMovie({ variables: { id } });
    } catch (err: any) {
      showError(`Error: ${err.message}`);
    }
  };

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
        <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
          <Typography level="h2" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
            Watch History
          </Typography>
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            Movies you&rsquo;ve already watched together
          </Typography>
        </Box>

        {loading && movies.length === 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size="md" color="primary" />
          </Box>
        )}

        {!loading && movies.length === 0 && (
          <Typography level="body-sm" sx={{ textAlign: 'center', color: 'text.tertiary', py: 6 }}>
            No movies watched yet. Get watching!
          </Typography>
        )}

        {movies.length > 0 && (
          <>
            {/* Table — hidden on mobile */}
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
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
                        {['Title', 'Suggested by', 'Watched'].map((label) => (
                          <th
                            key={label}
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
                            {label}
                          </th>
                        ))}
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
                      </tr>
                    </thead>
                    <tbody>
                      {movies.map((movie: any) => {
                        const canUnwatch =
                          isAdmin || String(movie.requested_by) === String(user?.id);
                        return (
                          <tr key={movie.id}>
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
                                <Typography
                                  level="body-sm"
                                  sx={{ fontWeight: 600, color: 'text.primary' }}
                                >
                                  {movie.title}
                                </Typography>
                                {movie.tmdb_id && (
                                  <a
                                    href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      color: 'var(--joy-palette-primary-500)',
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    ↗
                                  </a>
                                )}
                              </Box>
                            </td>
                            <td style={{ verticalAlign: 'middle', padding: '12px 16px' }}>
                              <Chip
                                size="sm"
                                variant="soft"
                                color="neutral"
                                sx={{ fontWeight: 500 }}
                              >
                                {movie.requester}
                              </Chip>
                            </td>
                            <td
                              style={{
                                verticalAlign: 'middle',
                                padding: '12px 16px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                {movie.watched_at
                                  ? new Date(movie.watched_at).toLocaleDateString(undefined, {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : '—'}
                              </Typography>
                            </td>
                            <td
                              style={{
                                verticalAlign: 'middle',
                                padding: '0 12px',
                                textAlign: 'right',
                              }}
                            >
                              {canUnwatch && (
                                <Tooltip title="Watch again — put back in queue" arrow>
                                  <IconButton
                                    size="sm"
                                    color="primary"
                                    variant="plain"
                                    onClick={() => handleUnwatch(movie.id, movie.title)}
                                    sx={{
                                      opacity: 0.5,
                                      transition: 'opacity 0.15s',
                                      '&:hover': { opacity: 1 },
                                      fontSize: '0.8rem',
                                    }}
                                  >
                                    ↩
                                  </IconButton>
                                </Tooltip>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Box>
              </Sheet>
            </Box>

            {/* Cards — visible on mobile */}
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
              {movies.map((movie: any) => (
                <WatchHistoryCard
                  key={movie.id}
                  movie={movie}
                  canUnwatch={isAdmin || String(movie.requested_by) === String(user?.id)}
                  onUnwatch={handleUnwatch}
                />
              ))}
            </Box>
          </>
        )}

        {/* Pagination */}
        {(offset > 0 || movies.length === PAGE_SIZE) && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2 }}>
            <Button
              variant="plain"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              variant="plain"
              size="sm"
              disabled={movies.length < PAGE_SIZE}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </Box>
        )}
      </Box>

      <ConfirmDialog {...dialogProps} />
    </Box>
  );
};

export default WatchHistory;

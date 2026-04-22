import React, { useState, useCallback, useEffect } from 'react';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import {
  THIS_OR_THAT,
  RECORD_COMPARISON,
  MY_RANKINGS,
  RESET_MOVIE_COMPARISONS,
  GET_MOVIES,
} from '../../graphql/queries';
import { Box, Typography, Button, Sheet, Chip, Skeleton } from '@mui/joy';
import MovieCompareCard from './MovieCompareCard';

type Tab = 'compare' | 'rankings';

const ThisOrThat: React.FC = () => {
  const [tab, setTab] = useState<Tab>('compare');
  const [sessionCount, setSessionCount] = useState(0);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [fading, setFading] = useState(false);

  const [fetchPair, { data: pairData, loading: pairLoading, error: pairError }] = useLazyQuery(
    THIS_OR_THAT,
    { fetchPolicy: 'network-only' }
  );

  const [recordComparison, { loading: recording }] = useMutation(RECORD_COMPARISON, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

  const { data: rankingsData, loading: rankingsLoading, refetch: refetchRankings } = useQuery(
    MY_RANKINGS,
    { skip: tab !== 'rankings' }
  );

  const [resetComparisons] = useMutation(RESET_MOVIE_COMPARISONS, {
    refetchQueries: [{ query: MY_RANKINGS }, { query: GET_MOVIES }],
  });

  const loadPair = useCallback(
    (excludeIds: string[] = []) => {
      fetchPair({ variables: { excludeIds } });
    },
    [fetchPair]
  );

  // Load first pair on mount
  useEffect(() => {
    loadPair();
  }, [loadPair]);

  const handlePick = async (winnerId: string) => {
    const pair = pairData?.thisOrThat;
    if (!pair || recording) return;

    const loserId = pair.movieA.id === winnerId ? pair.movieB.id : pair.movieA.id;

    // Fade out
    setFading(true);

    try {
      await recordComparison({ variables: { winnerId, loserId } });
      setSessionCount((c) => c + 1);

      // Track seen IDs for next pair exclusion
      const newSeen = [...seenIds, pair.movieA.id, pair.movieB.id];
      setSeenIds(newSeen);

      // Load next pair
      loadPair([pair.movieA.id, pair.movieB.id]);
    } catch (err: any) {
      console.error('Failed to record comparison:', err);
      setFading(false);
    }
  };

  // Clear fade when new pair arrives
  useEffect(() => {
    if (pairData?.thisOrThat) {
      setFading(false);
    }
  }, [pairData]);

  const handleReset = async (movieId: string, title: string) => {
    if (!window.confirm(`Reset all your comparisons for "${title}"?`)) return;
    try {
      await resetComparisons({ variables: { movieId } });
    } catch (err: any) {
      console.error('Failed to reset:', err);
    }
  };

  const isNotEnoughMovies = pairError?.graphQLErrors?.some(
    (e) => e.extensions?.code === 'BAD_USER_INPUT'
  );

  const pair = pairData?.thisOrThat;
  const showSkeleton = (pairLoading || fading) && !isNotEnoughMovies;

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
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
          <Typography level="h2" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
            This or That
          </Typography>
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            Pick which movie you'd rather watch
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3 }}>
          <Button
            variant={tab === 'compare' ? 'soft' : 'plain'}
            color="neutral"
            size="sm"
            onClick={() => setTab('compare')}
            sx={{ fontWeight: 600, color: tab === 'compare' ? 'primary.400' : 'text.secondary' }}
          >
            Compare
          </Button>
          <Button
            variant={tab === 'rankings' ? 'soft' : 'plain'}
            color="neutral"
            size="sm"
            onClick={() => {
              setTab('rankings');
              refetchRankings();
            }}
            sx={{ fontWeight: 600, color: tab === 'rankings' ? 'primary.400' : 'text.secondary' }}
          >
            My Rankings
          </Button>
        </Box>

        {tab === 'compare' && (
          <>
            {/* Session counter */}
            {sessionCount > 0 && (
              <Typography level="body-xs" sx={{ textAlign: 'center', mb: 2, color: 'text.tertiary' }}>
                {sessionCount} comparison{sessionCount !== 1 ? 's' : ''} this session
              </Typography>
            )}

            {/* Not enough movies */}
            {isNotEnoughMovies && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                  Add more movies to start comparing.
                </Typography>
              </Box>
            )}

            {/* Skeleton loading state */}
            {showSkeleton && !pair && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 3,
                  justifyContent: 'center',
                }}
              >
                {[0, 1].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      flex: 1,
                      maxWidth: { sm: 360 },
                      borderRadius: 'lg',
                      overflow: 'hidden',
                      bgcolor: 'background.surface',
                      border: '2px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Skeleton variant="rectangular" sx={{ width: '100%', aspectRatio: '2/3' }} />
                    <Box sx={{ p: 2 }}>
                      <Skeleton variant="text" sx={{ width: '70%', mb: 1 }} />
                      <Skeleton variant="text" sx={{ width: '50%', mb: 1 }} />
                      <Skeleton variant="rectangular" sx={{ width: '100%', height: 36, borderRadius: 'sm' }} />
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {/* Comparison cards */}
            {pair && !isNotEnoughMovies && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 3,
                  justifyContent: 'center',
                  opacity: fading ? 0 : 1,
                  transition: 'opacity 0.2s ease-out',
                }}
              >
                <Box sx={{ flex: 1, maxWidth: { sm: 360 }, display: 'flex' }}>
                  <MovieCompareCard
                    movie={pair.movieA}
                    onPick={handlePick}
                    disabled={recording || fading}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography
                    level="h4"
                    sx={{ fontWeight: 800, color: 'text.tertiary', userSelect: 'none' }}
                  >
                    vs
                  </Typography>
                </Box>

                <Box sx={{ flex: 1, maxWidth: { sm: 360 }, display: 'flex' }}>
                  <MovieCompareCard
                    movie={pair.movieB}
                    onPick={handlePick}
                    disabled={recording || fading}
                  />
                </Box>
              </Box>
            )}
          </>
        )}

        {tab === 'rankings' && (
          <>
            {rankingsLoading && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Loading rankings...</Typography>
              </Box>
            )}

            {!rankingsLoading && (!rankingsData?.myRankings || rankingsData.myRankings.length === 0) && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                  No rankings yet. Compare some movies to see your preferences!
                </Typography>
              </Box>
            )}

            {!rankingsLoading && rankingsData?.myRankings?.length > 0 && (
              <Sheet
                variant="outlined"
                sx={{ borderRadius: 'md', overflow: 'clip', borderColor: 'var(--mn-border-vis)' }}
              >
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                    <thead>
                      <tr style={{ background: 'var(--mn-bg-elevated)', borderBottom: '1px solid var(--mn-border-vis)' }}>
                        <th style={thStyle}>#</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>Title</th>
                        <th style={thStyle}>Elo</th>
                        <th style={thStyle}>Matches</th>
                        <th style={thStyle} />
                      </tr>
                    </thead>
                    <tbody>
                      {rankingsData.myRankings.map((r: any, idx: number) => (
                        <tr key={r.movie.id}>
                          <td style={{ ...tdStyle, textAlign: 'center', width: 48 }}>
                            <Typography level="body-xs" sx={{ fontWeight: 700, color: idx < 3 ? 'primary.400' : 'text.tertiary' }}>
                              {idx + 1}
                            </Typography>
                          </td>
                          <td style={tdStyle}>
                            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                              {r.movie.title}
                            </Typography>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <Chip size="sm" variant="soft" color={r.eloRating >= 1000 ? 'success' : 'warning'}>
                              {Math.round(r.eloRating)}
                            </Chip>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                              {r.comparisonCount}
                            </Typography>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <Button
                              variant="plain"
                              color="danger"
                              size="sm"
                              onClick={() => handleReset(r.movie.id, r.movie.title)}
                              sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                            >
                              Reset
                            </Button>
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
      </Box>
    </Box>
  );
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'center',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--mn-text-muted)',
};

const tdStyle: React.CSSProperties = {
  padding: '12px',
  verticalAlign: 'middle',
};

export default ThisOrThat;

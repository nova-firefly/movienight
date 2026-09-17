import React, { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Box,
  Button,
  Typography,
  Sheet,
  Chip,
  CircularProgress,
  Skeleton,
  IconButton,
  Tooltip,
  Select,
  Option,
} from '@mui/joy';
import { Check, X } from 'lucide-react';
import {
  GET_MOVIES,
  DELETE_MOVIE,
  MARK_WATCHED,
  UNWATCH_MOVIE,
  SEED_MOVIES,
  GET_APP_INFO,
  MY_CONNECTIONS,
  PENDING_CONNECTION_REQUESTS,
  COMBINED_LIST,
  NEW_MOVIES_FROM_CONNECTIONS,
  SET_MOVIE_INTEREST,
  SOLO_MOVIES,
  PASSED_MOVIE_IDS,
  SET_MOVIE_TAG,
  REMOVE_MOVIE_TAG,
  GET_SHOWS,
  DELETE_SHOW,
  MARK_SHOW_WATCHED,
  UNWATCH_SHOW,
  COMBINED_SHOW_LIST,
  NEW_SHOWS_FROM_CONNECTIONS,
  SET_SHOW_INTEREST,
  SOLO_SHOWS,
  PASSED_SHOW_IDS,
  SET_SHOW_TAG,
  REMOVE_SHOW_TAG,
} from '../../graphql/queries';
import TmdbMatchFlow from './TmdbMatchFlow';
import ContentRow from './ContentRow';
import ContentCard from './ContentCard';
import AddMovieForm from './AddMovieForm';
import ViewSelector from './ViewSelector';
import ConnectionBanners from './ConnectionBanners';
import ConnectionInboxModal from './ConnectionInboxModal';
import ThisOrThatBanner from './ThisOrThatBanner';
import ConfirmDialog from '../common/ConfirmDialog';
import Poster from '../common/Poster';
import { OnboardingCard, ONBOARDING_DISMISSED_KEY } from '../common/OnboardingGuide';
import { ContentItem } from '../../models/Content';
import { useAuth } from '../../contexts/AuthContext';
import { useKind } from '../../contexts/KindContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../hooks/useConfirm';
import { tmdbUrl } from '../../utils/tmdb';

// ── Page ──────────────────────────────────────────────────────────────────────

interface HomePageProps {
  onShowThisOrThat?: () => void;
  onShowConnections?: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onShowThisOrThat, onShowConnections }) => {
  const { isAuthenticated, user } = useAuth();
  const { kind } = useKind();
  const { showError, showUndo } = useToast();
  const { confirm, dialogProps } = useConfirm();
  const isAdmin = user?.is_admin ?? false;

  // Per-kind operation + copy bundle. Show ops mirror movie ops in shape, so
  // the rest of the component is kind-agnostic once it reads from here.
  const isShow = kind === 'show';
  const noun = isShow ? 'show' : 'movie';
  const nounPlural = isShow ? 'shows' : 'movies';
  const idVar = isShow ? 'showId' : 'movieId';
  const GET_LIST = isShow ? GET_SHOWS : GET_MOVIES;
  const MARK_OP = isShow ? MARK_SHOW_WATCHED : MARK_WATCHED;
  const UNWATCH_OP = isShow ? UNWATCH_SHOW : UNWATCH_MOVIE;
  const DELETE_OP = isShow ? DELETE_SHOW : DELETE_MOVIE;
  const SET_TAG_OP = isShow ? SET_SHOW_TAG : SET_MOVIE_TAG;
  const REMOVE_TAG_OP = isShow ? REMOVE_SHOW_TAG : REMOVE_MOVIE_TAG;
  const SET_INTEREST_OP = isShow ? SET_SHOW_INTEREST : SET_MOVIE_INTEREST;
  const COMBINED_OP = isShow ? COMBINED_SHOW_LIST : COMBINED_LIST;
  const NEW_FROM_CONN_OP = isShow ? NEW_SHOWS_FROM_CONNECTIONS : NEW_MOVIES_FROM_CONNECTIONS;
  const SOLO_OP = isShow ? SOLO_SHOWS : SOLO_MOVIES;
  const PASSED_OP = isShow ? PASSED_SHOW_IDS : PASSED_MOVIE_IDS;

  const [matchFlowOpen, setMatchFlowOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<string[]>([]);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () =>
      typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true',
  );
  const [combinedSeenFilter, setCombinedSeenFilter] = useState<'all' | 'new' | 'one' | 'rewatch'>(
    'all',
  );

  const handleDismissOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
    setOnboardingDismissed(true);
  }, []);

  const handleMovieAdded = useCallback((id: string) => {
    setRecentlyAddedIds((prev) => [id, ...prev]);
  }, []);

  // Connections data (only when authenticated)
  const { data: connectionsData } = useQuery(MY_CONNECTIONS, { skip: !isAuthenticated });
  const { data: pendingData } = useQuery(PENDING_CONNECTION_REQUESTS, {
    skip: !isAuthenticated,
    pollInterval: 10000,
  });
  const { data: combinedData, loading: combinedLoading } = useQuery(COMBINED_OP, {
    variables: { connectionId: selectedConnectionId },
    skip: !selectedConnectionId || selectedConnectionId === 'solo',
    fetchPolicy: 'cache-and-network',
  });

  // Interest / connection data (only when authenticated)
  const { data: pendingMoviesData } = useQuery(NEW_FROM_CONN_OP, {
    skip: !isAuthenticated,
    pollInterval: 10000,
  });
  const { data: soloData } = useQuery(SOLO_OP, {
    skip: !isAuthenticated,
    pollInterval: 15000,
  });
  const { data: passedData } = useQuery(PASSED_OP, {
    skip: !isAuthenticated,
    pollInterval: 10000,
  });
  const [setMovieTag] = useMutation(SET_TAG_OP, {
    refetchQueries: [{ query: GET_LIST }],
  });
  const [removeMovieTag] = useMutation(REMOVE_TAG_OP, {
    refetchQueries: [{ query: GET_LIST }],
  });

  const [setMovieInterest] = useMutation(SET_INTEREST_OP, {
    refetchQueries: [
      { query: NEW_FROM_CONN_OP },
      { query: SOLO_OP },
      { query: PASSED_OP },
      ...(selectedConnectionId && selectedConnectionId !== 'solo'
        ? [{ query: COMBINED_OP, variables: { connectionId: selectedConnectionId } }]
        : []),
    ],
  });

  const connections = connectionsData?.myConnections || [];

  // Default view is "My Suggestions" (selectedConnectionId === null).
  // Users can switch to a connection's combined view via the ViewSelector tabs.

  const incomingPending =
    pendingData?.pendingConnectionRequests?.filter((r: any) => r.direction === 'received') || [];
  const isSoloView = selectedConnectionId === 'solo';
  const isCombinedView = selectedConnectionId !== null && !isSoloView;
  // Normalise the show/movie field name so downstream (inbox modal) is kind-agnostic.
  const pendingMovies = (
    (isShow
      ? pendingMoviesData?.newShowsFromConnections
      : pendingMoviesData?.newMoviesFromConnections) || []
  ).map((p: any) => ({ ...p, movie: p.movie ?? p.show }));
  const soloMovies: ContentItem[] = (isShow ? soloData?.soloShows : soloData?.soloMovies) ?? [];
  const passedMovieIds: Set<string> = new Set(
    (isShow ? passedData?.passedShowIds : passedData?.passedMovieIds) ?? [],
  );
  const combined = (isShow ? combinedData?.combinedShowList : combinedData?.combinedList) ?? null;

  const { data, loading: moviesLoading } = useQuery(GET_LIST, { pollInterval: 5000 });

  const [markWatched] = useMutation(MARK_OP, {
    refetchQueries: [
      { query: GET_LIST },
      ...(selectedConnectionId && selectedConnectionId !== 'solo'
        ? [{ query: COMBINED_OP, variables: { connectionId: selectedConnectionId } }]
        : []),
    ],
  });
  const [unwatchMovie] = useMutation(UNWATCH_OP, {
    refetchQueries: [
      { query: GET_LIST },
      ...(selectedConnectionId && selectedConnectionId !== 'solo'
        ? [{ query: COMBINED_OP, variables: { connectionId: selectedConnectionId } }]
        : []),
    ],
  });
  const [deleteMovie] = useMutation(DELETE_OP, {
    refetchQueries: [{ query: GET_LIST }],
  });
  const [seedMovies, { loading: seeding }] = useMutation(SEED_MOVIES, {
    refetchQueries: [{ query: GET_LIST }],
  });
  const { data: appInfoData } = useQuery(GET_APP_INFO, { fetchPolicy: 'cache-first' });
  const isProd = appInfoData?.appInfo?.isProduction ?? true;

  const allMovies: ContentItem[] = (isShow ? data?.shows : data?.movies) ?? [];
  const recentlyAddedSet = new Set(recentlyAddedIds);
  const recentlyAddedMovies = recentlyAddedIds
    .map((id) => allMovies.find((m) => String(m.id) === id))
    .filter((m): m is ContentItem => m != null);
  // Keep just-added movies in the main list — their data-rank is at the bottom of
  // the queue (MAX(rank)+1) and the user should see that. They also appear in the
  // highlighted "Just added" strip above for quick post-add actions.
  const movies = allMovies.filter((m) => !passedMovieIds.has(String(m.id)));

  // Check if the current user has any personal Elo data
  const hasEloData = isAuthenticated && allMovies.some((m) => m.elo_rank != null);

  // First-login onboarding: show until dismissed, and only when the user looks new
  // (no suggestions of their own and no ranking activity yet)
  const userHasSuggestedMovie =
    isAuthenticated && user
      ? allMovies.some((m) => String(m.requested_by) === String(user.id))
      : false;
  const showOnboardingCard =
    isAuthenticated && !onboardingDismissed && !userHasSuggestedMovie && !hasEloData;

  // "My Suggestions" view: only movies the current user suggested
  const isMySuggestionsView = !isCombinedView && !isSoloView;
  const myMovies = isMySuggestionsView
    ? movies.filter((m) => user && String(m.requested_by) === String(user.id))
    : movies;

  const unmatchedMovies = movies.filter(
    (m) => !m.tmdb_id && (isAdmin || (user && String(m.requested_by) === String(user.id))),
  );

  const handleMarkWatched = async (id: string, movieTitle: string) => {
    try {
      await markWatched({ variables: { id } });
      showUndo(`Marked "${movieTitle}" as done`, async () => {
        try {
          await unwatchMovie({ variables: { id } });
        } catch (err: any) {
          showError(`Couldn't undo: ${err.message}`);
        }
      });
    } catch (err: any) {
      showError(`Error marking  as done: `);
    }
  };

  const handleMarkWatchedCombined = async (id: string, movieTitle: string, _friendName: string) => {
    try {
      await markWatched({ variables: { id } });
      showUndo(`Marked "${movieTitle}" as done for both of you`, async () => {
        try {
          await unwatchMovie({ variables: { id } });
        } catch (err: any) {
          showError(`Couldn't undo: ${err.message}`);
        }
      });
    } catch (err: any) {
      showError(`Error marking  as done: `);
    }
  };

  const handleToggleSeen = async (id: string, currentlySeen: boolean) => {
    try {
      if (currentlySeen) {
        await removeMovieTag({ variables: { [idVar]: id, tagSlug: 'seen' } });
      } else {
        await setMovieTag({ variables: { [idVar]: id, tagSlug: 'seen' } });
      }
    } catch (err: any) {
      showError(`Error updating tag: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, movieTitle: string) => {
    const ok = await confirm({
      title: `Remove ?`,
      message: `"${movieTitle}" will be permanently removed from the list.`,
      confirmText: 'Remove',
      confirmColor: 'danger',
    });
    if (!ok) return;
    try {
      await deleteMovie({ variables: { id } });
    } catch (err: any) {
      showError(`Error removing : `);
    }
  };

  const handleSeed = async () => {
    const ok = await confirm({
      title: 'Seed movies?',
      message: 'This will DELETE all existing movies and seed 30 new ones.',
      confirmText: 'Seed',
      confirmColor: 'danger',
    });
    if (!ok) return;
    try {
      await seedMovies();
    } catch (err: any) {
      showError(`Seed failed: ${err.message}`);
    }
  };

  const handleSetInterest = (movieId: string, interested: boolean) => {
    setMovieInterest({ variables: { [idVar]: movieId, interested } });
  };

  const handleSetSeenTag = async (movieId: string) => {
    await setMovieTag({ variables: { [idVar]: movieId, tagSlug: 'seen' } });
  };

  // Column count for colSpan calculations
  const colCount =
    1 + // title
    1 + // suggested by
    1 + // added
    1 + // tmdb
    (isAuthenticated ? 1 : 0) + // seen
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
            {isShow ? 'TV Shows' : 'Movie List'}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
              {isMySuggestionsView
                ? myMovies.length === 0
                  ? `No ${nounPlural} yet — suggest one!`
                  : `${myMovies.length} ${noun}${myMovies.length !== 1 ? 's' : ''} you've suggested`
                : movies.length === 0
                  ? `No ${nounPlural} yet — suggest one!`
                  : `${movies.length} ${noun}${movies.length !== 1 ? 's' : ''} in the queue`}
            </Typography>
            {movies.length >= 2 && (
              <ThisOrThatBanner
                hasEloData={hasEloData}
                isAuthenticated={isAuthenticated}
                onShowThisOrThat={onShowThisOrThat}
              />
            )}
          </Box>
        </Box>

        {/* Connection inbox — single primary CTA above the queue */}
        {isAuthenticated && pendingMovies.length > 0 && (
          <Sheet
            variant="soft"
            color="primary"
            sx={{
              mb: 2.5,
              p: { xs: 1.5, sm: 2 },
              borderRadius: 'md',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                {pendingMovies.length} new suggestion{pendingMovies.length === 1 ? '' : 's'} from
                your connections
              </Typography>
              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                Tell them if you're in for the watch.
              </Typography>
            </Box>
            <Button
              variant="solid"
              color="primary"
              size="sm"
              onClick={() => setInboxOpen(true)}
              sx={{ fontWeight: 700, color: '#0d0f1a', flexShrink: 0 }}
            >
              Review now
            </Button>
          </Sheet>
        )}

        {/* View selector */}
        {isAuthenticated && (connections.length > 0 || soloMovies.length > 0) && (
          <ViewSelector
            connections={connections}
            soloMovieCount={soloMovies.length}
            selectedConnectionId={selectedConnectionId}
            onSelect={setSelectedConnectionId}
          />
        )}

        {/* My Suggestions subtitle */}
        {isAuthenticated && isMySuggestionsView && (
          <Typography level="body-sm" sx={{ textAlign: 'center', color: 'text.tertiary', mb: 2 }}>
            {isShow ? 'Shows' : 'Movies'} you've suggested for the group
          </Typography>
        )}

        {/* Connection banners (personal view only) */}
        {isAuthenticated && !isCombinedView && !isSoloView && (
          <ConnectionBanners
            incomingPending={incomingPending}
            onShowConnections={onShowConnections}
          />
        )}

        {/* First-login onboarding card — already on Movies, so no Watch button on card */}
        {showOnboardingCard && (
          <OnboardingCard
            onDismiss={handleDismissOnboarding}
            onShowConnections={onShowConnections}
            onShowThisOrThat={onShowThisOrThat}
          />
        )}

        {/* Add form */}
        {isAuthenticated && <AddMovieForm kind={kind} onMovieAdded={handleMovieAdded} />}

        {/* Recently added — highlighted cards */}
        {recentlyAddedMovies.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography level="title-sm" sx={{ fontWeight: 700, mb: 1 }}>
              Just added
            </Typography>
            {recentlyAddedMovies.map((movie) => {
              const isSeen = movie.myTags?.some((t) => t.tag.slug === 'seen') ?? false;
              const seenByUsers = (movie.userTags ?? []).filter((t) => t.tag.slug === 'seen');
              const seenCount = seenByUsers.length;
              const seenNames = seenByUsers.map((t) => t.user.display_name || t.user.username);
              return (
                <Sheet
                  key={movie.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 'md',
                    mb: 1,
                    p: 1.5,
                    borderColor: 'primary.400',
                    borderWidth: 1.5,
                    bgcolor: 'rgba(var(--joy-palette-primary-mainChannel) / 0.06)',
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    {/* Poster */}
                    <Poster url={movie.poster_url} size="sm" />

                    {/* Details */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {movie.title}
                        {movie.tmdb_id && (
                          <a
                            href={tmdbUrl(kind, movie.tmdb_id)}
                            target="_blank"
                            rel="noopener noreferrer"
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
                      <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                        Added to the queue
                      </Typography>
                    </Box>

                    {/* Seen toggle */}
                    <Tooltip
                      title={
                        seenCount > 0
                          ? `Seen by: ${seenNames.join(', ')}`
                          : isSeen
                            ? 'Remove "Seen it"'
                            : "I've seen this"
                      }
                      arrow
                    >
                      <Button
                        size="sm"
                        variant={isSeen ? 'soft' : 'outlined'}
                        color={isSeen ? 'warning' : 'neutral'}
                        onClick={() => handleToggleSeen(movie.id, isSeen)}
                        sx={{ fontSize: '0.75rem', flexShrink: 0 }}
                      >
                        {isSeen ? 'Seen' : "I've seen this"}
                        {seenCount > 0 && !isSeen && (
                          <Typography
                            component="span"
                            level="body-xs"
                            sx={{ ml: 0.5, fontWeight: 700 }}
                          >
                            ({seenCount})
                          </Typography>
                        )}
                      </Button>
                    </Tooltip>

                    {/* Undo */}
                    <Tooltip title="Undo — remove from list" arrow>
                      <Button
                        size="sm"
                        variant="plain"
                        color="danger"
                        onClick={async () => {
                          try {
                            await deleteMovie({ variables: { id: movie.id } });
                            setRecentlyAddedIds((prev) => prev.filter((rid) => rid !== movie.id));
                          } catch (err: any) {
                            showError(`Error: ${err.message}`);
                          }
                        }}
                        sx={{ fontSize: '0.75rem', flexShrink: 0 }}
                      >
                        Undo
                      </Button>
                    </Tooltip>

                    {/* Dismiss */}
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      aria-label="Dismiss"
                      onClick={() =>
                        setRecentlyAddedIds((prev) => prev.filter((id) => id !== movie.id))
                      }
                      sx={{ opacity: 0.4, '&:hover': { opacity: 1 }, flexShrink: 0 }}
                    >
                      <X size={16} strokeWidth={2.25} />
                    </IconButton>
                  </Box>
                </Sheet>
              );
            })}
          </Box>
        )}

        {/* TMDB match flow */}
        {isAuthenticated && unmatchedMovies.length > 0 && !isCombinedView && !isSoloView && (
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Button
              variant="outlined"
              color="neutral"
              size="sm"
              onClick={() => setMatchFlowOpen(true)}
            >
              Match {unmatchedMovies.length} unmatched {noun}
              {unmatchedMovies.length !== 1 ? 's' : ''} with TMDB
            </Button>
          </Box>
        )}
        {matchFlowOpen && (
          <TmdbMatchFlow
            kind={kind}
            movies={unmatchedMovies}
            onClose={() => setMatchFlowOpen(false)}
          />
        )}

        {/* Unauthenticated prompt */}
        {!isAuthenticated && movies.length === 0 && (
          <Typography level="body-sm" sx={{ textAlign: 'center', color: 'text.tertiary', mb: 4 }}>
            Sign in to suggest {nounPlural}.
          </Typography>
        )}

        {/* Combined view */}
        {isCombinedView && (
          <>
            <Typography level="body-sm" sx={{ textAlign: 'center', color: 'neutral.400', mb: 2 }}>
              {isShow ? 'Shows' : 'Movies'} ranked by combining both your This or That picks. The
              more you each compare, the better the ranking.
            </Typography>

            {combinedLoading && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size="sm" />
              </Box>
            )}
            {!combinedLoading && combined && (
              <>
                {(() => {
                  const allRankings = combined.rankings;
                  const myId = String(user?.id ?? '');
                  const otherId = String(combined.connection.user.id);
                  const filteredRankings =
                    combinedSeenFilter === 'all'
                      ? allRankings
                      : allRankings.filter((r: any) => {
                          const seenTags = ((r.movie ?? r.show).userTags ?? []).filter(
                            (t: any) => t.tag.slug === 'seen',
                          );
                          const meSeen = seenTags.some((t: any) => String(t.user.id) === myId);
                          const otherSeen = seenTags.some(
                            (t: any) => String(t.user.id) === otherId,
                          );
                          if (combinedSeenFilter === 'new') return !meSeen && !otherSeen;
                          if (combinedSeenFilter === 'one') return meSeen !== otherSeen;
                          if (combinedSeenFilter === 'rewatch') return meSeen && otherSeen;
                          return true;
                        });
                  const filterChips: { key: typeof combinedSeenFilter; label: string }[] = [
                    { key: 'all', label: 'All' },
                    { key: 'new', label: 'New to both' },
                    { key: 'one', label: 'One has seen' },
                    { key: 'rewatch', label: 'Both have seen' },
                  ];
                  if (allRankings.length === 0) {
                    return (
                      <Box sx={{ textAlign: 'center', py: 6 }}>
                        <Typography level="body-md" sx={{ color: 'text.secondary', mb: 2 }}>
                          No rankings to combine yet. Both users need to do some "This or That"
                          comparisons first!
                        </Typography>
                        {onShowThisOrThat && (
                          <Button
                            variant="soft"
                            color="primary"
                            size="sm"
                            onClick={onShowThisOrThat}
                          >
                            Rank {nounPlural}
                          </Button>
                        )}
                      </Box>
                    );
                  }
                  return (
                    <>
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
                            aria-label={`Combined  rankings`}
                            style={{
                              width: '100%',
                              minWidth: 360,
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
                                <th style={combinedThStyle} scope="col">
                                  #
                                </th>
                                <th style={{ ...combinedThStyle, textAlign: 'left' }}>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <span>Title</span>
                                    <Select
                                      size="sm"
                                      value={combinedSeenFilter}
                                      onChange={(_, val) => val && setCombinedSeenFilter(val)}
                                      sx={{
                                        minHeight: 24,
                                        py: 0,
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        textTransform: 'none',
                                        letterSpacing: 'normal',
                                      }}
                                    >
                                      {filterChips.map((f) => (
                                        <Option key={f.key} value={f.key}>
                                          {f.label}
                                        </Option>
                                      ))}
                                    </Select>
                                  </Box>
                                </th>
                                <th style={combinedThStyle}>You</th>
                                <th style={combinedThStyle}>
                                  {combined.connection.user.display_name ||
                                    combined.connection.user.username}
                                </th>
                                <th style={combinedThStyle}>Combined</th>
                                <th style={combinedThStyle} aria-label="Actions"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredRankings.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={6}
                                    style={{
                                      ...combinedTdStyle,
                                      textAlign: 'center',
                                      color: 'var(--mn-text-muted)',
                                      fontSize: '0.875rem',
                                      padding: '32px 16px',
                                    }}
                                  >
                                    No match this filter.
                                  </td>
                                </tr>
                              ) : (
                                filteredRankings.map((r: any, idx: number) => (
                                  <tr key={(r.movie ?? r.show).id}>
                                    <td
                                      style={{
                                        ...combinedTdStyle,
                                        textAlign: 'center',
                                        width: 48,
                                      }}
                                    >
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
                                          {(r.movie ?? r.show).title}
                                        </Typography>
                                        {!r.bothRated && (
                                          <Tooltip
                                            title={`Only one of you has ranked this  in This or That`}
                                            arrow
                                          >
                                            <Chip size="sm" variant="soft" color="neutral">
                                              Needs ranking
                                            </Chip>
                                          </Tooltip>
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
                                    <td
                                      style={{
                                        ...combinedTdStyle,
                                        textAlign: 'right',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {isAuthenticated && (
                                        <Tooltip
                                          title={`Mark "${(r.movie ?? r.show).title}" as watched together`}
                                          arrow
                                        >
                                          <IconButton
                                            size="sm"
                                            color="success"
                                            variant="plain"
                                            onClick={() =>
                                              handleMarkWatchedCombined(
                                                (r.movie ?? r.show).id,
                                                (r.movie ?? r.show).title,
                                                combined.connection.user.display_name ||
                                                  combined.connection.user.username,
                                              )
                                            }
                                            aria-label={`Mark "${(r.movie ?? r.show).title}" as watched together`}
                                            sx={{
                                              opacity: 0.5,
                                              transition: 'opacity 0.15s',
                                              '&:hover': { opacity: 1 },
                                            }}
                                          >
                                            <Check size={16} strokeWidth={2.5} />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </Box>
                      </Sheet>

                      {/* Sparse data CTA */}
                      {(() => {
                        const rankings = combined.rankings;
                        const needsRanking = rankings.filter((r: any) => !r.bothRated).length;
                        return needsRanking > rankings.length / 2 ? (
                          <Sheet
                            variant="soft"
                            color="warning"
                            sx={{
                              mt: 2,
                              p: 2,
                              borderRadius: 'md',
                              textAlign: 'center',
                            }}
                          >
                            <Typography level="body-sm" sx={{ fontWeight: 600, mb: 1 }}>
                              Rankings work best when you've both compared more {nounPlural}
                            </Typography>
                            {onShowThisOrThat && (
                              <Button
                                variant="soft"
                                color="primary"
                                size="sm"
                                onClick={onShowThisOrThat}
                              >
                                Keep ranking
                              </Button>
                            )}
                          </Sheet>
                        ) : null;
                      })()}
                    </>
                  );
                })()}
              </>
            )}
          </>
        )}

        {/* Watch Alone view */}
        {isSoloView && (
          <>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography level="body-sm" sx={{ color: 'text.tertiary' }}>
                {isShow ? 'Shows' : 'Movies'} your connections passed on — these are all yours to
                watch solo!
              </Typography>
            </Box>

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
                    aria-label={`Solo `}
                    style={{
                      width: '100%',
                      minWidth: 540,
                      borderCollapse: 'collapse',
                      tableLayout: 'auto',
                    }}
                  >
                    <tbody>
                      {soloMovies.map((movie) => (
                        <ContentRow
                          key={movie.id}
                          item={movie}
                          kind={kind}
                          isAdmin={isAdmin}
                          canMarkWatched={true}
                          onMarkWatched={handleMarkWatched}
                          onDelete={handleDelete}
                          onToggleSeen={handleToggleSeen}
                          isAuthenticated={isAuthenticated}
                        />
                      ))}
                    </tbody>
                  </table>
                </Box>
              </Sheet>
            </Box>

            {/* Cards — visible on mobile */}
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
              {soloMovies.map((movie, idx) => (
                <ContentCard
                  key={movie.id}
                  item={movie}
                  kind={kind}
                  rank={idx + 1}
                  isAdmin={isAdmin}
                  canMarkWatched={true}
                  onMarkWatched={handleMarkWatched}
                  onDelete={handleDelete}
                  onToggleSeen={handleToggleSeen}
                  isAuthenticated={isAuthenticated}
                />
              ))}
            </Box>
          </>
        )}

        {/* Movie list (personal view) */}
        {!isCombinedView && !isSoloView && (
          <>
            {/* Loading skeleton */}
            {moviesLoading && !data && (
              <Sheet
                variant="outlined"
                sx={{
                  borderRadius: 'md',
                  overflow: 'clip',
                  borderColor: 'var(--mn-border-vis)',
                }}
              >
                <Box sx={{ p: 0 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: '8px 16px',
                        borderBottom: '1px solid var(--mn-border)',
                      }}
                    >
                      <Skeleton
                        variant="rectangular"
                        sx={{ width: 28, height: 42, borderRadius: '3px', flexShrink: 0 }}
                      />
                      <Skeleton variant="text" sx={{ width: `${60 + (i % 3) * 15}%` }} />
                    </Box>
                  ))}
                </Box>
              </Sheet>
            )}

            {/* Table — hidden on mobile */}
            {data && (
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
                      aria-label={isMySuggestionsView ? `My suggested ` : ` queue`}
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
                          {['Title', 'Suggested by', 'Added'].map((label) => (
                            <th key={label} scope="col" style={thStyle}>
                              {label}
                            </th>
                          ))}
                          <th
                            scope="col"
                            style={{ ...thStyle, textAlign: 'center', padding: '10px 8px' }}
                          >
                            TMDB
                          </th>
                          {isAuthenticated && (
                            <th
                              scope="col"
                              style={{ ...thStyle, textAlign: 'center', padding: '10px 4px' }}
                            >
                              Seen
                            </th>
                          )}
                          {isAuthenticated && (
                            <th
                              scope="col"
                              aria-label="Actions"
                              style={{ ...thStyle, textAlign: 'right', padding: '10px 12px' }}
                            />
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {myMovies.length === 0 ? (
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
                              {isAuthenticated
                                ? `You haven't suggested any  yet. Use the search bar above to add one!`
                                : `No  yet. Be the first to suggest one!`}
                            </td>
                          </tr>
                        ) : (
                          myMovies.map((movie) => (
                            <ContentRow
                              key={movie.id}
                              item={movie}
                              kind={kind}
                              isAdmin={isAdmin}
                              canMarkWatched={
                                isAdmin ||
                                (isAuthenticated && String(movie.requested_by) === String(user?.id))
                              }
                              onMarkWatched={handleMarkWatched}
                              onDelete={handleDelete}
                              onToggleSeen={handleToggleSeen}
                              isAuthenticated={isAuthenticated}
                              isRecentlyAdded={recentlyAddedSet.has(String(movie.id))}
                            />
                          ))
                        )}
                      </tbody>
                    </table>
                  </Box>
                </Sheet>
              </Box>
            )}

            {/* Cards — visible on mobile */}
            {data && (
              <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                {myMovies.length === 0 ? (
                  <Typography
                    level="body-sm"
                    sx={{ textAlign: 'center', color: 'text.tertiary', py: 6 }}
                  >
                    {isAuthenticated
                      ? `You haven't suggested any  yet. Use the search bar above to add one!`
                      : `No  yet. Be the first to suggest one!`}
                  </Typography>
                ) : (
                  myMovies.map((movie, idx) => (
                    <ContentCard
                      key={movie.id}
                      item={movie}
                      kind={kind}
                      rank={idx + 1}
                      isAdmin={isAdmin}
                      canMarkWatched={
                        isAdmin ||
                        (isAuthenticated && String(movie.requested_by) === String(user?.id))
                      }
                      onMarkWatched={handleMarkWatched}
                      onDelete={handleDelete}
                      onToggleSeen={handleToggleSeen}
                      isAuthenticated={isAuthenticated}
                      isRecentlyAdded={recentlyAddedSet.has(String(movie.id))}
                    />
                  ))
                )}
              </Box>
            )}
          </>
        )}

        {/* Seed button — admin only, test env only, movies only (no seedShows) */}
        {isAdmin && !isProd && !isShow && (
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

      <ConnectionInboxModal
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        pendingMovies={pendingMovies}
        onSetInterest={handleSetInterest}
        onSetSeenTag={handleSetSeenTag}
      />

      <ConfirmDialog {...dialogProps} />
    </Box>
  );
};

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--mn-text-muted)',
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

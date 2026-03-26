import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client";
import { GET_MOVIES, ADD_MOVIE, DELETE_MOVIE, MARK_WATCHED, REORDER_MOVIE, SEARCH_TMDB } from "../../graphql/queries";
import { Autocomplete, AutocompleteOption, Box, Button, Typography, Sheet, Chip, IconButton, ListItemContent } from "@mui/joy";
import TmdbMatchFlow from "./TmdbMatchFlow";
import { Movie } from "../../models/Movies";
import { useAuth } from "../../contexts/AuthContext";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Six-dot grab handle icon
const DragHandleIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="currentColor"
    style={{ display: "block" }}
  >
    <circle cx="5" cy="4" r="1.5" />
    <circle cx="11" cy="4" r="1.5" />
    <circle cx="5" cy="8" r="1.5" />
    <circle cx="11" cy="8" r="1.5" />
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="11" cy="12" r="1.5" />
  </svg>
);

interface SortableRowProps {
  movie: Movie;
  rank: number;
  isAdmin: boolean;
  onMarkWatched: (id: string, title: string) => void;
  onDelete: (id: string, title: string) => void;
}

const SortableRow: React.FC<SortableRowProps> = ({ movie, rank, isAdmin, onMarkWatched, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: movie.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      {/* Drag handle */}
      {isAdmin && (
        <td
          style={{
            width: 36,
            padding: "0 4px 0 12px",
            verticalAlign: "middle",
          }}
        >
          <span
            {...attributes}
            {...listeners}
            style={{
              cursor: isDragging ? "grabbing" : "grab",
              display: "inline-flex",
              alignItems: "center",
              touchAction: "none",
              color: "var(--mn-text-muted)",
              padding: "4px",
            }}
            title="Drag to reorder"
          >
            <DragHandleIcon />
          </span>
        </td>
      )}

      {/* Rank */}
      <td
        style={{
          width: 44,
          textAlign: "center",
          verticalAlign: "middle",
          padding: "0 8px",
        }}
      >
        <Typography
          level="body-xs"
          sx={{
            fontWeight: 700,
            color: rank <= 3 ? "primary.400" : "text.tertiary",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {rank}
        </Typography>
      </td>

      {/* Title */}
      <td style={{ verticalAlign: "middle", padding: "12px 16px" }}>
        <Typography
          level="body-sm"
          sx={{ fontWeight: 600, color: "text.primary" }}
        >
          {movie.title}
        </Typography>
      </td>

      {/* Suggested by */}
      <td style={{ verticalAlign: "middle", padding: "12px 16px" }}>
        <Chip
          size="sm"
          variant="soft"
          color="neutral"
          sx={{ fontWeight: 500 }}
        >
          {movie.requester}
        </Chip>
      </td>

      {/* Date */}
      <td
        style={{
          verticalAlign: "middle",
          padding: "12px 16px",
          whiteSpace: "nowrap",
        }}
      >
        <Typography level="body-xs" sx={{ color: "text.secondary" }}>
          {new Date(movie.date_submitted).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </Typography>
      </td>

      {/* TMDB */}
      <td style={{ verticalAlign: "middle", padding: "12px 8px", textAlign: "center" }}>
        {movie.tmdb_id ? (
          <a
            href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--joy-palette-primary-500)", fontSize: "0.75rem" }}
          >
            ↗
          </a>
        ) : null}
      </td>

      {/* Actions */}
      {isAdmin && (
        <td
          style={{
            verticalAlign: "middle",
            padding: "0 12px",
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          <IconButton
            size="sm"
            color="success"
            variant="plain"
            onClick={() => onMarkWatched(movie.id, movie.title)}
            title={`Mark "${movie.title}" as watched`}
            sx={{
              opacity: 0.5,
              transition: "opacity 0.15s",
              "&:hover": { opacity: 1 },
              mr: 0.5,
            }}
          >
            ✓
          </IconButton>
          <IconButton
            size="sm"
            color="danger"
            variant="plain"
            onClick={() => onDelete(movie.id, movie.title)}
            title={`Remove "${movie.title}"`}
            sx={{
              opacity: 0.5,
              transition: "opacity 0.15s",
              "&:hover": { opacity: 1 },
            }}
          >
            ✕
          </IconButton>
        </td>
      )}
    </tr>
  );
};

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

const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.is_admin ?? false;
  const [title, setTitle] = useState("");
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [tmdbOptions, setTmdbOptions] = useState<TmdbOption[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [localMovies, setLocalMovies] = useState<Movie[] | null>(null);
  const [matchFlowOpen, setMatchFlowOpen] = useState(false);

  const debouncedTitle = useDebounce(title, 400);

  const { data } = useQuery(GET_MOVIES, {
    pollInterval: 5000,
    onCompleted: () => setLocalMovies(null),
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

  const [reorderMovie] = useMutation(REORDER_MOVIE, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

  const movies: Movie[] = localMovies ?? data?.movies ?? [];

  // Movies without a TMDB match that the current user is allowed to act on
  const unmatchedMovies = movies.filter((m) => !m.tmdb_id && (
    isAdmin || (user && String(m.requested_by) === String(user.id))
  ));

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = movies.findIndex((m) => m.id === active.id);
    const newIndex = movies.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(movies, oldIndex, newIndex);
    setLocalMovies(reordered);

    const afterId = newIndex === 0 ? null : reordered[newIndex - 1].id;
    try {
      await reorderMovie({ variables: { id: active.id, afterId } });
    } catch (err: any) {
      setLocalMovies(null);
      setErrorMessage(`Error reordering: ${err.message}`);
    }
  };

  const handleMarkWatched = async (id: string, movieTitle: string) => {
    if (!window.confirm(`Mark "${movieTitle}" as watched? It will be removed from the watchlist.`)) return;
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Please enter a movie title.");
      return;
    }
    try {
      await addMovie({ variables: { title: title.trim(), tmdb_id: tmdbId } });
      setSuccessMessage("Added to the list!");
      setTitle("");
      setTmdbId(null);
      setTmdbOptions([]);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(`Error: ${error.message}`);
    }
  };

  return (
    <Box
      component="main"
      sx={{
        flex: 1,
        bgcolor: "background.body",
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 3, sm: 5 },
      }}
    >
      <Box sx={{ maxWidth: 860, mx: "auto" }}>
        {/* Page header */}
        <Box sx={{ textAlign: "center", mb: { xs: 4, sm: 5 } }}>
          <Typography
            level="h2"
            sx={{
              fontWeight: 800,
              letterSpacing: "-0.02em",
              mb: 0.5,
            }}
          >
            🍿 Movie List
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            {movies.length === 0
              ? "No movies yet — suggest one!"
              : `${movies.length} movie${movies.length !== 1 ? "s" : ""} in the queue`}
          </Typography>
        </Box>

        {/* Add movie form */}
        {isAuthenticated && (
          <Box sx={{ mb: 4 }}>
            <form onSubmit={handleSubmit}>
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  maxWidth: 520,
                  mx: "auto",
                }}
              >
                <Autocomplete
                  freeSolo
                  options={tmdbOptions}
                  getOptionLabel={(option) =>
                    typeof option === "string"
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
                    if (value && typeof value !== "string") {
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
                    bgcolor: "background.surface",
                    "--Input-focusedHighlight": "var(--joy-palette-primary-500)",
                  }}
                />
                <Button
                  type="submit"
                  color="primary"
                  variant="solid"
                  sx={{ fontWeight: 700, color: "#0d0f1a", px: 3 }}
                >
                  Add
                </Button>
              </Box>
            </form>

            {/* Feedback messages */}
            {successMessage && (
              <Typography
                level="body-sm"
                sx={{
                  textAlign: "center",
                  mt: 1.5,
                  color: "success.400",
                  fontWeight: 600,
                }}
              >
                ✓ {successMessage}
              </Typography>
            )}
            {errorMessage && (
              <Typography
                level="body-sm"
                sx={{
                  textAlign: "center",
                  mt: 1.5,
                  color: "danger.400",
                  fontWeight: 600,
                }}
              >
                {errorMessage}
              </Typography>
            )}
          </Box>
        )}

        {/* TMDB match flow */}
        {isAuthenticated && unmatchedMovies.length > 0 && (
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Button
              variant="outlined"
              color="neutral"
              size="sm"
              onClick={() => setMatchFlowOpen(true)}
            >
              Match {unmatchedMovies.length} unmatched movie{unmatchedMovies.length !== 1 ? "s" : ""} with TMDB
            </Button>
          </Box>
        )}
        {matchFlowOpen && (
          <TmdbMatchFlow
            movies={unmatchedMovies}
            onClose={() => setMatchFlowOpen(false)}
          />
        )}

        {/* Unauthenticated prompt */}
        {!isAuthenticated && movies.length === 0 && (
          <Typography
            level="body-sm"
            sx={{ textAlign: "center", color: "text.tertiary", mb: 4 }}
          >
            Sign in to suggest movies.
          </Typography>
        )}

        {/* Movie table */}
        <Sheet
          variant="outlined"
          sx={{
            borderRadius: "md",
            overflow: "clip",
            borderColor: "var(--mn-border-vis)",
          }}
        >
          <Box sx={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 480,
                borderCollapse: "collapse",
                tableLayout: "auto",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--mn-bg-elevated)",
                    borderBottom: "1px solid var(--mn-border-vis)",
                  }}
                >
                  {isAdmin && <th style={{ width: 36 }} />}
                  <th
                    style={{
                      padding: "10px 8px",
                      textAlign: "center",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--mn-text-muted)",
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--mn-text-muted)",
                    }}
                  >
                    Title
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--mn-text-muted)",
                    }}
                  >
                    Suggested by
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--mn-text-muted)",
                    }}
                  >
                    Added
                  </th>
                  <th
                    style={{
                      padding: "10px 8px",
                      textAlign: "center",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--mn-text-muted)",
                    }}
                  >
                    TMDB
                  </th>
                  {isAdmin && (
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--mn-text-muted)",
                      }}
                    />
                  )}
                </tr>
              </thead>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={movies.map((m) => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody>
                    {movies.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isAdmin ? 7 : 5}
                          style={{
                            padding: "48px 16px",
                            textAlign: "center",
                            color: "var(--mn-text-muted)",
                            fontSize: "0.875rem",
                          }}
                        >
                          No movies yet. Be the first to suggest one!
                        </td>
                      </tr>
                    ) : (
                      movies.map((movie, idx) => (
                        <SortableRow
                          key={movie.id}
                          movie={movie}
                          rank={idx + 1}
                          isAdmin={isAdmin}
                          onMarkWatched={handleMarkWatched}
                          onDelete={handleDelete}
                        />
                      ))
                    )}
                  </tbody>
                </SortableContext>
              </DndContext>
            </table>
          </Box>
        </Sheet>

        {/* Admin hint */}
        {isAdmin && movies.length > 1 && (
          <Typography
            level="body-xs"
            sx={{ mt: 1.5, textAlign: "center", color: "text.tertiary" }}
          >
            Drag rows to reorder the watchlist.
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default HomePage;

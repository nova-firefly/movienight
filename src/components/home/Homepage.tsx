// App.tsx
import React, { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_MOVIES, ADD_MOVIE, DELETE_MOVIE, REORDER_MOVIE } from "../../graphql/queries";
import { Button, Input, Stack, Table, Typography } from "@mui/joy";
import styled from "styled-components";
import { columnNameToDisplayName } from "../../utils/textUtils";
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

const StyledApp = styled.body`
  background-color: lightskyblue;
  min-height: calc(100vh - 60px);
  padding: 20px;
`;

// Six-dot grab handle icon
const DragHandleIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    style={{ display: "block", color: "#888" }}
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
  isAdmin: boolean;
  onDelete: (id: string, title: string) => void;
}

const SortableRow: React.FC<SortableRowProps> = ({ movie, isAdmin, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: movie.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? "#e8f4fd" : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      {isAdmin && (
        <td style={{ width: 32, paddingLeft: 8 }}>
          <span
            {...attributes}
            {...listeners}
            style={{ cursor: isDragging ? "grabbing" : "grab", display: "inline-flex", touchAction: "none" }}
            title="Drag to reorder"
          >
            <DragHandleIcon />
          </span>
        </td>
      )}
      {Object.keys(movie).map((key) => {
        if (key === "id" || key === "__typename" || key === "rank") return null;
        if (key === "date_submitted") {
          return <td key={key}>{new Date(movie[key as keyof Movie]).toLocaleDateString()}</td>;
        }
        return <td key={key}>{movie[key as keyof Movie]}</td>;
      })}
      {isAdmin && (
        <td>
          <Button
            size="sm"
            color="danger"
            variant="soft"
            onClick={() => onDelete(movie.id, movie.title)}
            title="Remove"
          >
            ✕
          </Button>
        </td>
      )}
    </tr>
  );
};

const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.is_admin ?? false;
  const [title, setTitle] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // Optimistic local ordering for smooth DnD UX
  const [localMovies, setLocalMovies] = useState<Movie[] | null>(null);

  const { data } = useQuery(GET_MOVIES, {
    pollInterval: 5000,
    onCompleted: () => setLocalMovies(null), // reset optimistic state on fresh data
  });

  const [addMovie] = useMutation(ADD_MOVIE, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

  const [deleteMovie] = useMutation(DELETE_MOVIE, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

  const [reorderMovie] = useMutation(REORDER_MOVIE, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

  const movies: Movie[] = localMovies ?? data?.movies ?? [];

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = movies.findIndex((m) => m.id === active.id);
    const newIndex = movies.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(movies, oldIndex, newIndex);

    // Optimistic update so the table snaps into place immediately
    setLocalMovies(reordered);

    const afterId = newIndex === 0 ? null : reordered[newIndex - 1].id;
    try {
      await reorderMovie({ variables: { id: active.id, afterId } });
    } catch (err: any) {
      setLocalMovies(null); // revert on error
      setErrorMessage(`Error reordering: ${err.message}`);
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
    if (title) {
      try {
        await addMovie({ variables: { title } });
        setSuccessMessage("Movie suggestion added successfully!");
        setTitle("");
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (error: any) {
        setErrorMessage(`Error adding movie suggestion: ${error.message}`);
      }
    } else {
      setErrorMessage("Please fill in all fields.");
    }
  };

  // Derive column headers from first movie, excluding hidden fields
  const visibleKeys = movies.length > 0
    ? Object.keys(movies[0]).filter((k) => k !== "id" && k !== "__typename" && k !== "rank")
    : [];

  return (
    <StyledApp>
      <Stack justifyContent="center" alignItems="center" spacing={2}>
        <Typography level="h1">🍿Movie List🍿</Typography>
        {isAuthenticated && (
          <>
            <form onSubmit={handleSubmit}>
              <Stack>
                <Input
                  type="text"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Button type="submit">Submit</Button>
              </Stack>
            </form>
            {successMessage && <p style={{ color: "green" }}>{successMessage}</p>}
            {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
          </>
        )}
        <Table
          aria-label="basic table"
          variant="outlined"
          size="lg"
          stickyHeader
          stripe="odd"
          sx={{ width: "80%", backgroundColor: "white" }}
        >
          <thead>
            <tr>
              {isAdmin && <th style={{ width: 32 }} />}
              {visibleKeys.map((key) => (
                <th key={key}>{columnNameToDisplayName(key)}</th>
              ))}
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={movies.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {movies.map((movie) => (
                  <SortableRow
                    key={movie.id}
                    movie={movie}
                    isAdmin={isAdmin}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </Table>
      </Stack>
    </StyledApp>
  );
};

export default HomePage;

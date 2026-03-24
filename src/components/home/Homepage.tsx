// App.tsx
import React, { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_MOVIES, ADD_MOVIE, DELETE_MOVIE, MOVE_MOVIE } from "../../graphql/queries";
import { Button, Input, Stack, Table, Typography } from "@mui/joy";
import styled from "styled-components";
import { columnNameToDisplayName } from "../../utils/textUtils";
import { Movie } from "../../models/Movies";
import { useAuth } from "../../contexts/AuthContext";

const StyledApp = styled.body`
  background-color: lightskyblue;
  min-height: calc(100vh - 60px);
  padding: 20px;
`;

const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.is_admin ?? false;
  const [title, setTitle] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const { data, loading, error } = useQuery(GET_MOVIES, {
    pollInterval: 5000, // Poll every 5 seconds for updates
  });

  const [addMovie] = useMutation(ADD_MOVIE, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

  const [deleteMovie] = useMutation(DELETE_MOVIE, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

  const [moveMovie] = useMutation(MOVE_MOVIE, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Remove "${title}" from the list?`)) return;
    try {
      await deleteMovie({ variables: { id } });
    } catch (err: any) {
      setErrorMessage(`Error removing movie: ${err.message}`);
    }
  };

  const handleMove = async (id: string, direction: string) => {
    try {
      await moveMovie({ variables: { id, direction } });
    } catch (err: any) {
      setErrorMessage(`Error reordering: ${err.message}`);
    }
  };

  const movies: Movie[] = data?.movies || [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (title) {
      try {
        await addMovie({
          variables: { title },
        });
        setSuccessMessage("Movie suggestion added successfully!");
        setTitle("");
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } catch (error: any) {
        setErrorMessage(`Error adding movie suggestion: ${error.message}`);
      }
    } else {
      setErrorMessage("Please fill in all fields.");
    }
  };

  if (loading) return <StyledApp><Stack justifyContent="center" alignItems="center"><Typography level="h3">Loading movies...</Typography></Stack></StyledApp>;
  if (error) return <StyledApp><Stack justifyContent="center" alignItems="center"><Typography level="h3" color="danger">Error: {error.message}</Typography></Stack></StyledApp>;

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
              {movies &&
                movies.length !== 0 &&
                Object.keys(movies[0]).map(
                  (key) =>
                    key !== "id" && key !== "__typename" && <th key={key}>{columnNameToDisplayName(key)}</th>
                )}
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {movies.map((movie, idx) => (
              <tr key={movie.id}>
                {Object.keys(movie).map((key) => {
                  if (key === "id" || key === "__typename") return null;

                  if (key === "date_submitted") {
                    return <td key={key}>{new Date(movie[key as keyof Movie]).toLocaleDateString()}</td>;
                  }

                  return <td key={key}>{movie[key as keyof Movie]}</td>;
                })}
                {isAdmin && (
                  <td>
                    <Stack direction="row" spacing={0.5}>
                      <Button
                        size="sm"
                        variant="plain"
                        disabled={idx === 0}
                        onClick={() => handleMove(movie.id, "up")}
                        title="Move up"
                      >▲</Button>
                      <Button
                        size="sm"
                        variant="plain"
                        disabled={idx === movies.length - 1}
                        onClick={() => handleMove(movie.id, "down")}
                        title="Move down"
                      >▼</Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="soft"
                        onClick={() => handleDelete(movie.id, movie.title)}
                        title="Remove"
                      >✕</Button>
                    </Stack>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Stack>
    </StyledApp>
  );
};

export default HomePage;

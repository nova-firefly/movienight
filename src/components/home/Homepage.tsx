// App.tsx
import React, { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_MOVIES, ADD_MOVIE } from "../../graphql/queries";
import { Button, Input, Stack, Table, Typography } from "@mui/joy";
import styled from "styled-components";
import { columnNameToDisplayName } from "../../utils/textUtils";
import { Movie } from "../../models/Movies";
import { useAuth } from "../../contexts/AuthContext";

const StyledApp = styled.div`
  background-color: lightskyblue;
  min-height: calc(100vh - 60px);
  padding: 20px;
`;

const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [title, setTitle] = useState("");
  const [requester, setRequester] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const { data, loading, error } = useQuery(GET_MOVIES, {
    pollInterval: 5000, // Poll every 5 seconds for updates
  });

  const [addMovie] = useMutation(ADD_MOVIE, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

  const movies: Movie[] = data?.movies || [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (title && requester) {
      try {
        await addMovie({
          variables: { title, requester },
        });
        setSuccessMessage("Movie suggestion added successfully!");
        setTitle("");
        setRequester("");
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
                <Input
                  type="text"
                  placeholder="Requester"
                  value={requester}
                  onChange={(e) => setRequester(e.target.value)}
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
                    key !== "id" && key !== "__typename" && <th>{columnNameToDisplayName(key)}</th>
                )}
            </tr>
          </thead>
          <tbody>
            {movies.map((movie) => (
              <tr key={movie.id}>
                <td>{movie.title}</td>
                <td>{movie.requester}</td>
                <td>{new Date(movie.date_submitted).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Stack>
    </StyledApp>
  );
};

export default HomePage;

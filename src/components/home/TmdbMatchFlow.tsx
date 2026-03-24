import React, { useState, useEffect } from "react";
import { useLazyQuery, useMutation } from "@apollo/client";
import { SEARCH_TMDB, MATCH_MOVIE, GET_MOVIES } from "../../graphql/queries";
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Button,
  Box,
  CircularProgress,
  Divider,
} from "@mui/joy";
import { Movie } from "../../models/Movies";

type TmdbResult = {
  tmdb_id: number;
  title: string;
  release_year: string | null;
  overview: string | null;
};

interface Props {
  movies: Movie[];
  onClose: () => void;
}

const TmdbMatchFlow: React.FC<Props> = ({ movies, onClose }) => {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<TmdbResult[]>([]);

  const current = movies[index];

  const [searchError, setSearchError] = useState<string | null>(null);

  const [searchTmdb, { loading: searching }] = useLazyQuery(SEARCH_TMDB, {
    onCompleted: (d) => { setResults(d.searchTmdb || []); setSearchError(null); },
    onError: (e) => setSearchError(e.message),
    fetchPolicy: "network-only",
  });

  const [matchMovie, { loading: matching }] = useMutation(MATCH_MOVIE, {
    refetchQueries: [{ query: GET_MOVIES }],
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

  const handlePick = async (tmdbId: number) => {
    await matchMovie({ variables: { id: current.id, tmdb_id: tmdbId } });
    advance();
  };

  return (
    <Modal open onClose={onClose}>
      <ModalDialog sx={{ maxWidth: 460, width: "100%", p: 3 }}>
        <ModalClose />

        {!current ? (
          <>
            <Typography level="title-md">All done!</Typography>
            <Typography level="body-sm" sx={{ color: "text.secondary", mt: 0.5 }}>
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
              <Typography level="body-xs" sx={{ color: "text.tertiary", mt: 0.25 }}>
                {index + 1} of {movies.length}
              </Typography>
            </Box>

            <Typography
              level="body-sm"
              sx={{ fontWeight: 600, mb: 1.5 }}
            >
              "{current.title}"
            </Typography>

            <Divider sx={{ mb: 1.5 }} />

            {searching ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                <CircularProgress size="sm" />
              </Box>
            ) : searchError ? (
              <Typography level="body-sm" sx={{ color: "danger.400", py: 2, textAlign: "center" }}>
                Search failed: {searchError}
              </Typography>
            ) : results.length === 0 ? (
              <Typography level="body-sm" sx={{ color: "text.tertiary", py: 2, textAlign: "center" }}>
                No results found.
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, maxHeight: 320, overflowY: "auto" }}>
                {results.map((r) => (
                  <Button
                    key={r.tmdb_id}
                    variant="outlined"
                    color="neutral"
                    disabled={matching}
                    onClick={() => handlePick(r.tmdb_id)}
                    sx={{
                      justifyContent: "flex-start",
                      textAlign: "left",
                      fontWeight: 500,
                      px: 1.5,
                    }}
                  >
                    {r.title}
                    {r.release_year && (
                      <Typography
                        component="span"
                        level="body-xs"
                        sx={{ ml: 1, color: "text.tertiary" }}
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
              sx={{ mt: 2, alignSelf: "flex-end" }}
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

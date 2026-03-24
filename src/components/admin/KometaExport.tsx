import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import {
  Box,
  CircularProgress,
  Typography,
  Button,
  Alert,
  Sheet,
} from '@mui/joy';
import { GET_MOVIES } from '../../graphql/queries';

interface Movie {
  id: string;
  title: string;
  rank: number;
  tmdb_id: number | null;
}

function generateKometaYaml(movies: Movie[], collectionName: string): string {
  const matched = movies.filter((m) => m.tmdb_id != null);
  const today = new Date().toISOString().split('T')[0];

  const idLines = matched.map((m) => `      - ${m.tmdb_id}`).join('\n');

  return (
    `collections:\n` +
    `  ${collectionName}:\n` +
    `    tmdb_movie:\n` +
    `${idLines}\n` +
    `    collection_order: custom\n` +
    `    sync_mode: sync\n` +
    `    summary: "MovieNight watchlist — exported ${today}"\n`
  );
}

export const KometaExport: React.FC = () => {
  const { data, loading } = useQuery(GET_MOVIES, {
    fetchPolicy: 'cache-and-network',
  });

  const [copied, setCopied] = useState(false);
  const collectionName = 'MovieNight Watchlist';

  const movies: Movie[] = [...(data?.movies ?? [])].sort(
    (a: Movie, b: Movie) => a.rank - b.rank
  );

  const matched = movies.filter((m) => m.tmdb_id != null);
  const unmatched = movies.filter((m) => m.tmdb_id == null);

  const yaml = movies.length > 0 ? generateKometaYaml(movies, collectionName) : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kometa-movienight.yml';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && movies.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size="md" color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      <Typography level="title-md" fontWeight={700} sx={{ color: 'text.secondary', mb: 1 }}>
        {matched.length} of {movies.length} movies exportable (have TMDB ID)
      </Typography>

      <Typography level="body-sm" sx={{ color: 'text.tertiary', mb: 2 }}>
        Generates a Kometa collection file using{' '}
        <code>tmdb_movie</code> + <code>collection_order: custom</code> to
        preserve the current ranked order in Plex.
      </Typography>

      {unmatched.length > 0 && (
        <Alert color="warning" sx={{ mb: 2 }}>
          <Box>
            <Typography level="title-sm" fontWeight={700}>
              {unmatched.length} movie{unmatched.length > 1 ? 's' : ''} skipped — no TMDB ID
            </Typography>
            <Typography level="body-xs" sx={{ mt: 0.5, opacity: 0.85 }}>
              {unmatched.map((m) => m.title).join(', ')}
            </Typography>
          </Box>
        </Alert>
      )}

      {matched.length === 0 ? (
        <Alert color="danger" sx={{ mb: 2 }}>
          No movies have TMDB IDs. Use the TMDB match feature on the homepage to
          link movies before exporting.
        </Alert>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              size="sm"
              variant="solid"
              color="primary"
              onClick={handleDownload}
            >
              Download .yml
            </Button>
            <Button
              size="sm"
              variant="outlined"
              color={copied ? 'success' : 'neutral'}
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </Button>
          </Box>

          <Sheet
            variant="outlined"
            sx={{
              borderRadius: 'md',
              borderColor: 'var(--mn-border-vis)',
              overflow: 'auto',
              maxHeight: 480,
            }}
          >
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                lineHeight: 1.6,
                color: 'text.primary',
                whiteSpace: 'pre',
              }}
            >
              {yaml}
            </Box>
          </Sheet>
        </>
      )}
    </Box>
  );
};

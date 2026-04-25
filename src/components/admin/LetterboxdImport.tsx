import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Box, Button, Input, Typography, Alert, CircularProgress, List, ListItem } from '@mui/joy';
import { IMPORT_FROM_LETTERBOXD, BACKFILL_TMDB_DATA, GET_MOVIES } from '../../graphql/queries';

interface ImportResult {
  imported: number;
  skipped: number;
  tmdb_matched: number;
  errors: string[];
}

export const LetterboxdImport: React.FC = () => {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [backfillResult, setBackfillResult] = useState<number | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  const [importMovies, { loading }] = useMutation(IMPORT_FROM_LETTERBOXD, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

  const [backfillTmdb, { loading: backfilling }] = useMutation(BACKFILL_TMDB_DATA);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    try {
      const { data } = await importMovies({ variables: { url: url.trim() } });
      setResult(data.importFromLetterboxd);
    } catch (err: any) {
      setResult({
        imported: 0,
        skipped: 0,
        tmdb_matched: 0,
        errors: [err.message ?? 'Unknown error'],
      });
    }
  };

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography level="title-md" fontWeight={700} sx={{ color: 'text.secondary', mb: 1 }}>
        Import from Letterboxd
      </Typography>
      <Typography level="body-sm" sx={{ color: 'text.tertiary', mb: 3 }}>
        Paste a public Letterboxd list URL to bulk-import all films. Already-existing titles are
        skipped.
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://letterboxd.com/username/list/list-name/"
          disabled={loading}
          sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}
          required
        />
        <Button type="submit" loading={loading} disabled={!url.trim()}>
          Import
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
          <CircularProgress size="sm" />
          <Typography level="body-sm">Fetching list from Letterboxd…</Typography>
        </Box>
      )}

      {result && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {result.imported > 0 && (
            <Alert color="success" variant="soft">
              <Typography level="body-sm" fontWeight={600}>
                {result.imported} film{result.imported !== 1 ? 's' : ''} imported
                {result.tmdb_matched > 0 && ` (${result.tmdb_matched} auto-matched to TMDB)`}
                {result.skipped > 0 && `, ${result.skipped} already in list`}
              </Typography>
            </Alert>
          )}
          {result.imported === 0 && result.skipped > 0 && result.errors.length === 0 && (
            <Alert color="neutral" variant="soft">
              <Typography level="body-sm">
                All {result.skipped} film{result.skipped !== 1 ? 's' : ''} already in the list
              </Typography>
            </Alert>
          )}
          {result.errors.length > 0 && (
            <Alert color="danger" variant="soft">
              <Box>
                <Typography level="body-sm" fontWeight={600} sx={{ mb: 0.5 }}>
                  {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
                </Typography>
                <List size="sm" sx={{ '--List-gap': '2px', pl: 0 }}>
                  {result.errors.map((err, i) => (
                    <ListItem key={i} sx={{ py: 0 }}>
                      <Typography level="body-xs" sx={{ fontFamily: 'monospace' }}>
                        {err}
                      </Typography>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Alert>
          )}
        </Box>
      )}

      {/* TMDB Backfill */}
      <Box sx={{ mt: 5, pt: 4, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography level="title-md" fontWeight={700} sx={{ color: 'text.secondary', mb: 1 }}>
          Backfill TMDB Data
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.tertiary', mb: 2 }}>
          Fetch poster, director, cast, and genre data from TMDB for any movies that are missing it.
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            loading={backfilling}
            onClick={async () => {
              setBackfillResult(null);
              setBackfillError(null);
              try {
                const { data } = await backfillTmdb();
                setBackfillResult(data.backfillTmdbData);
              } catch (err: any) {
                setBackfillError(err.message ?? 'Unknown error');
              }
            }}
          >
            Backfill Now
          </Button>
          {backfillResult !== null && (
            <Alert color={backfillResult > 0 ? 'success' : 'neutral'} variant="soft" size="sm">
              {backfillResult > 0
                ? `Fetched TMDB data for ${backfillResult} movie${backfillResult !== 1 ? 's' : ''}`
                : 'All movies already have TMDB data'}
            </Alert>
          )}
          {backfillError && (
            <Alert color="danger" variant="soft" size="sm">
              {backfillError}
            </Alert>
          )}
        </Box>
      </Box>
    </Box>
  );
};

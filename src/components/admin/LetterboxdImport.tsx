import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import {
  Box,
  Button,
  Input,
  Typography,
  Alert,
  CircularProgress,
  List,
  ListItem,
} from '@mui/joy';
import { IMPORT_FROM_LETTERBOXD } from '../../graphql/queries';
import { GET_MOVIES } from '../../graphql/queries';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export const LetterboxdImport: React.FC = () => {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const [importMovies, { loading }] = useMutation(IMPORT_FROM_LETTERBOXD, {
    refetchQueries: [{ query: GET_MOVIES }],
  });

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

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', gap: 1, mb: 3 }}
      >
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
    </Box>
  );
};

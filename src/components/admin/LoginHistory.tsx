import React from 'react';
import { useQuery } from '@apollo/client';
import { Box, CircularProgress, Typography, Table, Sheet, Chip } from '@mui/joy';
import { GET_LOGIN_HISTORY } from '../../graphql/queries';

interface LoginHistoryEntry {
  id: string;
  user_id: string | null;
  username: string | null;
  ip_address: string | null;
  user_agent: string | null;
  succeeded: boolean;
  created_at: string;
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--mn-text-muted)',
  background: 'var(--mn-bg-elevated)',
  borderBottom: '1px solid var(--mn-border-vis)',
  whiteSpace: 'nowrap',
};

export const LoginHistory: React.FC = () => {
  const { data, loading } = useQuery(GET_LOGIN_HISTORY, {
    variables: { limit: 200 },
    fetchPolicy: 'network-only',
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size="md" color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      <Typography level="title-md" fontWeight={700} sx={{ color: 'text.secondary', mb: 2 }}>
        {data?.loginHistory?.length ?? 0} entries
      </Typography>
      <Sheet
        variant="outlined"
        sx={{ borderRadius: 'md', overflow: 'hidden', borderColor: 'var(--mn-border-vis)' }}
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Table
            stickyHeader
            sx={{
              '--TableCell-headBackground': 'var(--mn-bg-elevated)',
              '--TableRow-hoverBackground': 'var(--mn-bg-hover)',
              '--TableCell-paddingY': '10px',
              '--TableCell-paddingX': '16px',
              minWidth: 560,
            }}
          >
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 145 }}>Time</th>
                <th style={{ ...thStyle, width: 120 }}>User</th>
                <th style={{ ...thStyle, width: 90 }}>Result</th>
                <th style={{ ...thStyle, width: 120 }}>IP Address</th>
                <th style={thStyle}>User Agent</th>
              </tr>
            </thead>
            <tbody>
              {data?.loginHistory.map((entry: LoginHistoryEntry) => (
                <tr key={entry.id}>
                  <td>
                    <Typography level="body-xs" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm"
                      fontWeight={entry.username ? 600 : 400}
                      sx={{ color: entry.username ? 'text.primary' : 'text.tertiary' }}>
                      {entry.username || 'unknown'}
                    </Typography>
                  </td>
                  <td>
                    <Chip
                      size="sm"
                      color={entry.succeeded ? 'success' : 'danger'}
                      variant="soft"
                    >
                      {entry.succeeded ? 'Success' : 'Failed'}
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-xs" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                      {entry.ip_address || '—'}
                    </Typography>
                  </td>
                  <td>
                    <Typography
                      level="body-xs"
                      sx={{
                        color: 'text.secondary',
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={entry.user_agent || ''}
                    >
                      {entry.user_agent || '—'}
                    </Typography>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Box>
      </Sheet>
    </Box>
  );
};

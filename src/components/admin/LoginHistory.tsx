import React from 'react';
import { useQuery } from '@apollo/client';
import { Box, Typography, Table, Sheet, Chip } from '@mui/joy';
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

export const LoginHistory: React.FC = () => {
  const { data, loading } = useQuery(GET_LOGIN_HISTORY, {
    variables: { limit: 200 },
    fetchPolicy: 'network-only',
  });

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box>
      <Typography level="h3" sx={{ mb: 3 }}>
        Login History
      </Typography>
      <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto' }}>
        <Table>
          <thead>
            <tr>
              <th style={{ width: 150 }}>Time</th>
              <th style={{ width: 120 }}>User</th>
              <th style={{ width: 90 }}>Result</th>
              <th style={{ width: 120 }}>IP Address</th>
              <th>User Agent</th>
            </tr>
          </thead>
          <tbody>
            {data?.loginHistory.map((entry: LoginHistoryEntry) => (
              <tr key={entry.id}>
                <td>
                  <Typography level="body-xs">
                    {new Date(entry.created_at).toLocaleString()}
                  </Typography>
                </td>
                <td>
                  {entry.username || (
                    <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                      unknown
                    </Typography>
                  )}
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
                  <Typography level="body-xs">{entry.ip_address || '—'}</Typography>
                </td>
                <td>
                  <Typography
                    level="body-xs"
                    sx={{
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
      </Sheet>
    </Box>
  );
};

import React from 'react';
import { useQuery } from '@apollo/client';
import { Box, Typography, Table, Sheet, Chip } from '@mui/joy';
import { GET_AUDIT_LOGS } from '../../graphql/queries';

interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_username: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: string | null;
  ip_address: string | null;
  created_at: string;
}

function actionColor(action: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (action === 'LOGIN_SUCCESS' || action === 'MOVIE_ADD' || action === 'USER_CREATE')
    return 'success';
  if (action === 'USER_UPDATE') return 'warning';
  if (action === 'LOGIN_FAILURE' || action.includes('DELETE')) return 'danger';
  return 'neutral';
}

export const AuditLog: React.FC = () => {
  const { data, loading } = useQuery(GET_AUDIT_LOGS, {
    variables: { limit: 200 },
    fetchPolicy: 'network-only',
  });

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box>
      <Typography level="h3" sx={{ mb: 3 }}>
        Audit Log
      </Typography>
      <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto' }}>
        <Table>
          <thead>
            <tr>
              <th style={{ width: 150 }}>Time</th>
              <th style={{ width: 120 }}>Actor</th>
              <th style={{ width: 150 }}>Action</th>
              <th style={{ width: 120 }}>Target</th>
              <th>Details</th>
              <th style={{ width: 120 }}>IP</th>
            </tr>
          </thead>
          <tbody>
            {data?.auditLogs.map((log: AuditLogEntry) => (
              <tr key={log.id}>
                <td>
                  <Typography level="body-xs">
                    {new Date(log.created_at).toLocaleString()}
                  </Typography>
                </td>
                <td>
                  {log.actor_username || (
                    <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                      —
                    </Typography>
                  )}
                </td>
                <td>
                  <Chip size="sm" color={actionColor(log.action)} variant="soft">
                    {log.action}
                  </Chip>
                </td>
                <td>
                  {log.target_type && log.target_id ? (
                    <Typography level="body-xs">
                      {log.target_type}:{log.target_id}
                    </Typography>
                  ) : (
                    <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                      —
                    </Typography>
                  )}
                </td>
                <td>
                  <Typography
                    level="body-xs"
                    sx={{
                      maxWidth: 260,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={log.metadata || ''}
                  >
                    {log.metadata || '—'}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-xs">{log.ip_address || '—'}</Typography>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Sheet>
    </Box>
  );
};

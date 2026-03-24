import React from 'react';
import { useQuery } from '@apollo/client';
import { Box, CircularProgress, Typography, Table, Sheet, Chip } from '@mui/joy';
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

export const AuditLog: React.FC = () => {
  const { data, loading } = useQuery(GET_AUDIT_LOGS, {
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
        {data?.auditLogs?.length ?? 0} entries
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
              minWidth: 680,
            }}
          >
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 145 }}>Time</th>
                <th style={{ ...thStyle, width: 110 }}>Actor</th>
                <th style={{ ...thStyle, width: 155 }}>Action</th>
                <th style={{ ...thStyle, width: 120 }}>Target</th>
                <th style={thStyle}>Details</th>
                <th style={{ ...thStyle, width: 115 }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {data?.auditLogs.map((log: AuditLogEntry) => (
                <tr key={log.id}>
                  <td>
                    <Typography level="body-xs" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" fontWeight={log.actor_username ? 600 : 400}
                      sx={{ color: log.actor_username ? 'text.primary' : 'text.tertiary' }}>
                      {log.actor_username || '—'}
                    </Typography>
                  </td>
                  <td>
                    <Chip size="sm" color={actionColor(log.action)} variant="soft">
                      {log.action}
                    </Chip>
                  </td>
                  <td>
                    {log.target_type && log.target_id ? (
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                        {log.target_type}:{log.target_id}
                      </Typography>
                    ) : (
                      <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>—</Typography>
                    )}
                  </td>
                  <td>
                    <Typography
                      level="body-xs"
                      sx={{
                        color: 'text.secondary',
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
                    <Typography level="body-xs" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                      {log.ip_address || '—'}
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

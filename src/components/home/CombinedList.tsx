import React, { useState, useEffect } from 'react';
import { useQuery, useLazyQuery, useMutation } from '@apollo/client';
import {
  Box, Typography, Button, Sheet, Chip, Input, CircularProgress, Alert,
} from '@mui/joy';
import {
  SEARCH_USERS,
  MY_CONNECTIONS,
  PENDING_CONNECTION_REQUESTS,
  COMBINED_LIST,
  SEND_CONNECTION_REQUEST,
  RESPOND_TO_CONNECTION_REQUEST,
  REMOVE_CONNECTION,
} from '../../graphql/queries';
import { useAuth } from '../../contexts/AuthContext';

type Tab = 'connections' | 'rankings';

interface CombinedListProps {
  connectionId: string | null;
  onSelectConnection: (id: string | null) => void;
}

const CombinedList: React.FC<CombinedListProps> = ({ connectionId, onSelectConnection }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(connectionId ? 'rankings' : 'connections');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchUsers, { loading: searchLoading }] = useLazyQuery(SEARCH_USERS, {
    fetchPolicy: 'network-only',
    onCompleted: (data) => setSearchResults(data.searchUsers),
  });

  const { data: connectionsData, refetch: refetchConnections } = useQuery(MY_CONNECTIONS);
  const { data: pendingData, refetch: refetchPending } = useQuery(PENDING_CONNECTION_REQUESTS, {
    pollInterval: 5000,
  });

  const { data: combinedData, loading: combinedLoading } = useQuery(COMBINED_LIST, {
    variables: { connectionId },
    skip: !connectionId,
    fetchPolicy: 'cache-and-network',
  });

  const [sendRequest, { loading: sendingRequest }] = useMutation(SEND_CONNECTION_REQUEST, {
    onCompleted: (data) => {
      const status = data.sendConnectionRequest.status;
      setSuccess(status === 'accepted' ? 'Connected! (mutual request)' : 'Request sent!');
      setSearchQuery('');
      setSearchResults([]);
      refetchPending();
      refetchConnections();
    },
    onError: (err) => setError(err.message),
  });

  const [respond] = useMutation(RESPOND_TO_CONNECTION_REQUEST, {
    onCompleted: () => {
      refetchPending();
      refetchConnections();
    },
    onError: (err) => setError(err.message),
  });

  const [removeConnection] = useMutation(REMOVE_CONNECTION, {
    onCompleted: () => {
      if (connectionId) onSelectConnection(null);
      refetchConnections();
    },
    onError: (err) => setError(err.message),
  });

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchUsers({ variables: { query: searchQuery.trim() } });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  // Auto-clear alerts
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Switch to rankings tab when connection selected
  useEffect(() => {
    if (connectionId) setTab('rankings');
  }, [connectionId]);

  const incomingPending = pendingData?.pendingConnectionRequests?.filter((r: any) => r.direction === 'received') || [];
  const outgoingPending = pendingData?.pendingConnectionRequests?.filter((r: any) => r.direction === 'sent') || [];
  const connections = connectionsData?.myConnections || [];

  const handleViewCombined = (connId: string) => {
    onSelectConnection(connId);
    setTab('rankings');
  };

  return (
    <Box
      component="main"
      sx={{
        flex: 1,
        bgcolor: 'background.body',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 3, sm: 5 },
      }}
    >
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
          <Typography level="h2" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
            Combined List
          </Typography>
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            Connect with friends and see your combined movie rankings
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3 }}>
          <Button
            variant={tab === 'connections' ? 'soft' : 'plain'}
            color="neutral"
            size="sm"
            onClick={() => setTab('connections')}
            sx={{ fontWeight: 600, color: tab === 'connections' ? 'primary.400' : 'text.secondary' }}
          >
            Connections
          </Button>
          <Button
            variant={tab === 'rankings' ? 'soft' : 'plain'}
            color="neutral"
            size="sm"
            onClick={() => setTab('rankings')}
            disabled={!connectionId && connections.length === 0}
            sx={{ fontWeight: 600, color: tab === 'rankings' ? 'primary.400' : 'text.secondary' }}
          >
            Rankings
          </Button>
        </Box>

        {/* Alerts */}
        {error && <Alert color="danger" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert color="success" sx={{ mb: 2 }}>{success}</Alert>}

        {tab === 'connections' && (
          <>
            {/* Search */}
            <Sheet variant="outlined" sx={{ p: 2, borderRadius: 'md', mb: 3, borderColor: 'var(--mn-border-vis)' }}>
              <Typography level="title-sm" sx={{ mb: 1.5, fontWeight: 700 }}>Find a friend</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Input
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ flex: 1 }}
                  size="sm"
                />
                {searchLoading && <CircularProgress size="sm" />}
              </Box>
              {searchResults.length > 0 && (
                <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {searchResults.map((u: any) => (
                    <Box
                      key={u.id}
                      sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        p: 1, borderRadius: 'sm', bgcolor: 'background.level1',
                      }}
                    >
                      <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {u.display_name || u.username}
                        {u.display_name && (
                          <Typography component="span" level="body-xs" sx={{ color: 'text.tertiary', ml: 0.5 }}>
                            @{u.username}
                          </Typography>
                        )}
                      </Typography>
                      <Button
                        size="sm"
                        variant="soft"
                        color="primary"
                        loading={sendingRequest}
                        onClick={() => sendRequest({ variables: { addresseeId: u.id } })}
                      >
                        Connect
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}
            </Sheet>

            {/* Pending incoming */}
            {incomingPending.length > 0 && (
              <Sheet variant="outlined" sx={{ p: 2, borderRadius: 'md', mb: 3, borderColor: 'warning.outlinedBorder' }}>
                <Typography level="title-sm" sx={{ mb: 1.5, fontWeight: 700 }}>
                  Pending requests ({incomingPending.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {incomingPending.map((req: any) => (
                    <Box
                      key={req.id}
                      sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        p: 1, borderRadius: 'sm', bgcolor: 'background.level1',
                      }}
                    >
                      <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {req.user.display_name || req.user.username}
                        <Typography component="span" level="body-xs" sx={{ color: 'text.tertiary', ml: 0.5 }}>
                          wants to connect
                        </Typography>
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Button
                          size="sm" variant="soft" color="success"
                          onClick={() => respond({ variables: { connectionId: req.id, accept: true } })}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm" variant="plain" color="danger"
                          onClick={() => respond({ variables: { connectionId: req.id, accept: false } })}
                        >
                          Decline
                        </Button>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Sheet>
            )}

            {/* Outgoing pending */}
            {outgoingPending.length > 0 && (
              <Sheet variant="outlined" sx={{ p: 2, borderRadius: 'md', mb: 3, borderColor: 'var(--mn-border-vis)' }}>
                <Typography level="title-sm" sx={{ mb: 1.5, fontWeight: 700 }}>Sent requests</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {outgoingPending.map((req: any) => (
                    <Box
                      key={req.id}
                      sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        p: 1, borderRadius: 'sm', bgcolor: 'background.level1',
                      }}
                    >
                      <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {req.user.display_name || req.user.username}
                      </Typography>
                      <Chip size="sm" variant="soft" color="neutral">Pending</Chip>
                    </Box>
                  ))}
                </Box>
              </Sheet>
            )}

            {/* Active connections */}
            <Sheet variant="outlined" sx={{ p: 2, borderRadius: 'md', borderColor: 'var(--mn-border-vis)' }}>
              <Typography level="title-sm" sx={{ mb: 1.5, fontWeight: 700 }}>Your connections</Typography>
              {connections.length === 0 && (
                <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                  No connections yet. Search for a friend above!
                </Typography>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {connections.map((conn: any) => (
                  <Box
                    key={conn.id}
                    sx={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      p: 1, borderRadius: 'sm', bgcolor: 'background.level1',
                    }}
                  >
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                      {conn.user.display_name || conn.user.username}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button
                        size="sm" variant="soft" color="primary"
                        onClick={() => handleViewCombined(conn.id)}
                      >
                        View Combined
                      </Button>
                      <Button
                        size="sm" variant="plain" color="danger"
                        onClick={() => {
                          if (window.confirm(`Remove connection with ${conn.user.display_name || conn.user.username}?`)) {
                            removeConnection({ variables: { connectionId: conn.id } });
                          }
                        }}
                        sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                      >
                        Remove
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Sheet>
          </>
        )}

        {tab === 'rankings' && (
          <>
            {!connectionId && connections.length > 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography level="body-md" sx={{ color: 'text.secondary', mb: 2 }}>
                  Select a connection to view combined rankings
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 400, mx: 'auto' }}>
                  {connections.map((conn: any) => (
                    <Button
                      key={conn.id}
                      variant="outlined"
                      color="neutral"
                      onClick={() => handleViewCombined(conn.id)}
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      {conn.user.display_name || conn.user.username}
                    </Button>
                  ))}
                </Box>
              </Box>
            )}

            {!connectionId && connections.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                  No connections yet. Go to the Connections tab to add a friend!
                </Typography>
              </Box>
            )}

            {connectionId && combinedLoading && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size="sm" />
              </Box>
            )}

            {connectionId && combinedData?.combinedList && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography level="title-md" sx={{ fontWeight: 700 }}>
                    {user?.display_name || user?.username} + {combinedData.combinedList.connection.user.display_name || combinedData.combinedList.connection.user.username}
                  </Typography>
                  <Button
                    size="sm" variant="plain" color="neutral"
                    onClick={() => { onSelectConnection(null); setTab('connections'); }}
                  >
                    Change
                  </Button>
                </Box>

                {combinedData.combinedList.rankings.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                      No rankings to combine yet. Both users need to do some "This or That" comparisons first!
                    </Typography>
                  </Box>
                ) : (
                  <Sheet
                    variant="outlined"
                    sx={{ borderRadius: 'md', overflow: 'clip', borderColor: 'var(--mn-border-vis)' }}
                  >
                    <Box sx={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                        <thead>
                          <tr style={{ background: 'var(--mn-bg-elevated)', borderBottom: '1px solid var(--mn-border-vis)' }}>
                            <th style={thStyle}>#</th>
                            <th style={{ ...thStyle, textAlign: 'left' }}>Title</th>
                            <th style={thStyle}>You</th>
                            <th style={thStyle}>Them</th>
                            <th style={thStyle}>Combined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combinedData.combinedList.rankings.map((r: any, idx: number) => (
                            <tr key={r.movie.id}>
                              <td style={{ ...tdStyle, textAlign: 'center', width: 48 }}>
                                <Typography level="body-xs" sx={{ fontWeight: 700, color: idx < 3 ? 'primary.400' : 'text.tertiary' }}>
                                  {idx + 1}
                                </Typography>
                              </td>
                              <td style={tdStyle}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                                    {r.movie.title}
                                  </Typography>
                                  {!r.bothRated && (
                                    <Chip size="sm" variant="soft" color="neutral">partial</Chip>
                                  )}
                                </Box>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                {r.userAElo != null ? (
                                  <Chip size="sm" variant="soft" color={r.userAElo >= 1000 ? 'success' : 'warning'}>
                                    {Math.round(r.userAElo)}
                                  </Chip>
                                ) : (
                                  <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>--</Typography>
                                )}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                {r.userBElo != null ? (
                                  <Chip size="sm" variant="soft" color={r.userBElo >= 1000 ? 'success' : 'warning'}>
                                    {Math.round(r.userBElo)}
                                  </Chip>
                                ) : (
                                  <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>--</Typography>
                                )}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                <Chip size="sm" variant="solid" color="primary">
                                  {Math.round(r.combinedElo)}
                                </Chip>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Box>
                  </Sheet>
                )}
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'center',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--mn-text-muted)',
};

const tdStyle: React.CSSProperties = {
  padding: '12px',
  verticalAlign: 'middle',
};

export default CombinedList;

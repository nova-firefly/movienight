import React, { useState, useEffect } from 'react';
import { useQuery, useLazyQuery, useMutation } from '@apollo/client';
import {
  Box, Typography, Button, Sheet, Chip, Input, CircularProgress, Alert,
} from '@mui/joy';
import {
  SEARCH_USERS,
  MY_CONNECTIONS,
  PENDING_CONNECTION_REQUESTS,
  SEND_CONNECTION_REQUEST,
  RESPOND_TO_CONNECTION_REQUEST,
  REMOVE_CONNECTION,
} from '../../graphql/queries';

const CombinedList: React.FC = () => {
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
    onCompleted: () => refetchConnections(),
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

  const incomingPending = pendingData?.pendingConnectionRequests?.filter((r: any) => r.direction === 'received') || [];
  const outgoingPending = pendingData?.pendingConnectionRequests?.filter((r: any) => r.direction === 'sent') || [];
  const connections = connectionsData?.myConnections || [];

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
            Connections
          </Typography>
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            Connect with friends to see combined movie rankings on the home page
          </Typography>
        </Box>

        {/* Alerts */}
        {error && <Alert color="danger" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert color="success" sx={{ mb: 2 }}>{success}</Alert>}

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
            ))}
          </Box>
        </Sheet>
      </Box>
    </Box>
  );
};

export default CombinedList;

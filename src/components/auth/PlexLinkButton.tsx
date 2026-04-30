import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Box, Button, Typography } from '@mui/joy';
import {
  CREATE_PLEX_PIN,
  LINK_PLEX_ACCOUNT,
  UNLINK_PLEX_ACCOUNT,
  GET_ME,
} from '../../graphql/queries';
import { useAuth } from '../../contexts/AuthContext';

export const PlexLinkButton: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [createPlexPin] = useMutation(CREATE_PLEX_PIN);
  const [linkPlexAccount] = useMutation(LINK_PLEX_ACCOUNT, {
    refetchQueries: [{ query: GET_ME }],
  });
  const [unlinkPlexAccount] = useMutation(UNLINK_PLEX_ACCOUNT, {
    refetchQueries: [{ query: GET_ME }],
  });

  const handleLink = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: pinData } = await createPlexPin();
      const { pinId, authUrl } = pinData.createPlexPin;

      window.open(authUrl, 'PlexAuth', 'width=800,height=600');

      await linkPlexAccount({ variables: { pinId } });
      await refreshUser();
    } catch (err: any) {
      const msg = err?.graphQLErrors?.[0]?.message;
      setError(msg || 'Failed to link Plex account');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setLoading(true);
    setError('');
    try {
      await unlinkPlexAccount();
      await refreshUser();
    } catch (err: any) {
      const msg = err?.graphQLErrors?.[0]?.message;
      setError(msg || 'Failed to unlink Plex account');
    } finally {
      setLoading(false);
    }
  };

  if (user?.plex_id) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography level="body-xs" sx={{ color: '#e5a00d' }}>
          Plex: {user.plex_username}
        </Typography>
        <Button
          variant="plain"
          color="neutral"
          size="sm"
          loading={loading}
          onClick={handleUnlink}
          sx={{ fontSize: '0.7rem', minHeight: 'auto', p: 0.5 }}
        >
          Unlink
        </Button>
        {error && (
          <Typography level="body-xs" color="danger">
            {error}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Button
        variant="plain"
        size="sm"
        loading={loading}
        onClick={handleLink}
        sx={{
          fontSize: '0.75rem',
          minHeight: 'auto',
          p: 0.5,
          color: '#e5a00d',
          '&:hover': { bgcolor: 'rgba(229, 160, 13, 0.08)' },
        }}
      >
        Link Plex
      </Button>
      {error && (
        <Typography level="body-xs" color="danger">
          {error}
        </Typography>
      )}
    </Box>
  );
};

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Box,
  Typography,
  Button,
  Alert,
  Sheet,
  Input,
  FormLabel,
  FormControl,
  CircularProgress,
} from '@mui/joy';
import { GET_APP_INFO, UPDATE_APP_SETTING } from '../../graphql/queries';

interface SettingFieldProps {
  label: string;
  settingKey: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  helpText: string;
}

const SettingField: React.FC<SettingFieldProps> = ({
  label,
  settingKey,
  value,
  onChange,
  placeholder,
  helpText,
}) => (
  <FormControl sx={{ mb: 2 }}>
    <FormLabel sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary' }}>
      {label}
    </FormLabel>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      sx={{ bgcolor: 'background.surface', fontFamily: 'monospace', fontSize: '0.85rem' }}
      data-setting-key={settingKey}
    />
    <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 0.5 }}>
      {helpText}
    </Typography>
  </FormControl>
);

export const Settings: React.FC = () => {
  const { data, loading } = useQuery(GET_APP_INFO);
  const [updateSetting, { loading: saving }] = useMutation(UPDATE_APP_SETTING, {
    refetchQueries: [{ query: GET_APP_INFO }],
  });

  const [plexClientId, setPlexClientId] = useState('');
  const [tmdbApiKey, setTmdbApiKey] = useState('');
  const [mdblistApiKey, setMdblistApiKey] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (data?.appInfo) {
      setPlexClientId(data.appInfo.plexClientId || '');
      setTmdbApiKey(data.appInfo.tmdbApiKey || '');
      setMdblistApiKey(data.appInfo.mdblistApiKey || '');
    }
  }, [data]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    try {
      const settings = [
        { key: 'plex_client_id', value: plexClientId, prev: data?.appInfo?.plexClientId || '' },
        { key: 'tmdb_api_key', value: tmdbApiKey, prev: data?.appInfo?.tmdbApiKey || '' },
        { key: 'mdblist_api_key', value: mdblistApiKey, prev: data?.appInfo?.mdblistApiKey || '' },
      ];

      const changed = settings.filter((s) => s.value !== s.prev);
      if (changed.length === 0) {
        setSuccess('No changes to save.');
        return;
      }

      for (const { key, value } of changed) {
        await updateSetting({ variables: { key, value: value || null } });
      }
      setSuccess(`Saved ${changed.length} setting${changed.length > 1 ? 's' : ''}.`);
    } catch (err: any) {
      setError(err.message);
    }
  };

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
        API Keys & Integration
      </Typography>

      <Sheet
        variant="outlined"
        sx={{
          borderRadius: 'md',
          p: 2.5,
          borderColor: 'var(--mn-border-vis)',
        }}
      >
        <SettingField
          label="Plex Client ID"
          settingKey="plex_client_id"
          value={plexClientId}
          onChange={setPlexClientId}
          placeholder="e.g. movienight-abc123"
          helpText="Enables 'Sign in with Plex'. Must be stable across restarts. Also configurable via PLEX_CLIENT_ID env var."
        />

        <SettingField
          label="TMDB API Key"
          settingKey="tmdb_api_key"
          value={tmdbApiKey}
          onChange={setTmdbApiKey}
          placeholder="e.g. abc123def456..."
          helpText="Enables movie search, poster art, and metadata. Get one at themoviedb.org. Also configurable via TMDB_API_KEY env var."
        />

        <SettingField
          label="MDBList API Key"
          settingKey="mdblist_api_key"
          value={mdblistApiKey}
          onChange={setMdblistApiKey}
          placeholder="e.g. xyz789..."
          helpText="Enables Kometa/Plex collection sync via MDBList. Also configurable via MDBLIST_API_KEY env var."
        />

        {success && (
          <Alert color="success" variant="soft" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        {error && (
          <Alert color="danger" variant="soft" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            color="primary"
            loading={saving}
            onClick={handleSave}
            sx={{ fontWeight: 700, color: '#0d0f1a' }}
          >
            Save Settings
          </Button>
        </Box>
      </Sheet>
    </Box>
  );
};

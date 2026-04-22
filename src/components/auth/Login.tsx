import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Typography,
  Alert,
} from '@mui/joy';
import { LOGIN, GET_APP_INFO } from '../../graphql/queries';
import { useAuth } from '../../contexts/AuthContext';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const { data: appInfoData } = useQuery(GET_APP_INFO);
  const quickLoginUsers: { label: string; username: string; password: string }[] =
    appInfoData?.appInfo?.quickLoginUsers ?? [];

  const [loginMutation, { loading }] = useMutation(LOGIN, {
    onCompleted: (data) => {
      login(data.login.token, data.login.user);
      setError('');
    },
    onError: (err) => {
      if (err.networkError) {
        const status = (err.networkError as any)?.statusCode;
        if (status === 502 || status === 503 || status === 504) {
          setError('Server is temporarily unavailable. Please try again in a moment.');
        } else {
          setError('Cannot connect to the server. Please check your connection and try again.');
        }
      } else if (err.graphQLErrors?.length) {
        const code = err.graphQLErrors[0]?.extensions?.code;
        if (code === 'UNAUTHENTICATED') {
          setError('Incorrect username or password.');
        } else if (code === 'FORBIDDEN') {
          setError('Your account has been disabled. Please contact an administrator.');
        } else {
          setError('Login failed. Please try again.');
        }
      } else {
        setError('Login failed. Please try again.');
      }
    },
  });

  const handleQuickLogin = async (u: string, p: string) => {
    setError('');
    try {
      await loginMutation({ variables: { username: u, password: p } });
    } catch {
      // handled by onError
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }
    try {
      await loginMutation({ variables: { username, password } });
    } catch {
      // handled by onError
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: 'background.body',
      }}
    >
      {/* Left — branding panel (hidden on small screens) */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          bgcolor: 'background.surface',
          borderRight: '1px solid',
          borderColor: 'divider',
          px: 6,
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative glow */}
        <Box
          sx={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,197,24,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <Typography sx={{ fontSize: '5rem', lineHeight: 1 }}>🎬</Typography>
        <Typography
          level="h1"
          sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: 'primary.400' }}
        >
          MovieNight
        </Typography>
        <Typography level="body-lg" sx={{ color: 'text.secondary', maxWidth: 280 }}>
          Keep track of what to watch next — together.
        </Typography>
      </Box>

      {/* Right — login form */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: { xs: 3, sm: 5 },
          py: 6,
        }}
      >
        {/* Mobile logo */}
        <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '3rem', lineHeight: 1 }}>🎬</Typography>
          <Typography
            level="h3"
            sx={{ fontWeight: 800, color: 'primary.400', mt: 1 }}
          >
            MovieNight
          </Typography>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 380 }}>
          <Typography level="h3" sx={{ mb: 0.5, fontWeight: 700 }}>
            Welcome back
          </Typography>
          <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 4 }}>
            Sign in to your account
          </Typography>

          <form onSubmit={handleSubmit}>
            <FormControl sx={{ mb: 2 }}>
              <FormLabel sx={{ color: 'text.secondary', fontSize: '0.8rem', fontWeight: 600 }}>
                Username
              </FormLabel>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoFocus
                required
                sx={{
                  bgcolor: 'background.surface',
                  '--Input-focusedHighlight': 'var(--joy-palette-primary-500)',
                }}
              />
            </FormControl>

            <FormControl sx={{ mb: 3 }}>
              <FormLabel sx={{ color: 'text.secondary', fontSize: '0.8rem', fontWeight: 600 }}>
                Password
              </FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                sx={{
                  bgcolor: 'background.surface',
                  '--Input-focusedHighlight': 'var(--joy-palette-primary-500)',
                }}
              />
            </FormControl>

            {error && (
              <Alert color="danger" variant="soft" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              loading={loading}
              color="primary"
              variant="solid"
              sx={{ fontWeight: 700, color: '#0d0f1a', py: 1.25 }}
            >
              Sign In
            </Button>
          </form>

          {quickLoginUsers.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography
                level="body-xs"
                sx={{ textAlign: 'center', color: 'text.tertiary', mb: 1.5 }}
              >
                Quick login — test environment
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {quickLoginUsers.map((u) => (
                  <Button
                    key={u.username}
                    variant="outlined"
                    color="neutral"
                    fullWidth
                    loading={loading}
                    onClick={() => handleQuickLogin(u.username, u.password)}
                    sx={{ fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    {u.label}
                  </Button>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

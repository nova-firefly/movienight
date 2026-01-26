import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Box, Button, FormControl, FormLabel, Input, Typography, Sheet, Alert } from '@mui/joy';
import { LOGIN } from '../../graphql/queries';
import { useAuth } from '../../contexts/AuthContext';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const [loginMutation, { loading }] = useMutation(LOGIN, {
    onCompleted: (data) => {
      login(data.login.token, data.login.user);
      setError('');
    },
    onError: (err) => {
      setError(err.message || 'Login failed. Please check your credentials.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    try {
      await loginMutation({
        variables: { username, password },
      });
    } catch (err) {
      // Error is handled by onError callback
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'background.body',
      }}
    >
      <Sheet
        variant="outlined"
        sx={{
          maxWidth: 400,
          width: '100%',
          mx: 2,
          py: 3,
          px: 4,
          borderRadius: 'sm',
          boxShadow: 'md',
        }}
      >
        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Typography level="h3" sx={{ mb: 1 }}>
            MovieNight
          </Typography>
          <Typography level="body-sm" color="neutral">
            Sign in to continue
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <FormControl sx={{ mb: 2 }}>
            <FormLabel>Username</FormLabel>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoFocus
              required
            />
          </FormControl>

          <FormControl sx={{ mb: 3 }}>
            <FormLabel>Password</FormLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </FormControl>

          {error && (
            <Alert color="danger" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Button type="submit" fullWidth loading={loading}>
            Sign In
          </Button>
        </form>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography level="body-sm" color="neutral">
            Default credentials: admin / admin123
          </Typography>
        </Box>
      </Sheet>
    </Box>
  );
};

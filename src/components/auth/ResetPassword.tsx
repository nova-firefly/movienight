import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Typography,
  Alert,
} from '@mui/joy';
import { RESET_PASSWORD } from '../../graphql/queries';

interface ResetPasswordProps {
  token: string;
  onComplete: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ token, onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [resetPassword, { loading }] = useMutation(RESET_PASSWORD, {
    onCompleted: () => {
      setSuccess(true);
      window.history.replaceState({}, '', window.location.pathname);
    },
    onError: (err) => {
      const code = err.graphQLErrors?.[0]?.extensions?.code;
      if (code === 'BAD_USER_INPUT') {
        setError(err.graphQLErrors[0].message);
      } else if (code === 'FORBIDDEN') {
        setError('This account has been disabled. Please contact an administrator.');
      } else {
        setError('Failed to reset password. The link may have expired.');
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      await resetPassword({ variables: { token, newPassword: password } });
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

      {/* Right — form */}
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
          {success ? (
            <>
              <Typography level="h3" sx={{ mb: 0.5, fontWeight: 700 }}>
                Password reset
              </Typography>
              <Alert color="success" variant="soft" sx={{ mb: 3, mt: 2 }}>
                Your password has been reset successfully.
              </Alert>
              <Button
                onClick={onComplete}
                variant="solid"
                color="primary"
                fullWidth
                sx={{ fontWeight: 700, color: '#0d0f1a', py: 1.25 }}
              >
                Sign In
              </Button>
            </>
          ) : (
            <>
              <Typography level="h3" sx={{ mb: 0.5, fontWeight: 700 }}>
                Set new password
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 4 }}>
                Choose a new password for your account
              </Typography>

              <form onSubmit={handleSubmit}>
                <FormControl sx={{ mb: 2 }}>
                  <FormLabel sx={{ color: 'text.secondary', fontSize: '0.8rem', fontWeight: 600 }}>
                    New Password
                  </FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
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
                    Confirm Password
                  </FormLabel>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
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
                  Reset Password
                </Button>
              </form>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

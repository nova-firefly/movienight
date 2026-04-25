import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Box, Button, FormControl, FormLabel, Input, Typography, Alert } from '@mui/joy';
import { REQUEST_PASSWORD_RESET } from '../../graphql/queries';

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [requestReset, { loading }] = useMutation(REQUEST_PASSWORD_RESET, {
    onCompleted: () => {
      setSubmitted(true);
      setError('');
    },
    onError: () => {
      setError('Something went wrong. Please try again.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    try {
      await requestReset({ variables: { email } });
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
          <Typography level="h3" sx={{ fontWeight: 800, color: 'primary.400', mt: 1 }}>
            MovieNight
          </Typography>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 380 }}>
          {submitted ? (
            <>
              <Typography level="h3" sx={{ mb: 0.5, fontWeight: 700 }}>
                Check your email
              </Typography>
              <Alert color="success" variant="soft" sx={{ mb: 3, mt: 2 }}>
                If an account exists with that email, a password reset link has been sent. Check
                your inbox.
              </Alert>
              <Button
                onClick={onBackToLogin}
                variant="solid"
                color="primary"
                fullWidth
                sx={{ fontWeight: 700, color: '#0d0f1a', py: 1.25 }}
              >
                Back to Sign In
              </Button>
            </>
          ) : (
            <>
              <Typography level="h3" sx={{ mb: 0.5, fontWeight: 700 }}>
                Reset your password
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 4 }}>
                Enter the email address associated with your account
              </Typography>

              <form onSubmit={handleSubmit}>
                <FormControl sx={{ mb: 3 }}>
                  <FormLabel sx={{ color: 'text.secondary', fontSize: '0.8rem', fontWeight: 600 }}>
                    Email
                  </FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoFocus
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
                  Send Reset Link
                </Button>
              </form>

              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button
                  onClick={onBackToLogin}
                  variant="plain"
                  color="neutral"
                  size="sm"
                  sx={{ fontSize: '0.8rem' }}
                >
                  Back to Sign In
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

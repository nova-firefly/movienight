import React, { useState } from 'react';
import { Box, Button, Typography, IconButton, Divider } from '@mui/joy';
import { useAuth } from '../../contexts/AuthContext';
import { getGravatarUrl } from '../../utils/gravatar';

type ViewName = 'movies' | 'this-or-that' | 'combined-list' | 'admin';

interface NavbarProps {
  currentView: ViewName;
  onShowMovies: () => void;
  onShowThisOrThat: () => void;
  onShowCombinedList: () => void;
  onShowAdmin: () => void;
  onShowLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onShowMovies,
  onShowThisOrThat,
  onShowCombinedList,
  onShowAdmin,
  onShowLogin,
}) => {
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = (
    <>
      <Button
        variant={currentView === 'movies' ? 'soft' : 'plain'}
        color="neutral"
        size="sm"
        onClick={() => { onShowMovies(); setMobileOpen(false); }}
        sx={{
          fontWeight: 600,
          color: currentView === 'movies' ? 'primary.400' : 'text.secondary',
          '&:hover': { color: 'primary.300' },
        }}
      >
        Movies
      </Button>
      {isAuthenticated && (
        <Button
          variant={currentView === 'this-or-that' ? 'soft' : 'plain'}
          color="neutral"
          size="sm"
          onClick={() => { onShowThisOrThat(); setMobileOpen(false); }}
          sx={{
            fontWeight: 600,
            color: currentView === 'this-or-that' ? 'primary.400' : 'text.secondary',
            '&:hover': { color: 'primary.300' },
          }}
        >
          This or That
        </Button>
      )}
      {isAuthenticated && (
        <Button
          variant={currentView === 'combined-list' ? 'soft' : 'plain'}
          color="neutral"
          size="sm"
          onClick={() => { onShowCombinedList(); setMobileOpen(false); }}
          sx={{
            fontWeight: 600,
            color: currentView === 'combined-list' ? 'primary.400' : 'text.secondary',
            '&:hover': { color: 'primary.300' },
          }}
        >
          Combined
        </Button>
      )}
      {isAuthenticated && user?.is_admin && (
        <Button
          variant={currentView === 'admin' ? 'soft' : 'plain'}
          color="neutral"
          size="sm"
          onClick={() => { onShowAdmin(); setMobileOpen(false); }}
          sx={{
            fontWeight: 600,
            color: currentView === 'admin' ? 'primary.400' : 'text.secondary',
            '&:hover': { color: 'primary.300' },
          }}
        >
          Admin
        </Button>
      )}
    </>
  );

  return (
    <Box component="header">
      {/* Main bar */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          bgcolor: 'rgba(13, 15, 26, 0.96)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: { xs: 2, sm: 3 },
          py: 1.25,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {/* Logo + desktop nav */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            level="title-lg"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'primary.400',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => { onShowMovies(); setMobileOpen(false); }}
          >
            MovieNight
          </Typography>
          {/* Desktop nav links */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5 }}>
            {navItems}
          </Box>
        </Box>

        {/* Right side */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isAuthenticated ? (
            <>
              {/* User info — desktop only */}
              <Box
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {user?.email && (
                  <img
                    src={getGravatarUrl(user.email, 32)}
                    alt={user.display_name || user.username}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      border: '2px solid rgba(245, 197, 24, 0.3)',
                    }}
                  />
                )}
                <Box>
                  <Typography level="body-xs" sx={{ color: 'text.secondary', lineHeight: 1 }}>
                    {user?.is_admin ? 'Admin' : 'Member'}
                  </Typography>
                  <Typography
                    level="body-sm"
                    fontWeight={600}
                    sx={{ color: 'text.primary', lineHeight: 1.2 }}
                  >
                    {user?.display_name || user?.username}
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                color="neutral"
                size="sm"
                onClick={logout}
                sx={{ fontWeight: 600, borderColor: 'var(--mn-border-vis)' }}
              >
                Logout
              </Button>
            </>
          ) : (
            <Button
              variant="solid"
              color="primary"
              size="sm"
              onClick={() => { onShowLogin(); setMobileOpen(false); }}
              sx={{ fontWeight: 700, color: '#0d0f1a' }}
            >
              Sign In
            </Button>
          )}

          {/* Hamburger — mobile only */}
          <IconButton
            variant="plain"
            color="neutral"
            size="sm"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((o) => !o)}
            sx={{ display: { xs: 'flex', sm: 'none' } }}
          >
            {mobileOpen ? '✕' : '☰'}
          </IconButton>
        </Box>
      </Box>

      {/* Mobile drawer */}
      {mobileOpen && (
        <Box
          sx={{
            display: { xs: 'flex', sm: 'none' },
            flexDirection: 'column',
            gap: 1,
            bgcolor: 'background.surface',
            borderBottom: '1px solid',
            borderColor: 'divider',
            px: 2,
            py: 2,
          }}
        >
          {navItems}
          {isAuthenticated && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5 }}>
                {user?.email && (
                  <img
                    src={getGravatarUrl(user.email, 32)}
                    alt={user.display_name || user.username}
                    style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(245, 197, 24, 0.3)' }}
                  />
                )}
                <Box>
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                    {user?.is_admin ? 'Admin' : 'Member'}
                  </Typography>
                  <Typography level="body-sm" fontWeight={600}>
                    {user?.display_name || user?.username}
                  </Typography>
                </Box>
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

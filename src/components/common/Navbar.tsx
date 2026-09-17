import React, { useState } from 'react';
import { Box, Button, Typography, IconButton, Divider } from '@mui/joy';
import { Bell, Film, HelpCircle, Menu, Tv, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useKind } from '../../contexts/KindContext';
import { ContentKind, ViewName } from '../../models/Content';
import { getGravatarUrl } from '../../utils/gravatar';
import { OnboardingModal } from './OnboardingGuide';
import { NotificationSettingsModal } from '../settings/NotificationSettings';

interface NavbarProps {
  onShowLogin: () => void;
}

const kindAccentVar = (kind: ContentKind) =>
  kind === 'show' ? 'var(--mn-kind-show)' : 'var(--mn-kind-movie)';
const kindTintVar = (kind: ContentKind) =>
  kind === 'show' ? 'var(--mn-kind-show-tint)' : 'var(--mn-kind-movie-tint)';

export const Navbar: React.FC<NavbarProps> = ({ onShowLogin }) => {
  const { isAuthenticated, user, logout } = useAuth();
  const { kind, view: currentView, setKind, navigate } = useKind();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const go = (view: ViewName) => {
    navigate(view);
    setMobileOpen(false);
  };

  const navButton = (view: ViewName, label: string, subtle = false) => (
    <Button
      variant={currentView === view ? 'soft' : 'plain'}
      color="neutral"
      size="sm"
      onClick={() => go(view)}
      sx={{
        fontWeight: 600,
        color: currentView === view ? 'primary.400' : subtle ? 'text.tertiary' : 'text.secondary',
        '&:hover': { color: 'primary.300' },
        ...(subtle ? { fontSize: '0.8rem' } : {}),
      }}
    >
      {label}
    </Button>
  );

  const navItems = (
    <>
      {navButton('queue', 'Queue')}
      {isAuthenticated && navButton('this-or-that', 'This or That')}
      {isAuthenticated && navButton('combined-list', 'Combined')}
      {isAuthenticated && navButton('history', 'History', true)}
      {isAuthenticated && user?.is_admin && navButton('admin', 'Admin')}
    </>
  );

  // Segmented Movies/Shows toggle (D-7). Icon + text so kind is never
  // conveyed by colour alone (WCAG 1.4.1). Always visible.
  const kindToggle = (
    <Box
      role="tablist"
      aria-label="Content type"
      sx={{
        display: 'inline-flex',
        borderRadius: 'sm',
        overflow: 'hidden',
        border: '1px solid var(--mn-border-vis)',
      }}
    >
      {(['movie', 'show'] as ContentKind[]).map((k) => {
        const active = kind === k;
        const Icon = k === 'movie' ? Film : Tv;
        return (
          <Box
            component="button"
            type="button"
            role="tab"
            aria-selected={active}
            key={k}
            onClick={() => {
              setKind(k);
              setMobileOpen(false);
            }}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.25,
              py: 0.5,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.78rem',
              fontFamily: 'inherit',
              bgcolor: active ? kindTintVar(k) : 'transparent',
              color: active ? kindAccentVar(k) : 'var(--mn-text-secondary)',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            <Icon size={15} strokeWidth={2.25} aria-hidden />
            {k === 'movie' ? 'Movies' : 'Shows'}
          </Box>
        );
      })}
    </Box>
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
          borderBottom: '2px solid',
          borderColor: kindAccentVar(kind),
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
            onClick={() => go('queue')}
          >
            MovieNight
          </Typography>
          {/* Kind toggle — desktop */}
          <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>{kindToggle}</Box>
          {/* Desktop nav links */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5 }}>{navItems}</Box>
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
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                aria-label="How MovieNight works"
                onClick={() => setHelpOpen(true)}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.300' },
                }}
              >
                <HelpCircle size={18} strokeWidth={2.25} />
              </IconButton>
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                aria-label="Notification settings"
                onClick={() => setNotificationsOpen(true)}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.300' },
                }}
              >
                <Bell size={18} strokeWidth={2.25} />
              </IconButton>
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
              onClick={() => {
                onShowLogin();
                setMobileOpen(false);
              }}
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
            {mobileOpen ? (
              <X size={20} strokeWidth={2.25} />
            ) : (
              <Menu size={20} strokeWidth={2.25} />
            )}
          </IconButton>
        </Box>
      </Box>

      <NotificationSettingsModal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      <OnboardingModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onShowConnections={() => {
          setHelpOpen(false);
          go('combined-list');
        }}
        onShowThisOrThat={() => {
          setHelpOpen(false);
          go('this-or-that');
        }}
        onShowMovies={() => {
          setHelpOpen(false);
          go('queue');
        }}
      />

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
          <Box sx={{ alignSelf: 'flex-start' }}>{kindToggle}</Box>
          {navItems}
          {isAuthenticated && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5 }}>
                {user?.email && (
                  <img
                    src={getGravatarUrl(user.email, 32)}
                    alt={user.display_name || user.username}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: '2px solid rgba(245, 197, 24, 0.3)',
                    }}
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

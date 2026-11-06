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

  // Tabs: one weight in every state; the current one is ink with a kind-colour
  // underline, never a fill.
  const navButton = (view: ViewName, label: string) => (
    <Button
      variant="plain"
      color="neutral"
      size="sm"
      onClick={() => go(view)}
      aria-current={currentView === view ? 'page' : undefined}
      sx={{
        fontWeight: 600,
        borderRadius: 0,
        px: 1.25,
        minHeight: 40,
        justifyContent: { xs: 'flex-start', sm: 'center' },
        color: currentView === view ? 'text.primary' : 'text.secondary',
        boxShadow: currentView === view ? `inset 0 -2px 0 ${kindAccentVar(kind)}` : 'none',
        '&:hover': { color: 'text.primary', bgcolor: 'transparent' },
        '&:active': { bgcolor: 'var(--color-hover)' },
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
      {isAuthenticated && navButton('history', 'History')}
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
              minHeight: 32,
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              fontFamily: 'inherit',
              bgcolor: active ? kindTintVar(k) : 'transparent',
              color: active ? kindAccentVar(k) : 'var(--color-ink-2)',
              transitionProperty: 'background-color, color',
              transitionDuration: 'var(--dur-micro)',
              '&:hover': { color: active ? kindAccentVar(k) : 'var(--color-ink)' },
              '&:active': { bgcolor: kindTintVar(k) },
              '&:focus-visible': { outlineOffset: '-2px' },
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
          bgcolor: 'var(--color-scrim)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-rule)',
          px: { xs: 2, sm: 3 },
          minHeight: 64,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {/* Logo + desktop nav */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, alignSelf: 'stretch' }}>
          <Box
            component="button"
            type="button"
            aria-label="MovieNight home"
            onClick={() => go('queue')}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              p: 0,
              border: 'none',
              bgcolor: 'transparent',
              cursor: 'pointer',
              color: 'text.primary',
              fontFamily: 'display',
              fontWeight: 800,
              fontSize: { xs: '1.5rem', sm: '1.75rem' },
              lineHeight: 1,
              textTransform: 'uppercase',
              '&:hover': { color: 'primary.400' },
            }}
          >
            <img src="/favicon.svg" alt="" width={26} height={26} />
            MovieNight
          </Box>
          {/* Kind toggle — desktop */}
          <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>{kindToggle}</Box>
          {/* Desktop nav links */}
          <Box
            component="nav"
            aria-label="Main"
            sx={{
              display: { xs: 'none', md: 'flex' },
              gap: 0.5,
              alignSelf: 'stretch',
              alignItems: 'stretch',
            }}
          >
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
                      border: '1px solid var(--color-rule-strong)',
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
                  display: { xs: 'none', sm: 'inline-flex' },
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary' },
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
                  display: { xs: 'none', sm: 'inline-flex' },
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                <Bell size={18} strokeWidth={2.25} />
              </IconButton>
              <Button
                variant="outlined"
                color="neutral"
                size="sm"
                onClick={logout}
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
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
            sx={{ display: { xs: 'flex', md: 'none' }, minWidth: 44, minHeight: 44 }}
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
            display: { xs: 'flex', md: 'none' },
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
                      border: '1px solid var(--color-rule-strong)',
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
              <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 0.5 }}>
                <Button
                  variant="plain"
                  color="neutral"
                  startDecorator={<HelpCircle size={18} strokeWidth={2.25} />}
                  onClick={() => {
                    setHelpOpen(true);
                    setMobileOpen(false);
                  }}
                  sx={{ justifyContent: 'flex-start', minHeight: 44 }}
                >
                  How MovieNight works
                </Button>
                <Button
                  variant="plain"
                  color="neutral"
                  startDecorator={<Bell size={18} strokeWidth={2.25} />}
                  onClick={() => {
                    setNotificationsOpen(true);
                    setMobileOpen(false);
                  }}
                  sx={{ justifyContent: 'flex-start', minHeight: 44 }}
                >
                  Notification settings
                </Button>
                <Button
                  variant="outlined"
                  color="neutral"
                  onClick={logout}
                  sx={{ alignSelf: 'flex-start', minHeight: 44 }}
                >
                  Logout
                </Button>
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

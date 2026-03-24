import React from 'react';
import { Box, Button, Typography, Sheet } from '@mui/joy';
import { useAuth } from '../../contexts/AuthContext';
import { getGravatarUrl } from '../../utils/gravatar';

interface NavbarProps {
  showUserManagement: boolean;
  onShowMovies: () => void;
  onShowUserManagement: () => void;
  onShowLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  showUserManagement,
  onShowMovies,
  onShowUserManagement,
  onShowLogin,
}) => {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <Sheet
      variant="soft"
      sx={{
        p: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography level="h4">MovieNight</Typography>
        <Button
          variant={showUserManagement ? 'plain' : 'soft'}
          onClick={onShowMovies}
        >
          Movies
        </Button>
        {isAuthenticated && user?.is_admin && (
          <Button
            variant={showUserManagement ? 'soft' : 'plain'}
            onClick={onShowUserManagement}
          >
            Manage Users
          </Button>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {isAuthenticated ? (
          <>
            {user?.email && (
              <img
                src={getGravatarUrl(user.email, 32)}
                alt="avatar"
                style={{ width: 32, height: 32, borderRadius: '50%' }}
              />
            )}
            <Typography level="body-sm">
              Welcome, {user?.display_name || user?.username} {user?.is_admin && '(Admin)'}
            </Typography>
            <Button variant="outlined" color="neutral" onClick={logout}>
              Logout
            </Button>
          </>
        ) : (
          <Button variant="solid" onClick={onShowLogin}>
            Login
          </Button>
        )}
      </Box>
    </Sheet>
  );
};

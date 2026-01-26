import React from "react";
import { Box, Button, Typography, Sheet } from '@mui/joy';
import HomePage from "./components/home/Homepage";
import { Login } from "./components/auth/Login";
import { UserManagement } from "./components/admin/UserManagement";
import { useAuth } from "./contexts/AuthContext";

const App = () => {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [showUserManagement, setShowUserManagement] = React.useState(false);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Box>
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
            onClick={() => setShowUserManagement(false)}
          >
            Movies
          </Button>
          {user?.is_admin && (
            <Button
              variant={showUserManagement ? 'soft' : 'plain'}
              onClick={() => setShowUserManagement(true)}
            >
              Manage Users
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography level="body-sm">
            Welcome, {user?.username} {user?.is_admin && '(Admin)'}
          </Typography>
          <Button variant="outlined" color="neutral" onClick={logout}>
            Logout
          </Button>
        </Box>
      </Sheet>

      <Box sx={{ p: 3 }}>
        {showUserManagement && user?.is_admin ? <UserManagement /> : <HomePage />}
      </Box>
    </Box>
  );
};

export default App;

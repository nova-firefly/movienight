import React from "react";
import { Box, Typography } from '@mui/joy';
import HomePage from "./components/home/Homepage";
import { Login } from "./components/auth/Login";
import { UserManagement } from "./components/admin/UserManagement";
import { Navbar } from "./components/common/Navbar";
import { useAuth } from "./contexts/AuthContext";

const App = () => {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [showUserManagement, setShowUserManagement] = React.useState(false);
  const [showLogin, setShowLogin] = React.useState(false);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (showLogin && !isAuthenticated) {
    return <Login />;
  }

  return (
    <Box>
      <Navbar
        showUserManagement={showUserManagement}
        onShowMovies={() => setShowUserManagement(false)}
        onShowUserManagement={() => setShowUserManagement(true)}
        onShowLogin={() => setShowLogin(true)}
      />

      {showUserManagement && user?.is_admin ? (
        <Box sx={{ p: 3 }}>
          <UserManagement />
        </Box>
      ) : (
        <HomePage />
      )}
    </Box>
  );
};

export default App;

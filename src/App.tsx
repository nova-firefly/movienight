import React from "react";
import { Box, Typography } from '@mui/joy';
import HomePage from "./components/home/Homepage";
import { Login } from "./components/auth/Login";
import { AdminPanel } from "./components/admin/AdminPanel";
import { Navbar } from "./components/common/Navbar";
import { Footer } from "./components/common/Footer";
import { useAuth } from "./contexts/AuthContext";

const GIT_BRANCH = process.env.REACT_APP_GIT_BRANCH;
const IS_TEST_ENV = GIT_BRANCH && GIT_BRANCH !== "master";

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
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {IS_TEST_ENV && (
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1200,
            bgcolor: 'warning.400',
            color: 'warning.800',
            textAlign: 'center',
            py: 0.75,
            px: 2,
          }}
        >
          <Typography level="body-sm" fontWeight="bold">
            ⚠ TEST ENVIRONMENT — branch: {GIT_BRANCH}
          </Typography>
        </Box>
      )}
      <Navbar
        showUserManagement={showUserManagement}
        onShowMovies={() => setShowUserManagement(false)}
        onShowUserManagement={() => setShowUserManagement(true)}
        onShowLogin={() => setShowLogin(true)}
      />

      {showUserManagement && user?.is_admin ? (
        <Box sx={{ p: 3 }}>
          <AdminPanel />
        </Box>
      ) : (
        <HomePage />
      )}

      <Footer />
    </Box>
  );
};

export default App;

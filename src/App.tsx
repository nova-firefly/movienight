import React from "react";
import { Box, Typography, CircularProgress } from '@mui/joy';
import HomePage from "./components/home/Homepage";
import { Login } from "./components/auth/Login";
import { AdminPanel } from "./components/admin/AdminPanel";
import { Navbar } from "./components/common/Navbar";
import { Footer } from "./components/common/Footer";
import { useAuth } from "./contexts/AuthContext";

const GIT_BRANCH = process.env.REACT_APP_GIT_BRANCH;
const IS_TEST_ENV = GIT_BRANCH && GIT_BRANCH !== "master";

const App = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showUserManagement, setShowUserManagement] = React.useState(false);
  const [showLogin, setShowLogin] = React.useState(false);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: 'background.body',
          gap: 2,
        }}
      >
        <CircularProgress size="md" color="primary" />
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          Loading…
        </Typography>
      </Box>
    );
  }

  if (showLogin && !isAuthenticated) {
    return <Login />;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.body',
      }}
    >
      {/* Test environment banner */}
      {IS_TEST_ENV && (
        <Box
          sx={{
            bgcolor: 'warning.softBg',
            color: 'warning.softColor',
            textAlign: 'center',
            py: 0.75,
            px: 2,
            borderBottom: '1px solid',
            borderColor: 'warning.outlinedBorder',
          }}
        >
          <Typography level="body-xs" fontWeight="bold">
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
        <Box
          component="main"
          sx={{
            flex: 1,
            px: { xs: 2, sm: 3, md: 4 },
            py: { xs: 3, sm: 4 },
            bgcolor: 'background.body',
          }}
        >
          <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
            <AdminPanel />
          </Box>
        </Box>
      ) : (
        <HomePage />
      )}

      <Footer />
    </Box>
  );
};

export default App;

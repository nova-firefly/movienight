import React from "react";
import { Box, Typography, CircularProgress } from '@mui/joy';
import HomePage from "./components/home/Homepage";
import ThisOrThat from "./components/home/ThisOrThat";
import { Login } from "./components/auth/Login";
import { AdminPanel } from "./components/admin/AdminPanel";
import { Navbar } from "./components/common/Navbar";
import { Footer } from "./components/common/Footer";
import { useAuth } from "./contexts/AuthContext";

const GIT_BRANCH = process.env.REACT_APP_GIT_BRANCH;
const IS_TEST_ENV = GIT_BRANCH && GIT_BRANCH !== "master";

type ViewName = 'movies' | 'this-or-that' | 'admin';

const App = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [currentView, setCurrentView] = React.useState<ViewName>('movies');
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

  const renderView = () => {
    if (currentView === 'admin' && user?.is_admin) {
      return (
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
      );
    }

    if (currentView === 'this-or-that' && isAuthenticated) {
      return <ThisOrThat />;
    }

    return <HomePage onShowThisOrThat={() => setCurrentView('this-or-that')} />;
  };

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
            TEST ENVIRONMENT — branch: {GIT_BRANCH}
          </Typography>
        </Box>
      )}

      <Navbar
        currentView={currentView}
        onShowMovies={() => setCurrentView('movies')}
        onShowThisOrThat={() => setCurrentView('this-or-that')}
        onShowAdmin={() => setCurrentView('admin')}
        onShowLogin={() => setShowLogin(true)}
      />

      {renderView()}

      <Footer />
    </Box>
  );
};

export default App;

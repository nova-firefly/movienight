import React from "react";
import { Box, Typography, CircularProgress } from '@mui/joy';
import HomePage from "./components/home/Homepage";
import ThisOrThat from "./components/home/ThisOrThat";
import CombinedList from "./components/home/CombinedList";
import { Login } from "./components/auth/Login";
import { ForgotPassword } from "./components/auth/ForgotPassword";
import { ResetPassword } from "./components/auth/ResetPassword";
import { AdminPanel } from "./components/admin/AdminPanel";
import { Navbar } from "./components/common/Navbar";
import { Footer } from "./components/common/Footer";
import { useAuth } from "./contexts/AuthContext";

const GIT_BRANCH = process.env.REACT_APP_GIT_BRANCH;
const IS_TEST_ENV = GIT_BRANCH && GIT_BRANCH !== "master";

type ViewName = 'movies' | 'this-or-that' | 'combined-list' | 'admin';

const App = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [currentView, setCurrentView] = React.useState<ViewName>('movies');
  const [showLogin, setShowLogin] = React.useState(false);
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [resetToken, setResetToken] = React.useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('resetToken');
  });

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

  if (resetToken) {
    return (
      <ResetPassword
        token={resetToken}
        onComplete={() => {
          setResetToken(null);
          setShowLogin(true);
          setShowForgotPassword(false);
        }}
      />
    );
  }

  if (showLogin && !isAuthenticated) {
    if (showForgotPassword) {
      return <ForgotPassword onBackToLogin={() => setShowForgotPassword(false)} />;
    }
    return <Login onForgotPassword={() => setShowForgotPassword(true)} />;
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

    if (currentView === 'combined-list' && isAuthenticated) {
      return <CombinedList />;
    }

    return (
      <HomePage
        onShowThisOrThat={() => setCurrentView('this-or-that')}
        onShowConnections={() => setCurrentView('combined-list')}
      />
    );
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
        onShowCombinedList={() => setCurrentView('combined-list')}
        onShowAdmin={() => setCurrentView('admin')}
        onShowLogin={() => setShowLogin(true)}
      />

      {renderView()}

      <Footer />
    </Box>
  );
};

export default App;

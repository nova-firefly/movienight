import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { CssVarsProvider, CssBaseline } from '@mui/joy';
import '@fontsource/big-shoulders-display/latin-800';
import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-600.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import client from './graphql/client';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { KindProvider } from './contexts/KindContext';
import theme from './theme';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <CssVarsProvider theme={theme} defaultMode="dark">
      <CssBaseline />
      <ToastProvider>
        <ApolloProvider client={client}>
          <AuthProvider>
            <KindProvider>
              <App />
            </KindProvider>
          </AuthProvider>
        </ApolloProvider>
      </ToastProvider>
    </CssVarsProvider>
  </React.StrictMode>,
);

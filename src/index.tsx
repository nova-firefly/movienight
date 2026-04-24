import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { CssVarsProvider, CssBaseline } from '@mui/joy';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import client from './graphql/client';
import { AuthProvider } from './contexts/AuthContext';
import theme from './theme';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <CssVarsProvider theme={theme} defaultMode="dark">
      <CssBaseline />
      <ApolloProvider client={client}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ApolloProvider>
    </CssVarsProvider>
  </React.StrictMode>,
);

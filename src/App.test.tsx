import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock all heavy dependencies
jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useLazyQuery: () => [jest.fn().mockResolvedValue({ data: null })],
  useApolloClient: () => ({ clearStore: jest.fn() }),
  useQuery: () => ({ data: null, loading: false }),
  useMutation: () => [jest.fn(), { loading: false }],
  gql: (strings: TemplateStringsArray) => strings[0],
}));

jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('./components/home/Homepage', () => () => <div data-testid="homepage">Homepage</div>);
jest.mock('./components/home/ThisOrThat', () => () => <div>ThisOrThat</div>);
jest.mock('./components/home/CombinedList', () => () => <div>CombinedList</div>);
jest.mock('./components/auth/Login', () => ({ Login: () => <div>Login</div> }));
jest.mock('./components/auth/ForgotPassword', () => ({
  ForgotPassword: () => <div>ForgotPassword</div>,
}));
jest.mock('./components/auth/ResetPassword', () => ({
  ResetPassword: () => <div>ResetPassword</div>,
}));
jest.mock('./components/admin/AdminPanel', () => ({ AdminPanel: () => <div>AdminPanel</div> }));
jest.mock('./components/common/Navbar', () => ({ Navbar: () => <div>Navbar</div> }));
jest.mock('./components/common/Footer', () => ({ Footer: () => <div>Footer</div> }));

import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByTestId('homepage')).toBeInTheDocument();
  });

  it('renders Navbar and Footer', () => {
    render(<App />);
    expect(screen.getByText('Navbar')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});

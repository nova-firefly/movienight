import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useLazyQuery } from '@apollo/client';
import { User } from '../models/User';
import { GET_ME } from '../graphql/queries';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [getMe] = useLazyQuery(GET_ME);

  const refreshUser = async () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const { data } = await getMe();
        if (data?.me) {
          setUser(data.me);
        } else {
          localStorage.removeItem('authToken');
          setUser(null);
        }
      } catch (error) {
        localStorage.removeItem('authToken');
        setUser(null);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('authToken', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

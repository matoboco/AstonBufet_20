import { useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken, removeToken, getUser, setUser } from '../utils/api';
import { User, AuthResponse } from '../types';

export const useAuth = () => {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const storedUser = getUser();

    if (token && storedUser) {
      setUserState(storedUser as User);
    }
    setLoading(false);
  }, []);

  const requestCode = async (email: string): Promise<void> => {
    await api<{ message: string }>('/auth/request-code', {
      method: 'POST',
      body: { email },
      auth: false,
    });
  };

  const verifyCode = async (email: string, code: string, name?: string): Promise<User> => {
    const response = await api<AuthResponse>('/auth/verify-code', {
      method: 'POST',
      body: { email, code, name },
      auth: false,
    });

    setToken(response.token);
    setUser(response.user);
    setUserState(response.user);

    return response.user;
  };

  const updateProfile = async (name: string): Promise<User> => {
    const response = await api<AuthResponse>('/auth/profile', {
      method: 'PUT',
      body: { name },
    });

    setToken(response.token);
    setUser(response.user);
    setUserState(response.user);

    return response.user;
  };

  const logout = useCallback(() => {
    removeToken();
    setUserState(null);
  }, []);

  const isAuthenticated = !!user;
  const isOfficeAssistant = user?.role === 'office_assistant';

  return {
    user,
    loading,
    isAuthenticated,
    isOfficeAssistant,
    requestCode,
    verifyCode,
    updateProfile,
    logout,
  };
};

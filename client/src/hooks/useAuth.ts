import { useQuery } from '@tanstack/react-query';

export interface User {
  id: number;
  email: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isVerified?: boolean;
  createdAt?: string;
}

export interface AuthData {
  user: User | null;
  authenticated: boolean;
}

export function useAuth() {
  const { data, isLoading, error } = useQuery<AuthData>({
    queryKey: ['/api/auth/me'],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user: data?.user || null,
    isLoading,
    error,
    isAuthenticated: data?.authenticated || false,
  };
}

export async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    // Reload to clear all state
    window.location.href = '/';
  } catch (error) {
    console.error('Logout error:', error);
  }
}
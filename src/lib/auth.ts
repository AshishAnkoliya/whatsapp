import { supabase } from './supabase';

export async function getCurrentUser() {
  const mockSession = localStorage.getItem('mock_session');
  if (mockSession) {
    try {
      return JSON.parse(mockSession).user;
    } catch (e) {
      localStorage.removeItem('mock_session');
    }
  }

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function isDevMode() {
  return localStorage.getItem('mock_session') !== null;
}

import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({
    id: import.meta.env.VITE_APP_ID || 'cassa-binengo',
    public_settings: {
      auth_required: false,
    },
  });

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      // L'app è pubblica per impostazione predefinita (come il progetto originale con requiresAuth:false)
      // Se VITE_AUTH_REQUIRED === 'true', viene richiesta l'autenticazione
      const authRequired = import.meta.env.VITE_AUTH_REQUIRED === 'true';
      if (authRequired) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      }

      setIsLoadingPublicSettings(false);
      await checkUserAuth();
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred',
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const currentUser = await meFromSession(session.user);
        setUser(currentUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
      setAuthChecked(true);

      // Listener per i cambiamenti di sessione Supabase
      const { data: listener } = supabase.auth.onAuthStateChange(
        async (_event, newSession) => {
          if (newSession?.user) {
            const u = await meFromSession(newSession.user);
            setUser(u);
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      );
      return () => listener?.subscription?.unsubscribe();
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      }
    }
  };

  const meFromSession = async (supabaseUser) => {
    let role = 'user';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', supabaseUser.id)
        .maybeSingle();
      if (profile?.role) role = profile.role;
    } catch (e) {}
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      role,
      ...supabaseUser,
    };
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    supabase.auth.signOut().finally(() => {
      if (shouldRedirect) {
        window.location.href = window.location.pathname;
      }
    });
  };

  const navigateToLogin = () => {
    const redirectTo = window.location.href;
    const params = new URLSearchParams();
    if (redirectTo) params.set('redirectTo', redirectTo);
    window.location.href = `/login${params.toString() ? '?' + params.toString() : ''}`;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

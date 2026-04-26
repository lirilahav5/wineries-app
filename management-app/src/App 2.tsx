import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import WineriesManagement from './pages/WineriesManagement';
import WineShopsManagement from './pages/WineShopsManagement';
import { hasQuickAuth, getSavedCredentials } from './utils/biometricAuth';
import './App.css';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingBiometric, setCheckingBiometric] = useState(false);

  // Perform automatic login with credentials - completely silent
  const performAutoLogin = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Successfully logged in, user state will update via onAuthStateChange
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Auto login error:', err);
      return false;
    }
  };

  // Auto-trigger biometric login - like iPhone Face ID
  const handleAutoBiometricLogin = async (): Promise<boolean> => {
    try {
      const saved = await getSavedCredentials();
      if (!saved) {
        return false;
      }

      // Try browser credential management first (includes biometric)
      // This will show the native face recognition prompt
      if ('credentials' in navigator && 'get' in navigator.credentials) {
        try {
          // Try silent first (no prompt)
          const credential = await navigator.credentials.get({
            mediation: 'silent' as CredentialMediationRequirement,
          }) as any;
          
          if (credential && (credential.id === saved.email || credential.password)) {
            // Browser handled biometric authentication silently
            return await performAutoLogin(saved.email, saved.password);
          }
        } catch (credError) {
          // Silent failed, try required (will show face recognition prompt)
          try {
            const credential = await navigator.credentials.get({
              mediation: 'required' as CredentialMediationRequirement,
            }) as any;
            
            if (credential && (credential.id === saved.email || credential.password)) {
              // Face recognition succeeded, login automatically
              return await performAutoLogin(saved.email, saved.password);
            }
          } catch (credError2) {
            // User cancelled or failed
            return false;
          }
        }
      }
      
      // Fallback: try manual biometric authentication
      const { authenticateWithBiometric } = await import('./utils/biometricAuth');
      const success = await authenticateWithBiometric();
      if (success) {
        // Face recognition succeeded, login automatically
        return await performAutoLogin(saved.email, saved.password);
      }
      return false;
    } catch (err: any) {
      console.error('Auto biometric login error:', err);
      return false;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      // First, check if user is already logged in
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // User is already logged in
        setUser(session.user);
        setLoading(false);
        return;
      }

      // User is not logged in - check if biometric is enabled
      if (hasQuickAuth()) {
        // Biometric is enabled - try automatic face recognition (like iPhone)
        setCheckingBiometric(true);
        const success = await handleAutoBiometricLogin();
        setCheckingBiometric(false);
        
        if (success) {
          // Biometric succeeded - user will be set via onAuthStateChange
          // Don't set loading to false yet, wait for auth state change
          return;
        }
      }

      // Biometric not enabled or failed - show login page
      setLoading(false);
    };

    initializeAuth();

    // Listen for auth changes (including email verification)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle email verification
      if (event === 'SIGNED_IN' && session?.user) {
        // Check if email is verified
        if (!session.user.email_confirmed_at) {
          // Email not verified - sign out and redirect to login
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }
      }
      
      setUser(session?.user ?? null);
      setLoading(false);
      setCheckingBiometric(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show nothing while checking biometric or loading
  // This ensures the face recognition prompt appears immediately without any UI
  if (loading || checkingBiometric) {
    return null; // Completely blank - just like iPhone Face ID
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" /> : <Login />} 
      />
      <Route 
        path="/reset-password" 
        element={<ResetPassword />} 
      />
      <Route 
        path="/dashboard" 
        element={user ? <Dashboard /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/wineries" 
        element={user ? <WineriesManagement /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/wine-shops" 
        element={user ? <WineShopsManagement /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/settings" 
        element={user ? <Settings /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/" 
        element={<Navigate to={user ? "/dashboard" : "/login"} />} 
      />
    </Routes>
  );
}

export default App;

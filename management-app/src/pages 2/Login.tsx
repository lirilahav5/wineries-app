import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import BiometricAuth from '../components/BiometricAuth';
import {
  saveCredentials,
  getSavedCredentials,
  getAuthPreferences,
  saveAuthPreferences,
} from '../utils/biometricAuth';
import './Login.css';

type ViewMode = 'login' | 'signup' | 'signup-verify' | 'forgot';

function Login() {
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBiometric, setShowBiometric] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const navigate = useNavigate();


  // Check for saved credentials and biometric on mount
  useEffect(() => {
    const checkSavedAuth = async () => {
      // Check URL for email verification confirmation
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('verified') === 'true') {
        setSuccess('Email verified successfully! You can now sign in.');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Note: Biometric authentication is now handled in App.tsx before Login renders
      // If we reach here, biometric either failed or isn't enabled
      // Just show the login form
      const saved = await getSavedCredentials();
      if (saved) {
        setEmail(saved.email);
        setPassword(saved.password);
        setRememberMe(true);
      }
      setShowPasswordLogin(true);
    };
    checkSavedAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Check if error is due to unverified email
        if (error.message.includes('Email not confirmed') || 
            error.message.includes('email_not_confirmed') ||
            error.message.includes('Email not verified')) {
          setError('Please verify your email address before signing in. Check your inbox for the verification link.');
          setLoading(false);
          return;
        }
        throw error;
      }

      if (data.user) {
        // Check if email is verified
        if (!data.user.email_confirmed_at) {
          setError('Please verify your email address before signing in. Check your inbox for the verification link.');
          setLoading(false);
          return;
        }

        // Save credentials if "Remember Me" is checked
        if (rememberMe) {
          await saveCredentials(email, password);
          const preferences = getAuthPreferences() || {
            useBiometric: false,
            usePin: false,
            rememberCredentials: true,
          };
          preferences.rememberCredentials = true;
          saveAuthPreferences(preferences);
        }
        
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricSuccess = async () => {
    // Get saved credentials and automatically login
    const saved = await getSavedCredentials();
    if (saved) {
      // Set credentials and perform login
      setEmail(saved.email);
      setPassword(saved.password);
      setLoading(true);
      setError('');
      
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: saved.email,
          password: saved.password,
        });

        if (error) throw error;

        if (data.user) {
          navigate('/dashboard');
        }
      } catch (err: any) {
        setError(err.message || 'Login failed');
        setShowBiometric(false);
        setShowPasswordLogin(true);
      } finally {
        setLoading(false);
      }
    } else {
      setError('No saved credentials found');
      setShowBiometric(false);
      setShowPasswordLogin(true);
    }
  };

  const handleUsePassword = () => {
    setShowBiometric(false);
    setShowPasswordLogin(true);
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    setResendingVerification(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/login?verified=true`,
        },
      });

      if (error) throw error;

      setSuccess('Verification email sent! Please check your inbox and click the verification link.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email');
    } finally {
      setResendingVerification(false);
    }
  };

  const validatePassword = (pwd: string): { valid: boolean; message: string } => {
    if (pwd.length < 6) {
      return { valid: false, message: 'Password must be at least 6 characters' };
    }
    
    if (!/[a-zA-Z]/.test(pwd)) {
      return { valid: false, message: 'Password must contain at least one letter' };
    }
    
    if (!/[0-9]/.test(pwd)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
      return { valid: false, message: 'Password must contain at least one symbol (!@#$%^&* etc.)' };
    }
    
    return { valid: true, message: '' };
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // Format as international: +972XXXXXXXXX (Israel)
    if (digits.startsWith('0')) {
      return '+972' + digits.substring(1);
    }
    if (digits.startsWith('972')) {
      return '+' + digits;
    }
    if (!digits.startsWith('+')) {
      return '+972' + digits;
    }
    return phone;
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingOtp(true);
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setSendingOtp(false);
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      setSendingOtp(false);
      return;
    }

    if (!phoneNumber || phoneNumber.trim().length < 9) {
      setError('Please enter a valid phone number');
      setSendingOtp(false);
      return;
    }

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      // Send OTP to phone number using Supabase phone auth
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;

      setSuccess('Verification code sent to your phone!');
      setViewMode('signup-verify');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyingOtp(true);
    setError('');
    setSuccess('');

    if (otpCode.length !== 4) {
      setError('Please enter the 4-digit verification code');
      setVerifyingOtp(false);
      return;
    }

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      // Verify OTP
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otpCode,
        type: 'sms',
      });

      if (error) throw error;

      if (data.user) {
        // Phone verified, now create the account with email/password
        // First sign out from phone auth session
        await supabase.auth.signOut();
        
        // Create account with email/password and phone in metadata
        // Email verification will be sent automatically by Supabase
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login?verified=true`,
            data: {
              phone: formattedPhone,
            },
          },
        });

        if (signUpError) {
          // Check if the error is because the user already exists
          const errorMessage = signUpError.message.toLowerCase();
          if (errorMessage.includes('already registered') || 
              errorMessage.includes('already exists') ||
              errorMessage.includes('user already registered') ||
              errorMessage.includes('email address is already registered') ||
              signUpError.code === 'signup_disabled' ||
              signUpError.status === 422) {
            setError('This account already exists. Please sign in instead.');
            setTimeout(() => {
              setViewMode('login');
              setError('');
              setEmail('');
              setPassword('');
              setConfirmPassword('');
              setPhoneNumber('');
              setOtpCode('');
            }, 3000);
          } else {
            throw signUpError;
          }
          return;
        }

        if (signUpData.user) {
          // Log user creation for verification (can be removed in production)
          console.log('User created successfully:', {
            id: signUpData.user.id,
            email: signUpData.user.email,
            phone: signUpData.user.user_metadata?.phone,
            created_at: signUpData.user.created_at,
            email_confirmed: signUpData.user.email_confirmed_at !== null
          });
          
          // Check if email confirmation is required
          if (signUpData.user.email_confirmed_at === null) {
            setSuccess('Phone verified and account created! Your details have been saved to the database. Please check your email and click the verification link to activate your account. You cannot sign in until your email is verified.');
          } else {
            setSuccess('Phone verified and account created successfully! Your details have been saved to the database.');
          }
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setPhoneNumber('');
          setOtpCode('');
          setTimeout(() => {
            setViewMode('login');
            setSuccess('');
          }, 5000);
        }
      }
    } catch (err: any) {
      // Check if the error is about existing account
      const errorMessage = err.message ? err.message.toLowerCase() : '';
      if (errorMessage.includes('already registered') || 
          errorMessage.includes('already exists') ||
          errorMessage.includes('user already registered') ||
          errorMessage.includes('email address is already registered')) {
        setError('This account already exists. Please sign in instead.');
        setTimeout(() => {
          setViewMode('login');
          setError('');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setPhoneNumber('');
          setOtpCode('');
        }, 3000);
      } else {
        setError(err.message || 'Failed to verify code');
      }
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOTP = async () => {
    setSendingOtp(true);
    setError('');
    setSuccess('');

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;

      setSuccess('Verification code resent to your phone!');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSuccess('Password reset email sent! Please check your inbox.');
      setEmail('');
      setTimeout(() => {
        setViewMode('login');
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{
      backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
      direction: language === 'he' ? 'rtl' : 'ltr'
    }}>
      <div className="login-card" style={{
        backgroundColor: isDark ? '#2a2a2a' : 'white',
        color: isDark ? '#fff' : '#333'
      }}>
        <h1 style={{ textAlign: language === 'he' ? 'right' : 'left' }}>WineME {t('login.title')}</h1>
        <p className="login-subtitle" style={{
          textAlign: language === 'he' ? 'right' : 'left',
          color: isDark ? '#ccc' : '#666'
        }}>
          {viewMode === 'login' && (language === 'he' ? 'התחבר כדי לנהל יקבים וחנויות יין' : 'Sign in to manage wineries and wine shops')}
          {viewMode === 'signup' && t('login.createAccount')}
          {viewMode === 'signup-verify' && (language === 'he' ? 'אמת את מספר הטלפון שלך' : 'Verify your phone number')}
          {viewMode === 'forgot' && (language === 'he' ? 'איפוס סיסמה' : 'Reset your password')}
        </p>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        {viewMode === 'login' && (
          <>
            {loading && (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: isDark ? '#fff' : '#333'
              }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
                  {language === 'he' ? 'מתחבר...' : 'Signing in...'}
                </div>
              </div>
            )}
            {/* Only show biometric modal if user explicitly needs to use it manually */}
            {showBiometric && !showPasswordLogin && !loading && (
              <BiometricAuth
                onSuccess={handleBiometricSuccess}
                onCancel={() => {
                  setShowBiometric(false);
                  setShowPasswordLogin(true);
                }}
                onUsePassword={handleUsePassword}
              />
            )}
            
            {showPasswordLogin && (
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label htmlFor="email" style={{ textAlign: language === 'he' ? 'right' : 'left' }}>{t('login.email')}</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="manager@wineme.com"
                    autoComplete="username email"
                    style={{
                      backgroundColor: isDark ? '#333' : 'white',
                      color: isDark ? '#fff' : '#333',
                      border: `1px solid ${isDark ? '#444' : '#ddd'}`
                    }}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="password" style={{ textAlign: language === 'he' ? 'right' : 'left' }}>{t('login.password')}</label>
                  <div className="password-input-wrapper">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  <label htmlFor="remember-me" style={{ margin: 0, fontWeight: 'normal', cursor: 'pointer' }}>
                    {t('login.rememberMe')}
                  </label>
                </div>
                
                <button type="submit" className="btn btn-primary" disabled={loading} style={{
                  backgroundColor: '#8B1D24',
                  color: 'white',
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}>
                  {loading ? (language === 'he' ? 'מתחבר...' : 'Signing in...') : t('login.signIn')}
                </button>

                {error && error.includes('verify your email') && (
                  <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <button
                      type="button"
                      className="link-button"
                      onClick={handleResendVerification}
                      disabled={resendingVerification || !email}
                      style={{ 
                        fontSize: '0.9rem',
                        color: '#8B1D24',
                        textDecoration: 'underline',
                        background: 'none',
                        border: 'none',
                        cursor: resendingVerification || !email ? 'not-allowed' : 'pointer',
                        opacity: resendingVerification || !email ? 0.6 : 1,
                      }}
                    >
                      {resendingVerification ? 'Sending...' : 'Resend verification email'}
                    </button>
                  </div>
                )}
                
                <div className="auth-links">
                  <button 
                    type="button" 
                    className="link-button" 
                    onClick={() => {
                      setViewMode('signup');
                      setError('');
                      setSuccess('');
                      setShowPassword(false);
                    }}
                    style={{
                      color: isDark ? '#8B9DC3' : '#8B1D24',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: '0.9rem'
                    }}
                  >
                    {t('login.dontHaveAccount')} {t('login.signUp')}
                  </button>
                  <button 
                    type="button" 
                    className="link-button" 
                    onClick={() => {
                      setViewMode('forgot');
                      setError('');
                      setSuccess('');
                      setShowPassword(false);
                    }}
                    style={{
                      color: isDark ? '#8B9DC3' : '#8B1D24',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: '0.9rem'
                    }}
                  >
                    {t('login.forgotPassword')}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {viewMode === 'signup' && (
          <form onSubmit={handleSendOTP}>
            <div className="form-group">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="manager@wineme.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="signup-phone">Phone Number</label>
              <input
                id="signup-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                placeholder="050-1234567 or +972501234567"
              />
              <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                We'll send a verification code to this number
              </small>
            </div>
            
            <div className="form-group">
              <label htmlFor="signup-password">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min 6 chars, 1 letter, 1 number, 1 symbol"
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
              <small style={{ 
                color: password ? (validatePassword(password).valid ? '#28a745' : '#dc3545') : '#666', 
                fontSize: '0.85rem', 
                marginTop: '0.25rem', 
                display: 'block' 
              }}>
                {password && !validatePassword(password).valid && (
                  <span>{validatePassword(password).message}</span>
                )}
                {password && validatePassword(password).valid && (
                  <span>✓ Password meets requirements</span>
                )}
                {!password && (
                  <span>Password must contain: at least 6 characters, one letter, one number, and one symbol</span>
                )}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirm Password</label>
              <div className="password-input-wrapper">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={sendingOtp}>
              {sendingOtp ? 'Sending code...' : 'Send Verification Code'}
            </button>
            
            <div className="auth-links">
              <button 
                type="button" 
                className="link-button" 
                onClick={() => {
                  setViewMode('login');
                  setError('');
                  setSuccess('');
                  setPassword('');
                  setConfirmPassword('');
                  setPhoneNumber('');
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {viewMode === 'signup-verify' && (
          <form onSubmit={handleVerifyOTP}>
            <div className="form-group">
              <label htmlFor="otp-code">Verification Code</label>
              <input
                id="otp-code"
                type="text"
                value={otpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setOtpCode(value);
                }}
                required
                placeholder="Enter 4-digit code"
                maxLength={4}
                style={{ 
                  textAlign: 'center', 
                  fontSize: '1.5rem', 
                  letterSpacing: '0.5rem',
                  fontFamily: 'monospace'
                }}
              />
              <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block', textAlign: 'center' }}>
                Enter the 4-digit code sent to {phoneNumber}
              </small>
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={verifyingOtp || otpCode.length !== 4}>
              {verifyingOtp ? 'Verifying...' : 'Verify & Create Account'}
            </button>

            <div className="auth-links">
              <button 
                type="button" 
                className="link-button" 
                onClick={handleResendOTP}
                disabled={sendingOtp}
              >
                {sendingOtp ? 'Resending...' : "Didn't receive code? Resend"}
              </button>
              <button 
                type="button" 
                className="link-button" 
                onClick={() => {
                  setViewMode('signup');
                  setError('');
                  setSuccess('');
                  setOtpCode('');
                }}
              >
                Change phone number
              </button>
            </div>
          </form>
        )}

        {viewMode === 'forgot' && (
          <form onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email address"
              />
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            
            <div className="auth-links">
              <button 
                type="button" 
                className="link-button" 
                onClick={() => {
                  setViewMode('login');
                  setError('');
                  setSuccess('');
                  setShowPassword(false);
                }}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;

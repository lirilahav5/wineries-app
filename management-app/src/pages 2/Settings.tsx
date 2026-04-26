import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  checkBiometricSupport,
  saveAuthPreferences,
  getAuthPreferences,
  setPin,
  hasPin,
  clearPin,
} from '../utils/biometricAuth';
import './Settings.css';

function Settings() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { themeMode, setThemeMode, isDark } = useTheme();
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'none'>('none');
  const [useBiometric, setUseBiometric] = useState(false);
  const [usePin, setUsePin] = useState(false);
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      const support = await checkBiometricSupport();
      setBiometricSupported(support.supported);
      setBiometricType(support.type);
      
      const preferences = getAuthPreferences();
      if (preferences) {
        setUseBiometric(preferences.useBiometric || false);
        setUsePin(preferences.usePin || false);
      }
      
      setPinSet(hasPin());
    };
    loadSettings();
  }, []);

  const handleBiometricToggle = async () => {
    if (!biometricSupported) {
      setError('Biometric authentication is not supported on this device');
      return;
    }

    const newValue = !useBiometric;
    setUseBiometric(newValue);
    
    const preferences = getAuthPreferences() || {
      useBiometric: false,
      usePin: false,
      rememberCredentials: true,
    };
    preferences.useBiometric = newValue;
    saveAuthPreferences(preferences);
    
    setSuccess(newValue ? 'Biometric authentication enabled!' : 'Biometric authentication disabled!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handlePinToggle = () => {
    if (usePin && pinSet) {
      // Disable PIN
      clearPin();
      setUsePin(false);
      setPinSet(false);
      const preferences = getAuthPreferences() || {
        useBiometric: false,
        usePin: false,
        rememberCredentials: true,
      };
      preferences.usePin = false;
      saveAuthPreferences(preferences);
      setSuccess('PIN disabled!');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      // Enable PIN - show setup
      setShowPinSetup(true);
    }
  };

  const handlePinSetup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setPin(pin);
    setUsePin(true);
    setPinSet(true);
    setShowPinSetup(false);
    setPinValue('');
    setConfirmPin('');
    
    const preferences = getAuthPreferences() || {
      useBiometric: false,
      usePin: true,
      rememberCredentials: true,
    };
    preferences.usePin = true;
    saveAuthPreferences(preferences);
    
    setSuccess('PIN set successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="settings-container" style={{
      backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
      minHeight: '100dvh',
      padding: '2rem',
      direction: language === 'he' ? 'rtl' : 'ltr'
    }}>
      <div className="settings-card" style={{
        backgroundColor: isDark ? '#2a2a2a' : 'white',
        color: isDark ? '#fff' : '#333',
        maxWidth: '800px',
        margin: '0 auto',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ 
          marginBottom: '0.5rem',
          textAlign: language === 'he' ? 'right' : 'left'
        }}>{t('settings.title')}</h1>
        <p className="settings-subtitle" style={{
          color: isDark ? '#ccc' : '#666',
          marginBottom: '2rem',
          textAlign: language === 'he' ? 'right' : 'left'
        }}>{t('settings.manageQuickSignIn')}</p>

        {error && <div className="error-message" style={{
          backgroundColor: isDark ? '#4a1a1a' : '#ffe6e6',
          color: isDark ? '#ff6b6b' : '#d32f2f',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>{error}</div>}
        {success && <div className="success-message" style={{
          backgroundColor: isDark ? '#1a4a1a' : '#e6ffe6',
          color: isDark ? '#6bff6b' : '#28a745',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>{success}</div>}

        {!showPinSetup ? (
          <>
            {/* Language is fixed to Hebrew - no selector needed */}

            {/* Theme Selection */}
            <div className="settings-section" style={{
              marginBottom: '2rem',
              paddingBottom: '2rem',
              borderBottom: `1px solid ${isDark ? '#444' : '#eee'}`
            }}>
              <h2 style={{
                fontSize: '1.2rem',
                marginBottom: '1rem',
                textAlign: language === 'he' ? 'right' : 'left'
              }}>{t('settings.theme')}</h2>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                {(['light', 'dark', 'system'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setThemeMode(mode)}
                    style={{
                      padding: '1rem 1.25rem',
                      backgroundColor: themeMode === mode ? '#8B1D24' : (isDark ? '#333' : '#f5f5f5'),
                      color: themeMode === mode ? 'white' : (isDark ? '#fff' : '#333'),
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '1rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      justifyContent: language === 'he' ? 'flex-end' : 'flex-start',
                      boxShadow: themeMode === mode ? '0 4px 12px rgba(139, 29, 36, 0.3)' : 'none'
                    }}
                  >
                    {mode === 'light' && '☀️'}
                    {mode === 'dark' && '🌙'}
                    {mode === 'system' && '💻'}
                    <span>{t(`settings.theme.${mode}`)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Security Settings */}
            <div className="settings-section">
              <h2 style={{
                fontSize: '1.2rem',
                marginBottom: '1rem',
                textAlign: language === 'he' ? 'right' : 'left'
              }}>{t('settings.security')}</h2>
              
              <div className="setting-item" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                backgroundColor: isDark ? '#333' : '#f9f9f9',
                borderRadius: '12px',
                marginBottom: '1rem'
              }}>
                <div className="setting-info" style={{
                  flex: 1,
                  textAlign: language === 'he' ? 'right' : 'left'
                }}>
                  <h3 style={{ margin: 0, marginBottom: '0.25rem' }}>
                    {biometricType === 'face' ? '🔒 Face ID' : biometricType === 'fingerprint' ? '👆 Fingerprint' : t('settings.biometric')}
                  </h3>
                  <p style={{
                    margin: 0,
                    color: isDark ? '#ccc' : '#666',
                    fontSize: '0.9rem'
                  }}>
                    {biometricSupported 
                      ? `${t('settings.biometric')} - ${biometricType === 'face' ? 'Face ID' : 'Fingerprint'}`
                      : t('settings.biometric') + ' - ' + (language === 'he' ? 'לא זמין במכשיר זה' : 'Not available on this device')}
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={useBiometric}
                    onChange={handleBiometricToggle}
                    disabled={!biometricSupported}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                backgroundColor: isDark ? '#333' : '#f9f9f9',
                borderRadius: '12px',
                marginBottom: '1rem'
              }}>
                <div className="setting-info" style={{
                  flex: 1,
                  textAlign: language === 'he' ? 'right' : 'left'
                }}>
                  <h3 style={{ margin: 0, marginBottom: '0.25rem' }}>🔑 {t('settings.pin')}</h3>
                  <p style={{
                    margin: 0,
                    color: isDark ? '#ccc' : '#666',
                    fontSize: '0.9rem'
                  }}>
                    {pinSet 
                      ? (language === 'he' ? 'השתמש בקוד PIN להתחברות מהירה' : 'Use a PIN code to sign in quickly')
                      : (language === 'he' ? 'הגדר קוד PIN להתחברות מהירה' : 'Set up a PIN code for quick sign-in')}
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={usePin && pinSet}
                    onChange={handlePinToggle}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="settings-actions" style={{
              marginTop: '2rem',
              display: 'flex',
              justifyContent: language === 'he' ? 'flex-end' : 'flex-start'
            }}>
              <button
                className="btn btn-secondary"
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: isDark ? '#333' : '#f5f5f5',
                  color: isDark ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {t('settings.backToDashboard')}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handlePinSetup} className="pin-setup-form">
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="pin" style={{
                display: 'block',
                marginBottom: '0.5rem',
                textAlign: language === 'he' ? 'right' : 'left'
              }}>{t('settings.enterPin')}</label>
              <input
                id="pin"
                type="password"
                value={pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPinValue(value);
                }}
                required
                placeholder={language === 'he' ? 'הזן PIN' : 'Enter PIN'}
                maxLength={6}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '1.5rem',
                  letterSpacing: '0.5rem',
                  fontFamily: 'monospace',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                  backgroundColor: isDark ? '#333' : 'white',
                  color: isDark ? '#fff' : '#333'
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="confirm-pin" style={{
                display: 'block',
                marginBottom: '0.5rem',
                textAlign: language === 'he' ? 'right' : 'left'
              }}>{t('settings.confirmPin')}</label>
              <input
                id="confirm-pin"
                type="password"
                value={confirmPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setConfirmPin(value);
                }}
                required
                placeholder={language === 'he' ? 'אישור PIN' : 'Confirm PIN'}
                maxLength={6}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '1.5rem',
                  letterSpacing: '0.5rem',
                  fontFamily: 'monospace',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                  backgroundColor: isDark ? '#333' : 'white',
                  color: isDark ? '#fff' : '#333'
                }}
              />
            </div>

            <div className="form-actions" style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: language === 'he' ? 'flex-end' : 'flex-start'
            }}>
              <button type="submit" className="btn btn-primary" style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#8B1D24',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}>
                {t('settings.setPin')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowPinSetup(false);
                  setPinValue('');
                  setConfirmPin('');
                  setError('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: isDark ? '#333' : '#f5f5f5',
                  color: isDark ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {t('settings.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Settings;

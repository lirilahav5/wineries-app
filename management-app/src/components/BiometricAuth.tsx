import { useState, useEffect } from 'react';
import { 
  checkBiometricSupport, 
  authenticateWithBiometric, 
  verifyPin, 
  hasPin,
  getAuthPreferences
} from '../utils/biometricAuth';
import './BiometricAuth.css';

interface BiometricAuthProps {
  onSuccess: () => void;
  onCancel?: () => void;
  onUsePassword: () => void;
}

function BiometricAuth({ onSuccess, onUsePassword }: BiometricAuthProps) {
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'none'>('none');
  const [pinSet, setPinSet] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      const support = await checkBiometricSupport();
      setBiometricSupported(support.supported);
      setBiometricType(support.type);
      setPinSet(hasPin());
    };
    checkSupport();
  }, []);

  const handleBiometricAuth = async () => {
    setLoading(true);
    setError('');
    
    try {
      // For mobile, try to use browser's credential management first
      if ('credentials' in navigator && 'get' in navigator.credentials) {
        try {
          const credential = await navigator.credentials.get({
            mediation: 'required' as CredentialMediationRequirement,
          }) as any;
          
          if (credential) {
            // Browser handled the authentication (may include biometric)
            onSuccess();
            return;
          }
        } catch (credError) {
          // Fall through to manual biometric check
        }
      }
      
      // Fallback to manual biometric check
      const success = await authenticateWithBiometric();
      if (success) {
        onSuccess();
      } else {
        setError('Biometric authentication failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Biometric authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = () => {
    setError('');
    if (pin.length < 4) {
      setError('יש להזין לפחות 4 ספרות');
      return;
    }

    if (verifyPin(pin)) {
      setPin('');
      onSuccess();
    } else {
      setError('קוד שגוי. נסה שוב.');
      setPin('');
    }
  };

  const preferences = getAuthPreferences();
  const showBiometric = biometricSupported && preferences?.useBiometric;
  const showPin = pinSet && preferences?.usePin;
  const pinLength = preferences?.pinLength;
  const shouldAutoVerify = typeof pinLength === 'number' && pinLength >= 4 && pinLength <= 6;

  if (!showBiometric && !showPin) {
    return null;
  }

  const handleDigitPress = (digit: string) => {
    if (!showPin) return;
    if (pin.length >= 6) return;
    const nextPin = `${pin}${digit}`;
    setPin(nextPin);

    if (shouldAutoVerify && nextPin.length === pinLength) {
      if (verifyPin(nextPin)) {
        setPin('');
        onSuccess();
      } else {
        setError('קוד שגוי. נסה שוב.');
        setPin('');
      }
    }
  };

  const handleDelete = () => {
    if (!pin.length) return;
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="biometric-auth-overlay">
      <div className="biometric-auth-screen">
        <div className="biometric-auth-header">
          <h2>התחברות מהירה</h2>
          {showBiometric && (
            <button
              className="biometric-quick-button"
              onClick={handleBiometricAuth}
              disabled={loading}
            >
              {loading ? 'בודק...' : (biometricType === 'face' ? 'Face ID' : 'Fingerprint')}
            </button>
          )}
        </div>

        <div className="biometric-subtitle">
          {showBiometric && showPin && 'אפשר להשתמש ב־Face ID או להזין קוד PIN'}
          {showBiometric && !showPin && (biometricType === 'face' ? 'החלק למעלה עבור Face ID' : 'הנח אצבע עבור טביעת אצבע')}
          {!showBiometric && showPin && 'הזן קוד PIN כדי להיכנס'}
        </div>

        {error && <div className="biometric-error">{error}</div>}

        {showPin && (
          <>
            <div className="pin-dots" aria-label="PIN input">
              {Array.from({ length: 6 }).map((_, index) => (
                <span
                  key={index}
                  className={`pin-dot ${index < pin.length ? 'filled' : ''}`}
                />
              ))}
            </div>

            <div className="pin-keypad">
              {['1','2','3','4','5','6','7','8','9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  className="pin-key"
                  onClick={() => handleDigitPress(digit)}
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                className="pin-key pin-key--ghost"
                onClick={onUsePassword}
              >
                כניסה עם סיסמה
              </button>
              <button
                type="button"
                className="pin-key"
                onClick={() => handleDigitPress('0')}
              >
                0
              </button>
              <button
                type="button"
                className="pin-key pin-key--ghost"
                onClick={handleDelete}
              >
                מחק
              </button>
            </div>

            {!shouldAutoVerify && (
              <button
                type="button"
                className="pin-submit"
                onClick={handlePinSubmit}
                disabled={pin.length < 4}
              >
                אישור
              </button>
            )}
          </>
        )}

        {!showPin && (
          <button
            type="button"
            className="pin-submit"
            onClick={onUsePassword}
          >
            כניסה עם סיסמה
          </button>
        )}
      </div>
    </div>
  );
}

export default BiometricAuth;

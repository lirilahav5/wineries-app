// Utility functions for biometric authentication and credential management

export interface AuthPreferences {
  useBiometric: boolean;
  usePin: boolean;
  pinHash?: string;
  pinLength?: number;
  rememberCredentials: boolean;
}

const PREFERENCES_KEY = 'wineME_auth_preferences';
const PIN_KEY = 'wineME_pin_hash';
const CREDENTIALS_KEY = 'wineME_credentials';

// Check if device supports biometric authentication
export async function checkBiometricSupport(): Promise<{
  supported: boolean;
  type: 'face' | 'fingerprint' | 'none';
}> {
  if (!window.PublicKeyCredential) {
    return { supported: false, type: 'none' };
  }

  try {
    // Check if platform authenticator is available
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    
    if (!available) {
      return { supported: false, type: 'none' };
    }

    // Detect device type (iOS/Android)
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    if (isIOS) {
      return { supported: true, type: 'face' }; // Face ID or Touch ID
    } else if (isAndroid) {
      return { supported: true, type: 'fingerprint' }; // Fingerprint or Face unlock
    }

    return { supported: true, type: 'fingerprint' };
  } catch (error) {
    console.error('Error checking biometric support:', error);
    return { supported: false, type: 'none' };
  }
}

// Save authentication preferences
export function saveAuthPreferences(preferences: AuthPreferences): void {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Error saving auth preferences:', error);
  }
}

// Get authentication preferences
export function getAuthPreferences(): AuthPreferences | null {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error getting auth preferences:', error);
  }
  return null;
}

// Hash PIN for storage (simple hash, in production use proper encryption)
function hashPin(pin: string): string {
  // Simple hash function - in production, use proper encryption
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// Set PIN
export function setPin(pin: string): void {
  try {
    const pinHash = hashPin(pin);
    localStorage.setItem(PIN_KEY, pinHash);
    const preferences = getAuthPreferences() || {
      useBiometric: false,
      usePin: true,
      rememberCredentials: false,
    };
    preferences.usePin = true;
    preferences.pinHash = pinHash;
    preferences.pinLength = pin.length;
    saveAuthPreferences(preferences);
  } catch (error) {
    console.error('Error setting PIN:', error);
  }
}

// Verify PIN
export function verifyPin(pin: string): boolean {
  try {
    const storedHash = localStorage.getItem(PIN_KEY);
    if (!storedHash) return false;
    const inputHash = hashPin(pin);
    return storedHash === inputHash;
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return false;
  }
}

// Check if PIN is set
export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(PIN_KEY);
  } catch (error) {
    return false;
  }
}

// Clear PIN
export function clearPin(): void {
  try {
    localStorage.removeItem(PIN_KEY);
    const preferences = getAuthPreferences();
    if (preferences) {
      preferences.usePin = false;
      preferences.pinHash = undefined;
      preferences.pinLength = undefined;
      saveAuthPreferences(preferences);
    }
  } catch (error) {
    console.error('Error clearing PIN:', error);
  }
}

// Save credentials for auto-fill (using browser's credential management)
export async function saveCredentials(email: string, password: string): Promise<void> {
  try {
    if ('credentials' in navigator && 'create' in navigator.credentials) {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: new Uint8Array(32),
          rp: { name: 'WineME Management' },
          user: {
            id: new TextEncoder().encode(email),
            name: email,
            displayName: email,
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
        },
      } as any);
      
      if (credential) {
        // Also store in localStorage as fallback
        localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ email, password }));
      }
    } else {
      // Fallback to localStorage
      localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ email, password }));
    }
  } catch (error) {
    console.error('Error saving credentials:', error);
    // Fallback to localStorage
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ email, password }));
  }
}

// Get saved credentials
export async function getSavedCredentials(): Promise<{ email: string; password: string } | null> {
  try {
    // Try browser credential management first
    if ('credentials' in navigator && 'get' in navigator.credentials) {
      const credential = await navigator.credentials.get({
        mediation: 'silent' as CredentialMediationRequirement,
      }) as any;
      
      if (credential && credential.id) {
        // For PasswordCredential-like objects
        return {
          email: credential.id,
          password: credential.password || '',
        };
      }
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem(CREDENTIALS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error getting saved credentials:', error);
    // Fallback to localStorage
    const stored = localStorage.getItem(CREDENTIALS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  }
  return null;
}

// Clear saved credentials
export function clearCredentials(): void {
  try {
    localStorage.removeItem(CREDENTIALS_KEY);
    const preferences = getAuthPreferences();
    if (preferences) {
      preferences.rememberCredentials = false;
      saveAuthPreferences(preferences);
    }
  } catch (error) {
    console.error('Error clearing credentials:', error);
  }
}

// Authenticate with biometric (simplified for mobile browsers)
export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    const support = await checkBiometricSupport();
    if (!support.supported) {
      return false;
    }

    // For mobile browsers, we'll use a simpler approach
    // The actual biometric prompt will be handled by the browser's credential management
    // This is a placeholder that returns true if the user confirms
    // In a real implementation, you'd integrate with WebAuthn properly
    
    // For now, we'll simulate the biometric check
    // In production, you'd need a proper WebAuthn backend
    return new Promise((resolve) => {
      // Show a confirmation dialog (in real app, this would be the browser's biometric prompt)
      const confirmed = window.confirm(
        support.type === 'face' 
          ? 'Use Face ID to sign in?' 
          : 'Use Fingerprint to sign in?'
      );
      resolve(confirmed);
    });
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return false;
  }
}

// Check if user has set up biometric or PIN
export function hasQuickAuth(): boolean {
  const preferences = getAuthPreferences();
  return !!(preferences?.useBiometric || preferences?.usePin);
}

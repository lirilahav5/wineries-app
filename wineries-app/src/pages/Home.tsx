import { useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';
import Logo from '../components/Logo';
import { useLanguage } from '../contexts/LanguageContext';

const Home = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const locationRequestRef = useRef(false); // Prevent multiple simultaneous requests

  const handleNearMeClick = () => {
    // Prevent multiple simultaneous requests
    if (locationRequestRef.current || isRequestingLocation) {
      console.log('Location request already in progress, ignoring...');
      return;
    }

    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.');
      navigate('/map', {
        state: {
          showListView: true
        }
      });
      return;
    }

    // Set flags to prevent duplicate requests
    locationRequestRef.current = true;
    setIsRequestingLocation(true);

    // Check if we have a cached location first
    const cachedLocation = localStorage.getItem('userLocation');
    if (cachedLocation) {
      try {
        const loc = JSON.parse(cachedLocation);
        // Check if cached location is recent (less than 5 minutes old)
        const locationAge = localStorage.getItem('userLocationTimestamp');
        if (locationAge) {
          const age = Date.now() - parseInt(locationAge, 10);
          if (age < 300000) { // 5 minutes
            locationRequestRef.current = false;
            setIsRequestingLocation(false);
            navigate('/map', {
              state: {
                userLocation: loc,
                shouldCenter: true,
                showListView: true
              }
            });
            return;
          }
        }
      } catch (e) {
        // Invalid cached location, continue with fresh request
      }
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        // Save location and timestamp
        localStorage.setItem('userLocation', JSON.stringify(loc));
        localStorage.setItem('userLocationTimestamp', Date.now().toString());
        
        locationRequestRef.current = false;
        setIsRequestingLocation(false);
        
        navigate('/map', {
          state: {
            userLocation: loc,
            shouldCenter: true,
            showListView: true
          }
        });
      },
      (error) => {
        console.error('Error getting location:', error);
        locationRequestRef.current = false;
        setIsRequestingLocation(false);
        
        // Navigate to map even if location fails
        navigate('/map', {
          state: {
            showListView: true
          }
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // Accept cached location up to 5 minutes old
      }
    );
  };

  // Helper function to handle both mouse and touch events for mobile compatibility
  const handleButtonInteraction = (e: React.MouseEvent | React.TouchEvent, action: 'enter' | 'leave') => {
    const target = e.currentTarget as HTMLElement;
    if (action === 'enter') {
      target.style.transform = 'translateY(-2px) scale(1.02)';
      target.style.boxShadow = `
        0 12px 32px rgba(139, 29, 36, 0.5),
        0 6px 12px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.3),
        inset 0 -1px 0 rgba(0, 0, 0, 0.2)
      `;
      target.style.background = 'linear-gradient(135deg, #9B2D34 0%, #7B2529 50%, #9B2D34 100%)';
    } else {
      target.style.transform = 'translateY(0) scale(1)';
      target.style.boxShadow = `
        0 8px 24px rgba(139, 29, 36, 0.4),
        0 4px 8px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.2),
        inset 0 -1px 0 rgba(0, 0, 0, 0.2)
      `;
      target.style.background = 'linear-gradient(135deg, #8B1D24 0%, #6B1519 50%, #8B1D24 100%)';
    }
  };

  return (
    <div className="welcome-screen">
      <div className="logo-container">
        <button
          onClick={() => navigate('/')}
          aria-label="חזרה למסך הבית"
          title="חזרה למסך הבית"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer'
          }}
        >
          <Logo size="medium" />
        </button>
      </div>
      
      <div className="welcome-buttons">
        <button 
          onClick={handleNearMeClick}
          style={{
            background: 'linear-gradient(135deg, #8B1D24 0%, #6B1519 50%, #8B1D24 100%)',
            border: 'none',
            borderRadius: '16px',
            color: '#ffffff',
            fontSize: 'clamp(1rem, 4vw, 1.1rem)', // Responsive font size for Android
            fontWeight: '600',
            padding: '1.5rem 2.5rem',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            textAlign: 'center',
            minHeight: 'clamp(80px, 12vh, 100px)', // Responsive height for Android
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'clamp(260px, 75vw, 280px)', // Responsive width for Android
            maxWidth: '90%', // Prevent overflow on small screens
            boxShadow: `
              0 8px 24px rgba(139, 29, 36, 0.4),
              0 4px 8px rgba(0, 0, 0, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.2),
              inset 0 -1px 0 rgba(0, 0, 0, 0.2)
            `,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            direction: language === 'he' ? 'rtl' : 'ltr',
            position: 'relative',
            overflow: 'hidden',
            // Android specific fixes
            WebkitAppearance: 'none',
            appearance: 'none',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            // Ensure proper touch target size (minimum 44x44px for Android)
            minWidth: '44px'
          }}
          onMouseEnter={(e) => handleButtonInteraction(e, 'enter')}
          onMouseLeave={(e) => handleButtonInteraction(e, 'leave')}
          onTouchStart={(e) => {
            e.preventDefault(); // Prevent default to avoid double-tap zoom
            handleButtonInteraction(e, 'enter');
          }}
          onTouchEnd={(e) => {
            e.preventDefault(); // Prevent default to avoid triggering onClick
            handleButtonInteraction(e, 'leave');
            if (!isRequestingLocation && !locationRequestRef.current) {
              handleNearMeClick();
            }
          }}
          onTouchCancel={(e) => {
            handleButtonInteraction(e, 'leave');
          }}
        >
          <span style={{ 
            position: 'absolute',
            top: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
            borderRadius: '2px'
          }} />
          {t('home.nearMe')}
        </button>
        <button 
          onClick={() => navigate('/regions')}
          style={{
            background: 'linear-gradient(135deg, #8B1D24 0%, #6B1519 50%, #8B1D24 100%)',
            border: 'none',
            borderRadius: '16px',
            color: '#ffffff',
            fontSize: 'clamp(1rem, 4vw, 1.1rem)', // Responsive font size for Android
            fontWeight: '600',
            padding: '1.5rem 2.5rem',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            textAlign: 'center',
            minHeight: 'clamp(80px, 12vh, 100px)', // Responsive height for Android (min 44px for touch target)
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'clamp(260px, 75vw, 280px)', // Responsive width for Android
            maxWidth: '90%', // Prevent overflow on small screens
            boxShadow: `
              0 8px 24px rgba(139, 29, 36, 0.4),
              0 4px 8px rgba(0, 0, 0, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.2),
              inset 0 -1px 0 rgba(0, 0, 0, 0.2)
            `,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            direction: language === 'he' ? 'rtl' : 'ltr',
            position: 'relative',
            overflow: 'hidden',
            // Android specific fixes
            WebkitAppearance: 'none',
            appearance: 'none',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            // Ensure proper touch target size (minimum 44x44px for Android)
            minWidth: '44px'
          }}
          onMouseEnter={(e) => handleButtonInteraction(e, 'enter')}
          onMouseLeave={(e) => handleButtonInteraction(e, 'leave')}
          onTouchStart={(e) => handleButtonInteraction(e, 'enter')}
          onTouchEnd={(e) => {
            handleButtonInteraction(e, 'leave');
            // Small delay to show feedback before navigation
            setTimeout(() => navigate('/regions'), 100);
          }}
          onTouchCancel={(e) => handleButtonInteraction(e, 'leave')}
        >
          <span style={{ 
            position: 'absolute',
            top: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
            borderRadius: '2px'
          }} />
          {t('home.otherArea')}
        </button>
      </div>
    </div>
  );
};

export default Home; 

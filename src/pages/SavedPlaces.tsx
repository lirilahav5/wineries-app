import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoListOutline, IoLocationOutline } from 'react-icons/io5';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { AppBottomNav } from '../components/AppBottomNav';
import { savedPlaceToFeature, useSavedPlaces } from '../contexts/SavedPlacesContext';
import { WinePlaceListCard } from '../components/WinePlaceListCard';
import { parseOffer } from '../utils/wineListCardFormat';
import { translateOffer } from '../utils/nameTranslations';
import { haversineDistanceMeters } from '../utils/geo';

const WM_RED = '#E30613';

const SavedPlaces = () => {
  const { t, language } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { items, toggleSave } = useSavedPlaces();
  const listIconColor = isDark ? '#b0b0b0' : '#8A8A8E';

  const [userLocation] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const raw = localStorage.getItem('userLocation');
      if (!raw) return null;
      const p = JSON.parse(raw) as { lat?: number; lng?: number };
      if (typeof p.lat === 'number' && typeof p.lng === 'number') return { lat: p.lat, lng: p.lng };
    } catch {
      /* ignore */
    }
    return null;
  });

  const sorted = [...items].sort((a, b) => b.savedAt - a.savedAt);

  const [expandedListOpeningHoursKeys, setExpandedListOpeningHoursKeys] = useState<Set<string>>(new Set());
  const toggleListOpeningHoursKey = useCallback((key: string) => {
    setExpandedListOpeningHoursKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const [selectedOffer, setSelectedOffer] = useState<{ name: string; description: string; wineryName: string } | null>(
    null
  );

  const translatedOffers = useMemo(() => {
    const m = new Map<string, { name: string; description: string }>();
    for (const place of items) {
      if (!place.offers) continue;
      const offerKey = `${place.placeId || place.name || ''}-offer`;
      const parsed = parseOffer(place.offers, t('list.offersAndDeals'));
      m.set(offerKey, {
        name: translateOffer(parsed.name, language),
        description: translateOffer(parsed.description, language),
      });
    }
    return m;
  }, [items, language, t]);

  return (
    <>
      <div
        style={{
          minHeight: '100vh',
          padding: '2rem 1.25rem',
          paddingBottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))',
          direction: 'rtl',
          textAlign: 'right',
          backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
          color: isDark ? '#f5f5f5' : '#1d1d1f',
          fontFamily: 'var(--apple-font, system-ui, sans-serif)',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>{t('saved.title')}</h1>
        {sorted.length === 0 ? (
          <p style={{ color: isDark ? '#aaa' : '#666', marginBottom: '1.25rem', lineHeight: 1.5, fontSize: '0.95rem' }}>
            {t('saved.placeholder')}
          </p>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.65rem',
            marginBottom: '1.5rem',
            justifyContent: 'flex-start',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/map', { state: { showListView: true } })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.65rem 1.25rem',
              backgroundColor: '#E30613',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.95rem',
            }}
          >
            <IoListOutline size={20} color="#fff" />
            {t('saved.backToList')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/map')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.65rem 1.25rem',
              backgroundColor: '#E30613',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.95rem',
            }}
          >
            <IoLocationOutline size={20} color="#fff" />
            {t('saved.backToMap')}
          </button>
        </div>

        {sorted.length === 0 ? (
          <p style={{ color: isDark ? '#888' : '#666', marginTop: '2rem', textAlign: 'center' }}>{t('saved.empty')}</p>
        ) : (
          <div style={{ direction: 'rtl' }}>
            {sorted.map((place, index) => {
              const feature = savedPlaceToFeature(place);
              return (
                <WinePlaceListCard
                  key={place.id}
                  item={feature}
                  isShop={place.isShop}
                  language={language}
                  isDark={isDark}
                  listIconColor={listIconColor}
                  wmRed={WM_RED}
                  translatedOffers={translatedOffers}
                  onOfferSelect={setSelectedOffer}
                  expandedListOpeningHoursKeys={expandedListOpeningHoursKeys}
                  toggleListOpeningHoursKey={toggleListOpeningHoursKey}
                  listIndex={index}
                  isSaved
                  onToggleSave={() => toggleSave(feature, place.isShop)}
                  t={t}
                  listRenderKey={0}
                  distanceFromUserMeters={
                    userLocation
                      ? haversineDistanceMeters(
                          userLocation.lat,
                          userLocation.lng,
                          feature.geometry.coordinates[1],
                          feature.geometry.coordinates[0]
                        )
                      : null
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {selectedOffer && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setSelectedOffer(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #8B1D24 0%, #d32f2f 100%)',
                padding: '2rem 1.5rem 1.5rem',
                position: 'relative',
                textAlign: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedOffer(null)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                }}
              >
                ×
              </button>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>%</div>
              <h2
                style={{
                  margin: 0,
                  color: 'white',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                {selectedOffer.name}
              </h2>
              <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
                {selectedOffer.wineryName}
              </div>
            </div>
            <div
              style={{
                padding: '2rem 1.5rem',
                overflowY: 'auto',
                flex: 1,
                direction: 'rtl',
              }}
            >
              <div
                style={{
                  fontSize: '1.1rem',
                  lineHeight: 1.8,
                  color: '#333',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                }}
              >
                {selectedOffer.description.split('\n').map((line, i) => (
                  <div key={i} style={{ marginBottom: line.trim() ? '0.5rem' : 0 }}>
                    {line.trim() || '\u00A0'}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '1.5rem', borderTop: '1px solid #f0f0f0' }}>
              <button
                type="button"
                onClick={() => setSelectedOffer(null)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {t('offer.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AppBottomNav />
    </>
  );
};

export default SavedPlaces;

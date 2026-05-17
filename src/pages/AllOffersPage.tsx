import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoLocationOutline } from 'react-icons/io5';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { AppBottomNav } from '../components/AppBottomNav';
import type { WineryFeature } from '../data/wineries';
import { fetchWineriesFromDb, fetchWineShopsFromDb } from '../data/wineries';
import { testConnection } from '../lib/supabase';
import { parseOffer } from '../utils/wineListCardFormat';
import { translateName, translateOffer } from '../utils/nameTranslations';

function hasOffers(f: WineryFeature): boolean {
  const o = f.properties.offers;
  return typeof o === 'string' && o.trim().length > 0;
}

type OfferRow = {
  feature: WineryFeature;
  isShop: boolean;
  short: string;
};

export default function AllOffersPage() {
  const { t, language } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [wineries, setWineries] = useState<WineryFeature[]>([]);
  const [shops, setShops] = useState<WineryFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<{ name: string; description: string; wineryName: string } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const ok = await testConnection();
        if (!ok) {
          if (!cancelled) setError(t('benefits.loadError'));
          return;
        }
        const [w, s] = await Promise.all([fetchWineriesFromDb(), fetchWineShopsFromDb()]);
        if (cancelled) return;
        setWineries(w.features);
        setShops(s.features);
      } catch {
        if (!cancelled) setError(t('benefits.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const rows = useMemo(() => {
    const out: OfferRow[] = [];
    const add = (arr: WineryFeature[], isShop: boolean) => {
      for (const f of arr) {
        if (!hasOffers(f)) continue;
        const parsed = parseOffer(f.properties.offers, t('list.offersAndDeals'));
        const translated = {
          name: translateOffer(parsed.name, language),
          description: translateOffer(parsed.description, language),
        };
        const line = [translated.name, translated.description].filter(Boolean).join(' — ') || t('list.offersAndDeals');
        const short = line.length > 160 ? `${line.slice(0, 157)}…` : line;
        out.push({ feature: f, isShop, short });
      }
    };
    add(wineries, false);
    add(shops, true);
    out.sort((a, b) => {
      const na = translateName(a.feature.properties.name || '', language) || a.feature.properties.name || '';
      const nb = translateName(b.feature.properties.name || '', language) || b.feature.properties.name || '';
      return na.localeCompare(nb, 'he');
    });
    return out;
  }, [wineries, shops, language, t]);

  const openDetail = (feature: WineryFeature, isShop: boolean) => {
    const parsed = parseOffer(feature.properties.offers, t('list.offersAndDeals'));
    setSelectedOffer({
      name: translateOffer(parsed.name, language),
      description: translateOffer(parsed.description, language),
      wineryName: translateName(feature.properties.name || '', language) || (isShop ? t('list.wineShop') : t('list.winery')),
    });
  };

  const goMap = (f: WineryFeature) => {
    const [lng, lat] = f.geometry.coordinates;
    navigate('/map', { state: { focusCoordinates: { lat, lng }, mapZoom: 15 } });
  };

  const bg = isDark ? '#1a1a1a' : '#f5f5f5';
  const fg = isDark ? '#f5f5f5' : '#1d1d1f';
  const cardBg = isDark ? '#2a2a2a' : '#fff';
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #d8d8d8';
  const muted = isDark ? '#aaa' : '#666';

  return (
    <>
      <div
        style={{
          minHeight: '100vh',
          padding: '2rem 1.25rem',
          paddingBottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))',
          direction: 'rtl',
          textAlign: 'right',
          backgroundColor: bg,
          color: fg,
          fontFamily: 'var(--apple-font), system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{t('benefits.pageTitle')}</h1>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.95rem', color: muted, lineHeight: 1.5 }}>{t('benefits.subtitle')}</p>

        {loading && (
          <p style={{ color: muted, textAlign: 'center', marginTop: '2rem' }}>{t('benefits.loading')}</p>
        )}
        {error && !loading && (
          <p style={{ color: '#c62828', textAlign: 'center', marginTop: '2rem' }}>{error}</p>
        )}
        {!loading && !error && rows.length === 0 && (
          <p style={{ color: muted, textAlign: 'center', marginTop: '2rem' }}>{t('benefits.empty')}</p>
        )}

        {!loading && !error && rows.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {rows.map(({ feature, isShop, short }) => {
              const title = translateName(feature.properties.name || '', language) || feature.properties.name || '—';
              return (
                <li
                  key={`${isShop ? 's' : 'w'}-${feature.properties.place_id || feature.properties.name || ''}-${short.slice(0, 24)}`}
                  style={{
                    backgroundColor: cardBg,
                    borderRadius: '14px',
                    padding: '1rem',
                    border: cardBorder,
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '999px',
                        backgroundColor: isShop ? '#000' : '#E30613',
                        color: '#fff',
                      }}
                    >
                      {isShop ? t('list.wineShop') : t('list.winery')}
                    </span>
                    {feature.properties.region && (
                      <span style={{ fontSize: '0.8rem', color: muted }}>{feature.properties.region}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openDetail(feature, isShop)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      margin: '0 0 0.65rem',
                      cursor: 'pointer',
                      textAlign: 'right',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: fg,
                      fontFamily: 'inherit',
                      width: '100%',
                      lineHeight: 1.3,
                    }}
                  >
                    {title}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDetail(feature, isShop)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'right',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      marginBottom: '0.75rem',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: '#E30613',
                      lineHeight: 1.45,
                      fontFamily: 'inherit',
                    }}
                  >
                    {short}
                  </button>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: muted }}>{t('benefits.tapForDetails')}</p>
                  <button
                    type="button"
                    onClick={() => goMap(feature)}
                    style={{
                      marginTop: '0.65rem',
                      width: '100%',
                      padding: '0.55rem 1rem',
                      borderRadius: '10px',
                      border: cardBorder,
                      background: isDark ? '#1f1f1f' : '#fafafa',
                      color: fg,
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <IoLocationOutline size={18} />
                    {t('benefits.openOnMap')}
                  </button>
                </li>
              );
            })}
          </ul>
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
}

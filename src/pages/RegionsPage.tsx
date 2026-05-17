import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';
import { AppBottomNav } from '../components/AppBottomNav';
import { IoMenu, IoSearch } from 'react-icons/io5';
import { FaSliders } from 'react-icons/fa6';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { fetchWineriesFromDb, fetchWineShopsFromDb, type WineryFeature } from '../data/wineries';
import { translateName, translateAddress } from '../utils/nameTranslations';

interface RegionCount {
  region: string;
  count: number;
}

type RegionTileDef =
  | { kind: 'nearMe'; iconSrc: string }
  | { kind: 'region'; name: string; iconSrc: string };

const REGION_TILES: RegionTileDef[] = [
  { kind: 'nearMe', iconSrc: '/newicons/my-location.png' },
  { kind: 'region', name: 'כרמל', iconSrc: '/newicons/carmel.png' },
  { kind: 'region', name: 'גליל', iconSrc: '/newicons/galil.png' },
  { kind: 'region', name: 'רמת הגולן', iconSrc: '/newicons/golan.png' },
  { kind: 'region', name: 'ירושלים', iconSrc: '/newicons/jerusalem.png' },
  { kind: 'region', name: 'הרי יהודה', iconSrc: '/newicons/judea.png' },
  { kind: 'region', name: 'שומרון', iconSrc: '/newicons/shomron.png' },
  { kind: 'region', name: 'נגב', iconSrc: '/newicons/negev.png' },
  { kind: 'region', name: 'מרכז', iconSrc: '/newicons/center.png' },
  { kind: 'region', name: 'שרון', iconSrc: '/newicons/sharon.png' },
  { kind: 'region', name: 'דרום', iconSrc: '/newicons/south.png' },
  { kind: 'region', name: 'צפון', iconSrc: '/newicons/north.png' },
];

const RegionsPage = () => {
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const locationRequestRef = useRef(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [nearMeCity, setNearMeCity] = useState<string>('');
  const [regionCounts, setRegionCounts] = useState<RegionCount[]>([]);
  const [_isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [wineries, setWineries] = useState<WineryFeature[]>([]);
  const [wineShops, setWineShops] = useState<WineryFeature[]>([]);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const autocompleteBlurRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const routeLocation = useLocation();
  
  // Hebrew UI: document RTL + lang
  useEffect(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'he';
  }, []);

  useEffect(() => {
    const cachedCity = localStorage.getItem('userLocationCity');
    if (cachedCity) {
      setNearMeCity(cachedCity);
    }
  }, []);


  useEffect(() => {
    const state = routeLocation.state as { scrollToTop?: boolean } | null;
    if (state?.scrollToTop && contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [routeLocation.key, routeLocation.state]);

  // Fetch wineries and wine shops for home-page search autocomplete
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [wineriesRes, shopsRes] = await Promise.all([
          fetchWineriesFromDb(),
          fetchWineShopsFromDb()
        ]);
        if (!cancelled) {
          setWineries(wineriesRes.features || []);
          setWineShops(shopsRes.features || []);
        }
      } catch (e) {
        console.error('Error fetching places for search:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Region mapping for translations
  const regionMap: Record<string, { he: string; en: string; ru: string }> = {
    'רמת הגולן': { he: 'רמת הגולן', en: 'Golan Heights', ru: 'Голанские высоты' },
    'גליל': { he: 'גליל', en: 'Galilee', ru: 'Галилея' },
    'שומרון': { he: 'שומרון', en: 'Shomron', ru: 'Самария' },
    'הרי יהודה': { he: 'הרי יהודה', en: 'Judean Hills', ru: 'Иудейские холмы' },
    'ירושלים': { he: 'ירושלים', en: 'Jerusalem', ru: 'Иерусалим' },
    'שרון': { he: 'שרון', en: 'Sharon', ru: 'Шарон' },
    'מרכז': { he: 'מרכז', en: 'Central', ru: 'Центр' },
    'נגב': { he: 'נגב', en: 'Negev', ru: 'Негев' },
    'צפון': { he: 'צפון', en: 'North', ru: 'Север' },
    'כרמל': { he: 'כרמל', en: 'Carmel', ru: 'Кармель' },
    'דרום': { he: 'דרום', en: 'South', ru: 'Юг' }
  };
  
  // Get translated region name
  const getRegionName = (regionKey: string): string => {
    const region = regionMap[regionKey];
    if (region) {
      return region[language as 'he' | 'en' | 'ru'];
    }
    return regionKey;
  };

  // Fetch winery and wine shop counts by region
  useEffect(() => {
    const fetchRegionCounts = async () => {
      try {
        setIsLoading(true);
        
        // Fetch wineries by region
        const { data: wineriesData, error: wineriesError } = await supabase
          .from('wineries')
          .select('region');

        // Fetch wine shops by region
        const { data: shopsData, error: shopsError } = await supabase
          .from('wine_shops')
          .select('region');

        if (wineriesError || shopsError) {
          console.error('Error fetching region counts:', wineriesError || shopsError);
          return;
        }

        // Combine and count
        const allItems = [
          ...(wineriesData || []).map(item => item.region),
          ...(shopsData || []).map(item => item.region)
        ].filter(Boolean);

        // Count by region
        const counts: Record<string, number> = {};
        allItems.forEach(region => {
          if (region) {
            counts[region] = (counts[region] || 0) + 1;
          }
        });

        // Convert to array and sort
        const regionCountsArray: RegionCount[] = Object.entries(counts)
          .map(([region, count]) => ({ region, count }))
          .sort((a, b) => b.count - a.count);

        setRegionCounts(regionCountsArray);
      } catch (error) {
        console.error('Error fetching region counts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRegionCounts();
  }, []);

  const handleRegionClick = (region: string) => {
    navigate('/map', {
      state: {
        selectedRegion: region,
        showListView: true // Show list view first
      }
    });
  };

  const fetchNearbyCity = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=he`,
        {
          headers: {
            'User-Agent': 'WineME/1.0 (feedback@wineme.app)'
          }
        }
      );
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      const address = data?.address || {};
      const city =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.county ||
        address.state ||
        '';
      if (city) {
        setNearMeCity(city);
        localStorage.setItem('userLocationCity', city);
      }
    } catch {
      // Ignore reverse geocode errors
    }
  };

  const handleNearMeClick = () => {
    if (locationRequestRef.current || isRequestingLocation) {
      return;
    }

    if (!navigator.geolocation) {
      navigate('/map', { state: { showListView: true } });
      return;
    }

    locationRequestRef.current = true;
    setIsRequestingLocation(true);

    const cachedLocation = localStorage.getItem('userLocation');
    if (cachedLocation) {
      try {
        const loc = JSON.parse(cachedLocation);
        const locationAge = localStorage.getItem('userLocationTimestamp');
        if (locationAge) {
          const age = Date.now() - parseInt(locationAge, 10);
          if (age < 300000) {
            locationRequestRef.current = false;
            setIsRequestingLocation(false);
            if (!nearMeCity) {
              fetchNearbyCity(loc.lat, loc.lng);
            }
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
      } catch {
        // Ignore cached location parsing errors
      }
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        localStorage.setItem('userLocation', JSON.stringify(loc));
        localStorage.setItem('userLocationTimestamp', Date.now().toString());
        fetchNearbyCity(loc.lat, loc.lng);

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
      () => {
        locationRequestRef.current = false;
        setIsRequestingLocation(false);
        navigate('/map', { state: { showListView: true } });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  // Get count for a specific region
  const getRegionCount = (regionName: string): number => {
    const found = regionCounts.find(rc => rc.region === regionName);
    return found ? found.count : 0;
  };

  // Search: region exact / partial, or map list with search term
  const handleSearchSubmit = () => {
    const q = searchTerm.trim();
    if (!q) return;
    const term = q.toLowerCase();
    const match = REGION_TILES.find(
      (r) =>
        r.kind === 'region' &&
        (r.name === q || getRegionName(r.name).toLowerCase() === term)
    );
    if (match && match.kind === 'region') {
      handleRegionClick(match.name);
      setSearchTerm('');
      setShowAutocomplete(false);
      return;
    }
    navigate('/map', { state: { searchTerm: q, showListView: true } });
    setSearchTerm('');
    setShowAutocomplete(false);
  };

  // Autocomplete: regions first, then wineries and wine shops
  const autocompleteSuggestions = useMemo(() => {
    if (!searchTerm.trim()) return [] as { kind: 'region' | 'place'; regionKey?: string; label: string }[];
    const term = searchTerm.toLowerCase().trim();
    const regionsOut: { kind: 'region'; regionKey: string; label: string }[] = [];
    for (const r of REGION_TILES) {
      if (r.kind !== 'region') continue;
      const label = getRegionName(r.name);
      if (r.name.includes(term) || label.toLowerCase().includes(term)) {
        regionsOut.push({ kind: 'region', regionKey: r.name, label });
        if (regionsOut.length >= 6) break;
      }
    }
    const all = [...wineries, ...wineShops];
    const seen = new Set<string>();
    const placesOut: { kind: 'place'; label: string }[] = [];
    for (const item of all) {
      const name = (translateName(item.properties.name || '', language) || item.properties.name || '').toLowerCase();
      const address = translateAddress(item.properties.address || '', language).toLowerCase();
      const region = getRegionName(item.properties.region || '').toLowerCase();
      const rawAddress = (item.properties.address || '').toLowerCase();
      const matches =
        name.includes(term) ||
        address.includes(term) ||
        region.includes(term) ||
        rawAddress.includes(term);
      if (matches) {
        const displayName = translateName(item.properties.name || '', language) || item.properties.name || '';
        if (displayName && !seen.has(displayName.toLowerCase())) {
          seen.add(displayName.toLowerCase());
          placesOut.push({ kind: 'place', label: displayName });
          if (placesOut.length >= 8) break;
        }
      }
    }
    return [...regionsOut, ...placesOut].slice(0, 12);
  }, [searchTerm, wineries, wineShops, language]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (autocompleteBlurRef.current) window.clearTimeout(autocompleteBlurRef.current);
    };
  }, []);

  return (
    <div
      className={`home-apple ${isDark ? 'dark' : ''}`}
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'hidden',
        overflowY: 'hidden'
      }}
    >
      {/* Header — WINE ME reference: menu, logo, sliders */}
      <div className="top-nav" style={{ backgroundColor: isDark ? '#1a1a1a' : '#fff' }}>
        <div className="top-nav-group left">
          <button
            type="button"
            className="nav-icon wm-top-icon"
            onClick={() => navigate('/map', { state: { openSettings: true } })}
            aria-label={t('settings.title')}
            title={t('settings.title')}
          >
            <IoMenu size={26} color={isDark ? '#f2f2f2' : '#000'} />
          </button>
        </div>

        <div className="logo-container">
          <button
            type="button"
            onClick={() => navigate('/', { state: { scrollToTop: true } })}
            aria-label="חזרה למסך הבית"
            title="חזרה למסך הבית"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <Logo size="small" />
          </button>
        </div>

        <div className="top-nav-group right">
          <button
            type="button"
            className="nav-icon wm-top-icon"
            onClick={() => navigate('/map', { state: { showListView: true } })}
            aria-label={t('nav.map')}
            title={t('nav.map')}
          >
            <FaSliders size={22} color={isDark ? '#f2f2f2' : '#000'} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div
        ref={contentRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
          zIndex: 1,
          minHeight: 0,
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Hero + Region grid - Apple style */}
        <div
          style={{
            width: '100%',
            margin: '0 auto',
            paddingTop: '1.25rem',
            paddingLeft: 'max(1.25rem, env(safe-area-inset-left))',
            paddingRight: 'max(1.25rem, env(safe-area-inset-right))',
            paddingBottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              marginBottom: '1.35rem',
              paddingTop: '0.15rem',
              textAlign: 'right',
              direction: 'rtl',
            }}
          >
            <h1 className="regions-hero-title">{t('home.heroTitle')}</h1>
            <p className="regions-hero-sub">{t('home.heroSub')}</p>
          </div>

          <div ref={searchBoxRef} style={{ marginBottom: '0.85rem', position: 'relative', zIndex: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                borderRadius: '14px',
                border: `1px solid ${isDark ? '#444' : '#d0d0d0'}`,
                paddingLeft: '0.75rem',
                paddingRight: '0.75rem',
                paddingTop: '0.55rem',
                paddingBottom: '0.55rem',
                direction: 'rtl',
              }}
            >
              <IoSearch
                size={22}
                style={{ color: isDark ? '#888' : '#666', flexShrink: 0 }}
                aria-hidden
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowAutocomplete(true);
                }}
                onFocus={() => searchTerm.trim() && setShowAutocomplete(true)}
                onBlur={() => {
                  autocompleteBlurRef.current = window.setTimeout(() => setShowAutocomplete(false), 200);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchSubmit();
                }}
                placeholder={t('home.searchRegionsPlaceholder')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  fontSize: '1rem',
                  backgroundColor: 'transparent',
                  color: isDark ? '#f5f5f5' : '#1d1d1f',
                  direction: 'rtl',
                  textAlign: 'right',
                }}
              />
            </div>
            {showAutocomplete && autocompleteSuggestions.length > 0 && (
              <div
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '100%',
                  marginTop: '4px',
                  backgroundColor: isDark ? '#2a2a2a' : '#fff',
                  border: `1px solid ${isDark ? '#444' : '#e5e5e5'}`,
                  borderRadius: '14px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  zIndex: 1100,
                  direction: 'rtl',
                }}
              >
                {autocompleteSuggestions.map((suggestion, i) => (
                  <button
                    key={`${suggestion.kind}-${suggestion.label}-${i}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (suggestion.kind === 'region' && suggestion.regionKey) {
                        handleRegionClick(suggestion.regionKey);
                      } else {
                        navigate('/map', { state: { searchTerm: suggestion.label, showListView: true } });
                      }
                      setSearchTerm('');
                      setShowAutocomplete(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.65rem 1rem',
                      border: 'none',
                      background: 'none',
                      fontSize: '0.95rem',
                      color: isDark ? '#f5f5f5' : '#1d1d1f',
                      textAlign: 'right',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? '#3a3a3a' : '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '0.85rem',
              direction: 'rtl',
              width: '100%',
            }}
          >
            {REGION_TILES.map((tile) => {
              if (tile.kind === 'nearMe') {
                const nearLabel =
                  `${t('home.useMyLocation')}${nearMeCity ? ` · ${nearMeCity}` : ''}`;
                return (
                  <button
                    key="near-me"
                    type="button"
                    onClick={handleNearMeClick}
                    disabled={isRequestingLocation}
                    className="region-tile region-tile--near-me"
                    aria-label={nearLabel}
                    style={{
                      aspectRatio: '1',
                      cursor: isRequestingLocation ? 'wait' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      padding: '0.85rem 0.5rem 0.65rem',
                      position: 'relative',
                      overflow: 'hidden',
                      fontFamily: 'var(--apple-font)',
                    }}
                  >
                    <img
                      src={tile.iconSrc}
                      alt=""
                      draggable={false}
                      style={{
                        width: '3rem',
                        height: '3rem',
                        objectFit: 'contain',
                        marginTop: '0.15rem',
                      }}
                    />
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: isDark ? '#f0f0f0' : '#000000',
                        textAlign: 'center',
                        direction: 'rtl',
                        lineHeight: 1.2,
                        maxWidth: '100%',
                      }}
                    >
                      {t('home.useMyLocation')}
                      {nearMeCity ? (
                        <>
                          {' '}
                          <span style={{ fontWeight: 600, opacity: 0.85 }}>· {nearMeCity}</span>
                        </>
                      ) : null}
                    </div>
                  </button>
                );
              }

              const count = getRegionCount(tile.name);
              return (
                <button
                  key={tile.name}
                  type="button"
                  onClick={() => handleRegionClick(tile.name)}
                  className="region-tile"
                  style={{
                    aspectRatio: '1',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    padding: '0.85rem 0.5rem 0.65rem',
                    position: 'relative',
                    overflow: 'hidden',
                    fontFamily: 'var(--apple-font)',
                  }}
                >
                  {count > 0 && (
                    <span
                      className="region-count-pill"
                      style={{
                        right: '0.45rem',
                      }}
                    >
                      {count}
                    </span>
                  )}
                  <img
                    src={tile.iconSrc}
                    alt=""
                    draggable={false}
                    style={{
                      width: '3rem',
                      height: '3rem',
                      objectFit: 'contain',
                      marginTop: '0.15rem',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: isDark ? '#f0f0f0' : '#000000',
                      textAlign: 'center',
                      direction: 'rtl',
                      lineHeight: 1.2,
                      maxWidth: '100%',
                    }}
                  >
                    {getRegionName(tile.name)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AppBottomNav
        onHomeClick={() => navigate('/', { state: { scrollToTop: true } })}
        onListClick={() => navigate('/map', { state: { showListView: true } })}
        onMapClick={() => navigate('/map')}
      />
    </div>
  );
};

export default RegionsPage;

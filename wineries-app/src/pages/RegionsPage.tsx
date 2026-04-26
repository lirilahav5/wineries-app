import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';
import { IoBulb, IoBulbOutline, IoSettings, IoHome, IoSearch, IoAddCircle, IoList } from 'react-icons/io5';
import { FaRegMap } from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { fetchWineriesFromDb, fetchWineShopsFromDb, type WineryFeature } from '../data/wineries';
import { translateName, translateAddress } from '../utils/nameTranslations';

interface RegionCount {
  region: string;
  count: number;
}

const RegionsPage = () => {
  const { language, t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const locationRequestRef = useRef(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const isNavigatingRef = useRef(false);
  const bottomArmedRef = useRef(false);
  const bottomScrollTopRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartedNearBottomRef = useRef(false);
  const [nearMeCity, setNearMeCity] = useState<string>('');
  const [nearMeBlinking, setNearMeBlinking] = useState(true);
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
  
  // Set document direction based on language
  useEffect(() => {
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const cachedCity = localStorage.getItem('userLocationCity');
    if (cachedCity) {
      setNearMeCity(cachedCity);
    }
  }, []);


  useEffect(() => {
    const state = routeLocation.state as { scrollToTop?: boolean } | null;
    isNavigatingRef.current = false;
    bottomArmedRef.current = false;
    bottomScrollTopRef.current = 0;
    lastScrollTopRef.current = 0;
    touchStartYRef.current = null;
    touchStartedNearBottomRef.current = false;
    if (state?.scrollToTop && contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [routeLocation.key, routeLocation.state]);

  useEffect(() => {
    setNearMeBlinking(true);
    const timer = window.setTimeout(() => setNearMeBlinking(false), 5000);
    return () => window.clearTimeout(timer);
  }, [routeLocation.key]);

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

  // Region mapping for the colorful buttons view
  const regionButtons = [
    { name: 'רמת הגולן', color: '#FF6B35', icon: '🏔️' },
    { name: 'גליל', color: '#4ECDC4', icon: '🌲' },
    // שומרון uses the previous \"near me\" accent color
    { name: 'שומרון', color: '#8B1D24', icon: '🍇' },
    { name: 'הרי יהודה', color: '#95E1D3', icon: '⛰️' },
    { name: 'ירושלים', color: '#F38181', icon: '🕌' },
    { name: 'שרון', color: '#AA96DA', icon: '🌊' },
    { name: 'מרכז', color: '#FCBAD3', icon: '🏙️' },
    { name: 'נגב', color: '#A8E6CF', icon: '🏜️' },
    { name: 'צפון', color: '#FFD3A5', icon: '🌅' },
    { name: 'דרום', color: '#FFA07A', icon: '🌴' }
  ];

  // Get count for a specific region
  const getRegionCount = (regionName: string): number => {
    const found = regionCounts.find(rc => rc.region === regionName);
    return found ? found.count : 0;
  };

  // Search: open map list view with search term (winery/wine shop)
  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      navigate('/map', { state: { searchTerm: searchTerm.trim(), showListView: true } });
      setSearchTerm('');
      setShowAutocomplete(false);
    }
  };

  // Autocomplete: wineries and wine shops (name, address, region) — same logic as map
  const autocompleteSuggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    const all = [...wineries, ...wineShops];
    const seen = new Set<string>();
    const out: string[] = [];
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
          out.push(displayName);
          if (out.length >= 10) return out;
        }
      }
    }
    return out;
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
      {/* Header - same as map page (top-nav) */}
      <div className="top-nav">
        <div className="top-nav-group left">
          <button
            className="nav-icon"
            onClick={() => navigate('/map', { state: { openSettings: true } })}
            aria-label={t('nav.settings')}
            title={t('nav.settings')}
          >
            <IoSettings size={24} />
           {/*<span>{t('nav.settings')}</span>*/}
          </button>
        </div>

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
            <Logo size="small" />
          </button>
        </div>

        <div className="top-nav-group right">
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px'
          }}>
            <style>{`
              @keyframes swing {
                0%, 100% { transform: rotate(-15deg); }
                50% { transform: rotate(15deg); }
              }
              .swinging-bulb {
                animation: swing 2s ease-in-out infinite;
                transform-origin: top center;
                transition: filter 0.2s ease;
              }
              .swinging-bulb:hover {
                filter: brightness(1.2);
              }
            `}</style>
            <button
              onClick={toggleTheme}
              dir="ltr"
              className="swinging-bulb"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={isDark ? 'Light mode' : 'Dark mode'}
              style={{
                width: '56px',
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                outline: 'none',
                padding: 0,
                position: 'relative'
              }}
            >
              {isDark ? (
                <IoBulb size={40} color="#ffd700" style={{ filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))' }} />
              ) : (
                <IoBulbOutline size={40} color="#ffd700" />
              )}
            </button>
          </div>
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
        <div style={{
          width: '100%',
          maxWidth: '680px',
          margin: '0 auto',
          padding: '1.5rem 1.25rem',
          paddingBottom: '6rem',
          boxSizing: 'border-box'
        }}>
          {/* Hero headline */}
          <div style={{
            marginBottom: '1.75rem',
            paddingTop: '0.25rem',
            textAlign: language === 'he' ? 'right' : 'left',
            direction: language === 'he' ? 'rtl' : 'ltr'
          }}>
            <h1 className="home-hero" style={{ margin: 0 }}>
              {t('home.heroTitle')}
            </h1>
            <p className="home-sub">
              {t('home.heroSub')}
            </p>
          </div>

          {/* Search bar — same style as map, below text, above grid */}
          <div
            ref={searchBoxRef}
            style={{
              marginBottom: '1.5rem',
              position: 'relative',
              zIndex: 10
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                borderRadius: '25px',
                border: `1px solid ${isDark ? '#444' : '#e0e0e0'}`,
                paddingLeft: '0.75rem',
                paddingRight: '0.75rem',
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem',
                direction: 'ltr'
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
                placeholder={language === 'he' ? 'חפש יקב או חנות יין...' : language === 'ru' ? 'Поиск...' : 'Search winery or wine shop...'}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  fontSize: '1rem',
                  backgroundColor: 'transparent',
                  color: isDark ? '#f5f5f5' : '#1d1d1f',
                  direction: language === 'he' ? 'rtl' : 'ltr',
                  textAlign: language === 'he' ? 'right' : 'left'
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
                  marginTop: '2px',
                  backgroundColor: isDark ? '#2a2a2a' : '#fff',
                  border: `1px solid ${isDark ? '#444' : '#e0e0e0'}`,
                  borderRadius: '25px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  maxHeight: '240px',
                  overflowY: 'auto',
                  zIndex: 1100,
                  direction: language === 'he' ? 'rtl' : 'ltr'
                }}
              >
                {autocompleteSuggestions.map((suggestion, i) => (
                  <button
                    key={`${suggestion}-${i}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      navigate('/map', { state: { searchTerm: suggestion, showListView: true } });
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
                      textAlign: language === 'he' ? 'right' : 'left',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? '#444' : '#f0f0f0';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Region Buttons Grid */}
          <style>{`
            @keyframes near-me-blink {
              0%, 100% { box-shadow: 0 2px 10px rgba(139, 29, 36, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06); }
              50% { box-shadow: 0 0 0 2px rgba(139, 29, 36, 0.25), 0 4px 20px rgba(139, 29, 36, 0.2); }
            }
            .near-me-blink {
              animation: near-me-blink 1.5s ease-in-out infinite;
            }
          `}</style>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            direction: language === 'he' ? 'rtl' : 'ltr',
            width: '100%',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            {[
              // Near me card first so it appears on the right in RTL
              { name: t('home.nearMe'), color: '#FFE66D', icon: '🍷', isNearMe: true },
              ...regionButtons.map((region) => ({ ...region, isNearMe: false }))
            ].map((region, index) => {
              if (region.isNearMe) {
                const nearMeLabel = nearMeCity ? `(${nearMeCity})` : '';
                const nearMeLines =
                  language === 'he'
                    ? ['באזור שלי']
                    : [t('home.nearMe')];
                return (
                  <button
                    key={`near-me-${index}`}
                    onClick={handleNearMeClick}
                    disabled={isRequestingLocation}
                    className={`region-card near-me ${nearMeBlinking ? 'near-me-blink' : ''}`}
                    style={{
                      aspectRatio: '1',
                      // Yellow background for \"my location\" tile
                      backgroundColor: isRequestingLocation ? '#9aa0a6' : '#FFE66D',
                      border: 'none',
                      cursor: isRequestingLocation ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      padding: '1rem',
                      position: 'relative',
                      overflow: 'hidden',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      fontFamily: 'var(--apple-font)'
                    }}
                  >
                    <div style={{
                      fontSize: '2rem',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                    }}>
                      {region.icon}
                    </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: 'white',
                      textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      textAlign: 'center',
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      lineHeight: 1.1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.1rem',
                      maxWidth: '100%'
                    }}
                  >
                    {nearMeLines.map((line, lineIndex) => (
                      <span key={`near-me-line-${lineIndex}`}>{line}</span>
                    ))}
                  </div>
                    {nearMeLabel && (
                      <div style={{
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        color: '#000',
                        textAlign: 'center',
                        direction: language === 'he' ? 'rtl' : 'ltr'
                      }}>
                        {nearMeLabel}
                      </div>
                    )}
                  </button>
                );
              }

              const count = getRegionCount(region.name);
              return (
                <button
                  key={index}
                  onClick={() => handleRegionClick(region.name)}
                  className="region-card"
                  style={{
                    aspectRatio: '1',
                    backgroundColor: region.color,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '1rem',
                    position: 'relative',
                    overflow: 'hidden',
                    fontFamily: 'var(--apple-font)'
                  }}
                >
                  <div style={{
                    fontSize: '1.75rem',
                    lineHeight: 1,
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
                  }}>
                    {region.icon}
                  </div>
                  <div style={{
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0,0,0,0.25)',
                    textAlign: 'center',
                    direction: language === 'he' ? 'rtl' : 'ltr',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.15
                  }}>
                    {getRegionName(region.name)}
                  </div>
                  {count > 0 && (
                    <span className="region-count-badge" style={{
                      position: 'absolute',
                      top: '0.5rem',
                      [language === 'he' ? 'right' : 'left']: '0.5rem'
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      <div className="bottom-nav">
        <button
          className="bottom-nav-item active"
          onClick={() => navigate('/', { state: { scrollToTop: true } })}
        >
          <span className="nav-icon">
            <IoHome size={26} />
          </span>
          <span>{t('nav.home')}</span>
        </button>
        <button
          className="bottom-nav-item"
          onClick={() => navigate('/map')}
        >
          <span className="nav-icon">
            <FaRegMap size={26} />
          </span>
          <span>{t('nav.map')}</span>
        </button>
        <button
          className="bottom-nav-item"
          onClick={() => navigate('/map', { state: { showListView: true } })}
        >
          <span className="nav-icon">
            <IoList size={26} />
          </span>
          <span>{t('nav.list')}</span>
        </button>
        {/* Search button — commented out (search is in map header)
        <button
          className="bottom-nav-item"
          onClick={() => navigate('/map', { state: { openSearch: true } })}
        >
          <span className="nav-icon">
            <IoSearch size={26} />
          </span>
          <span>{t('nav.search')}</span>
        </button>
        */}
        <button
          className="bottom-nav-item"
          onClick={() => navigate('/map', { state: { openAddPlace: true } })}
        >
          <span className="nav-icon">
            <IoAddCircle size={26} />
          </span>
          <span>{t('nav.addPlace')}</span>
        </button>
      </div>
    </div>
  );
};

export default RegionsPage;

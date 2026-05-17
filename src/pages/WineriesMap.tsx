import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { IoSearch, IoAdd, IoRemove, IoLocationOutline, IoCallOutline, IoGlobeOutline, IoCarOutline, IoMenu, IoSwapVertical, IoSunnyOutline, IoMoonOutline, IoBookmarkOutline, IoBookmark, IoTrashOutline, IoChevronDown, IoChevronUp, IoGiftOutline } from 'react-icons/io5';
import { FaChevronDown } from 'react-icons/fa';
import { FaLocationCrosshairs } from 'react-icons/fa6';
import { FaSliders } from 'react-icons/fa6';
import { useTheme } from '../contexts/ThemeContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import Logo from '../components/Logo';
import { AppBottomNav } from '../components/AppBottomNav';
import wineryMarkerIcon from '../assets/img/wineryMarker.png';
import { WineryFeature } from '../data/wineries';
import { fetchWineriesFromDb, fetchWineShopsFromDb } from '../data/wineries';
import { testConnection, supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useSavedPlaces } from '../contexts/SavedPlacesContext';
import { translateName, translateAddress, translateOffer } from '../utils/nameTranslations';
import { isCurrentlyOpen } from '../utils/openingHours';
import { WinePlaceListCard } from '../components/WinePlaceListCard';
import { parseOffer } from '../utils/wineListCardFormat';
import { formatPhoneForTel, normalizeUrl, openWazeNavigation } from '../utils/contactLinks';
import { haversineDistanceMeters } from '../utils/geo';

// Custom marker icon for wineries
const wineryIcon = L.icon({
  iconUrl: wineryMarkerIcon,
  iconSize: [28, 28], // Smaller
  iconAnchor: [14, 28], // Point of the icon which will correspond to marker's location
  popupAnchor: [0, -28] // Point from which the popup should open relative to the iconAnchor
});

// Wine shops: teardrop pin shape (matches winery marker silhouette), black + white cart
const SHOP_MARKER_INNER_HTML =
  '<svg class="wm-map-marker-shop__svg" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 34" preserveAspectRatio="xMidYMax meet" role="img" aria-hidden="true">' +
  '<path fill="#0a0a0a" d="M14 1.1C7.5 1.1 2.2 6.5 2.2 12.6c0 5.2 11.8 20.2 11.8 20.2s11.8-15 11.8-20.2C25.8 6.5 20.5 1.1 14 1.1z"/>' +
  '<g fill="none" stroke="#ffffff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" transform="translate(14 11) scale(0.46) translate(-12 -12)">' +
  '<path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3m3-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/>' +
  '</g></svg>';

const shopIcon = L.divIcon({
  className: 'wm-map-marker-shop',
  html: SHOP_MARKER_INNER_HTML,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

// Default marker icon setup for user location
const defaultIcon = L.icon({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

interface LocationState {
  userLocation?: {
    lat: number;
    lng: number;
  };
  shouldCenter?: boolean;
  selectedRegion?: string;
  searchTerm?: string;
  showListView?: boolean; // If true, show list view instead of map
  fromPullDown?: boolean;
  openSettings?: boolean;
  openSearch?: boolean;
  openAddPlace?: boolean;
  focusCoordinates?: { lat: number; lng: number };
  mapZoom?: number;
}

// Component to handle map center changes
const MapCenter = ({ center, zoom }: { center: [number, number]; zoom?: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom || 11);
  }, [center, zoom, map]);
  return null;
};

export const fetchWineries = async (): Promise<WineryFeature[]> => {
  try {
    const response = await fetch('/assets/data/wineries.geojson');
    const geojson = await response.json();
    return geojson.features as WineryFeature[];
  } catch (error) {
    console.error('Error loading wineries data:', error);
    return [];
  }
};

const WineriesMap: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { setThemeMode, isDark } = useTheme();
  const { isSaved, toggleSave } = useSavedPlaces();
  const { userLocation: locationStateUserLocation, shouldCenter, selectedRegion: initialRegion, showListView, searchTerm: searchTermFromState, fromPullDown, openSettings, openSearch, openAddPlace } = (location.state as LocationState) || {};
  const [activeFilter, setActiveFilter] = useState(() => t('filter.filter'));
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [listSortMode, setListSortMode] = useState<'distance' | 'name'>('distance');
  const [openFilter, setOpenFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [kosherFilter, setKosherFilter] = useState<'all' | 'kosher' | 'not_kosher'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showRegionFilter, setShowRegionFilter] = useState(false);
  const [showCityFilter, setShowCityFilter] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const closeFilterMenu = () => {
    setShowFilterMenu(false);
    setShowRegionFilter(false);
    setShowCityFilter(false);
    setShowSortMenu(false);
  };

  useEffect(() => {
    if (!showSortMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = sortMenuRef.current;
      if (el && !el.contains(e.target as Node)) setShowSortMenu(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [showSortMenu]);

  const toggleListOpeningHoursKey = (key: string) => {
    setExpandedListOpeningHoursKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  useEffect(() => {
    // Close any open popups/menus when navigating to another screen
    closeFilterMenu();
    setShowLanguageSelector(false);
    setShowSearchModal(false);
    setShowFeedbackModal(false);
    setSelectedOffer(null);
  }, [location.pathname]);
  
  // Initialize viewMode - show list if showListView is true, otherwise show map
  const [viewMode, setViewMode] = useState<'map' | 'list'>(() => {
    return showListView ? 'list' : 'map';
  });

  const handleMyLocationClick = () => {
    closeFilterMenu();
    setActiveFilter(t('filter.filter'));
    setListSortMode('distance');
    if (!navigator.geolocation || locationRequestRef.current) {
      return;
    }
    // Clear any previous city search so results reflect current location
    setIsSearchActive(false);
    setSearchResults([]);
    setSearchTerm('');
    setViewMode('map');
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
      return;
    }
    locationRequestRef.current = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(loc);
        localStorage.setItem('userLocation', JSON.stringify(loc));
        localStorage.setItem('userLocationTimestamp', Date.now().toString());
        setMapCenter([loc.lat, loc.lng]);
        locationRequestRef.current = false;
      },
      (error) => {
        locationRequestRef.current = false;
        if (error.code === error.PERMISSION_DENIED) {
          localStorage.removeItem('userLocation');
          localStorage.removeItem('userLocationTimestamp');
          const message =
            language === 'he'
              ? 'כדי להשתמש במיקום שלי יש לאשר הרשאת מיקום בדפדפן.'
              : 'Please allow location permission in your browser settings.';
          window.alert(message);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  useEffect(() => {
    if (openSettings) {
      closeFilterMenu();
      setShowLanguageSelector(true);
    }
  }, [openSettings]);
  useEffect(() => {
    if (openSearch) {
      closeFilterMenu();
      setShowSearchModal(true);
    }
  }, [openSearch]);
  useEffect(() => {
    if (openAddPlace) {
      closeFilterMenu();
      setShowFeedbackModal(true);
    }
  }, [openAddPlace]);
  const [wineries, setWineries] = useState<WineryFeature[]>([]);
  const [wineShops, setWineShops] = useState<WineryFeature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** After 5s, hide "no places in this region" when DB has zero rows for selected regions */
  const [suppressEmptyRegionDbNotice, setSuppressEmptyRegionDbNotice] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([31.7683, 35.2137]); // Default: Jerusalem
  const [mapNavZoom, setMapNavZoom] = useState<number | null>(null);

  const clearAllFilters = useCallback(() => {
    setSelectedRegions([]);
    setSelectedCities([]);
    setKosherFilter('all');
    setOpenFilter('all');
    setListSortMode('distance');
    setActiveFilter(t('filter.filter'));
    setMapCenter([31.7683, 35.2137]);
  }, [t]);

  const [selectedOffer, setSelectedOffer] = useState<{ name: string; description: string; wineryName: string } | null>(null);
  const [translatedOffers, setTranslatedOffers] = useState<Map<string, { name: string; description: string }>>(new Map());
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [renderKey, setRenderKey] = useState(0); // Force re-render when language changes
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<WineryFeature[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false); // Track if search is active
  const [timeKey, setTimeKey] = useState(0); // Force re-render to update open/closed status
  /** List cards: opening hours detail shown only after tapping the label */
  const [expandedListOpeningHoursKeys, setExpandedListOpeningHoursKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const locationRequestRef = useRef(false); // Prevent multiple simultaneous location requests
  const skipAutoCenterCountRef = useRef(0);
  const listViewRef = useRef<HTMLDivElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteBlurRef = useRef<number | null>(null);
  const [placeForm, setPlaceForm] = useState({
    type: 'winery',
    name: '',
    region: '',
    address: '',
    phone: '',
    website: '',
    openingHours: '',
    description: ''
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [regionSelect, setRegionSelect] = useState('');
  const wineShopIds = useMemo(() => {
    const ids = new Set<string>();
    wineShops.forEach((shop) => {
      const placeId = shop.properties.place_id || '';
      const name = shop.properties.name || '';
      if (placeId) ids.add(`id:${placeId}`);
      if (name) ids.add(`name:${name}`);
    });
    return ids;
  }, [wineShops]);

  const scrollListToTop = useCallback(() => {
    const el = listViewRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  /** List: jump to top when switching map ↔ list or wineries ↔ wine shops */
  useEffect(() => {
    if (viewMode !== 'list') return;
    let cancelled = false;
    const t1 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!cancelled) scrollListToTop();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(t1);
    };
  }, [viewMode, activeFilter, scrollListToTop]);

  
  
  // Zoom state for accessibility (elderly users)
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    const saved = localStorage.getItem('app_zoom');
    return saved ? parseFloat(saved) : 1.0; // Default 100%
  });
  
  // Persistent user location state - stored in localStorage and component state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(() => {
    // Try to get from localStorage first
    const stored = localStorage.getItem('userLocation');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  
  useEffect(() => {
    if (!userLocation && listSortMode === 'distance') {
      setListSortMode('name');
    }
  }, [userLocation, listSortMode]);

  // Force re-render when language changes
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [language]);
  
  // Translate all offers when language changes
  useEffect(() => {
    const translateAllOffers = () => {
      const allItems = [...wineries, ...wineShops];
      const newTranslatedOffers = new Map<string, { name: string; description: string }>();
      
      // Translate offers for all items (synchronous now)
      allItems
        .filter(item => item.properties.offers)
        .forEach((item) => {
          const offerKey = `${item.properties.place_id || item.properties.name || ''}-offer`;
          const parsed = parseOffer(item.properties.offers, t('list.offersAndDeals')); // Parse in Hebrew first
          
          const translatedName = translateOffer(parsed.name, language);
          const translatedDescription = translateOffer(parsed.description, language);
          newTranslatedOffers.set(offerKey, {
            name: translatedName,
            description: translatedDescription
          });
        });
      
      setTranslatedOffers(newTranslatedOffers);
    };
    
    if (wineries.length > 0 || wineShops.length > 0) {
      translateAllOffers();
    }
  }, [language, wineries, wineShops, t]);
  
  // Apply zoom level with proper viewport handling to prevent cutoff
  // Use transform scale for iOS compatibility (CSS zoom doesn't work on iOS Safari)
  useEffect(() => {
    const rootElement = document.getElementById('root');
    const bodyElement = document.body;
    const htmlElement = document.documentElement;
    
    if (rootElement && bodyElement && htmlElement) {
      // Detect if iOS (for zoom compatibility)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      if (isIOS) {
        // Use transform scale for iOS (more reliable than CSS zoom)
        rootElement.style.transform = `scale(${zoomLevel})`;
        rootElement.style.transformOrigin = 'top center';
        rootElement.style.width = `${100 / zoomLevel}%`;
        rootElement.style.height = `${100 / zoomLevel}%`;
      } else {
        // Use CSS zoom for Android and desktop (better performance)
        rootElement.style.zoom = zoomLevel.toString();
      }
      // Do not set body padding or overflow - it causes a growing gap at bottom in PWA when navigating to map
    }
    
    localStorage.setItem('app_zoom', zoomLevel.toString());
    
    // Cleanup on unmount
    return () => {
      if (rootElement) {
        rootElement.style.zoom = '';
        rootElement.style.transform = '';
        rootElement.style.transformOrigin = '';
        rootElement.style.width = '';
        rootElement.style.height = '';
      }
      if (bodyElement) {
        bodyElement.style.paddingBottom = '';
        bodyElement.style.overflowY = '';
      }
      if (htmlElement) {
        htmlElement.style.overflowY = '';
      }
    };
  }, [zoomLevel]);
  
  // Zoom control functions
  const increaseZoom = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 1.5)); // Max 150%
  };
  
  const decreaseZoom = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.8)); // Min 80%
  };
  
  const resetZoom = () => {
    setZoomLevel(1.0);
  };
  
  // Update open/closed status every minute based on device time
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeKey(prev => prev + 1); // Trigger re-render to refresh open/closed status
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);
  
  // Use timeKey to force re-evaluation of open/closed status (even if not directly used in JSX)
  // This ensures the status updates every minute
  useEffect(() => {
    // This effect runs when timeKey changes, ensuring open/closed status is recalculated
    void timeKey; // Acknowledge the variable to avoid unused warning
  }, [timeKey]);
  
  // Region center coordinates
  const regionCenters: Record<string, [number, number]> = {
    'רמת הגולן': [32.8, 35.7], // Golan Heights
    'גליל': [32.9, 35.5], // Galilee
    'שומרון': [32.2, 35.2], // Shomron
    'הרי יהודה': [31.7, 35.1], // Judean Hills
    'ירושלים': [31.7683, 35.2137], // Jerusalem
    'שרון': [32.3, 34.85], // Sharon
    'מרכז': [32.0853, 34.7818], // Central (Tel Aviv)
    'נגב': [31.25, 34.8], // Negev (Beer Sheva)
    'צפון': [32.8, 35.0], // North (Haifa)
    'כרמל': [32.79, 34.99], // Mount Carmel / Haifa area
    'דרום': [31.0, 34.75] // South (Ashkelon/Eilat area)
  };

  // Open map centered on a saved place (or deep link)
  useEffect(() => {
    const st = location.state as LocationState | null;
    if (!st?.focusCoordinates) return;
    skipAutoCenterCountRef.current = 2;
    const { lat, lng } = st.focusCoordinates;
    const zoom = st.mapZoom ?? 14;
    setMapCenter([lat, lng]);
    setViewMode('map');
    setMapNavZoom(zoom);
    const { focusCoordinates: _fc, mapZoom: _mz, ...rest } = st;
    const nextEntries = Object.entries(rest).filter(([, v]) => v !== undefined);
    const nextState = nextEntries.length > 0 ? (Object.fromEntries(nextEntries) as LocationState) : undefined;
    navigate(location.pathname, { replace: true, state: nextState });
    const timer = window.setTimeout(() => setMapNavZoom(null), 2500);
    return () => clearTimeout(timer);
  }, [location.key, location.pathname, navigate]);
  
  // Update map center when regions are selected
  useEffect(() => {
    if (skipAutoCenterCountRef.current > 0) {
      skipAutoCenterCountRef.current -= 1;
      return;
    }
    if (isSearchActive && searchResults.length > 0) {
      return;
    }
    if (selectedRegions.length === 1 && regionCenters[selectedRegions[0]]) {
      // If only one region selected, center on it
      setMapCenter(regionCenters[selectedRegions[0]]);
    } else if (userLocation && (shouldCenter ?? true)) {
      setMapCenter([userLocation.lat, userLocation.lng]);
    } else if (selectedRegions.length === 0) {
      // Reset to default (Jerusalem) when no regions selected
      setMapCenter([31.7683, 35.2137]);
    }
    // If multiple regions selected, keep current center or use default
  }, [selectedRegions, userLocation, shouldCenter, isSearchActive, searchResults.length]);
  
  // Initialize region from navigation state — neutral type filter + distance sort
  useEffect(() => {
    if (initialRegion) {
      setSelectedRegions([initialRegion]);
      setActiveFilter(t('filter.filter'));
      setListSortMode('distance');
    }
  }, [initialRegion, t]);

  // Get user location on mount if permission was previously granted
  useEffect(() => {
    // If user location comes from navigation state, save it
    if (locationStateUserLocation) {
      setUserLocation(locationStateUserLocation);
      localStorage.setItem('userLocation', JSON.stringify(locationStateUserLocation));
      localStorage.setItem('userLocationTimestamp', Date.now().toString());
      setActiveFilter(t('filter.filter'));
      setListSortMode('distance');
      return; // Don't request location if we already have it from navigation
    }

    // Don't request if we already have a location or if a request is in progress
    if (userLocation || locationRequestRef.current || !navigator.geolocation) {
      return;
    }

    // Check for cached location first
    const cachedLocation = localStorage.getItem('userLocation');
    const locationAge = localStorage.getItem('userLocationTimestamp');
    
    if (cachedLocation && locationAge) {
      try {
        const loc = JSON.parse(cachedLocation);
        const age = Date.now() - parseInt(locationAge, 10);
        if (age < 300000) { // Less than 5 minutes old
          setUserLocation(loc);
          return; // Use cached location
        }
      } catch (e) {
        // Invalid cached location, continue with fresh request
      }
    }

    // Only request location if we don't have it and haven't requested it yet
    locationRequestRef.current = true;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(loc);
        localStorage.setItem('userLocation', JSON.stringify(loc));
        localStorage.setItem('userLocationTimestamp', Date.now().toString());
        locationRequestRef.current = false;
      },
      (error) => {
        // Permission denied or error - that's okay, we'll just not show distance
        console.log('Location not available:', error.message);
        locationRequestRef.current = false;
        // Don't retry if permission was denied
        if (error.code === error.PERMISSION_DENIED) {
          // Clear any cached location if permission was denied
          localStorage.removeItem('userLocation');
          localStorage.removeItem('userLocationTimestamp');
        }
      },
      {
        enableHighAccuracy: true, // Better accuracy for mobile
        timeout: 10000, // 10 second timeout for mobile (longer than desktop)
        maximumAge: 300000 // Accept cached location up to 5 minutes old
      }
    );
  }, [locationStateUserLocation, userLocation, t]); // Include userLocation to prevent re-requesting

  // Initial center based on user location
  useEffect(() => {
    if (skipAutoCenterCountRef.current > 0) {
      skipAutoCenterCountRef.current -= 1;
      return;
    }
    if (userLocation && (shouldCenter ?? true)) {
      setMapCenter([userLocation.lat, userLocation.lng]);
    }
  }, [userLocation, shouldCenter]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // First test the connection
        console.log('Testing database connection...');
        const isConnected = await testConnection();
        
        if (!isConnected) {
          throw new Error('Failed to connect to the database. Please check your internet connection and try again.');
        }

        console.log('Starting to fetch data from Supabase...');
        const [wineriesGeojson, wineShopsGeojson] = await Promise.all([
          fetchWineriesFromDb(),
          fetchWineShopsFromDb()
        ]);
        
        console.log('Wineries data received:', wineriesGeojson);
        console.log('Wine shops data received:', wineShopsGeojson);
        
        // Log unique regions found in data
        const wineryRegions = [...new Set(wineriesGeojson.features.map(f => f.properties.region).filter(Boolean))];
        const shopRegions = [...new Set(wineShopsGeojson.features.map(f => f.properties.region).filter(Boolean))];
        console.log('Unique winery regions:', wineryRegions);
        console.log('Unique wine shop regions:', shopRegions);
        
        setWineries(wineriesGeojson.features);
        setWineShops(wineShopsGeojson.features);
      } catch (error) {
        console.error('Error loading data:', error);
        if (error instanceof Error) {
          setError(error.message);
          console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
          });
        } else {
          setError('An unexpected error occurred while loading the data');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
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
      return region[language];
    }
    return regionKey;
  };

  const WM_RED = '#E30613';
  /** Nav + search + chips + small gap — list / floating controls start below this */
  const MAP_HEADER_STACK_OFFSET_PX = 198;
  const listIconColor = isDark ? '#b0b0b0' : '#8A8A8E';

  const isItemKosher = (item: WineryFeature) => {
    const kosherValue = item.properties.kosher;
    if (kosherValue === true) return true;
    if (kosherValue !== null && kosherValue !== undefined) {
      const strValue = String(kosherValue).toLowerCase().trim();
      if (strValue === 'true' || strValue === '1') return true;
    }
    return false;
  };

  const isItemOpenNow = (item: WineryFeature) => {
    if (!item.properties.opening_hours) return false;
    return isCurrentlyOpen(item.properties.opening_hours);
  };

  const isWineShopItem = (item: WineryFeature) => {
    const placeId = item.properties.place_id || '';
    const name = item.properties.name || '';
    if (placeId && wineShopIds.has(`id:${placeId}`)) return true;
    if (name && wineShopIds.has(`name:${name}`)) return true;
    return false;
  };

  const regions = Object.keys(regionMap);

  const regionHasNoPlacesInDb = useMemo(() => {
    if (isLoading || selectedRegions.length === 0) return false;
    const inRegionW = wineries.filter(
      (w) => w.properties.region && selectedRegions.includes(w.properties.region)
    );
    const inRegionS = wineShops.filter(
      (s) => s.properties.region && selectedRegions.includes(s.properties.region)
    );
    return inRegionW.length + inRegionS.length === 0;
  }, [isLoading, selectedRegions, wineries, wineShops]);

  useEffect(() => {
    if (!regionHasNoPlacesInDb) {
      setSuppressEmptyRegionDbNotice(false);
      return;
    }
    setSuppressEmptyRegionDbNotice(false);
    const id = window.setTimeout(() => setSuppressEmptyRegionDbNotice(true), 5000);
    return () => clearTimeout(id);
  }, [regionHasNoPlacesInDb, selectedRegions]);

  // Get filtered items for list view
  const getFilteredItems = (): WineryFeature[] => {
    // If search is active, return search results
    if (isSearchActive && searchResults.length > 0) {
      const sorted = [...searchResults];
      if (listSortMode === 'name') {
        sorted.sort((a, b) => {
          const na = translateName(a.properties.name || '', language) || a.properties.name || '';
          const nb = translateName(b.properties.name || '', language) || b.properties.name || '';
          return na.localeCompare(nb, 'he');
        });
        return sorted;
      }
      if (userLocation) {
        sorted.sort((a, b) => {
          const distA = haversineDistanceMeters(
            userLocation.lat,
            userLocation.lng,
            a.geometry.coordinates[1],
            a.geometry.coordinates[0]
          );
          const distB = haversineDistanceMeters(
            userLocation.lat,
            userLocation.lng,
            b.geometry.coordinates[1],
            b.geometry.coordinates[0]
          );
          return distA - distB;
        });
        return sorted;
      }
      sorted.sort((a, b) => {
        const na = translateName(a.properties.name || '', language) || a.properties.name || '';
        const nb = translateName(b.properties.name || '', language) || b.properties.name || '';
        return na.localeCompare(nb, 'he');
      });
      return sorted;
    }
    
    let items: WineryFeature[] = [];
    
          // Add wineries if not filtered to wine shops only
          if (activeFilter !== t('filter.wineShops')) {
            items = [...items, ...wineries];
          }

          // Add wine shops if not filtered to wineries only
          if (activeFilter !== t('filter.wineries')) {
            items = [...items, ...wineShops];
          }
    
    // Filter by regions if selected
    if (selectedRegions.length > 0) {
      items = items.filter(item => item.properties.region && selectedRegions.includes(item.properties.region));
    }

    // Filter by cities if selected (match address text)
    if (selectedCities.length > 0) {
      items = items.filter(item => {
        const address = (item.properties.address || '').toLowerCase();
        return selectedCities.some((city) => address.includes(city.toLowerCase()));
      });
    }

    // Filter by kosher status
    if (kosherFilter !== 'all') {
      items = items.filter(item => kosherFilter === 'kosher' ? isItemKosher(item) : !isItemKosher(item));
    }

    // Filter by open status
    if (openFilter !== 'all') {
      items = items.filter(item => openFilter === 'open' ? isItemOpenNow(item) : !isItemOpenNow(item));
    }
    
    if (listSortMode === 'name') {
      items = [...items].sort((a, b) => {
        const na = translateName(a.properties.name || '', language) || a.properties.name || '';
        const nb = translateName(b.properties.name || '', language) || b.properties.name || '';
        return na.localeCompare(nb, 'he');
      });
    } else if (userLocation) {
      items = [...items].sort((a, b) => {
        const distA = haversineDistanceMeters(
          userLocation.lat,
          userLocation.lng,
          a.geometry.coordinates[1],
          a.geometry.coordinates[0]
        );
        const distB = haversineDistanceMeters(
          userLocation.lat,
          userLocation.lng,
          b.geometry.coordinates[1],
          b.geometry.coordinates[0]
        );
        return distA - distB;
      });
    } else {
      items = [...items].sort((a, b) => {
        const na = translateName(a.properties.name || '', language) || a.properties.name || '';
        const nb = translateName(b.properties.name || '', language) || b.properties.name || '';
        return na.localeCompare(nb, 'he');
      });
    }
    
    return items;
  };

  const performSearch = (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      setIsSearchActive(false);
      return;
    }

    // Reset filters so search shows both shops and wineries in the city
    setSelectedRegions([]);
    setActiveFilter(t('filter.filter'));

    const searchLower = term.toLowerCase().trim();
    const allItems = [...wineries, ...wineShops];
    
    const results = allItems.filter(item => {
      const name = (translateName(item.properties.name || '', language) || item.properties.name || '').toLowerCase();
      const address = translateAddress(item.properties.address || '', language).toLowerCase();
      const region = getRegionName(item.properties.region || '').toLowerCase();
      
      // Search in name, address, and region
      // Also check if search term matches any part of the address (for city searches)
      return name.includes(searchLower) || 
             address.includes(searchLower) || 
             region.includes(searchLower) ||
             (item.properties.address || '').toLowerCase().includes(searchLower);
    });

    setSearchResults(results);
    setIsSearchActive(true);
    if (viewMode === 'list') {
      listViewRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (results.length > 0) {
      const avgLat = results.reduce((sum, item) => sum + item.geometry.coordinates[1], 0) / results.length;
      const avgLng = results.reduce((sum, item) => sum + item.geometry.coordinates[0], 0) / results.length;
      setMapCenter([avgLat, avgLng]);
    }
    // Keep current view: map stays map with focus, list stays list
  };

  // Handle search submission (Enter key or search button)
  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      performSearch(searchTerm);
      setSearchTerm('');
      setShowSearchModal(false);
      setShowAutocomplete(false);
    }
  };

  // Close autocomplete on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear blur timeout on unmount
  useEffect(() => {
    return () => {
      if (autocompleteBlurRef.current) window.clearTimeout(autocompleteBlurRef.current);
    };
  }, []);

  // Autocomplete suggestions from place names and regions
  const autocompleteSuggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    const all = [...wineries, ...wineShops];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of all) {
      const name = translateName(item.properties.name || '', language) || item.properties.name || '';
      const region = getRegionName(item.properties.region || '');
      for (const s of [name, region].filter(Boolean)) {
        const lower = s.toLowerCase();
        if (lower.includes(term) && !seen.has(lower)) {
          seen.add(lower);
          out.push(s);
          if (out.length >= 10) return out;
        }
      }
    }
    return out;
  }, [searchTerm, wineries, wineShops, language]);

  // Handle search from navigation state (e.g. from home page)
  useEffect(() => {
    if (searchTermFromState) {
      setSearchTerm(searchTermFromState);
      setSelectedRegions([]);
      setActiveFilter(t('filter.filter'));
      const searchLower = searchTermFromState.toLowerCase().trim();
      const allItems = [...wineries, ...wineShops];

      const results = allItems.filter(item => {
        const name = (translateName(item.properties.name || '', language) || item.properties.name || '').toLowerCase();
        const address = translateAddress(item.properties.address || '', language).toLowerCase();
        const region = getRegionName(item.properties.region || '').toLowerCase();
        return name.includes(searchLower) ||
               address.includes(searchLower) ||
               region.includes(searchLower) ||
               (item.properties.address || '').toLowerCase().includes(searchLower);
      });

      setSearchResults(results);
      setIsSearchActive(true);
      if (viewMode === 'list') {
        listViewRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (results.length > 0) {
        const avgLat = results.reduce((sum, item) => sum + item.geometry.coordinates[1], 0) / results.length;
        const avgLng = results.reduce((sum, item) => sum + item.geometry.coordinates[0], 0) / results.length;
        setMapCenter([avgLat, avgLng]);
      }
    }
  }, [searchTermFromState, wineries, wineShops, language]);

  const regionOptions = [
    'רמת הגולן',
    'גליל',
    'שומרון',
    'הרי יהודה',
    'ירושלים',
    'שרון',
    'מרכז',
    'נגב',
    'צפון',
    'כרמל',
    'דרום'
  ];

  const cityOptions = [
    'חיפה',
    'קריית גת',
    'נתניה',
    'כפר סבא',
    'רעננה',
    'הרצליה',
    'פתח תקווה',
    'רמת גן',
    'גבעתיים',
    'תל אביב',
    'חולון',
    'בת ים',
    'ראשון לציון',
    'רחובות',
    'ירושלים',
    'אשדוד',
    'אשקלון',
    'באר שבע',
    'מודיעין',
    'אילת'
  ];

  const filterRegionSummary =
    selectedRegions.length === 0
      ? t('filter.allRegions')
      : selectedRegions.length === 1
        ? getRegionName(selectedRegions[0])
        : `${getRegionName(selectedRegions[0])} +${selectedRegions.length - 1}`;

  const filterCitySummary =
    selectedCities.length === 0
      ? t('filter.allCities')
      : selectedCities.length === 1
        ? selectedCities[0]
        : `${selectedCities[0]} +${selectedCities.length - 1}`;

  const buildPlaceMessage = () => {
    const lines = [
      `סוג: ${placeForm.type === 'winery' ? 'יקב' : 'חנות יין'}`,
      `שם: ${placeForm.name}`,
      `אזור: ${placeForm.region}`
    ];
    if (placeForm.address) lines.push(`כתובת: ${placeForm.address}`);
    if (placeForm.phone) lines.push(`טלפון: ${placeForm.phone}`);
    if (placeForm.website) lines.push(`אתר: ${placeForm.website}`);
    if (placeForm.openingHours) lines.push(`שעות פתיחה: ${placeForm.openingHours}`);
    if (placeForm.description) lines.push(`תיאור: ${placeForm.description}`);
    return lines.join('\n');
  };

  return (
      <div className="map-view">
        <div className="top-nav">
        <div className="top-nav-group left">
          <button 
            type="button"
            className="nav-icon wm-top-icon"
            aria-label={t('settings.title')}
            onClick={() => {
              closeFilterMenu();
              setShowLanguageSelector(true);
            }}
          >
            <IoMenu size={26} color={isDark ? '#f2f2f2' : '#000'} />
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

        <div className="top-nav-group right" aria-hidden="true" />
      </div>

      {/* Search box under header — icon left, autocomplete */}
      <div
        ref={searchBoxRef}
        style={{
          padding: '0.65rem 1rem 0.55rem',
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          position: 'relative',
          zIndex: 100
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
            borderRadius: '22px',
            border: `1px solid ${isDark ? '#444' : '#e0e0e0'}`,
            paddingLeft: '1rem',
            paddingRight: '1rem',
            paddingTop: '0.7rem',
            paddingBottom: '0.7rem',
            direction: 'rtl',
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <IoSearch
            size={22}
            style={{ color: isDark ? '#888' : '#8a8a8a', flexShrink: 0 }}
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
              if (e.key === 'Enter') {
                handleSearchSubmit();
              }
            }}
            placeholder={t('search.placeholderDesign')}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              fontSize: '1rem',
              backgroundColor: 'transparent',
              color: isDark ? '#f5f5f5' : '#1d1d1f',
              direction: 'rtl',
              textAlign: 'right'
            }}
          />
        </div>
        {showAutocomplete && autocompleteSuggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              left: '1rem',
              right: '1rem',
              top: '100%',
              marginTop: '2px',
              backgroundColor: isDark ? '#2a2a2a' : '#fff',
              border: `1px solid ${isDark ? '#444' : '#e0e0e0'}`,
              borderRadius: '25px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              maxHeight: '240px',
              overflowY: 'auto',
              zIndex: 1100,
              direction: 'rtl'
            }}
          >
            {autocompleteSuggestions.map((suggestion, i) => (
              <button
                key={`${suggestion}-${i}`}
                type="button"
                onClick={() => {
                  performSearch(suggestion);
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

      {isSearchActive && searchTerm && !isLoading && searchResults.length === 0 && (
        <div
          style={{
            position: 'fixed',
            top: '86px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1500,
            backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
            color: isDark ? '#f5f5f5' : '#333',
            border: `1px solid ${isDark ? '#444' : '#e0e0e0'}`,
            borderRadius: '12px',
            padding: '0.5rem 0.9rem',
            boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
            fontSize: '0.9rem',
            fontWeight: 600,
            maxWidth: '85%',
            textAlign: 'center'
          }}
        >
          {t('list.noResults')}
        </div>
      )}

      {fromPullDown && (
        <button
          onClick={() => navigate('/', { state: { scrollToTop: true } })}
          aria-label="חזרה לרשימת האזורים"
          title="חזרה לרשימת האזורים"
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '16px',
            zIndex: 1200,
            border: 'none',
            backgroundColor: isDark ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.9)',
            color: isDark ? '#fff' : '#333',
            borderRadius: '999px',
            padding: '0.3rem 0.6rem',
            boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem'
          }}
        >
          <FaChevronDown size={20} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>חזרה לרשימת האזורים</span>
        </button>
      )}

      {showFilterMenu && (
        <>
          <div
            className="wm-filter-modal__backdrop"
            role="button"
            tabIndex={0}
            onClick={closeFilterMenu}
            onKeyDown={(e) => e.key === 'Escape' && closeFilterMenu()}
            aria-label={t('filter.close')}
          />
          <button
            type="button"
            className="wm-filter-modal__fab-close"
            onClick={closeFilterMenu}
            aria-label={t('filter.close')}
          >
            ✕
          </button>
          <div
            className={`wm-filter-modal__sheet${isDark ? ' wm-filter-modal__sheet--dark' : ''}`}
            dir="rtl"
            lang="he"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="wm-filter-modal__clear-all"
              onClick={clearAllFilters}
            >
              <IoTrashOutline size={18} aria-hidden />
              <span>{t('filter.clearAll')}</span>
            </button>

            <div className="wm-filter-acc">
              <button
                type="button"
                className="wm-filter-acc__trigger"
                onClick={() => setShowRegionFilter(!showRegionFilter)}
                aria-expanded={showRegionFilter}
              >
                <div className="wm-filter-acc__trigger-main">
                  <span className="wm-filter-acc__title">{t('filter.byRegion')}</span>
                  <span className="wm-filter-acc__value">{filterRegionSummary}</span>
                </div>
                <span className="wm-filter-acc__chevron" aria-hidden>
                  {showRegionFilter ? <IoChevronUp size={20} /> : <IoChevronDown size={20} />}
                </span>
              </button>
              {showRegionFilter && (
                <div className="wm-filter-acc__panel">
                  <div className="wm-filter-pill-grid">
                    <button
                      type="button"
                      className={`wm-filter-pill${selectedRegions.length === 0 ? ' wm-filter-pill--on' : ' wm-filter-pill--off'}`}
                      onClick={() => {
                        setSelectedRegions([]);
                        setMapCenter([31.7683, 35.2137]);
                      }}
                    >
                      {t('filter.allRegions')}
                    </button>
                    {regions.map((region) => {
                      const isSelected = selectedRegions.includes(region);
                      return (
                        <button
                          type="button"
                          key={region}
                          className={`wm-filter-pill${isSelected ? ' wm-filter-pill--on' : ' wm-filter-pill--off'}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedRegions(selectedRegions.filter((r) => r !== region));
                            } else {
                              setSelectedRegions([...selectedRegions, region]);
                            }
                          }}
                        >
                          {isSelected ? <span className="wm-filter-pill__check">✓ </span> : null}
                          {getRegionName(region)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="wm-filter-acc">
              <button
                type="button"
                className="wm-filter-acc__trigger"
                onClick={() => setShowCityFilter(!showCityFilter)}
                aria-expanded={showCityFilter}
              >
                <div className="wm-filter-acc__trigger-main">
                  <span className="wm-filter-acc__title">{t('filter.byCity')}</span>
                  <span className="wm-filter-acc__value">{filterCitySummary}</span>
                </div>
                <span className="wm-filter-acc__chevron" aria-hidden>
                  {showCityFilter ? <IoChevronUp size={20} /> : <IoChevronDown size={20} />}
                </span>
              </button>
              {showCityFilter && (
                <div className="wm-filter-acc__panel">
                  <div className="wm-filter-pill-grid wm-filter-pill-grid--cities">
                    <button
                      type="button"
                      className={`wm-filter-pill${selectedCities.length === 0 ? ' wm-filter-pill--on' : ' wm-filter-pill--off'}`}
                      onClick={() => setSelectedCities([])}
                    >
                      {t('filter.allCities')}
                    </button>
                    {cityOptions.map((city) => {
                      const isSelected = selectedCities.includes(city);
                      return (
                        <button
                          type="button"
                          key={city}
                          className={`wm-filter-pill${isSelected ? ' wm-filter-pill--on' : ' wm-filter-pill--off'}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCities(selectedCities.filter((c) => c !== city));
                            } else {
                              setSelectedCities([...selectedCities, city]);
                            }
                          }}
                        >
                          {isSelected ? <span className="wm-filter-pill__check">✓ </span> : null}
                          {city}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="wm-filter-block">
              <div className="wm-filter-block__label">{t('filter.kosher')}</div>
              <div className="wm-filter-block__row">
                {[
                  { value: 'all' as const, label: t('filter.all') },
                  { value: 'kosher' as const, label: t('filter.kosherOnly') },
                  { value: 'not_kosher' as const, label: t('filter.notKosher') },
                ].map((option) => {
                  const isSelected = kosherFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`wm-filter-seg${isSelected ? ' wm-filter-seg--on' : ' wm-filter-seg--off'}`}
                      onClick={() => setKosherFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="wm-filter-block">
              <div className="wm-filter-block__label">{t('filter.openNow')}</div>
              <div className="wm-filter-block__row">
                {[
                  { value: 'all' as const, label: t('filter.all') },
                  { value: 'open' as const, label: t('filter.openOnly') },
                  { value: 'closed' as const, label: t('filter.closedOnly') },
                ].map((option) => {
                  const isSelected = openFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`wm-filter-seg${isSelected ? ' wm-filter-seg--on' : ' wm-filter-seg--off'}`}
                      onClick={() => setOpenFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="wm-filter-block">
              <div className="wm-filter-block__label">{t('filter.sortBy')}</div>
              <div className="wm-filter-block__row wm-filter-block__row--tight">
                {[
                  { value: 'distance' as const, label: t('filter.sortDistance') },
                  { value: 'name' as const, label: t('filter.sortName') },
                ].map((option) => {
                  const isSelected = listSortMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`wm-filter-seg${isSelected ? ' wm-filter-seg--on' : ' wm-filter-seg--off'}`}
                      onClick={() => setListSortMode(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}


      <div
        className="filter-bar wm-filter-bar"
        dir="rtl"
        lang="he"
      >
        {/* RTL: all chips in one flex row; wrap on narrow viewports so nothing clips */}
        <div className="wm-filter-bar-scroll" dir="rtl">
          <button
            type="button"
            dir="rtl"
            lang="he"
            className="wm-filter-chip"
            aria-label={t('filter.filter')}
            title={t('filter.filter')}
            onClick={() => {
              if (showFilterMenu) closeFilterMenu();
              else setShowFilterMenu(true);
            }}
          >
            <FaSliders size={17} aria-hidden />
          </button>
          <button
            type="button"
            dir="rtl"
            lang="he"
            className={`wm-filter-chip ${activeFilter === t('filter.wineries') ? 'wm-filter-chip--active-winery' : ''}`}
            onClick={() => {
              if (activeFilter === t('filter.wineries')) {
                setActiveFilter(t('filter.filter'));
              } else {
                setActiveFilter(t('filter.wineries'));
              }
            }}
          >
            {t('filter.wineries')}
          </button>
          <button
            type="button"
            dir="rtl"
            lang="he"
            className={`wm-filter-chip ${activeFilter === t('filter.wineShops') ? 'wm-filter-chip--active-wine' : ''}`}
            onClick={() => {
              if (activeFilter === t('filter.wineShops')) {
                setActiveFilter(t('filter.filter'));
              } else {
                setActiveFilter(t('filter.wineShops'));
              }
            }}
          >
            {t('filter.wineShops')}
          </button>
          <div className="wm-sort-menu-wrap" ref={sortMenuRef} dir="rtl" lang="he">
            <button
              type="button"
              dir="rtl"
              lang="he"
              className={`wm-filter-chip${showSortMenu ? ' wm-filter-chip--sort-on' : ''}`}
              aria-expanded={showSortMenu}
              aria-haspopup="menu"
              onClick={() => setShowSortMenu((o) => !o)}
            >
              <IoSwapVertical size={17} aria-hidden />
              {listSortMode === 'distance' ? t('filter.sortDistanceShort') : t('filter.sortName')}
              <FaChevronDown size={11} aria-hidden style={{ opacity: 0.55 }} />
            </button>
            {showSortMenu ? (
              <div className="wm-sort-menu" role="menu" dir="rtl" lang="he">
                <button
                  type="button"
                  role="menuitem"
                  dir="rtl"
                  lang="he"
                  className={`wm-sort-menu__btn${listSortMode === 'distance' ? ' wm-sort-menu__btn--active' : ''}`}
                  disabled={!userLocation}
                  title={!userLocation ? t('filter.sortDistanceNeedLocation') : undefined}
                  onClick={() => {
                    if (userLocation) {
                      setListSortMode('distance');
                      setShowSortMenu(false);
                    }
                  }}
                >
                  {t('filter.sortDistance')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  dir="rtl"
                  lang="he"
                  className={`wm-sort-menu__btn${listSortMode === 'name' ? ' wm-sort-menu__btn--active' : ''}`}
                  onClick={() => {
                    setListSortMode('name');
                    setShowSortMenu(false);
                  }}
                >
                  {t('filter.sortName')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Map View */}
      {viewMode === 'map' && (
      <div className="map-container">
        <button
          onClick={handleMyLocationClick}
          aria-label={t('nav.myLocation')}
          title={t('nav.myLocation')}
          style={{
            position: 'absolute',
            left: '12px',
            top: `${MAP_HEADER_STACK_OFFSET_PX}px`,
            zIndex: 1000,
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: `1px solid ${isDark ? '#444' : '#ddd'}`,
            backgroundColor: isDark ? '#2a2a2a' : '#fff',
            color: isDark ? '#f0f0f0' : '#333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            cursor: 'pointer'
          }}
        >
          <FaLocationCrosshairs size={22} />
        </button>
        <MapContainer
            center={mapCenter}
            zoom={selectedRegions.length > 0 ? 10 : 11}
          style={{ height: '100%', width: '100%' }}
            key={`${mapCenter[0]}-${mapCenter[1]}-light`}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            key="light"
          />
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]}>
              <Popup>
                          {t('map.youAreHere')}
              </Popup>
            </Marker>
          )}
          {activeFilter !== t('filter.wineShops') && (isSearchActive ? searchResults.filter(item => !isWineShopItem(item)) : wineries)
            .filter(winery => {
              // If regions are selected, only show wineries in those regions
              if (selectedRegions.length > 0 && (!winery.properties.region || !selectedRegions.includes(winery.properties.region))) {
                return false;
              }
              if (kosherFilter !== 'all') {
                const kosher = isItemKosher(winery);
                if (kosherFilter === 'kosher' && !kosher) return false;
                if (kosherFilter === 'not_kosher' && kosher) return false;
              }
              if (openFilter !== 'all') {
                const openNow = isItemOpenNow(winery);
                if (openFilter === 'open' && !openNow) return false;
                if (openFilter === 'closed' && openNow) return false;
              }
              return true;
            })
            .map((winery, index) => (
            <Marker
              key={`winery-${index}-${language}-${renderKey}`}
              position={[winery.geometry.coordinates[1], winery.geometry.coordinates[0]]}
              icon={wineryIcon}
            >
              <Popup>
                <div
                  className={`wm-map-popup${isDark ? ' wm-map-popup--dark' : ''}`}
                  style={{ direction: 'rtl' }}
                >
                  <div className="wm-map-popup__row">
                    <div className="wm-map-popup__body">
                      <div className="wm-map-popup__title-row">
                        <h3 className="wm-map-popup__title">
                          {(() => {
                            const translated = translateName(winery.properties.name || '', language);
                            return translated || 'יקב';
                          })()}
                        </h3>
                        <button
                          type="button"
                          className="wm-map-popup__bookmark"
                          title={isSaved(winery, false) ? t('saved.remove') : t('saved.save')}
                          aria-label={isSaved(winery, false) ? t('saved.remove') : t('saved.save')}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSave(winery, false);
                          }}
                        >
                          {isSaved(winery, false) ? <IoBookmark size={22} /> : <IoBookmarkOutline size={22} />}
                        </button>
                      </div>
                      {winery.properties.address ? (
                        <p className="wm-map-popup__address">
                          <IoLocationOutline size={17} color={listIconColor} aria-hidden />
                          <span>{translateAddress(winery.properties.address, language)}</span>
                        </p>
                      ) : null}
                      {winery.properties.opening_hours && !winery.properties.offers ? (
                        (() => {
                          const isOpen = isCurrentlyOpen(winery.properties.opening_hours);
                          return (
                            <p
                              key={`winery-status-${winery.properties.place_id || winery.properties.name}-${timeKey}`}
                              className={`wm-map-popup__status${isOpen ? ' wm-map-popup__status--open' : ' wm-map-popup__status--closed'}`}
                            >
                              <span className="wm-map-popup__status-dot" aria-hidden />
                              {isOpen ? t('list.openNow') : t('list.closed')}
                            </p>
                          );
                        })()
                      ) : null}
                      {winery.properties.offers ? (
                        (() => {
                          const offerKey = `${winery.properties.place_id || winery.properties.name || ''}-winery`;
                          const translated = translatedOffers.get(offerKey);
                          const parsed = parseOffer(winery.properties.offers, t('list.offersAndDeals'));
                          const offerName = translated?.name || parsed.name;
                          const offerDescription = translated?.description || parsed.description;
                          const rawLine = (offerDescription || offerName || '').trim();
                          const line = translateOffer(rawLine, language);
                          const short =
                            line.length > 96 ? `${line.slice(0, 93).trim()}…` : line;
                          return (
                            <button
                              type="button"
                              className="wm-map-popup__offer"
                              onClick={() =>
                                setSelectedOffer({
                                  name: offerName,
                                  description: offerDescription,
                                  wineryName: translateName(winery.properties.name || '', language) || 'יקב',
                                })
                              }
                            >
                              <IoGiftOutline size={18} className="wm-map-popup__offer-gift" aria-hidden />
                              <span className="wm-map-popup__offer-text">{short || t('list.offersAndDeals')}</span>
                            </button>
                          );
                        })()
                      ) : null}
                    </div>
                    {winery.properties.logo_url ? (
                      <img
                        className="wm-map-popup__logo"
                        src={winery.properties.logo_url}
                        alt=""
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="wm-map-popup__actions">
                    {winery.properties.phone ? (
                      <a
                        className="wm-map-popup__action"
                        href={`tel:${formatPhoneForTel(winery.properties.phone)}`}
                        aria-label={t('list.callAction')}
                      >
                        <IoCallOutline size={20} color={listIconColor} />
                        <span>{t('list.callAction')}</span>
                      </a>
                    ) : (
                      <div className="wm-map-popup__action wm-map-popup__action--disabled" aria-hidden="true">
                        <IoCallOutline size={20} color={listIconColor} />
                        <span>{t('list.callAction')}</span>
                      </div>
                    )}
                    <div className="wm-map-popup__action-split" />
                    <button
                      type="button"
                      className="wm-map-popup__action wm-map-popup__action--btn"
                      onClick={() =>
                        openWazeNavigation(
                          winery.geometry.coordinates[1],
                          winery.geometry.coordinates[0]
                        )
                      }
                    >
                      <IoCarOutline size={20} color={listIconColor} />
                      <span>{t('list.goThere')}</span>
                    </button>
                    <div className="wm-map-popup__action-split" />
                    {winery.properties.website ? (
                      <a
                        className="wm-map-popup__action"
                        href={normalizeUrl(winery.properties.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('map.website')}
                      >
                        <IoGlobeOutline size={20} color={listIconColor} />
                        <span>{t('map.website')}</span>
                      </a>
                    ) : (
                      <div className="wm-map-popup__action wm-map-popup__action--disabled" aria-hidden="true">
                        <IoGlobeOutline size={20} color={listIconColor} />
                        <span>{t('map.website')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
                    {activeFilter !== t('filter.wineries') && (isSearchActive ? searchResults.filter(item => isWineShopItem(item)) : wineShops)
            .filter(shop => {
              // If regions are selected, only show shops in those regions
              if (selectedRegions.length > 0 && (!shop.properties.region || !selectedRegions.includes(shop.properties.region))) {
                return false;
              }
              if (kosherFilter !== 'all') {
                const kosher = isItemKosher(shop);
                if (kosherFilter === 'kosher' && !kosher) return false;
                if (kosherFilter === 'not_kosher' && kosher) return false;
              }
              if (openFilter !== 'all') {
                const openNow = isItemOpenNow(shop);
                if (openFilter === 'open' && !openNow) return false;
                if (openFilter === 'closed' && openNow) return false;
              }
              return true;
            })
            .map((shop, index) => (
            <Marker
              key={`shop-${index}-${language}-${renderKey}`}
              position={[shop.geometry.coordinates[1], shop.geometry.coordinates[0]]}
              icon={shopIcon}
            >
              <Popup>
                <div
                  className={`wm-map-popup${isDark ? ' wm-map-popup--dark' : ''}`}
                  style={{ direction: 'rtl' }}
                >
                  <div className="wm-map-popup__row">
                    <div className="wm-map-popup__body">
                      <div className="wm-map-popup__title-row">
                        <h3 className="wm-map-popup__title">
                          {(() => {
                            const translated = translateName(shop.properties.name || '', language);
                            return translated || 'חנות יין';
                          })()}
                        </h3>
                        <button
                          type="button"
                          className="wm-map-popup__bookmark"
                          title={isSaved(shop, true) ? t('saved.remove') : t('saved.save')}
                          aria-label={isSaved(shop, true) ? t('saved.remove') : t('saved.save')}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSave(shop, true);
                          }}
                        >
                          {isSaved(shop, true) ? <IoBookmark size={22} /> : <IoBookmarkOutline size={22} />}
                        </button>
                      </div>
                      {shop.properties.address ? (
                        <p className="wm-map-popup__address">
                          <IoLocationOutline size={17} color={listIconColor} aria-hidden />
                          <span>{translateAddress(shop.properties.address, language)}</span>
                        </p>
                      ) : null}
                      {shop.properties.opening_hours && !shop.properties.offers ? (
                        (() => {
                          const isOpen = isCurrentlyOpen(shop.properties.opening_hours);
                          return (
                            <p
                              key={`shop-status-${shop.properties.place_id || shop.properties.name}-${timeKey}`}
                              className={`wm-map-popup__status${isOpen ? ' wm-map-popup__status--open' : ' wm-map-popup__status--closed'}`}
                            >
                              <span className="wm-map-popup__status-dot" aria-hidden />
                              {isOpen ? t('list.openNow') : t('list.closed')}
                            </p>
                          );
                        })()
                      ) : null}
                      {shop.properties.offers ? (
                        (() => {
                          const offerKey = `${shop.properties.place_id || shop.properties.name || ''}-shop`;
                          const translated = translatedOffers.get(offerKey);
                          const parsed = parseOffer(shop.properties.offers, t('list.offersAndDeals'));
                          const offerName = translated?.name || parsed.name;
                          const offerDescription = translated?.description || parsed.description;
                          const rawLine = (offerDescription || offerName || '').trim();
                          const line = translateOffer(rawLine, language);
                          const short =
                            line.length > 96 ? `${line.slice(0, 93).trim()}…` : line;
                          return (
                            <button
                              type="button"
                              className="wm-map-popup__offer"
                              onClick={() =>
                                setSelectedOffer({
                                  name: offerName,
                                  description: offerDescription,
                                  wineryName: translateName(shop.properties.name || '', language) || 'חנות יין',
                                })
                              }
                            >
                              <IoGiftOutline size={18} className="wm-map-popup__offer-gift" aria-hidden />
                              <span className="wm-map-popup__offer-text">{short || t('list.offersAndDeals')}</span>
                            </button>
                          );
                        })()
                      ) : null}
                    </div>
                    {shop.properties.logo_url ? (
                      <img
                        className="wm-map-popup__logo"
                        src={shop.properties.logo_url}
                        alt=""
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="wm-map-popup__actions">
                    {shop.properties.phone ? (
                      <a
                        className="wm-map-popup__action"
                        href={`tel:${formatPhoneForTel(shop.properties.phone)}`}
                        aria-label={t('list.callAction')}
                      >
                        <IoCallOutline size={20} color={listIconColor} />
                        <span>{t('list.callAction')}</span>
                      </a>
                    ) : (
                      <div className="wm-map-popup__action wm-map-popup__action--disabled" aria-hidden="true">
                        <IoCallOutline size={20} color={listIconColor} />
                        <span>{t('list.callAction')}</span>
                      </div>
                    )}
                    <div className="wm-map-popup__action-split" />
                    <button
                      type="button"
                      className="wm-map-popup__action wm-map-popup__action--btn"
                      onClick={() =>
                        openWazeNavigation(
                          shop.geometry.coordinates[1],
                          shop.geometry.coordinates[0]
                        )
                      }
                    >
                      <IoCarOutline size={20} color={listIconColor} />
                      <span>{t('list.goThere')}</span>
                    </button>
                    <div className="wm-map-popup__action-split" />
                    {shop.properties.website ? (
                      <a
                        className="wm-map-popup__action"
                        href={normalizeUrl(shop.properties.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('map.website')}
                      >
                        <IoGlobeOutline size={20} color={listIconColor} />
                        <span>{t('map.website')}</span>
                      </a>
                    ) : (
                      <div className="wm-map-popup__action wm-map-popup__action--disabled" aria-hidden="true">
                        <IoGlobeOutline size={20} color={listIconColor} />
                        <span>{t('map.website')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
          <MapCenter
            center={mapCenter}
            zoom={
              mapNavZoom ??
              (isSearchActive && searchResults.length > 0 ? 13 : selectedRegions.length > 0 ? 10 : 11)
            }
          />
        </MapContainer>
      </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="list-view" style={{
          position: 'absolute',
          top: `${MAP_HEADER_STACK_OFFSET_PX}px`,
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: 'auto',
          overflowX: 'visible',
          padding: '10px 1rem 1rem',
          paddingBottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          zIndex: 1,
          direction: 'rtl',
          textAlign: 'right'
        }} /**backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5', */
        ref={listViewRef}>
          {!isSearchActive && (
            <div style={{ direction: 'rtl', marginBottom: '1.25rem' }}>
              <div
                style={{
                  textAlign: 'right',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: isDark ? '#fff' : '#000',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.3,
                  fontFamily: 'var(--apple-font), system-ui, sans-serif',
                }}
              >
                {(() => {
                  const full = t('list.designSectionTitle').trim();
                  const words = full.split(/\s+/).filter(Boolean);
                  if (words.length === 0) return null;
                  if (words.length === 1) {
                    return (
                      <span style={{ borderBottom: `3px solid ${WM_RED}`, paddingBottom: 3, display: 'inline-block' }}>
                        {full}
                      </span>
                    );
                  }
                  const last = words[words.length - 1];
                  const before = words.slice(0, -1).join(' ');
                  return (
                    <>
                      {before}{' '}
                      <span style={{ borderBottom: `3px solid ${WM_RED}`, paddingBottom: 3, display: 'inline-block' }}>
                        {last}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          {/* Search Results Header */}
          {isSearchActive && searchTerm && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              backgroundColor: isDark ? '#2a2a2a' : 'white',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              direction: 'rtl'
            }}>
              <div>
                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  color: isDark ? '#fff' : '#333',
                  marginBottom: '0.25rem'
                }}>
                  {`תוצאות חיפוש עבור "${searchTerm}"`}
                </div>
                {!isLoading && (
                  <div style={{
                    fontSize: '0.9rem',
                    color: isDark ? '#ccc' : '#666'
                  }}>
                    {getFilteredItems().length} תוצאות
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSearchResults([]);
                  setIsSearchActive(false);
                }}
                style={{
                  background: isDark ? '#444' : '#f5f5f5',
                  color: isDark ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                נקה
              </button>
            </div>
          )}
          {getFilteredItems().map((item, index) => {
            const isShop = (() => {
              const placeId = item.properties.place_id || '';
              const name = item.properties.name || '';
              if (placeId && wineShopIds.has(`id:${placeId}`)) return true;
              if (name && wineShopIds.has(`name:${name}`)) return true;
              return false;
            })();

            return (
              <WinePlaceListCard
                key={`${item.properties.name}-${language}-${renderKey}-${index}`}
                item={item}
                isShop={isShop}
                language={language}
                isDark={isDark}
                listIconColor={listIconColor}
                wmRed={WM_RED}
                translatedOffers={translatedOffers}
                onOfferSelect={setSelectedOffer}
                expandedListOpeningHoursKeys={expandedListOpeningHoursKeys}
                toggleListOpeningHoursKey={toggleListOpeningHoursKey}
                listIndex={index}
                isSaved={isSaved(item, isShop)}
                onToggleSave={() => toggleSave(item, isShop)}
                t={t}
                listRenderKey={renderKey}
                distanceFromUserMeters={
                  userLocation
                    ? haversineDistanceMeters(
                        userLocation.lat,
                        userLocation.lng,
                        item.geometry.coordinates[1],
                        item.geometry.coordinates[0]
                      )
                    : null
                }
              />
            );
          })}

                  {getFilteredItems().length === 0 && !isLoading && (() => {
                    const regionMsg = `${t('list.noResultsRegion')} ${selectedRegions.map((r) => getRegionName(r)).join(', ')}`;
                    let content: React.ReactNode;
                    if (selectedRegions.length === 0) {
                      content = t('list.noResults');
                    } else if (regionHasNoPlacesInDb && suppressEmptyRegionDbNotice) {
                      content = null;
                    } else {
                      content = regionMsg;
                    }
                    if (content == null) return null;
                    return (
                    <div style={{
                      textAlign: 'center',
                      padding: '3rem',
                      color: '#666',
                      direction: 'rtl'
                    }}>
                      {content}
                    </div>
                    );
                  })()}
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '80px'
          }}
          onClick={() => {
            setShowSearchModal(false);
            setSearchTerm('');
            setSearchResults([]);
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              direction: 'rtl'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Header */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'nowrap',
              boxSizing: 'border-box'
            }}>
              <IoSearch size={24} color="#666" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit();
                  }
                }}
                placeholder={language === 'he' ? 'חפש יקב או חנות יין...' : language === 'ru' ? 'Поиск винодельни или винного магазина...' : 'Search winery or wine shop...'}
                style={{
                  flex: '1 1 220px',
                  minWidth: 0,
                  border: '1px solid #ddd',
                  outline: 'none',
                  fontSize: '1rem',
                  padding: '0.5rem',
                  backgroundColor: '#fff',
                  color: '#111',
                  direction: 'rtl',
                  textAlign: 'right'
                }}
                autoFocus
              />
              <button
                onClick={handleSearchSubmit}
                style={{
                  background: '#8B1D24',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  flex: '0 0 auto'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#6b1519';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#8B1D24';
                }}
              >
                חפש
              </button>
              <button
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchTerm('');
                  setSearchResults([]);
                  setIsSearchActive(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#666',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                  flex: '0 0 auto'
                }}
              >
                ×
        </button>
            </div>

            {/* Search Instructions */}
            <div style={{
              padding: '1.5rem',
              textAlign: 'center',
              color: '#666',
              direction: 'rtl',
              fontSize: '0.9rem',
              borderTop: '1px solid #eee'
            }}>
              {'הקש Enter או לחץ על כפתור החיפוש כדי לראות תוצאות'}
            </div>
          </div>
        </div>
      )}

      <AppBottomNav
        mapViewMode={viewMode}
        onBeforeNavigate={closeFilterMenu}
        onHomeClick={() => {
          closeFilterMenu();
          navigate('/');
        }}
        onListClick={() => {
          closeFilterMenu();
          if (location.pathname !== '/map') {
            navigate('/map', { state: { showListView: true } });
          } else {
            setViewMode('list');
          }
        }}
        onMapClick={() => {
          closeFilterMenu();
          if (location.pathname !== '/map') {
            navigate('/map');
          }
          setViewMode('map');
        }}
      />

      {error && (
        <div className="error-message" style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255, 0, 0, 0.1)',
          padding: '1rem',
          borderRadius: '8px',
          zIndex: 1000,
          textAlign: 'center',
                  maxWidth: '80%',
                  direction: 'rtl'
        }}>
                  <h3>{t('error.loading')}</h3>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
                    {t('error.retry')}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="loading-message" style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '1rem',
          borderRadius: '8px',
          zIndex: 1000,
                  textAlign: 'center',
                  direction: 'rtl'
                }}>
                  {t('error.loadingData')}
                </div>
              )}

      {/* Settings Modal */}
      {showLanguageSelector && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setShowLanguageSelector(false)}
        >
          <div 
            style={{
              backgroundColor: isDark ? '#1a1a1a' : 'white',
              borderRadius: '20px',
              padding: '1rem',
              maxWidth: '300px',
              width: '82%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              direction: 'rtl'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              marginBottom: '0.75rem',
              color: isDark ? '#fff' : '#333',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              textAlign: 'right'
            }}>
              {t('settings.title')}
            </h2>

            <div style={{ marginBottom: '1.25rem', borderBottom: `1px solid ${isDark ? '#333' : '#eee'}`, paddingBottom: '1.25rem' }}>
              <h3 style={{
                marginBottom: '0.75rem',
                color: isDark ? '#fff' : '#333',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'right',
              }}>
                {t('settings.theme')}
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', direction: 'rtl' }}>
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    padding: '0.65rem',
                    borderRadius: '12px',
                    border: `1px solid ${!isDark ? WM_RED : '#555'}`,
                    background: !isDark ? '#fff5f5' : '#2a2a2a',
                    color: isDark ? '#fff' : '#333',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  <IoSunnyOutline size={20} />
                  {t('settings.theme.light')}
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    padding: '0.65rem',
                    borderRadius: '12px',
                    border: `1px solid ${isDark ? WM_RED : '#ddd'}`,
                    background: isDark ? 'rgba(227, 6, 19, 0.12)' : '#f5f5f5',
                    color: isDark ? '#fff' : '#333',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  <IoMoonOutline size={20} />
                  {t('settings.theme.dark')}
                </button>
              </div>
            </div>

            {/* Language is fixed to Hebrew - no selector needed */}

            {/* Zoom Controls for Accessibility */}
            <div style={{ marginBottom: '2rem', borderTop: `1px solid ${isDark ? '#333' : '#eee'}`, paddingTop: '1.5rem' }}>
              <h3 style={{
                marginBottom: '1rem',
                color: isDark ? '#fff' : '#333',
                fontSize: '1.1rem',
                fontWeight: '600',
                textAlign: 'right'
              }}>
                {t('settings.zoom')}
              </h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1rem',
                direction: 'rtl'
              }}>
                <button
                  onClick={decreaseZoom}
                  disabled={zoomLevel <= 0.8}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: zoomLevel <= 0.8 ? (isDark ? '#1a1a1a' : '#e0e0e0') : (isDark ? '#2a2a2a' : '#f5f5f5'),
                    color: zoomLevel <= 0.8 ? (isDark ? '#666' : '#999') : (isDark ? '#fff' : '#333'),
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1.2rem',
                    cursor: zoomLevel <= 0.8 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '48px',
                    height: '48px'
                  }}
                  onMouseEnter={(e) => {
                    if (zoomLevel > 0.8) {
                      e.currentTarget.style.backgroundColor = isDark ? '#333' : '#e0e0e0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (zoomLevel > 0.8) {
                      e.currentTarget.style.backgroundColor = isDark ? '#2a2a2a' : '#f5f5f5';
                    }
                  }}
                >
                  <IoRemove />
                </button>
                <div style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '0.75rem 1rem',
                  backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                  borderRadius: '12px',
                  color: isDark ? '#fff' : '#333',
                  fontSize: '1rem',
                  fontWeight: '600',
                  direction: 'rtl'
                }}>
                  {Math.round(zoomLevel * 100)}%
                </div>
                <button
                  onClick={increaseZoom}
                  disabled={zoomLevel >= 1.5}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: zoomLevel >= 1.5 ? (isDark ? '#1a1a1a' : '#e0e0e0') : (isDark ? '#2a2a2a' : '#f5f5f5'),
                    color: zoomLevel >= 1.5 ? (isDark ? '#666' : '#999') : (isDark ? '#fff' : '#333'),
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1.2rem',
                    cursor: zoomLevel >= 1.5 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '48px',
                    height: '48px'
                  }}
                  onMouseEnter={(e) => {
                    if (zoomLevel < 1.5) {
                      e.currentTarget.style.backgroundColor = isDark ? '#333' : '#e0e0e0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (zoomLevel < 1.5) {
                      e.currentTarget.style.backgroundColor = isDark ? '#2a2a2a' : '#f5f5f5';
                    }
                  }}
                >
                  <IoAdd />
                </button>
              </div>
              <button
                onClick={resetZoom}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                  color: isDark ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'right'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#333' : '#e0e0e0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#2a2a2a' : '#f5f5f5';
                }}
              >
                {t('settings.resetZoom')}
              </button>
            </div>

            {/* Additional Settings */}
            <div style={{ marginBottom: '2rem', borderTop: `1px solid ${isDark ? '#333' : '#eee'}`, paddingTop: '1.5rem' }}>
              <button
                onClick={() => {
                  setActiveFilter(t('filter.filter'));
                  setSelectedRegions([]);
                  setShowLanguageSelector(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                  color: isDark ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '0.75rem',
                  textAlign: 'right'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#333' : '#e0e0e0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#2a2a2a' : '#f5f5f5';
                }}
              >
                {t('settings.clearFilters')}
              </button>
              <button
                onClick={() => {
                  setShowLanguageSelector(false);
                  setShowFeedbackModal(true);
                }}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                  color: isDark ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '0.75rem',
                  textAlign: 'right'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#333' : '#e0e0e0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#2a2a2a' : '#f5f5f5';
                }}
              >
                {t('nav.addPlace')}
              </button>
              <button
                onClick={() => {
                  setMapCenter([31.7683, 35.2137]);
                  setSelectedRegions([]);
                  setShowLanguageSelector(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                  color: isDark ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'right'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#333' : '#e0e0e0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#2a2a2a' : '#f5f5f5';
                }}
              >
                {t('settings.resetMap')}
              </button>
            </div>

            {/* About Section */}
            <div style={{
              borderTop: `1px solid ${isDark ? '#333' : '#eee'}`,
              paddingTop: '1.5rem',
              textAlign: 'center',
              color: isDark ? '#999' : '#666',
              fontSize: '0.85rem'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>{t('settings.about')}</div>
              <div>{t('settings.version')}: 1.0.0</div>
            </div>
            
            <button
              onClick={() => setShowLanguageSelector(false)}
              style={{
                marginTop: '1.5rem',
                width: '100%',
                padding: '0.875rem 1.25rem',
                backgroundColor: '#8B1D24',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#6b1519';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#8B1D24';
              }}
            >
              {t('settings.close')}
            </button>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => {
            if (!feedbackSubmitting) {
              setShowFeedbackModal(false);
              setPlaceForm({
                type: 'winery',
                name: '',
                region: '',
                address: '',
                phone: '',
                website: '',
                openingHours: '',
                description: ''
              });
              setRegionSelect('');
              setFeedbackSuccess(false);
            }
          }}
        >
          <div 
            style={{
              backgroundColor: isDark ? '#1a1a1a' : 'white',
              borderRadius: '24px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              direction: 'rtl'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              marginBottom: '1.5rem',
              color: isDark ? '#fff' : '#333',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              textAlign: 'right'
            }}>
              {t('addPlace.title')}
            </h2>
            
            {feedbackSuccess ? (
              <div style={{
                padding: '1.5rem',
                backgroundColor: isDark ? '#1a4a1a' : '#e6ffe6',
                color: isDark ? '#6bff6b' : '#28a745',
                borderRadius: '12px',
                textAlign: 'center',
                marginBottom: '1rem'
              }}>
                {t('addPlace.success')}
              </div>
            ) : (
              <>
                <p style={{
                  marginBottom: '0.75rem',
                  color: isDark ? '#ccc' : '#666',
                  fontSize: '0.9rem',
                  textAlign: 'right'
                }}>
                  {t('addPlace.description')}
                </p>

                <div style={{
                  display: 'grid',
                  gap: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setPlaceForm((prev) => ({ ...prev, type: 'winery' }))}
                      disabled={feedbackSubmitting}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: placeForm.type === 'winery' ? '#8B1D24' : (isDark ? '#2a2a2a' : '#f5f5f5'),
                        color: placeForm.type === 'winery' ? '#fff' : (isDark ? '#fff' : '#333'),
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9rem'
                      }}
                    >
                      {t('addPlace.type.winery')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaceForm((prev) => ({ ...prev, type: 'shop' }))}
                      disabled={feedbackSubmitting}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: placeForm.type === 'shop' ? '#8B1D24' : (isDark ? '#2a2a2a' : '#f5f5f5'),
                        color: placeForm.type === 'shop' ? '#fff' : (isDark ? '#fff' : '#333'),
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9rem'
                      }}
                    >
                      {t('addPlace.type.shop')}
                    </button>
                  </div>

                  <input
                    value={placeForm.name}
                    onChange={(e) => setPlaceForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder={t('addPlace.name')}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                      backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
                      color: isDark ? '#fff' : '#333',
                      fontSize: '0.9rem',
                      direction: 'rtl',
                      textAlign: 'right'
                    }}
                    disabled={feedbackSubmitting}
                  />
                  <select
                    value={regionSelect}
                    onChange={(e) => {
                      const value = e.target.value;
                      setRegionSelect(value);
                      if (value === 'other') {
                        setPlaceForm((prev) => ({ ...prev, region: '' }));
                      } else {
                        setPlaceForm((prev) => ({ ...prev, region: value }));
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                      backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
                      color: isDark ? '#fff' : '#333',
                      fontSize: '0.9rem',
                      direction: 'rtl',
                      textAlign: 'right'
                    }}
                    disabled={feedbackSubmitting}
                  >
                    <option value="">{t('addPlace.region')}</option>
                    {regionOptions.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                    <option value="other">{t('addPlace.regionOther')}</option>
                  </select>
                  {regionSelect === 'other' && (
                    <input
                      value={placeForm.region}
                      onChange={(e) => setPlaceForm((prev) => ({ ...prev, region: e.target.value }))}
                      placeholder={t('addPlace.regionCustom')}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '10px',
                        border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                        backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
                        color: isDark ? '#fff' : '#333',
                        fontSize: '0.9rem',
                        direction: 'rtl',
                        textAlign: 'right'
                      }}
                      disabled={feedbackSubmitting}
                    />
                  )}
                  <input
                    value={placeForm.address}
                    onChange={(e) => setPlaceForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder={t('addPlace.address')}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                      backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
                      color: isDark ? '#fff' : '#333',
                      fontSize: '0.9rem',
                      direction: 'rtl',
                      textAlign: 'right'
                    }}
                    disabled={feedbackSubmitting}
                  />
                  <input
                    value={placeForm.phone}
                    onChange={(e) => setPlaceForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder={t('addPlace.phone')}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                      backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
                      color: isDark ? '#fff' : '#333',
                      fontSize: '0.9rem',
                      direction: 'rtl',
                      textAlign: 'right'
                    }}
                    disabled={feedbackSubmitting}
                  />
                  <input
                    value={placeForm.website}
                    onChange={(e) => setPlaceForm((prev) => ({ ...prev, website: e.target.value }))}
                    placeholder={t('addPlace.website')}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                      backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
                      color: isDark ? '#fff' : '#333',
                      fontSize: '0.9rem',
                      direction: 'rtl',
                      textAlign: 'right'
                    }}
                    disabled={feedbackSubmitting}
                  />
                  <textarea
                    value={placeForm.openingHours}
                    onChange={(e) => setPlaceForm((prev) => ({ ...prev, openingHours: e.target.value }))}
                    placeholder={t('addPlace.openingHours')}
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                      backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
                      color: isDark ? '#fff' : '#333',
                      fontSize: '0.9rem',
                      resize: 'vertical',
                      direction: 'rtl',
                      textAlign: 'right'
                    }}
                    disabled={feedbackSubmitting}
                  />
                  <textarea
                    value={placeForm.description}
                    onChange={(e) => setPlaceForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder={t('addPlace.descriptionField')}
                    rows={2}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                      backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
                      color: isDark ? '#fff' : '#333',
                      fontSize: '0.9rem',
                      resize: 'vertical',
                      direction: 'rtl',
                      textAlign: 'right'
                    }}
                    disabled={feedbackSubmitting}
                  />
                </div>
                
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={async () => {
                      if (!placeForm.name.trim()) {
                        alert(t('addPlace.emptyName'));
                        return;
                      }
                      if (!placeForm.region.trim()) {
                        alert(t('addPlace.emptyRegion'));
                        return;
                      }
                      if (!placeForm.phone.trim()) {
                        alert(t('addPlace.emptyPhone'));
                        return;
                      }
                      if (!placeForm.address.trim()) {
                        alert(t('addPlace.emptyAddress'));
                        return;
                      }
                      if (!placeForm.description.trim()) {
                        alert(t('addPlace.emptyDescription'));
                        return;
                      }
                      
                      setFeedbackSubmitting(true);
                      try {
                        const messageText = buildPlaceMessage();
                        // Store feedback in Supabase
                        const { data, error } = await supabase
                          .from('feedback')
                          .insert([
                            {
                              message: messageText,
                              language: language
                            }
                          ])
                          .select();
                        
                        if (error) {
                          console.error('Supabase error:', error);
                          // Check if table doesn't exist
                          if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('table')) {
                            alert('טבלת המשוב לא קיימת. אנא צור את הטבלה ב-Supabase תחילה באמצעות הקובץ create_feedback_table.sql');
                          } else {
                            alert(t('addPlace.error') + (error.message ? `: ${error.message}` : ''));
                          }
                          setFeedbackSubmitting(false);
                          return;
                        }
                        
                        // Send email notification via Vercel serverless function (no proxy server)
                        if (data && data[0]) {
                          fetch('/api/send-feedback-email', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              message: messageText
                            })
                          })
                            .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
                            .then(({ ok, payload }) => {
                              if (!ok) {
                                console.error('❌ Error sending feedback email:', payload);
                                return;
                              }
                              console.log('✅ Feedback email sent:', payload);
                            })
                            .catch((err) => {
                              console.error('❌ Error sending feedback email:', err);
                            });
                        }
                        
                        setFeedbackSuccess(true);
                        setTimeout(() => {
                          setShowFeedbackModal(false);
                          setPlaceForm({
                            type: 'winery',
                            name: '',
                            region: '',
                            address: '',
                            phone: '',
                            website: '',
                            openingHours: '',
                            description: ''
                          });
                          setRegionSelect('');
                          setRegionSelect('');
                          setFeedbackSuccess(false);
                        }, 2000);
                      } catch (error: any) {
                        console.error('Error submitting feedback:', error);
                        alert(t('addPlace.error') + (error?.message ? `: ${error.message}` : ''));
                      } finally {
                        setFeedbackSubmitting(false);
                      }
                    }}
                    disabled={
                      feedbackSubmitting ||
                      !placeForm.name.trim() ||
                      !placeForm.region.trim() ||
                      !placeForm.phone.trim() ||
                      !placeForm.address.trim() ||
                      !placeForm.description.trim()
                    }
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: feedbackSubmitting || !placeForm.name.trim() || !placeForm.region.trim() || !placeForm.phone.trim() || !placeForm.address.trim() || !placeForm.description.trim() ? '#6c757d' : '#8B1D24',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '1rem',
                      fontWeight: '500',
                      cursor: feedbackSubmitting || !placeForm.name.trim() || !placeForm.region.trim() || !placeForm.phone.trim() || !placeForm.address.trim() || !placeForm.description.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {feedbackSubmitting ? t('addPlace.submitting') : t('addPlace.submit')}
                  </button>
                  <button
                    onClick={() => {
                      setShowFeedbackModal(false);
                      setPlaceForm({
                        type: 'winery',
                        name: '',
                        region: '',
                        address: '',
                        phone: '',
                        website: '',
                        openingHours: '',
                        description: ''
                      });
                      setRegionSelect('');
                      setFeedbackSuccess(false);
                    }}
                    disabled={feedbackSubmitting}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: isDark ? '#333' : '#f5f5f5',
                      color: isDark ? '#fff' : '#333',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '1rem',
                      cursor: feedbackSubmitting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {t('addPlace.cancel')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Offer Details Modal */}
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
            backdropFilter: 'blur(4px)'
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
              animation: 'slideUp 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #8B1D24 0%, #d32f2f 100%)',
              padding: '2rem 1.5rem 1.5rem',
              position: 'relative',
          textAlign: 'center'
        }}>
              <button
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
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                }}
              >
                ×
              </button>
              <div style={{
                fontSize: '2.5rem',
                marginBottom: '0.5rem'
              }}>
                %
              </div>
              <h2 style={{
                margin: 0,
                color: 'white',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                textShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                {selectedOffer.name}
              </h2>
              <div style={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '0.95rem',
                marginTop: '0.5rem'
              }}>
                {selectedOffer.wineryName}
              </div>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: '2rem 1.5rem',
              overflowY: 'auto',
              flex: 1,
              direction: 'rtl'
            }}>
              <div style={{
                fontSize: '1.1rem',
                lineHeight: '1.8',
                color: '#333',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}>
                {selectedOffer.description.split('\n').map((line, index) => (
                  <div key={index} style={{ marginBottom: line.trim() ? '0.5rem' : '0' }}>
                    {line.trim() || '\u00A0'}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1.5rem',
              borderTop: '1px solid #f0f0f0',
              display: 'flex',
              gap: '1rem'
            }}>
              <button
                onClick={() => setSelectedOffer(null)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0e0e0';
                }}
              >
                {t('offer.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && regionHasNoPlacesInDb && !suppressEmptyRegionDbNotice && (
                      <div style={{
                        position: 'absolute',
                        top: '120px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        padding: '1rem 1.5rem',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                        zIndex: 1000,
                        textAlign: 'center',
                        fontSize: '0.9rem',
                        color: '#666',
                        direction: 'rtl'
                      }}>
                        {t('list.noResultsRegion')} {selectedRegions.map(r => getRegionName(r)).join(', ')}
                      </div>
      )}
    </div>
  );
};

export default WineriesMap; 
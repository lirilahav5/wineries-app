import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { IoSearch, IoList, IoSettings, IoAddCircle, IoBulb, IoBulbOutline, IoAdd, IoRemove, IoHome, IoLocationOutline, IoMapOutline, IoCallOutline, IoGlobeOutline } from 'react-icons/io5';
import { FaChevronDown, FaRegClock, FaShoppingCart, FaSort } from 'react-icons/fa';
import { FaLocationCrosshairs } from 'react-icons/fa6';
import { FaSliders } from 'react-icons/fa6';
import { FaRegMap } from 'react-icons/fa';
import { useTheme } from '../contexts/ThemeContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import Logo from '../components/Logo';
import wineryMarkerIcon from '../assets/img/wineryMarker.png';
import wazeIcon from '../assets/img/waze.png';
import shopMarkerIcon from '../assets/img/shopMarkerSingle.png';
import topbarWineryIcon from '../assets/img/topbar-winery.png';
import topbarShopIcon from '../assets/img/topbar-shop.png';
import bottleImage from '../assets/img/bottle.png';
import { WineryFeature } from '../data/wineries';
import { fetchWineriesFromDb, fetchWineShopsFromDb } from '../data/wineries';
import { testConnection, supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { translateName, translateAddress, translateOffer } from '../utils/nameTranslations';
import { isCurrentlyOpen, getClosingTimeToday } from '../utils/openingHours';

// Custom marker icon for wineries
const wineryIcon = L.icon({
  iconUrl: wineryMarkerIcon,
  iconSize: [28, 28], // Smaller
  iconAnchor: [14, 28], // Point of the icon which will correspond to marker's location
  popupAnchor: [0, -28] // Point from which the popup should open relative to the iconAnchor
});

// Custom marker icon for wine shops
const shopIcon = L.icon({
  iconUrl: shopMarkerIcon,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24]
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

// translateOffer is now imported from nameTranslations.ts

// Helper function to parse and clean offers
const parseOffer = (offersString: string | null, defaultName: string): { name: string; description: string } => {
  if (!offersString) {
    return { name: defaultName, description: '' };
  }

  let offerName = defaultName;
  let offerDescription = offersString.trim();

  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(offersString);
    if (typeof parsed === 'object' && parsed !== null) {
      offerName = parsed.name || parsed.title || defaultName;
      offerDescription = parsed.description || parsed.details || '';
    }
  } catch {
    // Not valid JSON, try to extract from JSON-like string patterns
    // Pattern 1: {"name":"...","description":"..."}
    const fullJsonMatch = offersString.match(/\{"name"\s*:\s*"([^"]*)"\s*,\s*"description"\s*:\s*"([^"]+)"\}/);
    if (fullJsonMatch) {
      offerName = fullJsonMatch[1] || defaultName;
      offerDescription = fullJsonMatch[2];
    } else {
      // Pattern 2: Just description in JSON format
      const descMatch = offersString.match(/"description"\s*:\s*"([^"]+)"/);
      if (descMatch) {
        offerDescription = descMatch[1];
      } else {
        // Pattern 3: Try to find any quoted text that looks like description
        const quotedTextMatch = offersString.match(/"([^"]{10,})"/);
        if (quotedTextMatch && !quotedTextMatch[1].includes('{') && !quotedTextMatch[1].includes('}')) {
          offerDescription = quotedTextMatch[1];
        }
      }
    }
  }

  // Clean up the description: unescape JSON strings and remove artifacts
  if (offerDescription) {
    offerDescription = offerDescription
      .replace(/\\n/g, '\n')           // Unescape newlines
      .replace(/\\"/g, '"')            // Unescape quotes
      .replace(/\\'/g, "'")            // Unescape single quotes
      .replace(/\\t/g, '\t')           // Unescape tabs
      .replace(/\\r/g, '\r')           // Unescape carriage returns
      .replace(/\{"name":"[^"]*","description":"([^"]+)"\}/g, '$1') // Remove nested JSON
      .replace(/^["']|["']$/g, '')     // Remove surrounding quotes
      .replace(/^\s*\{.*\}\s*$/g, '')  // Remove if entire string is just JSON braces
      .trim();
  }

  // If description is empty or just JSON artifacts, use original string cleaned up
  if (!offerDescription || offerDescription.length < 3) {
    offerDescription = offersString
      .replace(/\{"name":"[^"]*","description":"([^"]+)"\}/g, '$1')
      .replace(/^["']|["']$/g, '')
      .trim();
  }

  // Return parsed offer (translation will happen when displayed)
  return { 
    name: offerName || defaultName, 
    description: offerDescription || offersString 
  };
};

const WineriesMap: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { toggleTheme, isDark } = useTheme();
  const { userLocation: locationStateUserLocation, shouldCenter, selectedRegion: initialRegion, showListView, searchTerm: searchTermFromState, fromPullDown, openSettings, openSearch, openAddPlace } = (location.state as LocationState) || {};
  const [activeFilter, setActiveFilter] = useState(() => (showListView ? t('filter.wineShops') : t('filter.filter')));
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [kosherFilter, setKosherFilter] = useState<'all' | 'kosher' | 'not_kosher'>('all');
  const [openFilter, setOpenFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showRegionFilter, setShowRegionFilter] = useState(false);
  const [showCityFilter, setShowCityFilter] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortMaxKm, setSortMaxKm] = useState('');
  const [sortByNameQuery, setSortByNameQuery] = useState('');
  const closeFilterMenu = () => {
    setShowFilterMenu(false);
    setShowRegionFilter(false);
    setShowCityFilter(false);
  };
  const closeSortMenu = () => setShowSortMenu(false);
  useEffect(() => {
    // Close any open popups/menus when navigating to another screen
    closeFilterMenu();
    closeSortMenu();
    setShowLanguageSelector(false);
    setShowSearchModal(false);
    setShowFeedbackModal(false);
    setShowSearchError(false);
    setSelectedOffer(null);
  }, [location.pathname]);
  
  // Initialize viewMode - show list if showListView is true, otherwise show map
  const [viewMode, setViewMode] = useState<'map' | 'list'>(() => {
    return showListView ? 'list' : 'map';
  });
  
  useEffect(() => {
    const applied = localStorage.getItem('default_shop_filter_applied');
    if (!applied) {
      setActiveFilter(t('filter.wineShops'));
      localStorage.setItem('default_shop_filter_applied', 'true');
    }
  }, [t]);

  useEffect(() => {
    const cachedCity = localStorage.getItem('userLocationCity');
    if (cachedCity) {
      setNearMeCity(cachedCity);
    }
  }, []);

  const handleMyLocationClick = () => {
    closeFilterMenu();
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
  const [mapCenter, setMapCenter] = useState<[number, number]>([31.7683, 35.2137]); // Default: Jerusalem
  const [selectedOffer, setSelectedOffer] = useState<{ name: string; description: string; wineryName: string } | null>(null);
  const [translatedOffers, setTranslatedOffers] = useState<Map<string, { name: string; description: string }>>(new Map());
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [renderKey, setRenderKey] = useState(0); // Force re-render when language changes
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<WineryFeature[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false); // Track if search is active
  const [showSearchError, setShowSearchError] = useState(false);
  const [timeKey, setTimeKey] = useState(0); // Force re-render to update open/closed status
  const [expandedHours, setExpandedHours] = useState<Set<string>>(new Set());
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const locationRequestRef = useRef(false); // Prevent multiple simultaneous location requests
  const searchErrorTimerRef = useRef<number | null>(null);
  const searchFromStateErrorDelayRef = useRef<number | null>(null);
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
  const [nearMeCity, setNearMeCity] = useState('');

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
      
      // Adjust viewport to prevent cutoff
      // When zoomed in, we need to ensure content doesn't get cut off
      if (zoomLevel > 1.0) {
        // Add padding to body to prevent bottom cutoff
        const extraPadding = (zoomLevel - 1.0) * 50; // Add padding proportional to zoom
        bodyElement.style.paddingBottom = `${extraPadding}px`;
        bodyElement.style.overflowY = 'auto';
        htmlElement.style.overflowY = 'auto';
      } else {
        bodyElement.style.paddingBottom = '';
        bodyElement.style.overflowY = '';
        htmlElement.style.overflowY = '';
      }
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
    'דרום': [31.0, 34.75] // South (Ashkelon/Eilat area)
  };
  
  // Update map center when regions are selected
  useEffect(() => {
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
  
  // Initialize region from navigation state
  useEffect(() => {
    if (initialRegion) {
      setSelectedRegions([initialRegion]);
    }
  }, [initialRegion]);

  // Get user location on mount if permission was previously granted
  useEffect(() => {
    // If user location comes from navigation state, save it
    if (locationStateUserLocation) {
      setUserLocation(locationStateUserLocation);
      localStorage.setItem('userLocation', JSON.stringify(locationStateUserLocation));
      localStorage.setItem('userLocationTimestamp', Date.now().toString());
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
  }, [locationStateUserLocation, userLocation]); // Include userLocation to prevent re-requesting

  // Initial center based on user location
  useEffect(() => {
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

  const listTypeLabel =
    activeFilter === t('filter.wineShops')
      ? t('list.type.wineShops')
      : activeFilter === t('filter.wineries')
        ? t('list.type.wineries')
        : t('list.type.both');

  const listAreaLabel = selectedRegions.length > 0
    ? `${selectedRegions.length === 1 ? t('list.areaRegion') : t('list.areaRegions')} ${selectedRegions.map((region) => getRegionName(region)).join(', ')}`
    : (nearMeCity ? `${t('list.areaMy')} (${nearMeCity})` : t('list.areaMy'));

  const listHeaderText = `${listTypeLabel} ${listAreaLabel}`;
  const listIconColor = isDark ? '#c0c0c0' : '#555';
  const listIconSize = 18;

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

  const filters = [
    { id: 'filter', label: t('filter.filter'), type: 'filter', icon: <FaSliders size={20} /> },
    { id: 'winery', label: t('filter.wineries'), type: 'winery', icon: (
      <img
        src={topbarWineryIcon}
        alt=""
        style={{ width: 26, height: 26, verticalAlign: 'middle' }}
      />
    ) },
    { id: 'wine_shops', label: t('filter.wineShops'), type: 'wine_shops', icon: (
      <img
        src={topbarShopIcon}
        alt=""
        style={{ width: 26, height: 26, verticalAlign: 'middle' }}
      />
    ) }
  ];

  const regions = Object.keys(regionMap);

  const normalizeUrl = (url: string): string => {
    if (!url) return '';
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  };

  const handleWazeNavigation = (lat: number, lng: number) => {
    const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    window.open(wazeUrl, '_blank');
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Return distance in meters
  };

  // Format phone number for tel: link (remove spaces, dashes, etc.)
  const formatPhoneForTel = (phone: string): string => {
    if (!phone) return '';
    // Remove all non-digit characters except + (for international numbers)
    return phone.replace(/[^\d+]/g, '');
  };

  // Translate opening hours text
  const translateOpeningHours = (hoursText: string): string => {
    if (!hoursText) return '';
    
    // Day names translation - Hebrew only
    const dayTranslations: Record<string, string> = {
      // English to Hebrew
      'Monday': 'יום שני',
      'Tuesday': 'יום שלישי',
      'Wednesday': 'יום רביעי',
      'Thursday': 'יום חמישי',
      'Friday': 'יום שישי',
      'Saturday': 'שבת',
      'Sunday': 'יום ראשון',
      'Mon': 'ב׳',
      'Tue': 'ג׳',
      'Wed': 'ד׳',
      'Thu': 'ה׳',
      'Fri': 'ו׳',
      'Sat': 'ש׳',
      'Sun': 'א׳',
      // Russian to Hebrew
      'Понедельник': 'יום שני',
      'Вторник': 'יום שלישי',
      'Среда': 'יום רביעי',
      'Четверг': 'יום חמישי',
      'Пятница': 'יום שישי',
      'Суббота': 'שבת',
      'Воскресенье': 'יום ראשון',
      'Пн': 'ב׳',
      'Вт': 'ג׳',
      'Ср': 'ד׳',
      'Чт': 'ה׳',
      'Пт': 'ו׳',
      'Сб': 'ש׳',
      'Вс': 'א׳',
    };
    
    // Common opening hours text translation - Hebrew only
    const textTranslations: Record<string, string> = {
      // English to Hebrew
      'Open': 'פתוח',
      'Closed': 'סגור',
      'Open now': 'פתוח כעת',
      'Closed now': 'סגור כעת',
      '24/7': '24/7',
      'AM': 'לפנה"צ',
      'PM': 'אחה"צ',
      '–': '–',
      '-': '-',
      ':': ':',
      // Russian to Hebrew
      'Открыто': 'פתוח',
      'Закрыто': 'סגור',
      'Открыто сейчас': 'פתוח כעת',
      'Закрыто сейчас': 'סגור כעת',
    };
    
    // Additional common words that might appear in opening hours - Hebrew only
    const additionalTranslations: Record<string, string> = {
      // English to Hebrew
      'to': 'עד',
      'from': 'מ',
      'until': 'עד',
      'and': 'ו',
      'or': 'או',
      'hours': 'שעות',
      'hour': 'שעה',
      'min': 'דק',
      'minutes': 'דקות',
      // Russian to Hebrew
      'с': 'מ',
      'до': 'עד',
      'и': 'ו',
      'или': 'או',
      'часы': 'שעות',
      'час': 'שעה',
    };
    
    let translated = hoursText;
    
    // First, translate day names (longest matches first to avoid partial replacements)
    const sortedDays = Object.keys(dayTranslations).sort((a, b) => b.length - a.length);
    sortedDays.forEach(day => {
      // Match day name with optional colon or space after it (for formats like "Sunday: 10:00" or "Sunday 10:00")
      // Use word boundary for English/Russian, but not for Hebrew (Hebrew doesn't use word boundaries)
      if (/[\u0590-\u05FF]/.test(day)) {
        // Hebrew day name - match directly
        const regex = new RegExp(day.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        translated = translated.replace(regex, dayTranslations[day]);
      } else {
        // English/Russian day name - use word boundary to avoid partial matches
        // But also allow colon or space after the day name
        const escapedDay = day.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedDay}(?=\\s*[:\\s]|\\b)`, 'gi');
        translated = translated.replace(regex, dayTranslations[day]);
      }
    });
    
    // Translate common text - handle Hebrew text without word boundaries
    Object.keys(textTranslations).forEach(text => {
      // For Hebrew text, don't use word boundaries (they don't work well with Hebrew)
      if (/[\u0590-\u05FF]/.test(text)) {
        const regex = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        translated = translated.replace(regex, textTranslations[text]);
      } else {
        // For English/Russian, use word boundaries
        const regex = new RegExp(`\\b${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        translated = translated.replace(regex, textTranslations[text]);
      }
    });
    
    // Translate additional common words
    Object.keys(additionalTranslations).forEach(word => {
      // For Hebrew text, don't use word boundaries
      if (/[\u0590-\u05FF]/.test(word)) {
        const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        translated = translated.replace(regex, additionalTranslations[word]);
      } else {
        // For English/Russian, use word boundaries
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        translated = translated.replace(regex, additionalTranslations[word]);
      }
    });
    
    // Final cleanup: remove any remaining untranslated words (Hebrew only)
    // Remove any English day names that might have been missed
    const englishDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    englishDays.forEach(day => {
      const regex = new RegExp(`\\b${day}\\b`, 'gi');
      if (regex.test(translated)) {
        const hebrewDay = dayTranslations[day];
        if (hebrewDay) {
          translated = translated.replace(regex, hebrewDay);
        } else {
          translated = translated.replace(regex, '');
        }
      }
    });
    // Remove any Russian day names
    const russianDays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    russianDays.forEach(day => {
      const regex = new RegExp(day, 'g');
      if (regex.test(translated)) {
        const hebrewDay = dayTranslations[day];
        if (hebrewDay) {
          translated = translated.replace(regex, hebrewDay);
        } else {
          translated = translated.replace(regex, '');
        }
      }
    });
    // Remove any English common words
    const englishWords = ['Open', 'Closed', 'Open now', 'Closed now', 'hours', 'hour', 'to', 'from', 'until', 'and', 'or'];
    englishWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(translated)) {
        const hebrewWord = textTranslations[word] || additionalTranslations[word];
        if (hebrewWord) {
          translated = translated.replace(regex, hebrewWord);
        } else {
          translated = translated.replace(regex, '');
        }
      }
    });
    // Remove any Russian common words
    const russianWords = ['Открыто', 'Закрыто', 'Открыто сейчас', 'Закрыто сейчас', 'часы', 'час', 'до', 'с', 'и', 'или'];
    russianWords.forEach(word => {
      const regex = new RegExp(word, 'g');
      if (regex.test(translated)) {
        const hebrewWord = textTranslations[word] || additionalTranslations[word];
        if (hebrewWord) {
          translated = translated.replace(regex, hebrewWord);
        } else {
          translated = translated.replace(regex, '');
        }
      }
    });
    // Remove any remaining English or Russian letters (but keep numbers and punctuation)
    translated = translated.replace(/[a-zA-Z\u0400-\u04FF]/g, '');
    
    // Clean up multiple spaces and trim
    translated = translated.replace(/\s+/g, ' ').trim();
    
    return translated;
  };

  // Format and translate opening hours - function that uses current language
  // Returns all opening hours, not just the first one
  const formatOpeningHours = (hours: string[] | string | null): string => {
    if (!hours) return '';
    let hoursArray: string[] = [];
    
    if (typeof hours === 'string') {
      try {
        const parsed = JSON.parse(hours);
        if (Array.isArray(parsed)) {
          hoursArray = parsed;
        } else {
          hoursArray = [parsed];
        }
      } catch {
        // If it's not JSON, treat as single string
        hoursArray = [hours];
      }
    } else if (Array.isArray(hours) && hours.length > 0) {
      hoursArray = hours;
    }
    
    // Translate all opening hours and join them
    const translatedHours = hoursArray.map(hoursText => translateOpeningHours(hoursText));
    return translatedHours.join(' • '); // Join with bullet separator
  };

  // Get filtered items for list view
  const getFilteredItems = (): WineryFeature[] => {
    // If search is active, return search results
    if (isSearchActive && searchResults.length > 0) {
      // Sort search results by distance if user location is available
      if (userLocation) {
        const sorted = [...searchResults].sort((a, b) => {
          const distA = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            a.geometry.coordinates[1],
            a.geometry.coordinates[0]
          );
          const distB = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            b.geometry.coordinates[1],
            b.geometry.coordinates[0]
          );
          return distA - distB;
        });
        return sorted;
      }
      return searchResults;
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

    // Filter by city search (match address, name, or region)
    const cityQuery = citySearchQuery.trim().toLowerCase();
    if (cityQuery) {
      items = items.filter(item => {
        const address = (item.properties.address || '').toLowerCase();
        const name = (item.properties.name || '').toLowerCase();
        const region = (item.properties.region || '').toLowerCase();
        return address.includes(cityQuery) || name.includes(cityQuery) || region.includes(cityQuery);
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

    // Filter by max distance (km) when user location is available
    const maxKm = parseFloat(sortMaxKm.replace(/,/g, '.'));
    if (userLocation && !isNaN(maxKm) && maxKm > 0) {
      const maxMeters = maxKm * 1000;
      items = items.filter(item => {
        const dist = calculateDistance(
          userLocation!.lat,
          userLocation!.lng,
          item.geometry.coordinates[1],
          item.geometry.coordinates[0]
        );
        return dist <= maxMeters;
      });
    }

    // Filter by name (sort/filter by name search)
    const nameQuery = sortByNameQuery.trim().toLowerCase();
    if (nameQuery) {
      items = items.filter(item => {
        const name = (item.properties.name || '').toLowerCase();
        const translated = (translateName(item.properties.name || '', language) || '').toLowerCase();
        return name.includes(nameQuery) || translated.includes(nameQuery);
      });
    }
    
    // Sort by distance if user location is available
    if (userLocation) {
      items.sort((a, b) => {
        const distA = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          a.geometry.coordinates[1],
          a.geometry.coordinates[0]
        );
        const distB = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          b.geometry.coordinates[1],
          b.geometry.coordinates[0]
        );
        return distA - distB;
      });
    } else if (nameQuery) {
      // Sort by name when filtering by name
      items.sort((a, b) => {
        const nameA = translateName(a.properties.name || '', language) || a.properties.name || '';
        const nameB = translateName(b.properties.name || '', language) || b.properties.name || '';
        return nameA.localeCompare(nameB, language === 'he' ? 'he' : 'en');
      });
    }
    
    return items;
  };

  // Search function - enhanced to search by name, address, region, and city
  const triggerSearchError = () => {
    if (searchErrorTimerRef.current) {
      window.clearTimeout(searchErrorTimerRef.current);
    }
    setShowSearchError(true);
    searchErrorTimerRef.current = window.setTimeout(() => {
      setShowSearchError(false);
    }, 2200);
  };

  useEffect(() => {
    return () => {
      if (searchErrorTimerRef.current) {
        window.clearTimeout(searchErrorTimerRef.current);
      }
    };
  }, []);

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
    } else {
      triggerSearchError();
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
      if (searchFromStateErrorDelayRef.current) {
        window.clearTimeout(searchFromStateErrorDelayRef.current);
        searchFromStateErrorDelayRef.current = null;
      }
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
      } else {
        // Delay "no results" so data has time to load (e.g. when coming from home search)
        const NO_RESULTS_DELAY_MS = 2500;
        searchFromStateErrorDelayRef.current = window.setTimeout(() => {
          searchFromStateErrorDelayRef.current = null;
          triggerSearchError();
        }, NO_RESULTS_DELAY_MS);
      }
    }
    return () => {
      if (searchFromStateErrorDelayRef.current) {
        window.clearTimeout(searchFromStateErrorDelayRef.current);
        searchFromStateErrorDelayRef.current = null;
      }
    };
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
    'דרום'
  ];

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
            className="nav-icon"
            onClick={() => {
              closeFilterMenu();
              setShowLanguageSelector(true);
            }}
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
          {/* Old Lantern Toggle - Swinging Animation */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '60px',
              height: '60px'
            }}
          >
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
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
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

      {/* Search box under header — icon left, autocomplete */}
      <div
        ref={searchBoxRef}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: isDark ? '#1a1a1a' : '#fff',
          position: 'relative',
          zIndex: 100
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
              if (e.key === 'Enter') {
                handleSearchSubmit();
              }
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
              direction: language === 'he' ? 'rtl' : 'ltr'
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

      {showSearchError && (
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
          {/* Material-style transparent grey overlay (scrim) - covers bottom bar too; click to close */}
          <div
            role="button"
            tabIndex={0}
            onClick={closeFilterMenu}
            onKeyDown={(e) => e.key === 'Escape' && closeFilterMenu()}
            aria-label={t('filter.close')}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              zIndex: 2500,
              cursor: 'default'
            }}
          />
          {/* Round floating close button (Material FAB) - smaller, with gap above popup */}
          <button
            onClick={closeFilterMenu}
            aria-label={t('filter.close')}
            style={{
              position: 'fixed',
              top: '62px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: isDark ? '#2a2a2a' : 'white',
              color: isDark ? '#fff' : '#333',
              fontSize: '1.25rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.1)',
              zIndex: 2502,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}
          >
            ✕
          </button>
          <div className="filter-menu" style={{
            position: 'fixed',
            top: '118px',
            left: '10px',
            right: '10px',
            backgroundColor: isDark ? '#2a2a2a' : 'white',
            borderRadius: '12px',
            padding: '1rem 0.75rem 0.75rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 2501,
            maxHeight: 'calc(100dvh - 140px)',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
          <button
            className="filter-menu-item"
            onClick={() => {
              setShowRegionFilter(!showRegionFilter);
            }}
            style={{
              width: '100%',
              padding: '0.6rem',
              marginBottom: '0.4rem',
              backgroundColor: isDark ? '#333' : '#f5f5f5',
              color: isDark ? '#fff' : '#333',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.95rem',
              cursor: 'pointer',
              textAlign: language === 'he' ? 'right' : 'left',
              direction: language === 'he' ? 'rtl' : 'ltr'
            }}
          >
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexDirection: language === 'he' ? 'row-reverse' : 'row'
            }}>
              <FaChevronDown style={{
                flexShrink: 0,
                transform: showRegionFilter ? 'none' : (language === 'he' ? 'rotate(-90deg)' : 'rotate(-90deg)'),
                transition: 'transform 0.2s ease'
              }} />
              <span>{t('filter.byRegion')}</span>
            </span>
          </button>
          
          {showRegionFilter && (
            <div style={{ 
              marginTop: '0.5rem', 
              padding: '0.5rem',
              backgroundColor: isDark ? '#333' : '#f9f9f9',
              borderRadius: '8px'
            }}>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '0.5rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  className="region-btn"
                  onClick={() => {
                    setSelectedRegions([]);
                    // Reset map center when clearing regions
                    setMapCenter([31.7683, 35.2137]);
                  }}
                  style={{
                    whiteSpace: 'nowrap',
                    fontSize: '0.9rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: selectedRegions.length === 0 ? '#8B1D24' : (isDark ? '#444' : '#e0e0e0'),
                    color: selectedRegions.length === 0 ? 'white' : (isDark ? '#fff' : '#333'),
                    border: 'none',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  >
                    {t('filter.allRegions')}
                  </button>
                {regions.map((region) => {
                  const isSelected = selectedRegions.includes(region);
                  return (
                    <button
                      key={region}
                      className="region-btn"
                      onClick={() => {
                        if (isSelected) {
                          // Remove region from selection
                          setSelectedRegions(selectedRegions.filter(r => r !== region));
                        } else {
                          // Add region to selection
                          setSelectedRegions([...selectedRegions, region]);
                        }
                      }}
                      style={{
                        whiteSpace: 'nowrap',
                        fontSize: '0.9rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: isSelected ? '#8B1D24' : (isDark ? '#444' : '#e0e0e0'),
                        color: isSelected ? 'white' : (isDark ? '#fff' : '#333'),
                        border: isSelected ? '2px solid #6b1519' : 'none',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      {isSelected && (
                        <span style={{ 
                          marginRight: language === 'he' ? '0' : '0.3rem',
                          marginLeft: language === 'he' ? '0.3rem' : '0'
                        }}>✓ </span>
                      )}
                      {getRegionName(region)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* City Filter */}
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: isDark ? '#333' : '#f9f9f9',
            borderRadius: '8px'
          }}>
            <button
              className="filter-menu-item"
              onClick={() => setShowCityFilter(!showCityFilter)}
              style={{
                width: '100%',
                padding: '0.6rem',
                marginBottom: '0.4rem',
                backgroundColor: isDark ? '#333' : '#f5f5f5',
                color: isDark ? '#fff' : '#333',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.95rem',
                cursor: 'pointer',
                textAlign: language === 'he' ? 'right' : 'left',
                direction: language === 'he' ? 'rtl' : 'ltr'
              }}
            >
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexDirection: language === 'he' ? 'row-reverse' : 'row'
              }}>
                <FaChevronDown style={{
                  flexShrink: 0,
                  transform: showCityFilter ? 'none' : 'rotate(-90deg)',
                  transition: 'transform 0.2s ease'
                }} />
                <span>{t('filter.byCity')}</span>
              </span>
            </button>
            {showCityFilter && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: isDark ? '#444' : '#fff',
                  border: `1px solid ${isDark ? '#555' : '#ddd'}`,
                  borderRadius: '8px',
                  padding: '0.4rem 0.6rem',
                  direction: language === 'he' ? 'rtl' : 'ltr'
                }}>
                  <IoSearch style={{ flexShrink: 0, fontSize: '1.1rem', color: isDark ? '#999' : '#666' }} />
                  <input
                    type="text"
                    value={citySearchQuery}
                    onChange={(e) => setCitySearchQuery(e.target.value)}
                    placeholder={language === 'he' ? 'חפש עיר או אזור...' : 'Search city or area...'}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      fontSize: '0.95rem',
                      color: isDark ? '#fff' : '#333',
                      outline: 'none'
                    }}
                  />
                  {citySearchQuery.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCitySearchQuery('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '0.2rem',
                        cursor: 'pointer',
                        color: isDark ? '#999' : '#666',
                        fontSize: '1.2rem',
                        lineHeight: 1
                      }}
                      aria-label={language === 'he' ? 'נקה' : 'Clear'}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Kosher Filter */}
          <div style={{
            marginTop: '1rem',
            padding: '0.6rem',
            backgroundColor: isDark ? '#333' : '#f9f9f9',
            borderRadius: '8px'
          }}>
            <div style={{ marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.95rem', color: isDark ? '#fff' : '#333', direction: language === 'he' ? 'rtl' : 'ltr' }}>
              {t('filter.kosher')}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {[
                { value: 'all', label: t('filter.all') },
                { value: 'kosher', label: t('filter.kosherOnly') },
                { value: 'not_kosher', label: t('filter.notKosher') }
              ].map((option) => {
                const isSelected = kosherFilter === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setKosherFilter(option.value as 'all' | 'kosher' | 'not_kosher')}
                    style={{
                      padding: '0.35rem 0.8rem',
                      borderRadius: '20px',
                      border: 'none',
                      backgroundColor: isSelected ? '#8B1D24' : (isDark ? '#444' : '#e0e0e0'),
                      color: isSelected ? 'white' : (isDark ? '#fff' : '#333'),
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '600'
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Open Now Filter */}
          <div style={{
            marginTop: '1rem',
            padding: '0.6rem',
            backgroundColor: isDark ? '#333' : '#f9f9f9',
            borderRadius: '8px'
          }}>
            <div style={{ marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.95rem', color: isDark ? '#fff' : '#333', direction: language === 'he' ? 'rtl' : 'ltr' }}>
              {t('filter.openNow')}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {[
                { value: 'all', label: t('filter.all') },
                { value: 'open', label: t('filter.openOnly') },
                { value: 'closed', label: t('filter.closedOnly') }
              ].map((option) => {
                const isSelected = openFilter === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setOpenFilter(option.value as 'all' | 'open' | 'closed')}
                    style={{
                      padding: '0.35rem 0.8rem',
                      borderRadius: '20px',
                      border: 'none',
                      backgroundColor: isSelected ? '#8B1D24' : (isDark ? '#444' : '#e0e0e0'),
                      color: isSelected ? 'white' : (isDark ? '#fff' : '#333'),
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '600'
                    }}
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


      <div className="filter-bar">
        {filters.map((filter) => {
          let isActive = false;
          // Filter button never shows as active
          if (filter.id === 'filter') {
            isActive = false;
          } else if (filter.id === 'winery') {
            isActive = activeFilter === t('filter.wineries');
          } else if (filter.id === 'wine_shops') {
            isActive = activeFilter === t('filter.wineShops');
          } else {
            isActive = activeFilter === filter.label;
          }
          
          return (
          <button
            key={filter.id}
              className={`filter-btn ${isActive ? 'active' : ''}`}
            data-type={filter.type}
              onClick={() => {
                if (filter.id === 'filter') {
                  // Filter button opens filter menu
                  if (showFilterMenu) {
                    closeFilterMenu();
                  } else {
                    setShowFilterMenu(true);
                  }
                } else if (filter.id === 'winery') {
                  // Toggle: if already showing only wineries, go back to showing all
                  if (activeFilter === t('filter.wineries')) {
                    setActiveFilter(t('filter.filter'));
                  } else {
                    setActiveFilter(t('filter.wineries'));
                  }
                } else if (filter.id === 'wine_shops') {
                  // Toggle: if already showing only wine shops, go back to showing all
                  if (activeFilter === t('filter.wineShops')) {
                    setActiveFilter(t('filter.filter'));
                  } else {
                    setActiveFilter(t('filter.wineShops'));
                  }
                } else {
                  setActiveFilter(filter.label);
                }
              }}
          >
            {filter.id === 'filter' && filter.icon && <span className="filter-icon">{filter.icon}</span>}
            {filter.label}
          </button>
          );
        })}
        <button
          className={`filter-btn ${showSortMenu ? 'active' : ''}`}
          data-type="sort"
          onClick={() => {
            if (showSortMenu) closeSortMenu();
            else setShowSortMenu(true);
          }}
          style={{ marginLeft: '0.5rem' }}
        >
          <span className="filter-icon"><FaSort size={18} /></span>
          {language === 'he' ? 'מיון' : 'Sort'}
        </button>
      </div>

      {/* Sort popup */}
      {showSortMenu && (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={closeSortMenu}
            onKeyDown={(e) => e.key === 'Escape' && closeSortMenu()}
            aria-label={language === 'he' ? 'סגור מיון' : 'Close sort'}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              zIndex: 2500,
              cursor: 'default'
            }}
          />
          <button
            onClick={closeSortMenu}
            aria-label={language === 'he' ? 'סגור' : 'Close'}
            style={{
              position: 'fixed',
              top: '62px',
              right: '10px',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: isDark ? '#2a2a2a' : 'white',
              color: isDark ? '#fff' : '#333',
              fontSize: '1.25rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              zIndex: 2502,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
          <div
            style={{
              position: 'fixed',
              top: '118px',
              left: '10px',
              right: '10px',
              backgroundColor: isDark ? '#2a2a2a' : 'white',
              borderRadius: '12px',
              padding: '1rem 0.75rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              zIndex: 2501,
              maxHeight: 'calc(100dvh - 140px)',
              overflowY: 'auto',
              direction: language === 'he' ? 'rtl' : 'ltr'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '1rem', fontWeight: '600', fontSize: '1rem', color: isDark ? '#fff' : '#333' }}>
              {language === 'he' ? 'מיון לפי מרחק (ק"מ)' : 'Within distance (km)'}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              backgroundColor: isDark ? '#444' : '#f5f5f5',
              border: `1px solid ${isDark ? '#555' : '#ddd'}`,
              borderRadius: '8px',
              padding: '0.5rem 0.75rem'
            }}>
              <input
                type="text"
                inputMode="decimal"
                value={sortMaxKm}
                onChange={(e) => setSortMaxKm(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder={language === 'he' ? 'הזן ק"מ (למשל 10)' : 'Enter km (e.g. 10)'}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: '0.95rem',
                  color: isDark ? '#fff' : '#333',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem', fontWeight: '600', fontSize: '1rem', color: isDark ? '#fff' : '#333' }}>
              {language === 'he' ? 'מיון לפי שם' : 'Filter by name'}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: isDark ? '#444' : '#f5f5f5',
              border: `1px solid ${isDark ? '#555' : '#ddd'}`,
              borderRadius: '8px',
              padding: '0.5rem 0.75rem'
            }}>
              <IoSearch style={{ flexShrink: 0, fontSize: '1.1rem', color: isDark ? '#999' : '#666' }} />
              <input
                type="text"
                value={sortByNameQuery}
                onChange={(e) => setSortByNameQuery(e.target.value)}
                placeholder={language === 'he' ? 'הקלד שם...' : 'Type name...'}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: '0.95rem',
                  color: isDark ? '#fff' : '#333',
                  outline: 'none'
                }}
              />
              {sortByNameQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSortByNameQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.2rem',
                    cursor: 'pointer',
                    color: isDark ? '#999' : '#666',
                    fontSize: '1.2rem',
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </>
      )}

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
            top: '186px',
            zIndex: 1000,
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '1px solid #ddd',
            backgroundColor: '#fff',
            color: '#333',
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
                <div className="winery-popup" style={{
                  direction: language === 'he' ? 'rtl' : 'ltr',
                  textAlign: language === 'he' ? 'right' : 'left',
                  backgroundColor: isDark ? '#2a2a2a' : 'white',
                  color: isDark ? '#fff' : '#333'
                }}>
                  <h3 style={{
                    direction: language === 'he' ? 'rtl' : 'ltr',
                    textAlign: language === 'he' ? 'right' : 'left',
                    color: '#8B1D24'
                  }}>{(() => {
                    const translated = translateName(winery.properties.name || '', language);
                    return translated || 'יקב';
                  })()}</h3>
                  
                  {/* Logo - Show if paid */}
                  {winery.properties.logo_paid && winery.properties.logo_url && (
                    <div style={{
                      textAlign: 'center',
                      margin: '0.5rem 0'
                    }}>
                      <img
                        src={winery.properties.logo_url}
                        alt={`${translateName(winery.properties.name || '', language) || 'Winery'} logo`}
                        style={{
                          maxWidth: '80px',
                          maxHeight: '80px',
                          objectFit: 'contain',
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          padding: '4px',
                          borderRadius: '4px',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Region */}
                  {winery.properties.region && (
                    <p className="region" style={{
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left',
                      color: isDark ? '#ccc' : '#666',
                      fontSize: '0.9rem',
                      margin: '0.25rem 0'
                    }}>
                      🗺️ {getRegionName(winery.properties.region)}
                    </p>
                  )}

                  {/* Address */}
                  {winery.properties.address && (
                    <p className="address" style={{
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left',
                      color: isDark ? '#ccc' : '#666'
                    }}>
                      <i className="fas fa-map-marker-alt"></i> {translateAddress(winery.properties.address, language)}
                    </p>
                  )}

                  {/* Open/Closed Status - Only show if opening hours exist */}
                  {winery.properties.opening_hours && (() => {
                    // Use device's current time (phone's clock) to determine if open
                    const isOpen = isCurrentlyOpen(winery.properties.opening_hours);
                    return (
                      <p key={`winery-status-${winery.properties.place_id || winery.properties.name}-${timeKey}`} className="status" style={{
                        direction: language === 'he' ? 'rtl' : 'ltr',
                        textAlign: language === 'he' ? 'right' : 'left',
                        color: isOpen ? (isDark ? '#4caf50' : '#28a745') : (isDark ? '#f44336' : '#dc3545'),
                        fontSize: '0.9rem',
                        margin: '0.25rem 0',
                        fontWeight: '500'
                      }}>
                        {isOpen ? '🟢' : '🔴'} {isOpen ? t('list.openNow') : t('list.closed')}
                      </p>
                    );
                  })()}

                  {/* Opening Hours - Always show if exists */}
                  {winery.properties.opening_hours && (() => {
                    const formattedHours = formatOpeningHours(winery.properties.opening_hours);
                    // Always show if opening_hours exists, even if formatted is empty (fallback to original)
                    const displayHours = formattedHours || (typeof winery.properties.opening_hours === 'string' 
                      ? winery.properties.opening_hours 
                      : Array.isArray(winery.properties.opening_hours) 
                        ? winery.properties.opening_hours.join(' • ')
                        : '');
                    
                    if (!displayHours) return null;
                    
                    return (
                      <p className="opening-hours" style={{
                        direction: language === 'he' ? 'rtl' : 'ltr',
                        textAlign: language === 'he' ? 'right' : 'left',
                        color: isDark ? '#ccc' : '#666',
                        fontSize: '0.9rem',
                        margin: '0.5rem 0'
                      }}>
                        <i className="fas fa-clock"></i> {displayHours}
                      </p>
                    );
                  })()}

                  {/* Phone */}
                  {winery.properties.phone && (
                    <a 
                      href={`tel:${formatPhoneForTel(winery.properties.phone)}`}
                      className="phone" 
                      style={{
                        direction: language === 'he' ? 'rtl' : 'ltr',
                        textAlign: language === 'he' ? 'right' : 'left',
                        color: isDark ? '#ccc' : '#666',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                      }}
                    >
                      <i className="fas fa-phone"></i> 
                      <span 
                        style={{
                          transition: 'text-decoration 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none';
                        }}
                      >
                        {winery.properties.phone}
                      </span>
                    </a>
                  )}

                  {/* Website */}
                  {winery.properties.website && (
                    <a href={normalizeUrl(winery.properties.website)} target="_blank" rel="noopener noreferrer" style={{
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left',
                      color: isDark ? '#b0b0b0' : '#666',
                      display: 'block',
                      marginBottom: '0.5rem',
                      textDecoration: 'none'
                    }}>🌐 {t('map.website')}</a>
                  )}

                  {/* Kosher Badge */}
                  {(() => {
                    const kosherValue = winery.properties.kosher;
                    if (kosherValue === true || (kosherValue !== null && kosherValue !== undefined && String(kosherValue).toLowerCase().trim() === 'true')) {
                      return (
                        <p className="kosher" style={{
                          direction: language === 'he' ? 'rtl' : 'ltr',
                          textAlign: language === 'he' ? 'right' : 'left',
                          color: isDark ? '#4caf50' : '#28a745',
                          fontSize: '0.9rem',
                          margin: '0.25rem 0',
                          fontWeight: '500'
                        }}>
                          ✓ {t('list.kosher')}
                        </p>
                      );
                    }
                    return null;
                  })()}

                  {/* Offers */}
                  {winery.properties.offers && (() => {
                    const offerKey = `${winery.properties.place_id || winery.properties.name || ''}-winery`;
                    const translated = translatedOffers.get(offerKey);
                    const parsed = parseOffer(winery.properties.offers, t('list.offersAndDeals'));
                    const offerName = translated?.name || parsed.name;
                    const offerDescription = translated?.description || parsed.description;
                    
                    return (
                      <button
                        onClick={() => setSelectedOffer({ 
                          name: offerName, 
                          description: offerDescription, 
                          wineryName: translateName(winery.properties.name || '', language) || 'יקב'
                        })}
                        style={{
                          direction: language === 'he' ? 'rtl' : 'ltr',
                          backgroundColor: 'transparent',
                          color: '#b81f45',
                          border: '1px solid #b81f45',
                          borderRadius: '8px',
                          padding: '0.45rem 0.9rem',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          marginTop: '0.5rem',
                          marginBottom: '0.5rem',
                          width: '100%',
                          textAlign: 'center',
                          whiteSpace: 'normal',
                          lineHeight: '1.2'
                        }}
                      >
                        % {t('list.offersAndDeals')}
                      </button>
                    );
                  })()}
                  <button 
                    className="waze-button"
                    onClick={() => handleWazeNavigation(
                      winery.geometry.coordinates[1],
                      winery.geometry.coordinates[0]
                    )}
                    style={{
                      direction: language === 'he' ? 'rtl' : 'ltr'
                    }}
                  >
                    <img src={wazeIcon} alt="Waze" className="waze-icon" />
                    {t('map.navigate')}
                  </button>
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
                <div className="shop-popup" style={{
                  direction: language === 'he' ? 'rtl' : 'ltr',
                  textAlign: language === 'he' ? 'right' : 'left',
                  backgroundColor: isDark ? '#2a2a2a' : 'white',
                  color: isDark ? '#fff' : '#333'
                }}>
                  <img src={shopMarkerIcon} alt="Shop Marker" style={{ width: 32, height: 32, marginBottom: 8 }} />
                  <h3 style={{
                    direction: language === 'he' ? 'rtl' : 'ltr',
                    textAlign: language === 'he' ? 'right' : 'left',
                    color: '#8B1D24'
                  }}>{(() => {
                    const translated = translateName(shop.properties.name || '', language);
                    return translated || 'חנות יין';
                  })()}</h3>
                  
                  {/* Logo - Show if paid */}
                  {shop.properties.logo_paid && shop.properties.logo_url && (
                    <div style={{
                      textAlign: 'center',
                      margin: '0.5rem 0'
                    }}>
                      <img
                        src={shop.properties.logo_url}
                        alt={`${translateName(shop.properties.name || '', language) || 'Wine Shop'} logo`}
                        style={{
                          maxWidth: '80px',
                          maxHeight: '80px',
                          objectFit: 'contain',
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          padding: '4px',
                          borderRadius: '4px',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Region */}
                  {shop.properties.region && (
                    <p className="region" style={{
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left',
                      color: isDark ? '#ccc' : '#666',
                      fontSize: '0.9rem',
                      margin: '0.25rem 0'
                    }}>
                      🗺️ {getRegionName(shop.properties.region)}
                    </p>
                  )}

                  {/* Address */}
                  {shop.properties.address && (
                    <p className="address" style={{
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left',
                      color: isDark ? '#ccc' : '#666'
                    }}>
                      <i className="fas fa-map-marker-alt"></i> {translateAddress(shop.properties.address, language)}
                    </p>
                  )}

                  {/* Open/Closed Status - Only show if opening hours exist */}
                  {shop.properties.opening_hours && (() => {
                    // Use device's current time (phone's clock) to determine if open
                    const isOpen = isCurrentlyOpen(shop.properties.opening_hours);
                    return (
                      <p key={`shop-status-${shop.properties.place_id || shop.properties.name}-${timeKey}`} className="status" style={{
                        direction: language === 'he' ? 'rtl' : 'ltr',
                        textAlign: language === 'he' ? 'right' : 'left',
                        color: isOpen ? (isDark ? '#4caf50' : '#28a745') : (isDark ? '#f44336' : '#dc3545'),
                        fontSize: '0.9rem',
                        margin: '0.25rem 0',
                        fontWeight: '500'
                      }}>
                        {isOpen ? '🟢' : '🔴'} {isOpen ? t('list.openNow') : t('list.closed')}
                      </p>
                    );
                  })()}

                  {/* Opening Hours - Always show if exists */}
                  {shop.properties.opening_hours && (() => {
                    const formattedHours = formatOpeningHours(shop.properties.opening_hours);
                    // Always show if opening_hours exists, even if formatted is empty (fallback to original)
                    const displayHours = formattedHours || (typeof shop.properties.opening_hours === 'string' 
                      ? shop.properties.opening_hours 
                      : Array.isArray(shop.properties.opening_hours) 
                        ? shop.properties.opening_hours.join(' • ')
                        : '');
                    
                    if (!displayHours) return null;
                    
                    return (
                      <p className="opening-hours" style={{
                        direction: language === 'he' ? 'rtl' : 'ltr',
                        textAlign: language === 'he' ? 'right' : 'left',
                        color: isDark ? '#ccc' : '#666',
                        fontSize: '0.9rem',
                        margin: '0.5rem 0'
                      }}>
                        <i className="fas fa-clock"></i> {displayHours}
                      </p>
                    );
                  })()}

                  {/* Phone */}
                  {shop.properties.phone && (
                    <a 
                      href={`tel:${formatPhoneForTel(shop.properties.phone)}`}
                      className="phone" 
                      style={{
                        direction: language === 'he' ? 'rtl' : 'ltr',
                        textAlign: language === 'he' ? 'right' : 'left',
                        color: isDark ? '#ccc' : '#666',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                      }}
                    >
                      <i className="fas fa-phone"></i> 
                      <span 
                        style={{
                          transition: 'text-decoration 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none';
                        }}
                      >
                        {shop.properties.phone}
                      </span>
                    </a>
                  )}

                  {/* Website */}
                  {shop.properties.website && (
                    <a href={normalizeUrl(shop.properties.website)} target="_blank" rel="noopener noreferrer" style={{
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left',
                      color: isDark ? '#b0b0b0' : '#666',
                      display: 'block',
                      marginBottom: '0.5rem',
                      textDecoration: 'none'
                    }}>🌐 {t('map.website')}</a>
                  )}

                  {/* Kosher Badge */}
                  {(() => {
                    const kosherValue = shop.properties.kosher;
                    if (kosherValue === true || (kosherValue !== null && kosherValue !== undefined && String(kosherValue).toLowerCase().trim() === 'true')) {
                      return (
                        <p className="kosher" style={{
                          direction: language === 'he' ? 'rtl' : 'ltr',
                          textAlign: language === 'he' ? 'right' : 'left',
                          color: isDark ? '#4caf50' : '#28a745',
                          fontSize: '0.9rem',
                          margin: '0.25rem 0',
                          fontWeight: '500'
                        }}>
                          ✓ {t('list.kosher')}
                        </p>
                      );
                    }
                    return null;
                  })()}

                  {/* Offers */}
                  {shop.properties.offers && (() => {
                    const offerKey = `${shop.properties.place_id || shop.properties.name || ''}-shop`;
                    const translated = translatedOffers.get(offerKey);
                    const parsed = parseOffer(shop.properties.offers, t('list.offersAndDeals'));
                    const offerName = translated?.name || parsed.name;
                    const offerDescription = translated?.description || parsed.description;
                    
                    return (
                      <button
                        onClick={() => setSelectedOffer({ 
                          name: offerName, 
                          description: offerDescription, 
                          wineryName: translateName(shop.properties.name || '', language) || 'חנות יין'
                        })}
                        style={{
                          direction: language === 'he' ? 'rtl' : 'ltr',
                          backgroundColor: 'transparent',
                          color: '#b81f45',
                          border: '1px solid #b81f45',
                          borderRadius: '8px',
                          padding: '0.45rem 0.9rem',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          marginTop: '0.5rem',
                          marginBottom: '0.5rem',
                          width: '100%',
                          textAlign: 'center',
                          whiteSpace: 'normal',
                          lineHeight: '1.2'
                        }}
                      >
                        % {t('list.offersAndDeals')}
                      </button>
                    );
                  })()}
                  <button 
                    className="waze-button"
                    onClick={() => handleWazeNavigation(
                      shop.geometry.coordinates[1],
                      shop.geometry.coordinates[0]
                    )}
                              style={{
                                direction: language === 'he' ? 'rtl' : 'ltr'
                              }}
                  >
                    <img src={wazeIcon} alt="Waze" className="waze-icon" />
                              {t('map.navigate')}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
          <MapCenter
            center={mapCenter}
            zoom={isSearchActive && searchResults.length > 0 ? 13 : (selectedRegions.length > 0 ? 10 : 11)}
          />
        </MapContainer>
      </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="list-view" style={{
          position: 'absolute',
          top: '186px',
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: 'auto',
          overflowX: 'visible',
          padding: '1rem',
          paddingBottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
          backgroundColor: isDark ? '#1a1a1a' : '',
          zIndex: 1,
          direction: language === 'he' ? 'rtl' : 'ltr',
          textAlign: language === 'he' ? 'right' : 'left'
        }} /**backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5', */
        ref={listViewRef}>
          {!isSearchActive && (
            <div style={{
              marginBottom: '1rem',
              paddingBottom: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: '600',
              color: isDark ? '#fff' : '#333',
              direction: language === 'he' ? 'rtl' : 'ltr',
              textAlign: language === 'he' ? 'right' : 'left'
            }}>
              {listHeaderText}
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
              direction: language === 'he' ? 'rtl' : 'ltr'
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
            const lat = item.geometry.coordinates[1];
            const lng = item.geometry.coordinates[0];
            const itemKey = item.properties.place_id || item.properties.name || `item-${index}`;
            const distance = userLocation 
              ? Math.round(calculateDistance(userLocation.lat, userLocation.lng, lat, lng))
              : null;
            const isShop = (() => {
              const placeId = item.properties.place_id || '';
              const name = item.properties.name || '';
              if (placeId && wineShopIds.has(`id:${placeId}`)) return true;
              if (name && wineShopIds.has(`name:${name}`)) return true;
              return false;
            })();
            
            return (
              <div
                key={`${item.properties.name}-${language}-${renderKey}-${index}`}
                className="winery-list-item"
                style={{
                  backgroundColor: isDark ? '#2a2a2a' : 'white',
                  borderRadius: '16px',
                  padding: '1.35rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0',
                  boxShadow: isDark ? '0 6px 20px rgba(0, 0, 0, 0.4)' : '0 6px 20px rgba(0, 0, 0, 0.15)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                  position: 'relative',
                  overflow: 'visible',
                  direction: language === 'he' ? 'rtl' : 'ltr',
                  textAlign: language === 'he' ? 'right' : 'left',
                  justifyContent: 'flex-start',
                  alignItems: 'stretch'
                }}
              >
                {/* Header row: winery/shop name only - full width, no border */}
                <div style={{
                  width: '100%',
                  paddingTop: '0.5rem',
                  paddingBottom: '0.75rem',
                  marginBottom: '0.25rem',
                  borderBottom: 'none',
                  direction: language === 'he' ? 'rtl' : 'ltr',
                  textAlign: language === 'he' ? 'right' : 'left'
                }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.3rem',
                    fontWeight: 'bold',
                    color: isDark ? '#fff' : '#3d3d3d',
                    textAlign: language === 'he' ? 'right' : 'left',
                    direction: language === 'he' ? 'rtl' : 'ltr'
                  }}>
                    {(() => {
                      const translated = translateName(item.properties.name || '', language);
                      return translated || 'יקב';
                    })()}
                  </h3>
                </div>

                {/* Two columns row: data + image */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: '1rem',
                  alignItems: language === 'he' ? 'flex-start' : 'flex-start',
                  justifyContent: language === 'he' ? 'flex-end' : 'flex-start',
                  direction: language === 'he' ? 'rtl' : 'ltr'
                }}>
                {/* Type Badge - Winery / Shop: inside card, top-left always, with icon; fixed height for both */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  borderTopLeftRadius: '16px',
                  borderBottomRightRadius: '8px',
                  backgroundColor: isShop ? '#5e3b8b' : '#b81f45',
                  color: 'white',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  zIndex: 1000,
                  boxShadow: isDark ? '0 2px 4px rgba(0, 0, 0, 0.5)' : '0 2px 4px rgba(0, 0, 0, 0.25)',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                  pointerEvents: 'none',
                  transform: 'translateZ(0)',
                  lineHeight: '1.2',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  direction: language === 'he' ? 'rtl' : 'ltr',
                  minHeight: '34px',
                  boxSizing: 'border-box'
                }}>
                  {isShop ? <FaShoppingCart size={18} style={{ flexShrink: 0 }} /> : <img src={topbarWineryIcon} alt="" style={{ width: 22, height: 22, objectFit: 'contain', filter: 'brightness(0) invert(1)', flexShrink: 0 }} />}
                  <span>{isShop ? t('list.wineShop') : t('list.winery')}</span>
                </div>
                
                {/* Information - Right side in Hebrew, Left side in English/Russian */}
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.75rem',
                  direction: language === 'he' ? 'rtl' : 'ltr',
                  textAlign: language === 'he' ? 'right' : 'left',
                  width: '100%',
                  alignItems: language === 'he' ? 'stretch' : 'flex-start',
                  alignSelf: language === 'he' ? 'flex-end' : 'flex-start',
                  order: language === 'he' ? 1 : 1,
                  fontSize: '1rem',
                  fontFamily: 'var(--apple-font)',
                  fontWeight: 500,
                  color: isDark ? '#d0d0d0' : '#444',
                  marginLeft: language === 'he' ? '0' : '0',
                  minWidth: 0 // Prevent flex shrinking issues
                }}>
                  {/* Distance + Region - one line: [map icon] distance, (region) */}
                  {((userLocation && distance !== null) || item.properties.region) && (() => {
                    const distanceStr = userLocation && distance !== null
                      ? (distance < 1000 ? `${distance} ${t('list.distance')}` : `${(distance / 1000).toFixed(1)} ${t('list.distanceKm')}`)
                      : '';
                    const regionName = item.properties.region ? getRegionName(item.properties.region) : '';
                    const lineParts: string[] = [];
                    if (distanceStr) lineParts.push(distanceStr);
                    if (regionName) lineParts.push(`(${regionName})`);
                    const lineText = lineParts.join(', ');
                    if (!lineText) return null;
                    return (
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: language === 'he' ? 'row-reverse' : 'row',
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        color: isDark ? '#d0d0d0' : '#444', 
                        fontSize: '1rem', 
                        fontWeight: 500,
                        direction: language === 'he' ? 'rtl' : 'ltr',
                        justifyContent: language === 'he' ? 'flex-end' : 'flex-start',
                        textAlign: language === 'he' ? 'right' : 'left',
                        alignSelf: language === 'he' ? 'flex-end' : 'flex-start',
                        width: language === 'he' ? '100%' : 'auto',
                        flexShrink: 0,
                        marginTop: '0.25rem'
                      }}>
                        {language === 'he' ? (
                          <>
                            <span style={{ textAlign: 'right', flex: 1 }}>{lineText}</span>
                            <IoMapOutline size={listIconSize} color={listIconColor} />
                          </>
                        ) : (
                          <>
                            <IoMapOutline size={listIconSize} color={listIconColor} />
                            <span style={{ textAlign: 'left' }}>{lineText}</span>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Address - Always show if address exists */}
                  {item.properties.address && (() => {
                    const translatedAddress = translateAddress(item.properties.address, language);
                    // Use translated address if available and meaningful, otherwise fallback to original only if language is Hebrew
                    let displayAddress = translatedAddress;
                    if (!displayAddress || displayAddress.trim() === '') {
                      // Only show original if language is Hebrew (to avoid showing Hebrew in other languages)
                      if (language === 'he') {
                        displayAddress = item.properties.address;
                      } else {
                        // Don't show Hebrew addresses in non-Hebrew languages
                        return null;
                      }
                    }
                    
                    // Don't show addresses that are only numbers
                    const plusCodePattern = /[A-Z0-9]{4}\+[A-Z0-9]{2,3}[A-Z0-9]*/i;
                    const isOnlyNumbers = /^[\d\s,]+$/.test(displayAddress.replace(plusCodePattern, '').trim());
                    if (isOnlyNumbers) {
                      return null;
                    }
                    
                    if (!displayAddress || displayAddress.trim() === '') return null;
                    
                    return (
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: language === 'he' ? 'row-reverse' : 'row',
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        color: isDark ? '#d0d0d0' : '#444', 
                        fontSize: '1rem', 
                        direction: language === 'he' ? 'rtl' : 'ltr',
                        justifyContent: language === 'he' ? 'flex-end' : 'flex-start',
                        textAlign: language === 'he' ? 'right' : 'left',
                        alignSelf: language === 'he' ? 'flex-end' : 'flex-start',
                        width: language === 'he' ? '100%' : 'auto',
                        flexShrink: 0
                      }}>
                        {language === 'he' ? (
                          <>
                            <span style={{ textAlign: 'right', flex: 1, lineHeight: '1.5' }}>{displayAddress}</span>
                            <span className="winery-list-location-icon"><IoLocationOutline size={20} color={listIconColor} /></span>
                          </>
                        ) : (
                          <>
                            <span className="winery-list-location-icon"><IoLocationOutline size={20} color={listIconColor} /></span>
                            <span style={{ textAlign: 'left', flex: 1, lineHeight: '1.5' }}>{displayAddress}</span>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Open/Closed + Opening Hours - one line: closed = "לצפייה בשעות" + chevron; open = "נסגר ב־HH:MM" */}
                  {item.properties.opening_hours && (() => {
                    const isOpen = isCurrentlyOpen(item.properties.opening_hours);
                    const closingTime = getClosingTimeToday(item.properties.opening_hours);
                    const formattedHours = formatOpeningHours(item.properties.opening_hours);
                    const displayHours = formattedHours || (typeof item.properties.opening_hours === 'string' 
                      ? item.properties.opening_hours 
                      : Array.isArray(item.properties.opening_hours) 
                        ? item.properties.opening_hours.join(' • ')
                        : '');
                    const isExpanded = expandedHours.has(itemKey);
                    const toggleExpanded = () => {
                      setExpandedHours((prev) => {
                        const next = new Set(prev);
                        if (next.has(itemKey)) next.delete(itemKey);
                        else next.add(itemKey);
                        return next;
                      });
                    };
                    const statusColor = isOpen ? (isDark ? '#4caf50' : '#28a745') : (isDark ? '#f44336' : '#dc3545');
                    const secondaryColor = isDark ? '#d0d0d0' : '#444';
                    return (
                      <>
                        <div
                          key={`list-status-${itemKey}-${timeKey}`}
                          style={{
                            display: 'flex',
                            flexDirection: language === 'he' ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: statusColor,
                            fontSize: '1rem',
                            fontWeight: 500,
                            direction: language === 'he' ? 'rtl' : 'ltr',
                            justifyContent: language === 'he' ? 'flex-end' : 'flex-start',
                            textAlign: language === 'he' ? 'right' : 'left',
                            alignSelf: language === 'he' ? 'flex-end' : 'flex-start',
                            width: language === 'he' ? '100%' : 'auto',
                            flexShrink: 0
                          }}
                        >
                          {language === 'he' ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', textAlign: 'right', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <span>{isOpen ? t('list.openNow') : t('list.closed')}</span>
                                {isOpen && closingTime && (
                                  <span style={{ color: secondaryColor, fontWeight: 400 }}>{t('list.closesAt')}{closingTime}</span>
                                )}
                                {!isOpen && (
                                  <>
                                    <span style={{ color: secondaryColor, fontWeight: 400 }}>{t('list.toViewHours')}</span>
                                    <button
                                      onClick={toggleExpanded}
                                      style={{ background: 'transparent', border: 'none', color: secondaryColor, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                                      aria-label={isExpanded ? 'סגור שעות' : 'פתח שעות'}
                                    >
                                      <FaChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : undefined }} />
                                    </button>
                                  </>
                                )}
                                {isOpen && (
                                  <button
                                    onClick={toggleExpanded}
                                    style={{ background: 'transparent', border: 'none', color: secondaryColor, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                                    aria-label={isExpanded ? 'סגור שעות' : 'פתח שעות'}
                                  >
                                    <FaChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : undefined }} />
                                  </button>
                                )}
                              </div>
                              <FaRegClock size={listIconSize} color={listIconColor} />
                            </>
                          ) : (
                            <>
                              <FaRegClock size={listIconSize} color={listIconColor} />
                              <div style={{ display: 'flex', alignItems: 'center', textAlign: 'left', gap: '0.35rem', flexWrap: 'wrap' }}>
                                <span>{isOpen ? t('list.openNow') : t('list.closed')}</span>
                                {isOpen && closingTime && (
                                  <span style={{ color: secondaryColor, fontWeight: 400 }}>{t('list.closesAt')}{closingTime}</span>
                                )}
                                {!isOpen && (
                                  <>
                                    <span style={{ color: secondaryColor, fontWeight: 400 }}>{t('list.toViewHours')}</span>
                                    <button
                                      onClick={toggleExpanded}
                                      style={{ background: 'transparent', border: 'none', color: secondaryColor, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                                      aria-label={isExpanded ? 'Hide hours' : 'Show hours'}
                                    >
                                      <FaChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : undefined }} />
                                    </button>
                                  </>
                                )}
                                {isOpen && (
                                  <button
                                    onClick={toggleExpanded}
                                    style={{ background: 'transparent', border: 'none', color: secondaryColor, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                                    aria-label={isExpanded ? 'Hide hours' : 'Show hours'}
                                  >
                                    <FaChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : undefined }} />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        {isExpanded && displayHours && (
                          <div style={{ 
                            color: isDark ? '#d0d0d0' : '#444', 
                            fontSize: '1rem', 
                            lineHeight: '1.5',
                            direction: language === 'he' ? 'rtl' : 'ltr',
                            textAlign: language === 'he' ? 'right' : 'left',
                            width: '100%'
                          }}>
                            {displayHours}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Phone */}
                  {item.properties.phone && (
                    <a 
                      href={`tel:${formatPhoneForTel(item.properties.phone)}`}
                      style={{ 
                        display: 'flex', 
                        flexDirection: language === 'he' ? 'row-reverse' : 'row',
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        color: isDark ? '#d0d0d0' : '#444', 
                        fontSize: '1rem',
                        direction: language === 'he' ? 'rtl' : 'ltr',
                        justifyContent: language === 'he' ? 'flex-end' : 'flex-start',
                        textAlign: language === 'he' ? 'right' : 'left',
                        alignSelf: language === 'he' ? 'flex-end' : 'flex-start',
                        width: language === 'he' ? '100%' : 'auto',
                        flexShrink: 0,
                        textDecoration: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {language === 'he' ? (
                        <>
                          <span 
                            style={{ 
                              textAlign: 'right', 
                              flex: 1,
                              transition: 'text-decoration 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            {item.properties.phone}
                          </span>
                          <IoCallOutline size={listIconSize} color={listIconColor} />
                        </>
                      ) : (
                        <>
                          <IoCallOutline size={listIconSize} color={listIconColor} />
                          <span 
                            style={{ 
                              textAlign: 'left',
                              transition: 'text-decoration 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            {item.properties.phone}
                          </span>
                        </>
                      )}
                    </a>
                  )}

                  {/* Website */}
                  {item.properties.website && (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: language === 'he' ? 'row-reverse' : 'row',
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      color: isDark ? '#8B1D24' : '#0066cc', 
                      fontSize: '1rem', 
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      justifyContent: language === 'he' ? 'flex-end' : 'flex-start',
                      textAlign: language === 'he' ? 'right' : 'left',
                      alignSelf: language === 'he' ? 'flex-end' : 'flex-start',
                      width: language === 'he' ? '100%' : 'auto',
                      flexShrink: 0
                    }}>
                      {language === 'he' ? (
                        <>
                          <a 
                            href={normalizeUrl(item.properties.website)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              textAlign: 'right', 
                              flex: 1, 
                              color: isDark ? '#d0d0d0' : '#444',
                              textDecoration: 'none'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t('list.website')}
                          </a>
                          <IoGlobeOutline size={listIconSize} color={listIconColor} />
                        </>
                      ) : (
                        <>
                          <IoGlobeOutline size={listIconSize} color={listIconColor} />
                          <a 
                            href={normalizeUrl(item.properties.website)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              textAlign: 'left', 
                              color: isDark ? '#d0d0d0' : '#444',
                              textDecoration: 'none'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t('list.website')}
                          </a>
                        </>
                      )}
                    </div>
                  )}

                  {/* Offers - label: red bg, white text, radius 25px, compact like type badge; only if offer exists */}
                  {item.properties.offers && (() => {
                    const offerKey = `${item.properties.place_id || item.properties.name || ''}-offer`;
                    const translated = translatedOffers.get(offerKey);
                    const parsed = parseOffer(item.properties.offers, t('list.offersAndDeals'));
                    const offerName = translated?.name || parsed.name;
                    const offerDescription = translated?.description || parsed.description;
                    const offerRed = 'rgb(184, 31, 69)';
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOffer({
                            name: offerName,
                            description: offerDescription,
                            wineryName: translateName(item.properties.name || '', language) || (language === 'he' ? 'יקב' : language === 'ru' ? 'Винодельня' : 'Winery')
                          });
                        }}
                        style={{
                          backgroundColor: offerRed,
                          color: 'white',
                          border: 'none',
                          borderRadius: '25px',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          flexDirection: language === 'he' ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: '0.35rem',
                          marginTop: '0.5rem',
                          alignSelf: 'flex-start',
                          direction: language === 'he' ? 'rtl' : 'ltr',
                          lineHeight: '1.2',
                          fontFamily: 'Arial, Helvetica, sans-serif',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)'
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap' }}>{t('list.specialOffer')}</span>
                        <span style={{ flexShrink: 0 }}>%</span>
                      </button>
                    );
                  })()}

                  {/* Go There - Waze icon (current size) + "סע לשם" in darker blue, no button box */}
                  <button
                    onClick={() => handleWazeNavigation(lat, lng)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#0088bb',
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: language === 'he' ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginTop: '0.15rem',
                      padding: 0,
                      alignSelf: language === 'he' ? 'flex-end' : 'flex-start',
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      justifyContent: language === 'he' ? 'flex-end' : 'flex-start',
                      width: language === 'he' ? '100%' : 'auto',
                      flexShrink: 0
                    }}
                  >
                    {language === 'he' ? (
                      <>
                        <span style={{ textAlign: 'right', flex: 1 }}>{t('list.goThere')}</span>
                        <img src={wazeIcon} alt="Waze" style={{ width: 28, height: 28, flexShrink: 0 }} />
                      </>
                    ) : (
                      <>
                        <img src={wazeIcon} alt="Waze" style={{ width: 28, height: 28, flexShrink: 0 }} />
                        <span style={{ textAlign: 'left' }}>{t('list.goThere')}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Wine Bottle Image - Right side in Hebrew and English/Russian; Kosher badge inside above bottle */}
                <div style={{
                  height: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  flexShrink: 0,
                  position: 'relative',
                  overflow: 'visible',
                  order: language === 'he' ? 2 : 2,
                  alignSelf: language === 'he' ? 'flex-start' : 'auto',
                  paddingTop: language === 'he' ? '0.5rem' : '0'
                }}>
                  {isItemKosher(item) && (
                    <div style={{
                      backgroundColor: isDark ? '#555' : '#444',
                      color: 'white',
                      padding: '0.35rem 0.7rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      marginBottom: '0.5rem',
                      boxShadow: isDark ? '0 2px 4px rgba(0, 0, 0, 0.5)' : '0 2px 4px rgba(0, 0, 0, 0.25)',
                      whiteSpace: 'nowrap',
                      fontFamily: 'Arial, Helvetica, sans-serif',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                      lineHeight: '1.2'
                    }}>
                      {t('list.kosher')}
                    </div>
                  )}
                  <img 
                    src={bottleImage} 
                    alt="Wine bottle" 
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain'
                    }}
                  />
                  {/* Logo overlay on bottle if paid */}
                  {item.properties.logo_paid && item.properties.logo_url && (
                    <img
                      src={item.properties.logo_url}
                      alt={`${translateName(item.properties.name || '', language) || 'Winery'} logo`}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        maxWidth: '60px',
                        maxHeight: '60px',
                        objectFit: 'contain',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        padding: '4px',
                        borderRadius: '4px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                        zIndex: 10
                      }}
                      onError={(e) => {
                        // Hide logo if image fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                </div>
              </div>
            );
          })}

                  {getFilteredItems().length === 0 && !isLoading && (
                    <div style={{
                      textAlign: 'center',
                      padding: '3rem',
                      color: '#666',
                      direction: language === 'he' ? 'rtl' : 'ltr'
                    }}>
                      {selectedRegions.length > 0
                        ? `${t('list.noResultsRegion')} ${selectedRegions.map(r => getRegionName(r)).join(', ')}`
                        : t('list.noResults')}
                    </div>
                  )}
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
              direction: language === 'he' ? 'rtl' : 'ltr'
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
                  direction: language === 'he' ? 'rtl' : 'ltr',
                  textAlign: language === 'he' ? 'right' : 'left'
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
              direction: language === 'he' ? 'rtl' : 'ltr',
              fontSize: '0.9rem',
              borderTop: '1px solid #eee'
            }}>
              {'הקש Enter או לחץ על כפתור החיפוש כדי לראות תוצאות'}
            </div>
          </div>
        </div>
      )}

      <div className="bottom-nav">
        <button 
          className="bottom-nav-item"
          onClick={() => {
            closeFilterMenu();
            navigate('/');
          }}
        >
          <span className="nav-icon">
            <IoHome size={26} />
          </span>
          <span>{t('nav.home')}</span>
        </button>
        <button 
          className={`bottom-nav-item ${viewMode === 'map' ? 'active' : ''}`}
          onClick={() => setViewMode('map')}
        >
          <span className="nav-icon">
            <FaRegMap size={26} />
          </span>
          <span>{t('nav.map')}</span>
        </button>
        <button 
          className={`bottom-nav-item ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => {
            closeFilterMenu();
            setViewMode('list');
          }}
        >
          <span className="nav-icon">
            <IoList size={26} />
          </span>
          <span>{t('nav.list')}</span>
        </button>
        {/* Search button — commented out (search is in header)
        <button 
          className="bottom-nav-item"
          onClick={() => {
            closeFilterMenu();
            setSearchTerm('');
            setShowSearchModal(true);
          }}
        >
          <span className="nav-icon">
            <IoSearch size={26} />
          </span>
          <span>{t('nav.search')}</span>
        </button>
        */}
        <button 
          className="bottom-nav-item"
          onClick={() => {
            closeFilterMenu();
            setShowFeedbackModal(true);
          }}
        >
          <span className="nav-icon">
            <IoAddCircle size={26} />
          </span>
          <span>{t('nav.addPlace')}</span>
        </button>
      </div>

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
                  direction: language === 'he' ? 'rtl' : 'ltr'
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
                  direction: language === 'he' ? 'rtl' : 'ltr'
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
              direction: language === 'he' ? 'rtl' : 'ltr'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              marginBottom: '0.75rem',
              color: isDark ? '#fff' : '#333',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              textAlign: language === 'he' ? 'right' : 'left'
            }}>
              {t('settings.title')}
            </h2>

            {/* Language is fixed to Hebrew - no selector needed */}

            {/* Zoom Controls for Accessibility */}
            <div style={{ marginBottom: '2rem', borderTop: `1px solid ${isDark ? '#333' : '#eee'}`, paddingTop: '1.5rem' }}>
              <h3 style={{
                marginBottom: '1rem',
                color: isDark ? '#fff' : '#333',
                fontSize: '1.1rem',
                fontWeight: '600',
                textAlign: language === 'he' ? 'right' : 'left'
              }}>
                {t('settings.zoom')}
              </h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1rem',
                direction: language === 'he' ? 'rtl' : 'ltr'
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
                  direction: 'ltr'
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
                  textAlign: language === 'he' ? 'right' : 'left'
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
                  textAlign: language === 'he' ? 'right' : 'left'
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
                  textAlign: language === 'he' ? 'right' : 'left'
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
              direction: language === 'he' ? 'rtl' : 'ltr'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              marginBottom: '1.5rem',
              color: isDark ? '#fff' : '#333',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              textAlign: language === 'he' ? 'right' : 'left'
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
                  textAlign: language === 'he' ? 'right' : 'left'
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
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left'
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
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left'
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
                        direction: language === 'he' ? 'rtl' : 'ltr',
                        textAlign: language === 'he' ? 'right' : 'left'
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
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left'
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
                      direction: 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left'
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
                      direction: 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left'
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
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left'
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
                      direction: language === 'he' ? 'rtl' : 'ltr',
                      textAlign: language === 'he' ? 'right' : 'left'
                    }}
                    disabled={feedbackSubmitting}
                  />
                </div>
                
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  justifyContent: language === 'he' ? 'flex-end' : 'flex-start'
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
              direction: language === 'he' ? 'rtl' : 'ltr'
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

      {!isLoading && selectedRegions.length > 0 && (
        (() => {
          const filteredWineries = wineries.filter(w => w.properties.region && selectedRegions.includes(w.properties.region));
          const filteredShops = wineShops.filter(s => s.properties.region && selectedRegions.includes(s.properties.region));
          const totalFiltered = filteredWineries.length + filteredShops.length;
          
          if (totalFiltered === 0) {
            return (
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
                        direction: language === 'he' ? 'rtl' : 'ltr'
                      }}>
                        {t('list.noResultsRegion')} {selectedRegions.map(r => getRegionName(r)).join(', ')}
                      </div>
            );
          }
          return null;
        })()
      )}
    </div>
  );
};

export default WineriesMap; 

import { useNavigate, useLocation } from 'react-router-dom';
import { IoHome, IoLocationOutline, IoBookmarkOutline, IoListOutline } from 'react-icons/io5';
import { useLanguage } from '../contexts/LanguageContext';

export interface AppBottomNavProps {
  /** Map route only: reflect list vs map tab highlight. */
  mapViewMode?: 'map' | 'list';
/** Optional extra classes on the fixed bottom bar */
  className?: string;
  onBeforeNavigate?: () => void;
  onHomeClick?: () => void;
  /** When set (e.g. on /map), switches to list view or opens /map with list. */
  onListClick?: () => void;
  onMapClick?: () => void;
}

export function AppBottomNav({
  mapViewMode,
  className,
  onBeforeNavigate,
  onHomeClick,
  onListClick,
  onMapClick,
}: AppBottomNavProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useLanguage();

  const isHomeRoute = pathname === '/' || pathname === '/regions';
  const isMapRoute = pathname === '/map';
  const isSavedRoute = pathname === '/saved';
  const isBenefitsRoute = pathname === '/offers';

  const mapShowsList = isMapRoute && mapViewMode === 'list';
  const mapShowsMap = isMapRoute && (mapViewMode === undefined || mapViewMode === 'map');

  const homeActive = isHomeRoute;
  const listActive = mapShowsList;
  const mapActive = mapShowsMap;
  const savedActive = isSavedRoute;
  const benefitsActive = isBenefitsRoute;

  const run = (action: () => void) => {
    onBeforeNavigate?.();
    action();
  };

  return (
    <div className={['bottom-nav', className].filter(Boolean).join(' ')} dir="rtl">
      <button
        type="button"
        className={`bottom-nav-item ${homeActive ? 'active' : ''}`}
        onClick={() => run(() => (onHomeClick ? onHomeClick() : navigate('/')))}
      >
        <span className="nav-icon">
          <IoHome size={26} />
        </span>
        <span className="nav-label">{t('nav.home')}</span>
      </button>
      <button
        type="button"
        className={`bottom-nav-item ${listActive ? 'active' : ''}`}
        onClick={() =>
          run(() =>
            onListClick
              ? onListClick()
              : navigate('/map', { state: { showListView: true } })
          )
        }
      >
        <span className="nav-icon">
          <IoListOutline size={26} />
        </span>
        <span className="nav-label">{t('nav.list')}</span>
      </button>
      <button
        type="button"
        className={`bottom-nav-item ${mapActive ? 'active' : ''}`}
        onClick={() =>
          run(() => (onMapClick ? onMapClick() : navigate('/map')))
        }
      >
        <span className="nav-icon">
          <IoLocationOutline size={26} />
        </span>
        <span className="nav-label">{t('nav.map')}</span>
      </button>
      <button
        type="button"
        className={`bottom-nav-item ${savedActive ? 'active' : ''}`}
        onClick={() => run(() => navigate('/saved'))}
      >
        <span className="nav-icon">
          <IoBookmarkOutline size={26} />
        </span>
        <span className="nav-label">{t('nav.saved')}</span>
      </button>
      <button
        type="button"
        className={`bottom-nav-item ${benefitsActive ? 'active' : ''}`}
        onClick={() => run(() => navigate('/offers'))}
      >
        <span className="nav-icon bottom-nav-percent" aria-hidden>
          %
        </span>
        <span className="nav-label">{t('nav.benefits')}</span>
      </button>
    </div>
  );
}

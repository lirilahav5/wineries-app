import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import NavSearch from './NavSearch';
import '../App.css';

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { isDark } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <nav className="nav" style={{
      backgroundColor: isDark ? '#1a1a1a' : '#8B1D24',
      direction: language === 'he' ? 'rtl' : 'ltr'
    }}>
      <div className="nav-content">
        <div style={{ 
          flexShrink: 0,
          whiteSpace: 'nowrap'
        }}>
          <Link to="/dashboard" style={{ 
            color: 'white', 
            textDecoration: 'none', 
            fontSize: 'clamp(1rem, 4vw, 1.2rem)', 
            fontWeight: 'bold' 
          }}>
            WineME {t('nav.dashboard')}
          </Link>
        </div>
        <ul className="nav-links" style={{
          flexDirection: language === 'he' ? 'row-reverse' : 'row',
          flex: '1 1 auto',
          justifyContent: 'center',
          minWidth: 0
        }}>
          <li style={{ flexShrink: 1, minWidth: 0 }}>
            <Link 
              to="/dashboard" 
              className={location.pathname === '/dashboard' ? 'active' : ''}
              style={{ whiteSpace: 'nowrap' }}
            >
              {t('nav.dashboard')}
            </Link>
          </li>
          <li style={{ flexShrink: 1, minWidth: 0 }}>
            <Link 
              to="/wineries" 
              className={location.pathname === '/wineries' ? 'active' : ''}
              style={{ whiteSpace: 'nowrap' }}
            >
              {t('nav.wineries')}
            </Link>
          </li>
          <li style={{ flexShrink: 1, minWidth: 0 }}>
            <Link 
              to="/wine-shops" 
              className={location.pathname === '/wine-shops' ? 'active' : ''}
              style={{ whiteSpace: 'nowrap' }}
            >
              {t('nav.wineShops')}
            </Link>
          </li>
          <li style={{ flexShrink: 1, minWidth: 0 }}>
            <Link 
              to="/settings" 
              className={location.pathname === '/settings' ? 'active' : ''}
              style={{ whiteSpace: 'nowrap' }}
            >
              {t('nav.settings')}
            </Link>
          </li>
        </ul>
        <NavSearch />
        <button className="logout-btn" onClick={handleLogout} style={{
          backgroundColor: isDark ? '#333' : 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          border: 'none',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          fontSize: 'clamp(0.85rem, 3vw, 0.9rem)'
        }}>
          {t('nav.logout')}
        </button>
      </div>
    </nav>
  );
}

export default Navigation;

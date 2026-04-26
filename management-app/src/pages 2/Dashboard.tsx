import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import Navigation from '../components/Navigation';
import './Dashboard.css';

function Dashboard() {
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const [stats, setStats] = useState({
    wineries: 0,
    wineShops: 0,
    totalEntries: 0,
    paidLogos: 0,
    totalEarnings: 0,
  });
  const [loading, setLoading] = useState(true);
  
  // Payment amount per logo (in NIS) - can be configured
  const PAYMENT_PER_LOGO = 100;

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [wineriesResult, shopsResult, paidWineriesResult, paidShopsResult] = await Promise.all([
        supabase.from('wineries').select('id', { count: 'exact', head: true }),
        supabase.from('wine_shops').select('id', { count: 'exact', head: true }),
        supabase.from('wineries').select('id', { count: 'exact', head: true }).eq('logo_paid', true),
        supabase.from('wine_shops').select('id', { count: 'exact', head: true }).eq('logo_paid', true),
      ]);

      const wineriesCount = wineriesResult.count || 0;
      const shopsCount = shopsResult.count || 0;
      const paidWineriesCount = paidWineriesResult.count || 0;
      const paidShopsCount = paidShopsResult.count || 0;
      const paidLogosCount = paidWineriesCount + paidShopsCount;
      const totalEarnings = paidLogosCount * PAYMENT_PER_LOGO;

      setStats({
        wineries: wineriesCount,
        wineShops: shopsCount,
        totalEntries: wineriesCount + shopsCount,
        paidLogos: paidLogosCount,
        totalEarnings: totalEarnings,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5', minHeight: '100dvh' }}>
        <Navigation />
        <div className="container" style={{ 
          backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
          color: isDark ? '#fff' : '#333'
        }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5', minHeight: '100dvh' }}>
      <Navigation />
      <div className="container" style={{ 
        backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
        color: isDark ? '#fff' : '#333',
        direction: language === 'he' ? 'rtl' : 'ltr'
      }}>
        <h1 style={{ textAlign: language === 'he' ? 'right' : 'left' }}>{t('dashboard.title')}</h1>
        <p className="dashboard-subtitle" style={{ 
          textAlign: language === 'he' ? 'right' : 'left',
          color: isDark ? '#ccc' : '#666'
        }}>{t('dashboard.welcome')}</p>

        <div className="stats-grid">
          <div className="stat-card" style={{
            backgroundColor: isDark ? '#2a2a2a' : 'white',
            color: isDark ? '#fff' : '#333'
          }}>
            <div className="stat-icon">🍷</div>
            <div className="stat-content">
              <h2>{stats.wineries}</h2>
              <p>{t('dashboard.wineries')}</p>
            </div>
            <Link to="/wineries" className="stat-link" style={{
              color: isDark ? '#8B9DC3' : '#8B1D24'
            }}>
              ← {t('dashboard.manageWineries')}
            </Link>
          </div>

          <div className="stat-card" style={{
            backgroundColor: isDark ? '#2a2a2a' : 'white',
            color: isDark ? '#fff' : '#333'
          }}>
            <div className="stat-icon">🏪</div>
            <div className="stat-content">
              <h2>{stats.wineShops}</h2>
              <p>{t('dashboard.wineShops')}</p>
            </div>
            <Link to="/wine-shops" className="stat-link" style={{
              color: isDark ? '#8B9DC3' : '#8B1D24'
            }}>
              ← {t('dashboard.manageShops')}
            </Link>
          </div>

          <div className="stat-card" style={{
            backgroundColor: isDark ? '#2a2a2a' : 'white',
            color: isDark ? '#fff' : '#333'
          }}>
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h2>{stats.totalEntries}</h2>
              <p>{t('dashboard.totalEntries')}</p>
            </div>
          </div>

          <div className="stat-card" style={{
            backgroundColor: isDark ? '#2a2a2a' : 'white',
            color: isDark ? '#fff' : '#333'
          }}>
            <div className="stat-icon">💳</div>
            <div className="stat-content">
              <h2>{stats.paidLogos}</h2>
              <p>{t('dashboard.paidLogos')}</p>
            </div>
          </div>

          <div className="stat-card" style={{
            backgroundColor: isDark ? '#2a2a2a' : 'white',
            color: isDark ? '#fff' : '#333'
          }}>
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <h2>{stats.totalEarnings.toLocaleString()} {t('dashboard.currency')}</h2>
              <p>{t('dashboard.totalEarnings')}</p>
            </div>
          </div>
        </div>

        <div className="quick-actions" style={{
          marginTop: '2rem'
        }}>
          <h2 style={{ textAlign: language === 'he' ? 'right' : 'left' }}>{t('dashboard.quickActions')}</h2>
          <div className="actions-grid">
            <Link to="/wineries" className="action-card" style={{
              backgroundColor: isDark ? '#2a2a2a' : 'white',
              color: isDark ? '#fff' : '#333'
            }}>
              <h3>{t('dashboard.addWinery')}</h3>
              <p>{t('dashboard.addWineryDesc')}</p>
            </Link>
            <Link to="/wine-shops" className="action-card" style={{
              backgroundColor: isDark ? '#2a2a2a' : 'white',
              color: isDark ? '#fff' : '#333'
            }}>
              <h3>{t('dashboard.addShop')}</h3>
              <p>{t('dashboard.addShopDesc')}</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

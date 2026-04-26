import { useEffect, useState } from 'react';
import { supabase, Winery } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import Navigation from '../components/Navigation';
import { isCurrentlyOpen } from '../utils/openingHours';
import './Management.css';

function WineriesManagement() {
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const [wineries, setWineries] = useState<Winery[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Winery>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [timeKey, setTimeKey] = useState(0); // Force re-render to update open/closed status
  // updatingStatus removed - status updates automatically on mount

  // Helper function to format opening hours
  const formatOpeningHours = (hours: string | string[] | null): string => {
    if (!hours) return '-';
    try {
      if (typeof hours === 'string') {
        const parsed = JSON.parse(hours);
        if (Array.isArray(parsed)) {
          return parsed.join(' • ');
        }
        return parsed;
      }
      if (Array.isArray(hours)) {
        return hours.join(' • ');
      }
      return String(hours);
    } catch {
      return String(hours);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      try {
        const { data, error } = await supabase
          .from('wineries')
          .select('*')
          .order('id', { ascending: true });
        
        if (error) throw error;
        
        if (data) {
          setWineries(data);
          // Automatically update open/closed status when app opens
          await updateAllOpenStatus(data);
        }
      } catch (error) {
        console.error('Error fetching wineries:', error);
      } finally {
        setLoading(false);
      }
    };
    initializeData();
  }, []);

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

  const fetchWineries = async () => {
    try {
      const { data, error } = await supabase
        .from('wineries')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setWineries(data || []);
    } catch (error) {
      console.error('Error fetching wineries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (winery: Winery) => {
    setEditingId(winery.id);
    setFormData(winery);
    setShowAddForm(false);
  };

  const handleAdd = () => {
    setEditingId(null);
    setFormData({});
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({});
    setShowAddForm(false);
  };

  const handleSave = async () => {
    try {
      // If opening hours are being updated, automatically calculate and update is_open
      const dataToSave = { ...formData };
      if (dataToSave.opening_hours !== undefined) {
        dataToSave.is_open = isCurrentlyOpen(dataToSave.opening_hours);
      }

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('wineries')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('wineries')
          .insert([dataToSave]);

        if (error) throw error;
      }

      await fetchWineries();
      handleCancel();
    } catch (error) {
      console.error('Error saving winery:', error);
      alert('Error saving winery. Please try again.');
    }
  };

  // Update all wineries' is_open status in database based on current opening hours
  const updateAllOpenStatus = async (wineriesData?: Winery[]) => {
    // Status update in progress
    try {
      const dataToUpdate = wineriesData || wineries;
      const updates = dataToUpdate
        .filter(winery => winery.opening_hours) // Only update wineries with opening hours
        .map(winery => ({
          id: winery.id,
          is_open: isCurrentlyOpen(winery.opening_hours)
        }));

      // Update in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const promises = batch.map(update =>
          supabase
            .from('wineries')
            .update({ is_open: update.is_open })
            .eq('id', update.id)
        );
        await Promise.all(promises);
      }

      // Refresh the data
      await fetchWineries();
      // Status updated automatically - no alert needed
    } catch (error) {
      console.error('Error updating open status:', error);
      alert(language === 'he' ? 'שגיאה בעדכון הסטטוס' : 'Error updating status');
    } finally {
      // Status update complete
    }
  };

  const handleDelete = async (id: number) => {
    const confirmMessage = language === 'he' 
      ? 'האם אתה בטוח שברצונך למחוק יקב זה?' 
      : 'Are you sure you want to delete this winery?';
    if (!confirm(confirmMessage)) return;

    try {
      const { error } = await supabase
        .from('wineries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchWineries();
    } catch (error) {
      console.error('Error deleting winery:', error);
      alert('Error deleting winery. Please try again.');
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
        <div className="page-header" style={{
          flexDirection: language === 'he' ? 'row-reverse' : 'row'
        }}>
          <h1 style={{ 
            color: isDark ? '#8B9DC3' : '#8B1D24',
            textAlign: language === 'he' ? 'right' : 'left'
          }}>{t('nav.wineries')} {language === 'he' ? 'ניהול' : 'Management'}</h1>
          <button 
            className="btn btn-primary" 
            onClick={handleAdd}
            style={{
              backgroundColor: '#8B1D24',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            + {language === 'he' ? 'הוסף יקב חדש' : 'Add New Winery'}
          </button>
        </div>

        {(showAddForm || editingId) && (
          <div className="card" style={{
            backgroundColor: isDark ? '#2a2a2a' : 'white',
            color: isDark ? '#fff' : '#333',
            padding: '2rem',
            borderRadius: '8px',
            marginBottom: '2rem',
            boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ 
              color: isDark ? '#8B9DC3' : '#8B1D24',
              textAlign: language === 'he' ? 'right' : 'left'
            }}>
              {editingId ? (language === 'he' ? 'ערוך יקב' : 'Edit Winery') : (language === 'he' ? 'הוסף יקב חדש' : 'Add New Winery')}
            </h2>
            <div className="form-grid">
              <div className="form-group">
                <label style={{ textAlign: language === 'he' ? 'right' : 'left' }}>{language === 'he' ? 'שם' : 'Name'} *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    backgroundColor: isDark ? '#333' : 'white',
                    color: isDark ? '#fff' : '#333',
                    border: '1px solid ' + (isDark ? '#444' : '#ddd')
                  }}
                />
              </div>
              <div className="form-group">
                <label style={{ textAlign: language === 'he' ? 'right' : 'left' }}>{language === 'he' ? 'כתובת' : 'Address'}</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{
                    backgroundColor: isDark ? '#333' : 'white',
                    color: isDark ? '#fff' : '#333',
                    border: '1px solid ' + (isDark ? '#444' : '#ddd')
                  }}
                />
              </div>
              <div className="form-group">
                <label style={{ textAlign: language === 'he' ? 'right' : 'left' }}>{language === 'he' ? 'אזור' : 'Region'}</label>
                <input
                  type="text"
                  value={formData.region || ''}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  style={{
                    backgroundColor: isDark ? '#333' : 'white',
                    color: isDark ? '#fff' : '#333',
                    border: '1px solid ' + (isDark ? '#444' : '#ddd')
                  }}
                />
              </div>
              <div className="form-group">
                <label style={{ textAlign: language === 'he' ? 'right' : 'left' }}>{language === 'he' ? 'טלפון' : 'Phone'}</label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{
                    backgroundColor: isDark ? '#333' : 'white',
                    color: isDark ? '#fff' : '#333',
                    border: '1px solid ' + (isDark ? '#444' : '#ddd')
                  }}
                />
              </div>
              <div className="form-group">
                <label style={{ textAlign: language === 'he' ? 'right' : 'left' }}>{language === 'he' ? 'אתר' : 'Website'}</label>
                <input
                  type="url"
                  value={formData.website || ''}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  style={{
                    backgroundColor: isDark ? '#333' : 'white',
                    color: isDark ? '#fff' : '#333',
                    border: '1px solid ' + (isDark ? '#444' : '#ddd')
                  }}
                />
              </div>
              <div className="form-group">
                <label style={{ textAlign: language === 'he' ? 'right' : 'left' }}>{language === 'he' ? 'קו רוחב' : 'Latitude'}</label>
                <input
                  type="number"
                  step="any"
                  value={formData.lat || ''}
                  onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) || null })}
                  style={{
                    backgroundColor: isDark ? '#333' : 'white',
                    color: isDark ? '#fff' : '#333',
                    border: '1px solid ' + (isDark ? '#444' : '#ddd')
                  }}
                />
              </div>
              <div className="form-group">
                <label style={{ textAlign: language === 'he' ? 'right' : 'left' }}>{language === 'he' ? 'קו אורך' : 'Longitude'}</label>
                <input
                  type="number"
                  step="any"
                  value={formData.lng || ''}
                  onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) || null })}
                  style={{
                    backgroundColor: isDark ? '#333' : 'white',
                    color: isDark ? '#fff' : '#333',
                    border: '1px solid ' + (isDark ? '#444' : '#ddd')
                  }}
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.kosher || false}
                    onChange={(e) => setFormData({ ...formData, kosher: e.target.checked })}
                    style={{ marginRight: '0.5rem' }}
                  />
                  {language === 'he' ? 'כשר' : 'Kosher'}
                </label>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_open || false}
                    onChange={(e) => setFormData({ ...formData, is_open: e.target.checked })}
                    style={{ marginRight: '0.5rem' }}
                  />
                  {language === 'he' ? 'פתוח כעת' : 'Open Now'}
                </label>
              </div>
              <div className="form-group full-width">
                <label>{language === 'he' ? 'שעות פתיחה' : 'Opening Hours'}</label>
                <textarea
                  value={Array.isArray(formData.opening_hours) 
                    ? JSON.stringify(formData.opening_hours) 
                    : (typeof formData.opening_hours === 'string' ? formData.opening_hours : '')}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setFormData({ ...formData, opening_hours: parsed });
                    } catch {
                      setFormData({ ...formData, opening_hours: e.target.value });
                    }
                  }}
                  placeholder={language === 'he' ? 'לדוגמה: ["יום א\': 9:00-18:00", "יום ב\': 9:00-18:00"]' : 'e.g., ["Sunday: 9:00-18:00", "Monday: 9:00-18:00"]'}
                  rows={3}
                  style={{
                    backgroundColor: isDark ? '#333' : 'white',
                    color: isDark ? '#fff' : '#333',
                    border: '1px solid ' + (isDark ? '#444' : '#ddd')
                  }}
                />
                <small style={{ color: isDark ? '#ccc' : '#666', fontSize: '0.85rem' }}>
                  {language === 'he' ? 'הזן כמערך JSON או כטקסט רגיל' : 'Enter as JSON array or plain text'}
                </small>
              </div>
              <div className="form-group full-width">
                <label>{language === 'he' ? 'מבצעים' : 'Offers'}</label>
                <textarea
                  value={formData.offers || ''}
                  onChange={(e) => setFormData({ ...formData, offers: e.target.value })}
                  placeholder={language === 'he' ? 'לדוגמה: 10% הנחה בקניה מעל 600 ש"ח' : 'e.g., 10% discount on purchases over 600 NIS'}
                  rows={3}
                  style={{
                    backgroundColor: isDark ? '#333' : 'white',
                    color: isDark ? '#fff' : '#333',
                    border: '1px solid ' + (isDark ? '#444' : '#ddd')
                  }}
                />
              </div>
              <div className="form-group">
                <label style={{ textAlign: language === 'he' ? 'right' : 'left' }}>{language === 'he' ? 'כתובת לוגו (URL)' : 'Logo URL'}</label>
                <input
                  type="url"
                  value={formData.logo_url || ''}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder={language === 'he' ? 'https://example.com/logo.png' : 'https://example.com/logo.png'}
                  style={{
                    backgroundColor: isDark ? '#333' : 'white',
                    color: isDark ? '#fff' : '#333',
                    border: '1px solid ' + (isDark ? '#444' : '#ddd')
                  }}
                />
              </div>
              <div className="form-group">
                <label style={{ textAlign: language === 'he' ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.logo_paid || false}
                    onChange={(e) => setFormData({ ...formData, logo_paid: e.target.checked })}
                    style={{ marginRight: '0.5rem' }}
                  />
                  {language === 'he' ? 'לוגו שולם' : 'Logo Paid'}
                </label>
              </div>
            </div>
            <div className="form-actions" style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: language === 'he' ? 'flex-end' : 'flex-start',
              marginTop: '1.5rem'
            }}>
              <button 
                className="btn btn-primary" 
                onClick={handleSave}
                style={{
                  backgroundColor: '#8B1D24',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                {t('common.save')}
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={handleCancel}
                style={{
                  backgroundColor: isDark ? '#444' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        <div className="table-container" style={{
          overflowX: 'auto',
          marginTop: '2rem',
          borderRadius: '8px',
          boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: isDark ? '#2a2a2a' : 'white',
            minWidth: '1200px'
          }}>
            <thead style={{
              backgroundColor: '#8B1D24',
              color: 'white',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>ID</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'שם' : 'Name'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'אזור' : 'Region'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'כתובת' : 'Address'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'טלפון' : 'Phone'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'אתר' : 'Website'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'שעות פתיחה' : 'Opening Hours'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'פתוח כעת' : 'Open Now'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'כשר' : 'Kosher'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'מבצעים' : 'Offers'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'קואורדינטות' : 'Coordinates'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'לוגו שולם' : 'Logo Paid'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'פעולות' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {wineries.map((winery) => (
                <tr 
                  key={winery.id}
                  style={{
                    borderBottom: '1px solid ' + (isDark ? '#444' : '#ddd'),
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? '#333' : '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{ padding: '0.75rem', color: isDark ? '#ccc' : '#666' }}>{winery.id}</td>
                  <td style={{ padding: '0.75rem', fontWeight: '500' }}>{winery.name || '-'}</td>
                  <td style={{ padding: '0.75rem' }}>{winery.region || '-'}</td>
                  <td style={{ padding: '0.75rem', maxWidth: '200px', wordBreak: 'break-word' }}>{winery.address || '-'}</td>
                  <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>{winery.phone || '-'}</td>
                  <td style={{ padding: '0.75rem' }}>
                    {winery.website ? (
                      <a 
                        href={winery.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          color: isDark ? '#8B9DC3' : '#8B1D24',
                          textDecoration: 'none'
                        }}
                      >
                        {winery.website.length > 30 ? winery.website.substring(0, 30) + '...' : winery.website}
                      </a>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '0.75rem', maxWidth: '250px', fontSize: '0.9rem' }}>
                    {formatOpeningHours(winery.opening_hours)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }} key={`status-${winery.id}-${timeKey}`}>
                    {winery.opening_hours ? (() => {
                      // Use device's current time (phone's clock) to determine if open
                      const isOpen = isCurrentlyOpen(winery.opening_hours);
                      return (
                        <span style={{
                          color: isOpen ? (isDark ? '#4caf50' : '#28a745') : (isDark ? '#f44336' : '#dc3545'),
                          fontWeight: 'bold'
                        }}>
                          {isOpen ? '🟢 ' : '🔴 '}
                          {isOpen ? (language === 'he' ? 'פתוח' : 'Open') : (language === 'he' ? 'סגור' : 'Closed')}
                        </span>
                      );
                    })() : '-'}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    {winery.kosher ? (
                      <span style={{ color: isDark ? '#4caf50' : '#28a745', fontWeight: 'bold' }}>✓</span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '0.75rem', maxWidth: '200px', fontSize: '0.85rem', wordBreak: 'break-word' }}>
                    {winery.offers ? (
                      <span title={winery.offers}>
                        {winery.offers.length > 30 ? winery.offers.substring(0, 30) + '...' : winery.offers}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                    {winery.lat && winery.lng ? `${winery.lat.toFixed(4)}, ${winery.lng.toFixed(4)}` : '-'}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    {winery.logo_paid ? (
                      <span style={{ color: isDark ? '#4caf50' : '#28a745', fontWeight: 'bold' }}>✓ {language === 'he' ? 'שולם' : 'Paid'}</span>
                    ) : (
                      <span style={{ color: isDark ? '#f44336' : '#dc3545', fontWeight: 'bold' }}>✗ {language === 'he' ? 'לא שולם' : 'Not Paid'}</span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexDirection: language === 'he' ? 'row-reverse' : 'row' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ 
                          padding: '0.5rem 1rem', 
                          fontSize: '0.9rem',
                          backgroundColor: isDark ? '#444' : '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleEdit(winery)}
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ 
                          padding: '0.5rem 1rem', 
                          fontSize: '0.9rem',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleDelete(winery.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default WineriesManagement;

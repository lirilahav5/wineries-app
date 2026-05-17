import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, WineShop } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import Navigation from '../components/Navigation';
import EditHistoryModal, {
  HistoryClockButton,
  LastEditedHint,
} from '../components/EditHistoryModal';
import {
  deleteManagementEditHistoryForEntity,
  fetchLatestEditByColumn,
  formatEditDateTime,
  getChangedColumnKeys,
  getRowLastEditIso,
  insertManagementEditHistory,
  wineShopTrackedKeys,
} from '../utils/editHistory';
import { isCurrentlyOpen } from '../utils/openingHours';
import PremiumMembershipFormSection from '../components/PremiumMembershipFormSection';
import PremiumMembershipTableCell from '../components/PremiumMembershipTableCell';
import type { PremiumExpireMode } from '../components/PremiumMembershipFormSection';
import type { PremiumDurationUnit } from '../utils/premiumMembership';
import { addDurationFromToday } from '../utils/premiumMembership';
import LogoUploadField from '../components/LogoUploadField';
import PromotionImagesUploadField from '../components/PromotionImagesUploadField';
import PromotionImageCarousel from '../components/PromotionImageCarousel';
import {
  uploadBrandedBottleImg,
  uploadBusinessLogo,
  validateLogoFile,
} from '../utils/logoUpload';
import {
  normalizePromotionImageUrls,
  uploadPromotionImages,
} from '../utils/promotionImageUpload';
import { getErrorMessage } from '../utils/errorMessage';
import './Management.css';

function WineShopsManagement() {
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [shops, setShops] = useState<WineShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<WineShop>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [timeKey, setTimeKey] = useState(0); // Force re-render to update open/closed status
  const [columnEditsByShopId, setColumnEditsByShopId] = useState<
    Record<number, Record<string, string>>
  >({});
  const [historyModal, setHistoryModal] = useState<{
    open: boolean;
    id: number | null;
    name: string;
  }>({ open: false, id: null, name: '' });

  const [premiumExpireMode, setPremiumExpireMode] = useState<PremiumExpireMode>('calendar');
  const [premiumDurationAmount, setPremiumDurationAmount] = useState(1);
  const [premiumDurationUnit, setPremiumDurationUnit] =
    useState<PremiumDurationUnit>('months');

  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [logoBlobPreview, setLogoBlobPreview] = useState<string | null>(null);

  const [pendingBrandedBottleFile, setPendingBrandedBottleFile] =
    useState<File | null>(null);
  const [brandedBottleBlobPreview, setBrandedBottleBlobPreview] =
    useState<string | null>(null);

  const [pendingPromotionFiles, setPendingPromotionFiles] = useState<File[]>([]);

  const formEditHints = editingId ? columnEditsByShopId[editingId] : undefined;

  useEffect(() => {
    if (!pendingLogoFile) {
      setLogoBlobPreview(null);
      return;
    }
    const u = URL.createObjectURL(pendingLogoFile);
    setLogoBlobPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [pendingLogoFile]);

  useEffect(() => {
    if (!pendingBrandedBottleFile) {
      setBrandedBottleBlobPreview(null);
      return;
    }
    const u = URL.createObjectURL(pendingBrandedBottleFile);
    setBrandedBottleBlobPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [pendingBrandedBottleFile]);

  const resetPremiumUi = () => {
    setPremiumExpireMode('calendar');
    setPremiumDurationAmount(1);
    setPremiumDurationUnit('months');
  };

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
          .from('wine_shops')
          .select('*')
          .order('id', { ascending: true });
        
        if (error) throw error;
        
        if (data) {
          setShops(data);
          // Automatically update open/closed status when app opens
          await updateAllOpenStatus(data);
        }
      } catch (error) {
        console.error('Error fetching wine shops:', error);
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

  useEffect(() => {
    if (shops.length === 0) {
      setColumnEditsByShopId({});
      return;
    }
    const ids = shops.map((s) => s.id);
    fetchLatestEditByColumn('wine_shop', ids)
      .then(setColumnEditsByShopId)
      .catch(() => setColumnEditsByShopId({}));
  }, [shops]);

  useEffect(() => {
    if (shops.length === 0) return;
    const raw = searchParams.get('edit');
    if (!raw) return;
    const id = parseInt(raw, 10);
    if (Number.isNaN(id)) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete('edit');
          return n;
        },
        { replace: true }
      );
      return;
    }
    const shop = shops.find((s) => s.id === id);
    if (!shop) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete('edit');
          return n;
        },
        { replace: true }
      );
      return;
    }
    setEditingId(shop.id);
    setFormData(shop);
    setShowAddForm(false);
    setPremiumExpireMode('calendar');
    setPremiumDurationAmount(1);
    setPremiumDurationUnit('months');
    setPendingLogoFile(null);
    setPendingBrandedBottleFile(null);
    setPendingPromotionFiles([]);
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete('edit');
        return n;
      },
      { replace: true }
    );
  }, [shops, searchParams, setSearchParams]);

  const fetchShops = async () => {
    try {
      const { data, error } = await supabase
        .from('wine_shops')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setShops(data || []);
    } catch (error) {
      console.error('Error fetching wine shops:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (shop: WineShop) => {
    setEditingId(shop.id);
    setFormData(shop);
    setShowAddForm(false);
    resetPremiumUi();
    setPendingLogoFile(null);
    setPendingBrandedBottleFile(null);
    setPendingPromotionFiles([]);
  };

  const handleAdd = () => {
    setEditingId(null);
    setFormData({});
    setShowAddForm(true);
    resetPremiumUi();
    setPendingLogoFile(null);
    setPendingBrandedBottleFile(null);
    setPendingPromotionFiles([]);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({});
    setShowAddForm(false);
    resetPremiumUi();
    setPendingLogoFile(null);
    setPendingBrandedBottleFile(null);
    setPendingPromotionFiles([]);
  };

  const handleSave = async () => {
    try {
      let dataToSave = { ...formData } as Partial<WineShop>;
      if (dataToSave.opening_hours !== undefined) {
        dataToSave.is_open = isCurrentlyOpen(dataToSave.opening_hours);
      }

      const isPremium = Boolean(dataToSave.premium);
      dataToSave.premium = isPremium;
      if (!isPremium) {
        dataToSave.premium_expires_at = null;
      } else if (premiumExpireMode === 'duration') {
        dataToSave.premium_expires_at = addDurationFromToday(
          premiumDurationAmount,
          premiumDurationUnit
        );
      } else {
        const pe = dataToSave.premium_expires_at;
        dataToSave.premium_expires_at =
          pe && String(pe).trim() !== '' ? String(pe).slice(0, 10) : null;
      }

      if (pendingLogoFile && editingId) {
        const url = await uploadBusinessLogo(pendingLogoFile, 'wine_shop', editingId);
        dataToSave.logo_url = url;
      }

      if (pendingBrandedBottleFile && editingId) {
        const url = await uploadBrandedBottleImg(
          pendingBrandedBottleFile,
          'wine_shop',
          editingId
        );
        dataToSave.branded_bottle_img = url;
      }

      let mergedPromotionUrls = normalizePromotionImageUrls(formData.promotion_image_urls);
      if (editingId && pendingPromotionFiles.length > 0) {
        const uploaded = await uploadPromotionImages(
          pendingPromotionFiles,
          'wine_shop',
          editingId
        );
        mergedPromotionUrls = [...mergedPromotionUrls, ...uploaded];
      }
      dataToSave.promotion_image_urls = mergedPromotionUrls;

      const prevRow = editingId ? shops.find((s) => s.id === editingId) ?? null : null;

      if (editingId) {
        const { error } = await supabase
          .from('wine_shops')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
        const changed = getChangedColumnKeys(
          prevRow,
          dataToSave as Partial<WineShop>,
          wineShopTrackedKeys
        );
        await insertManagementEditHistory('wine_shop', editingId, changed);
      } else {
        const forInsert = { ...dataToSave } as Partial<WineShop>;
        if (pendingLogoFile) delete forInsert.logo_url;
        if (pendingBrandedBottleFile) delete forInsert.branded_bottle_img;

        const { data: inserted, error } = await supabase
          .from('wine_shops')
          .insert([forInsert])
          .select('id')
          .single();

        if (error) throw error;
        if (inserted?.id != null) {
          if (pendingLogoFile) {
            const url = await uploadBusinessLogo(pendingLogoFile, 'wine_shop', inserted.id);
            await supabase.from('wine_shops').update({ logo_url: url }).eq('id', inserted.id);
            dataToSave.logo_url = url;
          }
          if (pendingBrandedBottleFile) {
            const url = await uploadBrandedBottleImg(
              pendingBrandedBottleFile,
              'wine_shop',
              inserted.id
            );
            await supabase
              .from('wine_shops')
              .update({ branded_bottle_img: url })
              .eq('id', inserted.id);
            dataToSave.branded_bottle_img = url;
          }
          if (pendingPromotionFiles.length > 0) {
            const uploaded = await uploadPromotionImages(
              pendingPromotionFiles,
              'wine_shop',
              inserted.id
            );
            mergedPromotionUrls = [...mergedPromotionUrls, ...uploaded];
            await supabase
              .from('wine_shops')
              .update({ promotion_image_urls: mergedPromotionUrls })
              .eq('id', inserted.id);
            dataToSave.promotion_image_urls = mergedPromotionUrls;
          }
          const changed = getChangedColumnKeys(
            null,
            dataToSave as Partial<WineShop>,
            wineShopTrackedKeys
          );
          await insertManagementEditHistory('wine_shop', inserted.id, changed);
        }
      }

      setPendingLogoFile(null);
      setPendingBrandedBottleFile(null);
      setPendingPromotionFiles([]);
      await fetchShops();
      handleCancel();
    } catch (error: unknown) {
      console.error('Error saving wine shop:', error);
      const detail = getErrorMessage(error);
      alert(
        language === 'he'
          ? `שגיאה בשמירת החנות${detail ? `: ${detail}` : '. נסה שוב.'}`
          : `Error saving wine shop${detail ? `: ${detail}` : '. Please try again.'}`
      );
    }
  };

  // Update all shops' is_open status in database based on current opening hours
  const updateAllOpenStatus = async (shopsData?: WineShop[]) => {
    // Status update in progress
    try {
      const dataToUpdate = shopsData || shops;
      const updates = dataToUpdate
        .filter(shop => shop.opening_hours) // Only update shops with opening hours
        .map(shop => ({
          id: shop.id,
          is_open: isCurrentlyOpen(shop.opening_hours)
        }));

      // Update in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const promises = batch.map(update =>
          supabase
            .from('wine_shops')
            .update({ is_open: update.is_open })
            .eq('id', update.id)
        );
        await Promise.all(promises);
      }

      // Refresh the data
      await fetchShops();
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
      ? 'האם אתה בטוח שברצונך למחוק חנות יין זו?' 
      : 'Are you sure you want to delete this wine shop?';
    if (!confirm(confirmMessage)) return;

    try {
      await deleteManagementEditHistoryForEntity('wine_shop', id);
      const { error } = await supabase
        .from('wine_shops')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchShops();
    } catch (error) {
      console.error('Error deleting wine shop:', error);
      alert('Error deleting wine shop. Please try again.');
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5', minHeight: '100dvh' }}>
        <Navigation />
        <div className="management-container" style={{ 
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
      <div className="management-container" style={{ 
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
          }}>{t('nav.wineShops')} {language === 'he' ? 'ניהול' : 'Management'}</h1>
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
            + {language === 'he' ? 'הוסף חנות יין חדשה' : 'Add New Wine Shop'}
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
              {editingId ? (language === 'he' ? 'ערוך חנות יין' : 'Edit Wine Shop') : (language === 'he' ? 'הוסף חנות יין חדשה' : 'Add New Wine Shop')}
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
                {editingId ? (
                  <LastEditedHint
                    iso={formEditHints?.name}
                    isDark={isDark}
                    prefix={t('management.lastChangeLinePrefix')}
                  />
                ) : null}
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
                {editingId ? (
                  <LastEditedHint
                    iso={formEditHints?.address}
                    isDark={isDark}
                    prefix={t('management.lastChangeLinePrefix')}
                  />
                ) : null}
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
                {editingId ? (
                  <LastEditedHint
                    iso={formEditHints?.region}
                    isDark={isDark}
                    prefix={t('management.lastChangeLinePrefix')}
                  />
                ) : null}
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
                {editingId ? (
                  <LastEditedHint
                    iso={formEditHints?.phone}
                    isDark={isDark}
                    prefix={t('management.lastChangeLinePrefix')}
                  />
                ) : null}
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
                {editingId ? (
                  <LastEditedHint
                    iso={formEditHints?.website}
                    isDark={isDark}
                    prefix={t('management.lastChangeLinePrefix')}
                  />
                ) : null}
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
                {editingId ? (
                  <LastEditedHint
                    iso={formEditHints?.lat}
                    isDark={isDark}
                    prefix={`${t('management.lastChangeLinePrefix')} קו רוחב`}
                  />
                ) : null}
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
                {editingId ? (
                  <LastEditedHint
                    iso={formEditHints?.lng}
                    isDark={isDark}
                    prefix={`${t('management.lastChangeLinePrefix')} קו אורך`}
                  />
                ) : null}
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
                {editingId ? (
                  <LastEditedHint
                    iso={formEditHints?.kosher}
                    isDark={isDark}
                    prefix={t('management.lastChangeLinePrefix')}
                  />
                ) : null}
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
                {editingId ? (
                  <LastEditedHint
                    iso={formEditHints?.is_open}
                    isDark={isDark}
                    prefix={t('management.lastChangeLinePrefix')}
                  />
                ) : null}
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
                {editingId ? (
                  <LastEditedHint
                    iso={formEditHints?.opening_hours}
                    isDark={isDark}
                    prefix={t('management.lastChangeLinePrefix')}
                  />
                ) : null}
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
                {editingId ? (
                  <LastEditedHint
                    iso={formEditHints?.offers}
                    isDark={isDark}
                    prefix={t('management.lastChangeLinePrefix')}
                  />
                ) : null}
              </div>
              <PromotionImagesUploadField
                savedUrls={normalizePromotionImageUrls(formData.promotion_image_urls)}
                pendingFiles={pendingPromotionFiles}
                onAddFiles={(files) => setPendingPromotionFiles((prev) => [...prev, ...files])}
                onRemoveSavedUrl={(url) =>
                  setFormData((prev) => ({
                    ...prev,
                    promotion_image_urls: normalizePromotionImageUrls(
                      prev.promotion_image_urls
                    ).filter((u) => u !== url),
                  }))
                }
                onRemovePendingAt={(idx) =>
                  setPendingPromotionFiles((prev) => prev.filter((_, i) => i !== idx))
                }
                isDark={isDark}
                showEditHint={Boolean(editingId)}
                editHintIso={formEditHints?.promotion_image_urls}
                hintPrefix={t('management.lastChangeLinePrefix')}
                t={t}
              />
              <LogoUploadField
                previewSrc={logoBlobPreview ?? formData.logo_url ?? null}
                pendingFile={pendingLogoFile}
                onPickFile={(file) => {
                  if (!file) {
                    setPendingLogoFile(null);
                    return;
                  }
                  const v = validateLogoFile(file);
                  if (!v.ok) {
                    alert(v.message);
                    return;
                  }
                  setPendingLogoFile(file);
                }}
                onClearLogo={() => setFormData((prev) => ({ ...prev, logo_url: null }))}
                isDark={isDark}
                showEditHint={Boolean(editingId)}
                editHintIso={formEditHints?.logo_url}
                hintPrefix={t('management.lastChangeLinePrefix')}
                t={t}
              />
              <div className="form-group">
                <label style={{ textAlign: language === 'he' ? 'right' : 'left' }}>
                  {t('management.logoUrlOptional')}
                </label>
                <input
                  type="url"
                  value={formData.logo_url || ''}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value || null })}
                  placeholder="https://…"
                  style={{
                    backgroundColor: isDark ? '#333' : 'white',
                    color: isDark ? '#fff' : '#333',
                    border: '1px solid ' + (isDark ? '#444' : '#ddd')
                  }}
                />
              </div>
              <LogoUploadField
                previewSrc={
                  brandedBottleBlobPreview ?? formData.branded_bottle_img ?? null
                }
                pendingFile={pendingBrandedBottleFile}
                onPickFile={(file) => {
                  if (!file) {
                    setPendingBrandedBottleFile(null);
                    return;
                  }
                  const v = validateLogoFile(file);
                  if (!v.ok) {
                    alert(v.message);
                    return;
                  }
                  setPendingBrandedBottleFile(file);
                }}
                onClearLogo={() =>
                  setFormData((prev) => ({ ...prev, branded_bottle_img: null }))
                }
                isDark={isDark}
                showEditHint={Boolean(editingId)}
                editHintIso={formEditHints?.branded_bottle_img}
                hintPrefix={t('management.lastChangeLinePrefix')}
                t={t}
                labelKey="management.brandedBottleImageLabel"
                helpKey="management.brandedBottleUploadHelp"
                removeKey="management.brandedBottleRemoveImage"
              />
              <div className="form-group">
                <label style={{ textAlign: language === 'he' ? 'right' : 'left' }}>
                  {t('management.brandedBottleUrlOptional')}
                </label>
                <input
                  type="url"
                  value={formData.branded_bottle_img || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      branded_bottle_img: e.target.value || null,
                    })
                  }
                  placeholder="https://…"
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
                {editingId ? (
                  <LastEditedHint
                    iso={formEditHints?.logo_paid}
                    isDark={isDark}
                    prefix={t('management.lastChangeLinePrefix')}
                  />
                ) : null}
              </div>
              <PremiumMembershipFormSection
                radioGroupName="premium-expire-shop"
                premium={Boolean(formData.premium)}
                premiumExpiresAt={formData.premium_expires_at || ''}
                onPremiumToggle={(v) =>
                  setFormData({
                    ...formData,
                    premium: v,
                    ...(v ? {} : { premium_expires_at: null }),
                  })
                }
                onExpiresAtChange={(ymd) =>
                  setFormData({ ...formData, premium_expires_at: ymd || null })
                }
                expireMode={premiumExpireMode}
                onExpireModeChange={setPremiumExpireMode}
                durationAmount={premiumDurationAmount}
                onDurationAmountChange={setPremiumDurationAmount}
                durationUnit={premiumDurationUnit}
                onDurationUnitChange={setPremiumDurationUnit}
                isDark={isDark}
                showHints={Boolean(editingId)}
                formEditHints={formEditHints}
                hintPrefix={t('management.lastChangeLinePrefix')}
                t={t}
              />
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

        <div
          className="table-container management-table-wrap"
          style={{
            marginTop: '2rem',
            borderRadius: '8px',
            boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: isDark ? '#2a2a2a' : 'white',
            minWidth: '2090px'
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
                <th style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>{t('management.logoColumn')}</th>
                <th style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {t('management.brandedBottleColumn')}
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'אזור' : 'Region'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'כתובת' : 'Address'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'טלפון' : 'Phone'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'אתר' : 'Website'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'שעות פתיחה' : 'Opening Hours'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'פתוח כעת' : 'Open Now'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'כשר' : 'Kosher'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'מבצעים' : 'Offers'}</th>
                <th style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {t('management.promotionImagesColumn')}
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'קואורדינטות' : 'Coordinates'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'לוגו שולם' : 'Logo Paid'}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{t('management.premiumColumn')}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{t('management.lastEditColumn')}</th>
                <th style={{ padding: '1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{language === 'he' ? 'פעולות' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => {
                const colEdits = columnEditsByShopId[shop.id];
                const rowIso = getRowLastEditIso(colEdits);
                return (
                <tr 
                  key={shop.id}
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
                  <td style={{ padding: '0.75rem', color: isDark ? '#ccc' : '#666', verticalAlign: 'top' }}>{shop.id}</td>
                  <td style={{ padding: '0.75rem', fontWeight: '500', verticalAlign: 'top' }}>
                    <div>{shop.name || '-'}</div>
                    <LastEditedHint iso={colEdits?.name} isDark={isDark} prefix={t('management.lastChangeLinePrefix')} />
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                    {shop.logo_url ? (
                      <img
                        src={shop.logo_url}
                        alt=""
                        style={{
                          display: 'block',
                          margin: '0 auto',
                          maxHeight: '56px',
                          maxWidth: '100px',
                          objectFit: 'contain',
                          borderRadius: '6px',
                          border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                          background: isDark ? '#1a1a1a' : '#f9f9f9',
                        }}
                        onError={(e) => {
                          e.currentTarget.style.visibility = 'hidden';
                        }}
                      />
                    ) : (
                      <span style={{ opacity: 0.45 }}>—</span>
                    )}
                    <LastEditedHint iso={colEdits?.logo_url} isDark={isDark} prefix={t('management.lastChangeLinePrefix')} />
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                    {shop.branded_bottle_img ? (
                      <img
                        src={shop.branded_bottle_img}
                        alt=""
                        style={{
                          display: 'block',
                          margin: '0 auto',
                          maxHeight: '56px',
                          maxWidth: '56px',
                          objectFit: 'contain',
                          borderRadius: '6px',
                          border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                          background: isDark ? '#1a1a1a' : '#f9f9f9',
                        }}
                        onError={(e) => {
                          e.currentTarget.style.visibility = 'hidden';
                        }}
                      />
                    ) : (
                      <span style={{ opacity: 0.45 }}>—</span>
                    )}
                    <LastEditedHint
                      iso={colEdits?.branded_bottle_img}
                      isDark={isDark}
                      prefix={t('management.lastChangeLinePrefix')}
                    />
                  </td>
                  <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                    <div>{shop.region || '-'}</div>
                    <LastEditedHint iso={colEdits?.region} isDark={isDark} prefix={t('management.lastChangeLinePrefix')} />
                  </td>
                  <td style={{ padding: '0.75rem', maxWidth: '200px', wordBreak: 'break-word', verticalAlign: 'top' }}>
                    <div>{shop.address || '-'}</div>
                    <LastEditedHint iso={colEdits?.address} isDark={isDark} prefix={t('management.lastChangeLinePrefix')} />
                  </td>
                  <td style={{ padding: '0.75rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    <div>{shop.phone || '-'}</div>
                    <LastEditedHint iso={colEdits?.phone} isDark={isDark} prefix={t('management.lastChangeLinePrefix')} />
                  </td>
                  <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                    <div>
                    {shop.website ? (
                      <a 
                        href={shop.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          color: isDark ? '#8B9DC3' : '#8B1D24',
                          textDecoration: 'none'
                        }}
                      >
                        {shop.website.length > 30 ? shop.website.substring(0, 30) + '...' : shop.website}
                      </a>
                    ) : '-'}
                    </div>
                    <LastEditedHint iso={colEdits?.website} isDark={isDark} prefix={t('management.lastChangeLinePrefix')} />
                  </td>
                  <td style={{ padding: '0.75rem', maxWidth: '250px', fontSize: '0.9rem', verticalAlign: 'top' }}>
                    <div>{formatOpeningHours(shop.opening_hours)}</div>
                    <LastEditedHint iso={colEdits?.opening_hours} isDark={isDark} prefix={t('management.lastChangeLinePrefix')} />
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'top' }} key={`status-${shop.id}-${timeKey}`}>
                    <div>
                    {shop.opening_hours ? (() => {
                      const isOpen = isCurrentlyOpen(shop.opening_hours);
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
                    </div>
                    <LastEditedHint iso={colEdits?.is_open} isDark={isDark} prefix={t('management.lastChangeLinePrefix')} />
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'top' }}>
                    <div>
                    {shop.kosher ? (
                      <span style={{ color: isDark ? '#4caf50' : '#28a745', fontWeight: 'bold' }}>✓</span>
                    ) : '-'}
                    </div>
                    <LastEditedHint iso={colEdits?.kosher} isDark={isDark} prefix={t('management.lastChangeLinePrefix')} />
                  </td>
                  <td style={{ padding: '0.75rem', maxWidth: '200px', fontSize: '0.85rem', wordBreak: 'break-word', verticalAlign: 'top' }}>
                    <div>
                    {shop.offers ? (
                      <span title={shop.offers}>
                        {shop.offers.length > 30 ? shop.offers.substring(0, 30) + '...' : shop.offers}
                      </span>
                    ) : '-'}
                    </div>
                    <LastEditedHint iso={colEdits?.offers} isDark={isDark} prefix={t('management.lastChangeLinePrefix')} />
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                    <PromotionImageCarousel
                      urls={normalizePromotionImageUrls(shop.promotion_image_urls)}
                      isDark={isDark}
                    />
                    <LastEditedHint
                      iso={colEdits?.promotion_image_urls}
                      isDark={isDark}
                      prefix={t('management.lastChangeLinePrefix')}
                    />
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.85rem', fontFamily: 'monospace', verticalAlign: 'top' }}>
                    <div>{shop.lat && shop.lng ? `${shop.lat.toFixed(4)}, ${shop.lng.toFixed(4)}` : '-'}</div>
                    <LastEditedHint iso={colEdits?.lat} isDark={isDark} prefix={`${t('management.lastChangeLinePrefix')} קו רוחב`} />
                    <LastEditedHint iso={colEdits?.lng} isDark={isDark} prefix={`${t('management.lastChangeLinePrefix')} קו אורך`} />
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'top' }}>
                    <div>
                    {shop.logo_paid ? (
                      <span style={{ color: isDark ? '#4caf50' : '#28a745', fontWeight: 'bold' }}>✓ {language === 'he' ? 'שולם' : 'Paid'}</span>
                    ) : (
                      <span style={{ color: isDark ? '#f44336' : '#dc3545', fontWeight: 'bold' }}>✗ {language === 'he' ? 'לא שולם' : 'Not Paid'}</span>
                    )}
                    </div>
                    <LastEditedHint iso={colEdits?.logo_paid} isDark={isDark} prefix={t('management.lastChangeLinePrefix')} />
                  </td>
                  <PremiumMembershipTableCell
                    premium={shop.premium}
                    premiumExpiresAt={shop.premium_expires_at}
                    isDark={isDark}
                    colEdits={colEdits}
                    hintPrefix={t('management.lastChangeLinePrefix')}
                    t={t}
                  />
                  <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      flexDirection: language === 'he' ? 'row-reverse' : 'row',
                      flexWrap: 'wrap',
                      justifyContent: language === 'he' ? 'flex-end' : 'flex-start'
                    }}>
                      <span style={{ fontSize: '0.85rem' }}>
                        {rowIso ? (
                          <>
                            {t('management.rowLastEditPrefix')} {formatEditDateTime(rowIso)}
                          </>
                        ) : (
                          <span style={{ opacity: 0.7 }}>—</span>
                        )}
                      </span>
                      <HistoryClockButton
                        isDark={isDark}
                        label={t('management.historyClockAria')}
                        onClick={() =>
                          setHistoryModal({
                            open: true,
                            id: shop.id,
                            name: shop.name || `חנות יין #${shop.id}`,
                          })
                        }
                      />
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
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
                        onClick={() => handleEdit(shop)}
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
                        onClick={() => handleDelete(shop.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <EditHistoryModal
          open={historyModal.open}
          onClose={() => setHistoryModal({ open: false, id: null, name: '' })}
          entityType="wine_shop"
          entityId={historyModal.id}
          titleName={historyModal.name}
          isDark={isDark}
          emptyLabel={t('management.editHistoryEmpty')}
          closeLabel={t('management.closeModal')}
          historyHeading={t('management.editHistoryTitle')}
          historySubtitle={t('management.editHistoryLead')}
          loadingLabel={t('management.loadingHistory')}
        />
      </div>
    </div>
  );
}

export default WineShopsManagement;

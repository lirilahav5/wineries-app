import React from 'react';
import {
  IoLocationOutline,
  IoNavigateOutline,
  IoCallOutline,
  IoGlobeOutline,
  IoCarOutline,
  IoBookmarkOutline,
  IoBookmark,
  IoTimeOutline,
} from 'react-icons/io5';
import { FaChevronDown, FaShoppingCart } from 'react-icons/fa';
import topbarWineryIcon from '../assets/img/topbar-winery.png';
import listBottleWinery from '../assets/img/bottle-list-winery.png';
import listBottleShop from '../assets/img/bottle-list-shop.png';
import type { WineryFeature } from '../data/wineries';
import type { Language } from '../contexts/LanguageContext';
import { translateName, translateAddress } from '../utils/nameTranslations';
import { formatPhoneForTel, normalizeUrl, openWazeNavigation } from '../utils/contactLinks';
import {
  parseOffer,
  renderOfferLineWithDiscountHighlight,
  splitOpeningHoursDisplayLines,
  formatOpeningHoursDisplay,
} from '../utils/wineListCardFormat';
import { isCurrentlyOpen } from '../utils/openingHours';
import { isPremiumActive } from '../utils/premiumMembership';

function OfferListStarIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{ flexShrink: 0, marginTop: 2 }}
    >
      <path
        d="M12 2.5v2.65M12 18.85v2.65M2.5 12h2.65M18.85 12h2.65M5.55 5.55l1.8 1.8M16.65 16.65l1.8 1.8M5.55 18.45l1.8-1.8M16.65 7.35l1.8-1.8"
        stroke={color}
        strokeWidth={1.45}
        strokeLinecap="round"
      />
      <path
        d="M12 7.4l.86 2.55h2.69l-2.17 1.58.83 2.56L12 12.9l-2.21 1.79.83-2.56-2.17-1.58h2.69L12 7.4z"
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function isItemKosher(item: WineryFeature): boolean {
  const kosherValue = item.properties.kosher;
  if (kosherValue === true) return true;
  if (kosherValue !== null && kosherValue !== undefined) {
    const strValue = String(kosherValue).toLowerCase().trim();
    if (strValue === 'true' || strValue === '1') return true;
  }
  return false;
}

export interface WinePlaceListCardProps {
  item: WineryFeature;
  isShop: boolean;
  language: Language;
  isDark: boolean;
  listIconColor: string;
  wmRed: string;
  translatedOffers: Map<string, { name: string; description: string }>;
  onOfferSelect: (payload: { name: string; description: string; wineryName: string }) => void;
  expandedListOpeningHoursKeys: Set<string>;
  toggleListOpeningHoursKey: (key: string) => void;
  listIndex: number;
  isSaved: boolean;
  onToggleSave: () => void;
  t: (key: string) => string;
  listRenderKey: number;
  /** Distance from user in meters; omitted or null when location unknown */
  distanceFromUserMeters?: number | null;
}

export const WinePlaceListCard: React.FC<WinePlaceListCardProps> = ({
  item,
  isShop,
  language,
  isDark,
  listIconColor,
  wmRed,
  translatedOffers,
  onOfferSelect,
  expandedListOpeningHoursKeys,
  toggleListOpeningHoursKey,
  listIndex,
  isSaved,
  onToggleSave,
  t,
  listRenderKey,
  distanceFromUserMeters = null,
}) => {
  const lat = item.geometry.coordinates[1];
  const lng = item.geometry.coordinates[0];
  const hoursKey = `${isShop ? 's' : 'w'}:${item.properties.place_id ?? ''}:${item.properties.name ?? ''}:${listIndex}`;
  const hoursExpanded = expandedListOpeningHoursKeys.has(hoursKey);

  const distanceLabel =
    distanceFromUserMeters != null && Number.isFinite(distanceFromUserMeters)
      ? distanceFromUserMeters < 1000
        ? `${Math.max(1, Math.round(distanceFromUserMeters))} ${t('list.distance')}`
        : `${(distanceFromUserMeters / 1000).toFixed(1)} ${t('list.distanceKm')}`
      : null;

  const premiumBorder = isPremiumActive(item.properties.premium, item.properties.premium_expires_at);
  const defaultListBottle = isShop ? listBottleShop : listBottleWinery;
  const brandedBottle = item.properties.branded_bottle_img?.trim();
  const listBottleSrc =
    brandedBottle && brandedBottle.length > 0 ? brandedBottle : defaultListBottle;

  return (
    <div
      className={`winery-list-item wm-list-card${premiumBorder ? ' wm-list-card--premium' : ''}`}
      style={{
        marginBottom: '1rem',
        position: 'relative',
        direction: 'rtl',
        textAlign: 'right',
      }}
    >
      <div className="wm-list-card__main">
        <button
          type="button"
          className={`wm-list-card__save-btn${isSaved ? ' wm-list-card__save-btn--active' : ''}`}
          title={isSaved ? t('saved.remove') : t('saved.save')}
          aria-label={isSaved ? t('saved.remove') : t('saved.save')}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
        >
          {isSaved ? <IoBookmark size={18} /> : <IoBookmarkOutline size={18} />}
        </button>
        <div
          className="wm-list-card__badges-row"
          style={{ unicodeBidi: 'isolate' }}
          aria-label={[isShop ? t('list.wineShop') : t('list.winery'), isItemKosher(item) ? t('list.kosher') : '']
            .filter(Boolean)
            .join(', ')}
        >
          <span
            className="wm-list-card__badge"
            dir="rtl"
            style={{
              backgroundColor: isShop ? '#000000' : wmRed,
              color: '#ffffff',
              padding: '0.18rem 0.6rem',
              borderRadius: '999px',
              fontSize: '0.6875rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.28rem',
            }}
          >
            {isShop ? <FaShoppingCart size={12} /> : <img src={topbarWineryIcon} alt="" style={{ width: 14, height: 14, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />}
            {isShop ? t('list.wineShop') : t('list.winery')}
          </span>
          {isItemKosher(item) && (
            <span
              className="wm-list-card__badge"
              dir="rtl"
              style={{
                backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                color: isDark ? '#d0d0d0' : '#666666',
                padding: '0.18rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.6875rem',
                fontWeight: 600,
                border: isDark ? '1px solid #666666' : '1px solid #e0e0e0',
              }}
            >
              {t('list.kosher')}
            </span>
          )}
        </div>
        <div className="wm-list-card__grid" style={{ direction: 'rtl' }}>
          <div
            className="wm-list-card__info"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              direction: 'rtl',
              textAlign: 'right',
              width: '100%',
              alignItems: 'stretch',
              alignSelf: 'stretch',
              order: 1,
              marginLeft: '0',
              minWidth: 0,
            }}
          >
            <h3
              className="wm-list-card__title"
              style={{
                textAlign: 'right',
                direction: 'rtl',
              }}
            >
              {(() => {
                const translated = translateName(item.properties.name || '', language);
                return translated || 'יקב';
              })()}
            </h3>

            {distanceLabel && (
              <div
                className="wm-list-card__distance"
                style={{
                  direction: 'rtl',
                }}
              >
                <span className="winery-list-location-icon" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <IoNavigateOutline size={20} color={listIconColor} aria-hidden />
                </span>
                <span className="wm-list-card__meta" style={{ textAlign: 'right', flex: 1 }}>
                  {distanceLabel}
                </span>
              </div>
            )}

            {item.properties.address &&
              (() => {
                const translatedAddress = translateAddress(item.properties.address, language);
                let displayAddress = translatedAddress;
                if (!displayAddress || displayAddress.trim() === '') {
                  if (language === 'he') {
                    displayAddress = item.properties.address;
                  } else {
                    return null;
                  }
                }
                const plusCodePattern = /[A-Z0-9]{4}\+[A-Z0-9]{2,3}[A-Z0-9]*/i;
                const isOnlyNumbers = /^[\d\s,]+$/.test(displayAddress.replace(plusCodePattern, '').trim());
                if (isOnlyNumbers) {
                  return null;
                }
                if (!displayAddress || displayAddress.trim() === '') return null;
                return (
                  <div
                    className="wm-list-card__address"
                    style={{
                      direction: 'rtl',
                    }}
                  >
                    <span className="winery-list-location-icon" style={{ flexShrink: 0, marginTop: '2px' }}>
                      <IoLocationOutline size={20} color={listIconColor} />
                    </span>
                    <span className="wm-list-card__meta" style={{ textAlign: 'right', flex: 1 }}>
                      {displayAddress}
                    </span>
                  </div>
                );
              })()}

            {item.properties.offers
              ? (() => {
                  const offerKey = `${item.properties.place_id || item.properties.name || ''}-offer`;
                  const translated = translatedOffers.get(offerKey);
                  const parsed = parseOffer(item.properties.offers, t('list.offersAndDeals'));
                  const offerName = translated?.name || parsed.name;
                  const offerDescription = translated?.description || parsed.description;
                  const line = [offerName, offerDescription].filter(Boolean).join(' — ') || t('list.offersAndDeals');
                  const shortLine = line.length > 100 ? `${line.slice(0, 97)}…` : line;
                  const offerTextColor = isDark ? '#ff6b6b' : wmRed;
                  const offerIconColor = isDark ? '#ff6b6b' : wmRed;
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOfferSelect({
                          name: offerName,
                          description: offerDescription,
                          wineryName: translateName(item.properties.name || '', language) || (language === 'he' ? 'יקב' : 'Winery'),
                        });
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: '0.45rem',
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'right',
                        direction: 'rtl',
                      }}
                    >
                      <OfferListStarIcon size={20} color={offerIconColor} />
                      <span
                        className="wm-list-card__offer-text"
                        style={{
                          flex: 1,
                          textAlign: 'right',
                          direction: 'rtl',
                        }}
                      >
                        {renderOfferLineWithDiscountHighlight(shortLine, offerTextColor, wmRed)}
                      </span>
                    </button>
                  );
                })()
              : item.properties.opening_hours
                ? (() => {
                    const raw = item.properties.opening_hours;
                    const hoursOpenNow = isCurrentlyOpen(raw);
                    const hoursLine =
                      formatOpeningHoursDisplay(raw) ||
                      (typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join(' • ') : '');
                    if (!hoursLine.trim()) return null;
                    const hourLines = splitOpeningHoursDisplayLines(hoursLine);
                    return (
                      <div className="wm-list-card__hours-block" style={{ direction: 'rtl' }}>
                        <span className="winery-list-hours-icon" style={{ marginTop: '2px' }} aria-hidden>
                          <IoTimeOutline size={20} color={listIconColor} />
                        </span>
                        <div className="wm-list-card__hours-body" style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="wm-list-card__hours-toggle"
                            aria-expanded={hoursExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleListOpeningHoursKey(hoursKey);
                            }}
                          >
                            {hoursOpenNow ? (
                              <span className="wm-list-card__hours-open-now" aria-label={t('filter.openNow')}>
                                {t('filter.openNow')}
                              </span>
                            ) : null}
                            <span className="wm-list-card__hours-toggle-text">{t('list.openingHoursLabel')}</span>
                            <FaChevronDown
                              size={12}
                              className="wm-list-card__hours-chevron"
                              aria-hidden
                              style={{
                                opacity: 0.55,
                                transform: hoursExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease',
                                flexShrink: 0,
                              }}
                            />
                          </button>
                          {hoursExpanded && (
                            <div className="wm-list-card__hours-scroll">
                              {hourLines.map((line, li) => (
                                <div key={`${listRenderKey}-${li}`} className="wm-list-card__hours-line">
                                  {line}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                : null}
          </div>

          <div
            className="wm-list-card__bottle"
            style={{
              flex: isShop ? '0 0 34%' : '0 0 48%',
              maxWidth: isShop ? 148 : 200,
              minWidth: isShop ? 82 : 124,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: isShop ? 'stretch' : 'flex-end',
              flexShrink: 0,
              position: 'relative',
              overflow: 'visible',
              order: 2,
              alignSelf: 'stretch',
              backgroundColor: 'transparent',
              borderRadius: 0,
              padding: isShop ? '4px 0' : '2px 0 0',
              boxSizing: 'border-box',
            }}
          >
            <div
              className="wm-list-card__bottle-img-wrap"
              style={{
                flex: 1,
                minHeight: isShop ? 0 : 176,
                width: '100%',
                display: 'flex',
                alignItems: isShop ? 'stretch' : 'flex-end',
                justifyContent: 'center',
              }}
            >
              <img
                src={listBottleSrc}
                alt={isShop ? 'Wine shop bottle' : 'Winery bottle'}
                style={{
                  width: isShop ? 'auto' : '100%',
                  maxWidth: isShop ? '72%' : '100%',
                  height: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  objectPosition: isShop ? 'center center' : 'center bottom',
                  display: 'block',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              />
            </div>
            {item.properties.logo_paid && item.properties.logo_url && (
              <img
                src={item.properties.logo_url}
                alt={`${translateName(item.properties.name || '', language) || 'Winery'} logo`}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  maxWidth: isShop ? '54px' : '68px',
                  maxHeight: isShop ? '54px' : '68px',
                  objectFit: 'contain',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  padding: '4px',
                  borderRadius: '4px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  zIndex: 10,
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
        </div>
      </div>

      {(() => {
        const tel = item.properties.phone ? formatPhoneForTel(item.properties.phone) : '';
        const web = item.properties.website ? normalizeUrl(item.properties.website) : '';
        const barIcon = listIconColor;
        const barDir = 'rtl';
        return (
          <div className="wm-list-card__actions" style={{ direction: barDir }}>
            {tel ? (
              <a className="wm-list-card__action-link" href={`tel:${tel}`} aria-label={t('list.callAction')}>
                <IoCallOutline size={22} color={barIcon} />
                <span>{t('list.callAction')}</span>
              </a>
            ) : (
              <div className="wm-list-card__action-link wm-list-card__action-link--muted" aria-hidden="true">
                <IoCallOutline size={22} color={barIcon} />
                <span>{t('list.callAction')}</span>
              </div>
            )}
            <div className="wm-list-card__action-divider" aria-hidden />
            <button type="button" className="wm-list-card__action-btn" onClick={() => openWazeNavigation(lat, lng)}>
              <IoCarOutline size={22} color={barIcon} />
              <span>{t('list.goThere')}</span>
            </button>
            <div className="wm-list-card__action-divider" aria-hidden />
            {web ? (
              <a className="wm-list-card__action-link" href={web} target="_blank" rel="noopener noreferrer" aria-label={t('list.website')}>
                <IoGlobeOutline size={22} color={barIcon} />
                <span>{t('list.website')}</span>
              </a>
            ) : (
              <div className="wm-list-card__action-link wm-list-card__action-link--muted" aria-hidden="true">
                <IoGlobeOutline size={22} color={barIcon} />
                <span>{t('list.website')}</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

import type { PremiumDurationUnit } from '../utils/premiumMembership';
import { addDurationFromToday, formatYmdToDisplay } from '../utils/premiumMembership';
import { LastEditedHint } from './EditHistoryModal';

export type PremiumExpireMode = 'calendar' | 'duration';

type Props = {
  premium: boolean;
  premiumExpiresAt: string;
  onPremiumToggle: (v: boolean) => void;
  onExpiresAtChange: (ymd: string) => void;
  expireMode: PremiumExpireMode;
  onExpireModeChange: (m: PremiumExpireMode) => void;
  durationAmount: number;
  onDurationAmountChange: (n: number) => void;
  durationUnit: PremiumDurationUnit;
  onDurationUnitChange: (u: PremiumDurationUnit) => void;
  isDark: boolean;
  showHints: boolean;
  formEditHints?: { premium?: string; premium_expires_at?: string };
  hintPrefix: string;
  t: (key: string) => string;
  /** Unique name for radio group (avoid clashes if multiple forms in DOM) */
  radioGroupName: string;
};

const inputStyle = (isDark: boolean) => ({
  backgroundColor: isDark ? '#333' : 'white',
  color: isDark ? '#fff' : '#333',
  border: '1px solid ' + (isDark ? '#444' : '#ddd'),
  borderRadius: '6px',
  padding: '0.45rem 0.6rem',
});

export default function PremiumMembershipFormSection({
  premium,
  premiumExpiresAt,
  onPremiumToggle,
  onExpiresAtChange,
  expireMode,
  onExpireModeChange,
  durationAmount,
  onDurationAmountChange,
  durationUnit,
  onDurationUnitChange,
  isDark,
  showHints,
  formEditHints,
  hintPrefix,
  t,
  radioGroupName,
}: Props) {
  const computedEnd =
    expireMode === 'duration' && durationAmount > 0
      ? addDurationFromToday(durationAmount, durationUnit)
      : null;

  return (
    <div className="form-group full-width">
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <input
          type="checkbox"
          checked={premium}
          onChange={(e) => onPremiumToggle(e.target.checked)}
          style={{ marginRight: '0.5rem' }}
        />
        {t('management.premiumLabel')}
      </label>
      {showHints ? (
        <LastEditedHint iso={formEditHints?.premium} isDark={isDark} prefix={hintPrefix} />
      ) : null}

      {premium ? (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '1rem',
            borderRadius: '8px',
            border: `1px solid ${isDark ? '#444' : '#ddd'}`,
            backgroundColor: isDark ? '#252525' : '#fafafa',
          }}
        >
          <div
            role="radiogroup"
            aria-label={t('management.premiumExpiryModeAria')}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '0.75rem',
              justifyContent: 'flex-end',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name={radioGroupName}
                checked={expireMode === 'calendar'}
                onChange={() => onExpireModeChange('calendar')}
              />
              {t('management.premiumModeCalendar')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name={radioGroupName}
                checked={expireMode === 'duration'}
                onChange={() => onExpireModeChange('duration')}
              />
              {t('management.premiumModeDuration')}
            </label>
          </div>

          {expireMode === 'calendar' ? (
            <div>
              <label
                style={{
                  display: 'block',
                  textAlign: 'right' as const,
                  marginBottom: '0.35rem',
                  fontSize: '0.9rem',
                }}
              >
                {t('management.premiumCalendarLabel')}
              </label>
              <input
                type="date"
                value={premiumExpiresAt}
                onChange={(e) => onExpiresAtChange(e.target.value)}
                style={{ ...inputStyle(isDark), maxWidth: '220px' }}
              />
            </div>
          ) : (
            <div>
              <label
                style={{
                  display: 'block',
                  textAlign: 'right' as const,
                  marginBottom: '0.35rem',
                  fontSize: '0.9rem',
                }}
              >
                {t('management.premiumDurationLabel')}
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={durationAmount || ''}
                  onChange={(e) => onDurationAmountChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{ ...inputStyle(isDark), width: '72px' }}
                />
                <select
                  value={durationUnit}
                  onChange={(e) => onDurationUnitChange(e.target.value as PremiumDurationUnit)}
                  style={{ ...inputStyle(isDark), minWidth: '120px' }}
                >
                  <option value="days">{t('management.premiumUnitDays')}</option>
                  <option value="months">{t('management.premiumUnitMonths')}</option>
                  <option value="years">{t('management.premiumUnitYears')}</option>
                </select>
              </div>
              {computedEnd ? (
                <p
                  style={{
                    marginTop: '0.65rem',
                    marginBottom: 0,
                    textAlign: 'right' as const,
                    fontSize: '0.9rem',
                    color: isDark ? '#a5c4e8' : '#1a5276',
                  }}
                >
                  {t('management.premiumComputedExpiry')}: {formatYmdToDisplay(computedEnd)}
                </p>
              ) : null}
            </div>
          )}

          {showHints ? (
            <LastEditedHint
              iso={formEditHints?.premium_expires_at}
              isDark={isDark}
              prefix={`${hintPrefix} ${t('management.premiumExpiryHint')}`}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

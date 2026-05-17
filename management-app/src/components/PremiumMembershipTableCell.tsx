import type { ReactNode } from 'react';
import { LastEditedHint } from './EditHistoryModal';
import {
  calendarDaysUntil,
  formatYmdToDisplay,
  premiumExpiryIsUrgent,
} from '../utils/premiumMembership';

type Props = {
  premium: boolean | null | undefined;
  premiumExpiresAt: string | null | undefined;
  isDark: boolean;
  colEdits?: Record<string, string>;
  hintPrefix: string;
  t: (key: string) => string;
};

export default function PremiumMembershipTableCell({
  premium,
  premiumExpiresAt,
  isDark,
  colEdits,
  hintPrefix,
  t,
}: Props) {
  const active = Boolean(premium);
  const ymd = premiumExpiresAt || null;
  const daysLeft = ymd ? calendarDaysUntil(ymd) : null;
  const urgent = active && ymd != null && daysLeft !== null && premiumExpiryIsUrgent(daysLeft);
  const okColor = isDark ? '#4caf50' : '#28a745';
  const badColor = isDark ? '#f44336' : '#dc3545';

  let dateLine: ReactNode = null;
  if (active && ymd) {
    const color = urgent ? badColor : okColor;
    const dateText = formatYmdToDisplay(ymd);
    const remain =
      daysLeft !== null
        ? t('management.premiumDaysRemain').replace('{n}', String(daysLeft))
        : '';
    dateLine = (
      <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color, fontWeight: 600 }}>
        <span>{dateText}</span>
        {daysLeft !== null ? (
          <span style={{ marginInlineStart: '0.35rem' }}>({remain})</span>
        ) : null}
      </div>
    );
  } else if (active && !ymd) {
    dateLine = (
      <div
        style={{
          marginTop: '0.25rem',
          fontSize: '0.72rem',
          color: isDark ? '#aaa' : '#888',
        }}
      >
        {t('management.premiumNoExpiry')}
      </div>
    );
  }

  return (
    <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'top' }}>
      <div>
        {active ? (
          <span style={{ color: okColor, fontWeight: 'bold' }}>
            ✓ {t('management.premiumYes')}
          </span>
        ) : (
          <span style={{ color: badColor, fontWeight: 'bold' }}>
            ✗ {t('management.premiumNo')}
          </span>
        )}
      </div>
      {dateLine}
      {(() => {
        const isoPremium = colEdits?.premium;
        const isoExpiry = colEdits?.premium_expires_at;
        if (isoPremium && isoExpiry && isoPremium === isoExpiry) {
          return <LastEditedHint iso={isoPremium} isDark={isDark} prefix={hintPrefix} />;
        }
        return (
          <>
            <LastEditedHint iso={isoPremium} isDark={isDark} prefix={hintPrefix} />
            <LastEditedHint
              iso={isoExpiry}
              isDark={isDark}
              prefix={`${hintPrefix} ${t('management.premiumExpiryHint')}`}
            />
          </>
        );
      })()}
    </td>
  );
}

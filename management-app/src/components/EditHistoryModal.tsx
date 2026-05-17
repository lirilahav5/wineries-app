import { useEffect, useState } from 'react';
import {
  columnLabelHe,
  fetchEditHistoryForEntity,
  formatEditDateTime,
  type EditEntityType,
  type ManagementEditRow,
} from '../utils/editHistory';

type Props = {
  open: boolean;
  onClose: () => void;
  entityType: EditEntityType;
  entityId: number | null;
  titleName: string;
  isDark: boolean;
  emptyLabel: string;
  closeLabel: string;
  historyHeading: string;
  historySubtitle: string;
  loadingLabel: string;
};

function EditHistoryModal({
  open,
  onClose,
  entityType,
  entityId,
  titleName,
  isDark,
  emptyLabel,
  closeLabel,
  historyHeading,
  historySubtitle,
  loadingLabel,
}: Props) {
  const [rows, setRows] = useState<ManagementEditRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || entityId == null) return;
    let cancelled = false;
    setLoading(true);
    fetchEditHistoryForEntity(entityType, entityId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entityType, entityId]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: isDark ? '#2a2a2a' : '#fff',
          color: isDark ? '#fff' : '#333',
          borderRadius: '12px',
          maxWidth: '480px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: `1px solid ${isDark ? '#444' : '#eee'}`,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.1rem', textAlign: 'right' as const }}>
            {historyHeading}
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', opacity: 0.8, textAlign: 'right' as const }}>
            {historySubtitle}
          </p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.95rem', opacity: 0.9, textAlign: 'right' as const }}>
            {titleName}
          </p>
        </div>
        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <p style={{ textAlign: 'center', margin: 0 }}>{loadingLabel}</p>
          )}
          {!loading && rows.length === 0 && (
            <p style={{ textAlign: 'center', margin: 0, opacity: 0.85 }}>{emptyLabel}</p>
          )}
          {!loading && rows.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {rows.map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: '0.65rem 0',
                    borderBottom: `1px solid ${isDark ? '#3a3a3a' : '#eee'}`,
                    textAlign: 'right' as const,
                    fontSize: '0.95rem',
                    lineHeight: 1.45,
                  }}
                >
                  <strong>{columnLabelHe[r.column_key] || r.column_key}</strong>
                  <span style={{ display: 'block', marginTop: '0.25rem', opacity: 0.85 }}>
                    {formatEditDateTime(r.edited_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: `1px solid ${isDark ? '#444' : '#eee'}`,
            display: 'flex',
            justifyContent: 'flex-start',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#8B1D24',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditHistoryModal;

/** Small label under edited fields: שינוי אחרון: dd/mm/yyyy, hh:mm */
export function LastEditedHint({
  iso,
  isDark,
  prefix,
}: {
  iso: string | undefined;
  isDark: boolean;
  prefix: string;
}) {
  if (!iso) return null;
  return (
    <div
      style={{
        fontSize: '0.7rem',
        color: isDark ? '#aaa' : '#666',
        marginTop: '0.2rem',
        lineHeight: 1.3,
        textAlign: 'right' as const,
      }}
    >
      {prefix} {formatEditDateTime(iso)}
    </div>
  );
}

/** Clock icon button for opening history (aria-label in Hebrew). */
export function HistoryClockButton({
  onClick,
  isDark,
  label,
}: {
  onClick: () => void;
  isDark: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        marginInlineStart: '0.35rem',
        verticalAlign: 'middle',
        cursor: 'pointer',
        border: `1px solid ${isDark ? '#555' : '#ccc'}`,
        background: isDark ? '#333' : '#f0f0f0',
        borderRadius: '8px',
        width: '34px',
        height: '34px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={isDark ? '#e0e0e0' : '#333'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    </button>
  );
}

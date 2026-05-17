import { useRef } from 'react';
import { LastEditedHint } from './EditHistoryModal';

type Props = {
  previewSrc: string | null | undefined;
  pendingFile: File | null;
  onPickFile: (file: File | null) => void;
  onClearLogo: () => void;
  isDark: boolean;
  showEditHint: boolean;
  editHintIso?: string;
  hintPrefix: string;
  t: (key: string) => string;
  /** Override default logo copy keys */
  labelKey?: string;
  helpKey?: string;
  removeKey?: string;
};

export default function LogoUploadField({
  previewSrc,
  pendingFile,
  onPickFile,
  onClearLogo,
  isDark,
  showEditHint,
  editHintIso,
  hintPrefix,
  t,
  labelKey = 'management.logoImageLabel',
  helpKey = 'management.logoUploadHelp',
  removeKey = 'management.logoRemoveImage',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const inputStyle = {
    backgroundColor: isDark ? '#333' : 'white',
    color: isDark ? '#fff' : '#333',
    border: '1px solid ' + (isDark ? '#444' : '#ddd'),
    borderRadius: '8px',
    padding: '0.5rem',
    fontSize: '0.9rem',
    width: '100%',
    maxWidth: '320px',
  };

  return (
    <div className="form-group full-width">
      <label style={{ textAlign: 'right' as const, display: 'block', marginBottom: '0.35rem' }}>
        {t(labelKey)}
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickFile(f);
            else onPickFile(null);
          }}
          style={inputStyle}
        />
        {(previewSrc || pendingFile) ? (
          <button
            type="button"
            onClick={() => {
              onPickFile(null);
              onClearLogo();
              if (inputRef.current) inputRef.current.value = '';
            }}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              border: `1px solid ${isDark ? '#666' : '#ccc'}`,
              background: isDark ? '#444' : '#eee',
              color: isDark ? '#fff' : '#333',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            {t(removeKey)}
          </button>
        ) : null}
      </div>
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', opacity: 0.85, textAlign: 'right' as const }}>
        {t(helpKey)}
      </p>
      {previewSrc ? (
        <div style={{ marginTop: '0.75rem', textAlign: 'center' as const }}>
          <img
            src={previewSrc}
            alt=""
            style={{
              maxHeight: '140px',
              maxWidth: '100%',
              objectFit: 'contain',
              borderRadius: '8px',
              border: `1px solid ${isDark ? '#444' : '#ddd'}`,
              background: isDark ? '#1a1a1a' : '#fafafa',
              padding: '0.35rem',
            }}
          />
        </div>
      ) : null}
      {showEditHint ? (
        <LastEditedHint iso={editHintIso} isDark={isDark} prefix={hintPrefix} />
      ) : null}
    </div>
  );
}

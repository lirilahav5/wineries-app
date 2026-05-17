import { useEffect, useRef, useState } from 'react';
import { LastEditedHint } from './EditHistoryModal';
import { validateLogoFile } from '../utils/logoUpload';

type Props = {
  savedUrls: string[];
  pendingFiles: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveSavedUrl: (url: string) => void;
  onRemovePendingAt: (index: number) => void;
  isDark: boolean;
  showEditHint: boolean;
  editHintIso?: string;
  hintPrefix: string;
  t: (key: string) => string;
};

export default function PromotionImagesUploadField({
  savedUrls,
  pendingFiles,
  onAddFiles,
  onRemoveSavedUrl,
  onRemovePendingAt,
  isDark,
  showEditHint,
  editHintIso,
  hintPrefix,
  t,
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
    maxWidth: '400px',
  };

  const thumbWrap = {
    display: 'inline-flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.25rem',
    margin: '0.35rem',
  };

  const btnRemove = {
    padding: '0.2rem 0.5rem',
    fontSize: '0.75rem',
    borderRadius: '6px',
    border: `1px solid ${isDark ? '#666' : '#ccc'}`,
    background: isDark ? '#444' : '#eee',
    color: isDark ? '#fff' : '#333',
    cursor: 'pointer',
  };

  return (
    <div className="form-group full-width">
      <label style={{ textAlign: 'right' as const, display: 'block', marginBottom: '0.35rem' }}>
        {t('management.promotionImagesLabel')}
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length === 0) return;
            const ok: File[] = [];
            for (const f of picked) {
              const v = validateLogoFile(f);
              if (!v.ok) {
                alert(v.message);
                continue;
              }
              ok.push(f);
            }
            if (ok.length) onAddFiles(ok);
            if (inputRef.current) inputRef.current.value = '';
          }}
          style={inputStyle}
        />
      </div>
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', opacity: 0.85, textAlign: 'right' as const }}>
        {t('management.promotionImagesHelp')}
      </p>

      {(savedUrls.length > 0 || pendingFiles.length > 0) && (
        <div
          style={{
            marginTop: '0.75rem',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: '0.25rem',
          }}
        >
          {savedUrls.map((url) => (
            <div key={url} style={thumbWrap}>
              <img
                src={url}
                alt=""
                style={{
                  height: 100,
                  maxWidth: 140,
                  objectFit: 'contain',
                  borderRadius: 8,
                  border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                  background: isDark ? '#1a1a1a' : '#fafafa',
                }}
              />
              <button type="button" style={btnRemove} onClick={() => onRemoveSavedUrl(url)}>
                {t('management.promotionRemoveOne')}
              </button>
            </div>
          ))}
          {pendingFiles.map((file, idx) => (
            <PendingThumb
              key={`${file.name}-${file.size}-${idx}`}
              file={file}
              isDark={isDark}
              onRemove={() => onRemovePendingAt(idx)}
              label={t('management.promotionRemoveOne')}
            />
          ))}
        </div>
      )}

      {showEditHint ? <LastEditedHint iso={editHintIso} isDark={isDark} prefix={hintPrefix} /> : null}
    </div>
  );
}

function PendingThumb({
  file,
  isDark,
  onRemove,
  label,
}: {
  file: File;
  isDark: boolean;
  onRemove: () => void;
  label: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setSrc(u);
    return () => {
      URL.revokeObjectURL(u);
    };
  }, [file]);

  const btnRemove = {
    padding: '0.2rem 0.5rem',
    fontSize: '0.75rem',
    borderRadius: '6px',
    border: `1px solid ${isDark ? '#666' : '#ccc'}`,
    background: isDark ? '#553311' : '#fff3cd',
    color: isDark ? '#fff' : '#333',
    cursor: 'pointer',
  };

  if (!src) return null;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '0.25rem',
        margin: '0.35rem',
      }}
    >
      <img
        src={src}
        alt=""
        style={{
          height: 100,
          maxWidth: 140,
          objectFit: 'contain',
          borderRadius: 8,
          border: `1px dashed ${isDark ? '#886644' : '#c9a227'}`,
          background: isDark ? '#221a10' : '#fffbeb',
        }}
      />
      <button type="button" style={btnRemove} onClick={onRemove}>
        {label}
      </button>
    </div>
  );
}

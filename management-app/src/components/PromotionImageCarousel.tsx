import { useEffect, useState } from 'react';

type Props = {
  urls: string[] | null | undefined;
  isDark: boolean;
  compact?: boolean;
};

/**
 * Small image carousel for table cells (RTL-friendly prev/next).
 */
export default function PromotionImageCarousel({ urls, isDark, compact = true }: Props) {
  const list = (urls ?? []).filter((u) => typeof u === 'string' && u.trim() !== '');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [list.join('\0')]);

  useEffect(() => {
    if (list.length === 0) return;
    setIndex((i) => Math.min(i, list.length - 1));
  }, [list.length]);

  if (list.length === 0) {
    return <span style={{ opacity: 0.45 }}>—</span>;
  }

  const h = compact ? 52 : 140;
  const boxW = compact ? 108 : '100%';

  const prev = () => setIndex((i) => (i <= 0 ? list.length - 1 : i - 1));
  const next = () => setIndex((i) => (i >= list.length - 1 ? 0 : i + 1));

  const border = `1px solid ${isDark ? '#444' : '#ddd'}`;
  const bg = isDark ? '#1a1a1a' : '#fafafa';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.25rem',
        maxWidth: compact ? 120 : undefined,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.2rem',
          width: '100%',
          justifyContent: 'center',
        }}
      >
        {list.length > 1 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="הקודם"
            style={{
              flexShrink: 0,
              width: 22,
              height: 28,
              padding: 0,
              borderRadius: 6,
              border,
              background: isDark ? '#3a3a3a' : '#eee',
              color: isDark ? '#fff' : '#333',
              cursor: 'pointer',
              fontSize: '0.85rem',
              lineHeight: 1,
            }}
          >
            ‹
          </button>
        ) : null}
        <div
          style={{
            width: boxW,
            height: h,
            border,
            borderRadius: 8,
            background: bg,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <img
            src={list[index]}
            alt=""
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden';
            }}
          />
        </div>
        {list.length > 1 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="הבא"
            style={{
              flexShrink: 0,
              width: 22,
              height: 28,
              padding: 0,
              borderRadius: 6,
              border,
              background: isDark ? '#3a3a3a' : '#eee',
              color: isDark ? '#fff' : '#333',
              cursor: 'pointer',
              fontSize: '0.85rem',
              lineHeight: 1,
            }}
          >
            ›
          </button>
        ) : null}
      </div>
      {list.length > 1 ? (
        <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>
          {index + 1} / {list.length}
        </div>
      ) : null}
    </div>
  );
}

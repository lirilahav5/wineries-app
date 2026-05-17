import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

export type SearchHit = {
  kind: 'winery' | 'shop';
  id: number;
  name: string;
  region: string | null;
};

function mergeById<T extends { id: number }>(rows: T[]): T[] {
  const m = new Map<number, T>();
  for (const r of rows) m.set(r.id, r);
  return Array.from(m.values());
}

async function runSearch(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const pattern = `%${q}%`;
  const [wName, wRegion, sName, sRegion] = await Promise.all([
    supabase.from('wineries').select('id,name,region').ilike('name', pattern).limit(25),
    supabase.from('wineries').select('id,name,region').ilike('region', pattern).limit(25),
    supabase.from('wine_shops').select('id,name,region').ilike('name', pattern).limit(25),
    supabase.from('wine_shops').select('id,name,region').ilike('region', pattern).limit(25),
  ]);
  const err = wName.error || wRegion.error || sName.error || sRegion.error;
  if (err) console.warn('nav search:', err.message);

  const wineries = mergeById([...(wName.data || []), ...(wRegion.data || [])]).map((r) => ({
    kind: 'winery' as const,
    id: r.id,
    name: r.name,
    region: r.region,
  }));
  const shops = mergeById([...(sName.data || []), ...(sRegion.data || [])]).map((r) => ({
    kind: 'shop' as const,
    id: r.id,
    name: r.name,
    region: r.region,
  }));

  return [...wineries, ...shops].slice(0, 40);
}

export default function NavSearch() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const executeSearch = useCallback(async () => {
    const query = q.trim();
    if (query.length < 1) {
      setHits([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    try {
      const results = await runSearch(query);
      setHits(results);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const goEdit = (hit: SearchHit) => {
    setOpen(false);
    const path = hit.kind === 'winery' ? '/wineries' : '/wine-shops';
    navigate(`${path}?edit=${hit.id}`);
  };

  const inputBg = isDark ? '#2a2a2a' : '#fff';
  const inputBorder = isDark ? '#444' : '#ddd';
  const panelBg = isDark ? '#1e1e1e' : '#fff';
  const panelBorder = isDark ? '#444' : '#ddd';

  return (
    <div
      ref={wrapRef}
      className="nav-search"
      style={{
        position: 'relative',
        flex: '1 1 220px',
        minWidth: 0,
        maxWidth: '420px',
      }}
    >
      <form
        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
        onSubmit={(e) => {
          e.preventDefault();
          void executeSearch();
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('nav.searchPlaceholder')}
          aria-label={t('nav.searchPlaceholder')}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '0.45rem 0.65rem',
            borderRadius: '8px',
            border: `1px solid ${inputBorder}`,
            backgroundColor: inputBg,
            color: isDark ? '#fff' : '#333',
            fontSize: '0.9rem',
          }}
        />
        <button
          type="submit"
          style={{
            flexShrink: 0,
            padding: '0.45rem 0.85rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.9rem',
            backgroundColor: isDark ? '#333' : 'rgba(255,255,255,0.25)',
            color: '#fff',
            whiteSpace: 'nowrap',
          }}
        >
          {t('nav.searchButton')}
        </button>
      </form>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 2000,
            backgroundColor: panelBg,
            border: `1px solid ${panelBorder}`,
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            maxHeight: 'min(70vh, 320px)',
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
              {t('nav.searchLoading')}
            </div>
          ) : hits.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.9rem', opacity: 0.85 }}>
              {t('nav.searchNoResults')}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: '0.35rem' }}>
              {hits.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    onClick={() => goEdit(hit)}
                    style={{
                      width: '100%',
                      textAlign: 'right',
                      padding: '0.65rem 0.75rem',
                      border: 'none',
                      borderRadius: '8px',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: isDark ? '#eee' : '#222',
                      fontSize: '0.9rem',
                      lineHeight: 1.35,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? '#333' : '#f0f0f0';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>
                      {hit.kind === 'winery' ? t('nav.searchBadgeWinery') : t('nav.searchBadgeShop')}
                    </span>
                    <span style={{ display: 'block', marginTop: '0.15rem' }}>{hit.name}</span>
                    {hit.region ? (
                      <span style={{ fontSize: '0.82rem', opacity: 0.85 }}>{hit.region}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

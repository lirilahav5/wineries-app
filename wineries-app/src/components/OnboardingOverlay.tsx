import { useMemo, useState } from 'react';
import { IoChevronBack, IoChevronForward, IoClose } from 'react-icons/io5';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

type OnboardingOverlayProps = {
  onFinish: () => void;
};

const OnboardingOverlay = ({ onFinish }: OnboardingOverlayProps) => {
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const isRtl = language === 'he';

  const steps = useMemo(
    () => [
      { title: t('onboard.title1'), body: t('onboard.body1') },
      { title: t('onboard.title2'), body: t('onboard.body2') },
      { title: t('onboard.title3'), body: t('onboard.body3') },
      { title: t('onboard.title4'), body: t('onboard.body4') }
    ],
    [t]
  );

  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: isDark ? '#1f1f1f' : '#fff',
          color: isDark ? '#f5f5f5' : '#222',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          padding: '1.25rem',
          direction: language === 'he' ? 'rtl' : 'ltr',
          textAlign: language === 'he' ? 'right' : 'left'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem'
          }}
        >
          <button
            onClick={onFinish}
            style={{
              background: 'transparent',
              border: 'none',
              color: isDark ? '#bbb' : '#666',
              cursor: 'pointer',
              fontSize: '1.25rem'
            }}
            aria-label={t('onboard.skip')}
            title={t('onboard.skip')}
          >
            <IoClose />
          </button>
          <span style={{ fontSize: '0.85rem', color: isDark ? '#aaa' : '#777' }}>
            {stepIndex + 1}/{steps.length}
          </span>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {steps[stepIndex].title}
          </div>
          <div style={{ fontSize: '0.95rem', lineHeight: 1.5, color: isDark ? '#ddd' : '#444' }}>
            {steps[stepIndex].body}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.4rem',
            marginBottom: '1rem'
          }}
        >
          {steps.map((_, i) => (
            <span
              key={`dot-${i}`}
              style={{
                width: i === stepIndex ? '20px' : '8px',
                height: '8px',
                borderRadius: '999px',
                backgroundColor: i === stepIndex ? '#8B1D24' : (isDark ? '#555' : '#ccc'),
                transition: 'all 0.2s ease'
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <button
            onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
            disabled={isFirst}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: `1px solid ${isDark ? '#444' : '#ddd'}`,
              color: isDark ? '#f5f5f5' : '#333',
              borderRadius: '12px',
              padding: '0.6rem 0.75rem',
              cursor: isFirst ? 'not-allowed' : 'pointer',
              opacity: isFirst ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              fontWeight: 600
            }}
          >
            {isRtl ? <IoChevronForward /> : <IoChevronBack />}
            {t('onboard.back')}
          </button>
          <button
            onClick={() => {
              if (isLast) {
                onFinish();
              } else {
                setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
              }
            }}
            style={{
              flex: 1,
              backgroundColor: '#8B1D24',
              border: 'none',
              color: '#fff',
              borderRadius: '12px',
              padding: '0.6rem 0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              fontWeight: 600
            }}
          >
            {isLast ? t('onboard.done') : t('onboard.next')}
            {!isLast && (isRtl ? <IoChevronBack /> : <IoChevronForward />)}
          </button>
        </div>

        <button
          onClick={onFinish}
          style={{
            width: '100%',
            marginTop: '0.75rem',
            background: 'transparent',
            border: 'none',
            color: isDark ? '#aaa' : '#777',
            fontSize: '0.85rem',
            cursor: 'pointer'
          }}
        >
          {t('onboard.skip')}
        </button>
      </div>
    </div>
  );
};

export default OnboardingOverlay;

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './Logo.css';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
  variant?: 'image' | 'svg';
}

const DEFAULT_LOGO_VARIANT: LogoProps['variant'] = 'image';

const Logo: React.FC<LogoProps> = ({ size = 'medium', className = '', variant }) => {
  const { isDark } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  
  // Generate unique IDs for each logo instance to avoid conflicts
  const uniqueId = useMemo(() => Math.random().toString(36).substr(2, 9), []);

  const sizeMap = {
    small: { width: 140, height: 40, fontSize: 26 },
    medium: { width: 200, height: 60, fontSize: 38 },
    large: { width: 380, height: 120, fontSize: 52 }
  };

  const dimensions = sizeMap[size];
  const activeVariant = variant ?? DEFAULT_LOGO_VARIANT;
  const imageSrc = activeVariant === 'svg' ? null : (isDark ? '/logo-dark.png' : '/logo-main.png');
  const showSvg = !imageSrc || imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [activeVariant]);

  return (
    <div
      className={`logo-wrapper ${className} ${isDark ? 'dark' : 'light'} ${showSvg ? 'logo-svg' : 'logo-image'}`}
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      {!showSvg && imageSrc && (
        <img
          src={imageSrc}
          alt="WineME logo"
          className="wine-me-logo wine-me-logo-image"
          onError={() => setImageFailed(true)}
          width={dimensions.width}
          height={dimensions.height}
        />
      )}
      {showSvg && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 280 80"
          width={dimensions.width}
          height={dimensions.height}
          className="wine-me-logo"
          style={{
            shapeRendering: 'geometricPrecision',
            textRendering: 'geometricPrecision',
            imageRendering: 'crisp-edges'
          }}
        >
          <defs>
            {/* Gradient for WINE text - richer red gradient with stronger colors */}
            <linearGradient id={`wineGradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c02d3a" stopOpacity="1" />
              <stop offset="30%" stopColor="#8B1D24" stopOpacity="1" />
              <stop offset="70%" stopColor="#6b1519" stopOpacity="1" />
              <stop offset="100%" stopColor="#8B1D24" stopOpacity="1" />
            </linearGradient>
            
            {/* Gradient for ME text - theme aware with better contrast and darker colors */}
            <linearGradient id={`meGradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isDark ? "#f0f0f0" : "#1a1a1a"} stopOpacity="1" />
              <stop offset="50%" stopColor={isDark ? "#e0e0e0" : "#0f0f0f"} stopOpacity="1" />
              <stop offset="100%" stopColor={isDark ? "#c0c0c0" : "#000000"} stopOpacity="1" />
            </linearGradient>
            
            {/* Shadow filter for light mode - reduced blur for sharper text */}
            <filter id={`logoShadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
              <feOffset dx="0" dy="2" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.5" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            
            {/* Glow effect for dark mode - wine-colored glow with reduced blur */}
            <filter id={`logoGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur">
                <feColorMatrix type="matrix" values="0.55 0 0 0 0
                                                     0 0.11 0 0 0
                                                     0 0 0.16 0 0
                                                     0 0 0 1 0"/>
              </feGaussianBlur>
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* WINE text with gradient and shadow */}
          <text
            x="10"
            y="58"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize={dimensions.fontSize}
            fontWeight="700"
            letterSpacing="1"
            fill={`url(#wineGradient-${uniqueId})`}
            filter={isDark ? `url(#logoGlow-${uniqueId})` : `url(#logoShadow-${uniqueId})`}
            className="wine-text"
            style={{
              shapeRendering: 'geometricPrecision',
              textRendering: 'optimizeLegibility'
            }}
          >
            WINE
          </text>
          
          {/* ME text with gradient and shadow */}
          <text
            x={155 + (dimensions.fontSize - 38) * 0.5}
            y="58"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize={dimensions.fontSize}
            fontWeight="700"
            letterSpacing="1"
            fill={`url(#meGradient-${uniqueId})`}
            filter={isDark ? `url(#logoGlow-${uniqueId})` : `url(#logoShadow-${uniqueId})`}
            className="me-text"
            style={{
              shapeRendering: 'geometricPrecision',
              textRendering: 'optimizeLegibility'
            }}
          >
            ME
          </text>
        </svg>
      )}
    </div>
  );
};

export default Logo;

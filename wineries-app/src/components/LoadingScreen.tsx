import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './LoadingScreen.css';

interface LoadingScreenProps {
  onFinished: () => void;
}

const SHORT_PLAY_MS = 3000;
const FIRST_TIME_KEY = 'loading_full_seen';

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onFinished }) => {
  const { isDark } = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState<boolean>(() => {
    return !localStorage.getItem(FIRST_TIME_KEY);
  });

  useEffect(() => {
    // Keep state in sync in case localStorage changes elsewhere
    setIsFirstTime(!localStorage.getItem(FIRST_TIME_KEY));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    video.volume = 1;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => undefined);
      });
    }
  }, []);

  useEffect(() => {
    if (isFirstTime) {
      return;
    }
    const timer = setTimeout(() => {
      const video = videoRef.current;
      if (video) {
        video.pause();
      }
      onFinished();
    }, SHORT_PLAY_MS);
    return () => clearTimeout(timer);
  }, [onFinished, isFirstTime]);

  return (
    <div className={`loading-screen ${isDark ? 'dark' : ''}`}>
      <div className="loading-content">
        <video
          ref={videoRef}
          className="loading-video"
          src="/loading-bottle.mp4"
          autoPlay
          playsInline
          muted={isMuted}
          preload="auto"
          onEnded={() => {
            if (isFirstTime) {
              localStorage.setItem(FIRST_TIME_KEY, 'true');
              setIsFirstTime(false);
            }
            onFinished();
          }}
          onError={() => {
            if (isFirstTime) {
              localStorage.setItem(FIRST_TIME_KEY, 'true');
              setIsFirstTime(false);
            }
            onFinished();
          }}
        />
        <div className="loading-text" dir="ltr" style={{ color: isDark ? '#fff' : '#333' }}>
          Loading...
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;

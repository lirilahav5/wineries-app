import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LogoProvider } from './contexts/LogoContext';

// Components
import Home from './pages/Home';
import WineriesList from './pages/WineriesList';
import WineryDetails from './pages/WineryDetails';
import RegionsPage from './pages/RegionsPage';
import WineriesMap from './pages/WineriesMap';
import LoadingScreen from './components/LoadingScreen';
import OnboardingOverlay from './components/OnboardingOverlay';

const AppContent = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isMap = location.pathname === '/map';

  return (
    <div className="app-container">
      <main className={!isHome && !isMap ? "container mt-4" : "main-full"}>
        <Routes>
          <Route path="/" element={<RegionsPage />} />
          <Route path="/home" element={<Home />} />
          <Route path="/regions" element={<RegionsPage />} />
          <Route path="/wineries" element={<WineriesList />} />
          <Route path="/wineries/:region" element={<WineriesList />} />
          <Route path="/winery/:id" element={<WineryDetails />} />
          <Route path="/map" element={<WineriesMap />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setIsLoading(true);
  }, []); // Empty dependency array means it runs on every mount (page refresh)

  useEffect(() => {
    const seen = localStorage.getItem('onboarding_seen');
    if (!seen) {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <LogoProvider>
          {isLoading && <LoadingScreen onFinished={() => setIsLoading(false)} />}
          {!isLoading && showOnboarding && (
            <OnboardingOverlay
              onFinish={() => {
                localStorage.setItem('onboarding_seen', 'true');
                setShowOnboarding(false);
              }}
            />
          )}
          <Router>
            <AppContent />
          </Router>
        </LogoProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

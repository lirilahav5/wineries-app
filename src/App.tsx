import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LogoProvider } from './contexts/LogoContext';
import { SavedPlacesProvider } from './contexts/SavedPlacesContext';

// Components
import Home from './pages/Home';
import WineriesList from './pages/WineriesList';
import WineryDetails from './pages/WineryDetails';
import RegionsPage from './pages/RegionsPage';
import WineriesMap from './pages/WineriesMap';
import SavedPlaces from './pages/SavedPlaces';
import AllOffersPage from './pages/AllOffersPage';
import LoadingScreen from './components/LoadingScreen';
import OnboardingOverlay from './components/OnboardingOverlay';
import HomeScreen from './pages/Home';

const AppContent = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isMap = location.pathname === '/map';
  const isListings = location.pathname === '/listings';
  const isOffers = location.pathname === '/offers';

  return (
    <div className="app-container" dir="rtl" lang="he">
      <main className={!isHome && !isMap && !isListings && !isOffers ? "container mt-4" : "main-full"}>
        <Routes>
          <Route path="/" element={<RegionsPage />} />
          <Route path="/listings" element={<HomeScreen />} />
          <Route path="/home" element={<Home />} />
          <Route path="/regions" element={<RegionsPage />} />
          <Route path="/wineries" element={<WineriesList />} />
          <Route path="/wineries/:region" element={<WineriesList />} />
          <Route path="/winery/:id" element={<WineryDetails />} />
          <Route path="/map" element={<WineriesMap />} />
          <Route path="/saved" element={<SavedPlaces />} />
          <Route path="/offers" element={<AllOffersPage />} />
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
          <SavedPlacesProvider>
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
          </SavedPlacesProvider>
        </LogoProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

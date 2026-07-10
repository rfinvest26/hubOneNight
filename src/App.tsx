import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider } from '@/contexts/AuthContext';

import LandingPage from '@/pages/LandingPage';
import HomePage from '@/pages/HomePage';
import CatalogPage from '@/pages/CatalogPage';
import ModelPage from '@/pages/ModelPage';
import OnlyModelPage from '@/pages/OnlyModelPage';
import ProfilePage from '@/pages/ProfilePage';
import OrderPage from '@/pages/OrderPage';
import ModelChatPage from '@/pages/ModelChatPage';
import SupportChatPage from '@/pages/SupportChatPage';

function RouterSetup() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname !== '/') return;
    const params = new URLSearchParams(window.location.search);
    const modelCode = params.get('model');
    if (modelCode) {
      navigate(`/model/${modelCode.toUpperCase()}`, { replace: true });
    }
  }, [pathname, navigate]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/model/:code" element={<ModelPage />} />
      <Route path="/only/:code" element={<OnlyModelPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/order/:modelId" element={<OrderPage />} />
      <Route path="/chat/model/:modelId" element={<ModelChatPage />} />
      <Route path="/chat/support" element={<SupportChatPage />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppProvider>
          <AuthProvider>
            <RouterSetup />
          </AuthProvider>
        </AppProvider>
      </BrowserRouter>
    </MotionConfig>
  );
}

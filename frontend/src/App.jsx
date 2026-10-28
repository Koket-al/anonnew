import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { RealtimeProvider } from './context/RealtimeContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';

import LandingPage from './pages/LandingPage.jsx';
import HomePage from './pages/HomePage.jsx';
import AskTheCrowdPage from './pages/AskTheCrowdPage.jsx';
import PostDetailPage from './pages/PostDetailPage.jsx';
import CommunitiesPage from './pages/CommunitiesPage.jsx';
import CommunityDetailPage from './pages/CommunityDetailPage.jsx';
import AIAssistantPage from './pages/AIAssistantPage.jsx';
import ProfessionalsPage from './pages/ProfessionalsPage.jsx';
import PrivateMessagesPage from './pages/PrivateMessagesPage.jsx';
import ListeningRoomsPage from './pages/ListeningRoomsPage.jsx';
import ListeningRoomLivePage from './pages/ListeningRoomLivePage.jsx';
import SettingsPrivacyPage from './pages/SettingsPrivacyPage.jsx';
import ProfessionalPortalPage from './pages/ProfessionalPortalPage.jsx';
import ModerationPage from './pages/ModerationPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <RealtimeProvider>
          <ScrollToTop />
          <div className="app-container">
            {/* Tactile Archival Paper Grain Texture */}
            <div className="paper-grain-overlay" aria-hidden="true" />
            <Navbar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/crowd" element={<AskTheCrowdPage />} />
                <Route path="/posts/:id" element={<PostDetailPage />} />
                <Route path="/communities" element={<CommunitiesPage />} />
                <Route path="/communities/:identifier" element={<CommunityDetailPage />} />
                <Route path="/ai-guide" element={<AIAssistantPage />} />
                <Route path="/professionals" element={<ProfessionalsPage />} />
                <Route path="/messages" element={<PrivateMessagesPage />} />
                <Route path="/listening-rooms" element={<ListeningRoomsPage />} />
                <Route path="/listening-rooms/:id" element={<ListeningRoomLivePage />} />
                <Route path="/settings" element={<SettingsPrivacyPage />} />
                <Route path="/portal/pro" element={<ProfessionalPortalPage />} />
                <Route path="/portal/mod" element={<ModerationPage />} />
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/portal/admin" element={<AdminDashboardPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </RealtimeProvider>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);
}

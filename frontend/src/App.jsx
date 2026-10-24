import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Journal from './pages/Journal';
import Memories from './pages/Memories';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { api } from './services/api';

function AppContent() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'journal', 'memories', 'analytics', 'settings'

  // Desktop browser notifications trigger for overdue tasks and daily reminders
  useEffect(() => {
    if (!user) return;

    let seenNotifIds = new Set();

    const checkBrowserNotifs = async () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      try {
        const notifs = await api.getNotifications();
        notifs.forEach(n => {
          if (!n.is_read && !seenNotifIds.has(n.id)) {
            seenNotifIds.add(n.id);
            new Notification(`Productive: ${n.title}`, {
              body: n.message,
              icon: '/favicon.ico'
            });
          }
        });
      } catch (err) {
        // Silently catch background errors
      }
    };

    checkBrowserNotifs();
    const interval = setInterval(checkBrowserNotifs, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', color: 'var(--text-dim)' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(99, 102, 241, 0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: '0.9rem' }}>Loading Productive...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Unauthenticated view
  if (!user) {
    return (
      <div className="app-container">
        {authMode === 'login' ? (
          <Login onSwitchToRegister={() => setAuthMode('register')} />
        ) : (
          <Register onSwitchToLogin={() => setAuthMode('login')} />
        )}
      </div>
    );
  }

  // Authenticated application view
  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="main-content">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'journal' && <Journal />}
        {activeTab === 'memories' && <Memories />}
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

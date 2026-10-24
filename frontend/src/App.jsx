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

function playAlertChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // Silently ignore audio context autoplay restrictions
  }
}

function AppContent() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'journal', 'memories', 'analytics', 'settings'
  const [activeAlert, setActiveAlert] = useState(null);

  // Desktop browser notifications trigger, audio chime, and in-app banner for overdue tasks & reminders
  useEffect(() => {
    if (!user) return;

    let seenNotifIds = new Set();

    const checkBrowserNotifs = async () => {
      try {
        const notifs = await api.getNotifications();
        const unread = notifs.filter(n => !n.is_read);
        if (unread.length > 0) {
          const newest = unread[0];
          setActiveAlert(newest);

          // Play chime if it's a newly discovered alert
          if (!seenNotifIds.has(newest.id)) {
            seenNotifIds.add(newest.id);
            playAlertChime();
          }
        } else {
          setActiveAlert(null);
        }

        if ('Notification' in window && Notification.permission === 'granted') {
          unread.forEach(n => {
            if (!seenNotifIds.has(n.id)) {
              seenNotifIds.add(n.id);
              new Notification(`Productive: ${n.title}`, {
                body: n.message,
                icon: '/favicon.ico'
              });
            }
          });
        }
      } catch (err) {
        // Silently catch background errors
      }
    };

    checkBrowserNotifs();
    const interval = setInterval(checkBrowserNotifs, 10000); // Check every 10 seconds for real-time accuracy
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
      
      {activeAlert && (
        <div style={{
          background: activeAlert.notification_type === 'overdue_task' 
            ? 'linear-gradient(135deg, #e11d48, #be123c)' 
            : 'linear-gradient(135deg, #4f46e5, #6366f1)',
          color: '#fff',
          padding: '0.85rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 600,
          fontSize: '0.92rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          position: 'sticky',
          top: '58px',
          zIndex: 45,
          borderBottom: '2px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.3rem' }}>{activeAlert.notification_type === 'overdue_task' ? '⚠️' : '🔔'}</span>
            <span><strong>{activeAlert.title}:</strong> {activeAlert.message}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
            {activeAlert.notification_type === 'reminder_journal' && (
              <button
                onClick={async () => {
                  try {
                    await api.markNotificationRead(activeAlert.id);
                    setActiveAlert(null);
                    setActiveTab('journal');
                  } catch (e) {}
                }}
                style={{
                  background: '#fff',
                  color: '#4f46e5',
                  border: 'none',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
              >
                Write Journal Now →
              </button>
            )}

            {activeAlert.notification_type === 'reminder_plan' && (
              <button
                onClick={async () => {
                  try {
                    await api.markNotificationRead(activeAlert.id);
                    setActiveAlert(null);
                    setActiveTab('dashboard');
                  } catch (e) {}
                }}
                style={{
                  background: '#fff',
                  color: '#4f46e5',
                  border: 'none',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
              >
                Plan Tasks Now →
              </button>
            )}

            {activeAlert.notification_type === 'overdue_task' && (
              <button
                onClick={async () => {
                  try {
                    await api.markNotificationRead(activeAlert.id);
                    setActiveAlert(null);
                    setActiveTab('dashboard');
                  } catch (e) {}
                }}
                style={{
                  background: '#fff',
                  color: '#e11d48',
                  border: 'none',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
              >
                View Overdue Task →
              </button>
            )}

            <button
              onClick={async () => {
                try {
                  await api.markNotificationRead(activeAlert.id);
                  setActiveAlert(null);
                } catch (e) {}
              }}
              style={{
                background: 'rgba(255,255,255,0.25)',
                border: 'none',
                color: '#fff',
                padding: '0.35rem 0.8rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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

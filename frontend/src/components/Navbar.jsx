import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckSquare, 
  BookOpen, 
  Image as ImageIcon, 
  TrendingUp, 
  Settings as SettingsIcon, 
  Bell, 
  LogOut, 
  Check, 
  AlertTriangle, 
  Clock, 
  Sparkles 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);

  const fetchNotifs = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err) {
      // Ignore background notification fetch errors
    }
  };

  useEffect(() => {
    fetchNotifs();
    // Poll notifications every 30 seconds
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Tasks', icon: CheckSquare },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'memories', label: 'Memories', icon: ImageIcon },
    { id: 'analytics', label: 'Performance', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <nav className="navbar">
      <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
        <div className="nav-logo-icon">
          <Sparkles size={20} color="#fff" />
        </div>
        <span>Productive</span>
      </div>

      <ul className="nav-links">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <li key={item.id}>
              <button
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="nav-actions">
        {/* Notification Bell Dropdown */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => setShowNotifs(!showNotifs)}
            title="Notifications & Alerts"
            style={{ position: 'relative' }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#f43f5e',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #0b0f19',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="notif-menu">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Alerts & Reminders</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  No alerts right now. You are all caught up!
                </div>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <div
                    key={n.id}
                    className={`notif-item ${n.notification_type === 'overdue_task' ? 'overdue' : ''} ${!n.is_read ? 'unread' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {n.notification_type === 'overdue_task' ? <AlertTriangle size={14} color="#f43f5e" /> : <Clock size={14} color="#6366f1" />}
                        {n.title}
                      </span>
                      {!n.is_read && (
                        <button
                          onClick={(e) => handleMarkRead(n.id, e)}
                          title="Mark read"
                          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{n.message}</p>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* User email badge */}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.35rem 0.75rem', borderRadius: '8px' }}>
          {user?.email}
        </div>

        {/* Logout button */}
        <button className="btn btn-secondary btn-icon" onClick={logout} title="Sign Out">
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
}

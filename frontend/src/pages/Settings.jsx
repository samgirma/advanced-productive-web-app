import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Globe, 
  Clock, 
  Shield, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { api } from '../services/api';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
];

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [browserPermission, setBrowserPermission] = useState('default');

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await api.getSettings();
        setSettings(data);
      } catch (err) {
        setErrorMsg('Failed to load settings.');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();

    // Check browser notification permission
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications.');
      return;
    }
    const perm = await Notification.requestPermission();
    setBrowserPermission(perm);
    if (perm === 'granted') {
      new Notification('Productive Reminders Activated', {
        body: 'You will now receive desktop alerts for your daily planning, journal, and overdue tasks!',
        icon: '/favicon.ico'
      });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const updated = await api.updateSettings({
        timezone: settings.timezone,
        plan_reminder_time: settings.plan_reminder_time,
        journal_reminder_time: settings.journal_reminder_time,
        allow_ai_journal_review: settings.allow_ai_journal_review,
      });
      setSettings(updated);
      setSuccessMsg('Settings updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
        Loading your preferences...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
          App Settings & Reminders
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
          Configure your daily automated schedules, timezone, and desktop notifications.
        </p>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', color: '#10b981', fontSize: '0.85rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Check size={16} /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', color: '#f43f5e', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Daily Schedule Card */}
        <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Clock size={20} color="#6366f1" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
              Daily Reminder Times
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">
                a) "Plan Your Day" Reminder Time
              </label>
              <input
                type="time"
                className="form-input"
                required
                value={settings?.plan_reminder_time || '08:00'}
                onChange={(e) => setSettings({ ...settings, plan_reminder_time: e.target.value })}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>
                Alert message: "Please plan your day"
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">
                b) "Journal Your Day" Reminder Time
              </label>
              <input
                type="time"
                className="form-input"
                required
                value={settings?.journal_reminder_time || '21:00'}
                onChange={(e) => setSettings({ ...settings, journal_reminder_time: e.target.value })}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>
                Alert message: "How was your day? Write your journal."
              </span>
            </div>
          </div>
        </div>

        {/* Timezone & Localization */}
        <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Globe size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
              Timezone
            </h3>
          </div>

          <div className="form-group">
            <label className="form-label">Your Local Timezone</label>
            <select
              className="form-input"
              value={settings?.timezone || 'UTC'}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz} style={{ background: '#111827', color: '#fff' }}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Browser Desktop Notifications Card */}
        <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Bell size={20} color="#10b981" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
              Browser Desktop Notifications
            </h3>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Allow Productive to send native desktop alerts for overdue tasks and your scheduled daily planning moments even when this tab is minimized.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: browserPermission === 'granted' ? '#10b981' : 'var(--text-dim)' }}>
              Status: <strong>{browserPermission.toUpperCase()}</strong>
            </span>

            {browserPermission !== 'granted' && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={requestBrowserPermission}
              >
                Enable Desktop Alerts
              </button>
            )}
          </div>
        </div>

        {/* Privacy & AI Permissions */}
        <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Shield size={20} color="#818cf8" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
              Privacy & AI Permissions
            </h3>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings?.allow_ai_journal_review || false}
              onChange={(e) => setSettings({ ...settings, allow_ai_journal_review: e.target.checked })}
              style={{ marginTop: '0.2rem', width: '18px', height: '18px', accentColor: '#6366f1' }}
            />
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                Allow AI Coach to Read Journal Text (Stage 2)
              </span>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                When disabled, weekly AI performance reviews only receive raw quantitative numbers (completion rates, efficiency). Your private journal reflections remain strictly unseen.
              </p>
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving changes...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

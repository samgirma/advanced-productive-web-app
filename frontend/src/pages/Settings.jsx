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
import { useAuth } from '../context/AuthContext';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (International 24hr format)' },
  { value: 'Africa/Addis_Ababa', label: 'Africa/Addis_Ababa (East Africa Time - UTC+3)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'America/New_York', label: 'America/New_York (US Eastern)' },
  { value: 'America/Chicago', label: 'America/Chicago (US Central)' },
  { value: 'America/Denver', label: 'America/Denver (US Mountain)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (US Pacific)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
];

function getTzCurrentTime(tz) {
  try {
    return new Date().toLocaleTimeString('en-GB', {
      timeZone: tz || 'UTC',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return '--:--';
  }
}

function International24hTimeInput({ label, sublabel, value, onChange }) {
  const [h, m] = (value || '08:00').split(':');
  const currentH = (h || '08').padStart(2, '0');
  const currentM = (m || '00').padStart(2, '0');

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div className="form-group">
      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38bdf8', fontSize: '0.95rem', background: 'rgba(56, 189, 248, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
          {currentH}:{currentM} (24h)
        </span>
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem', display: 'block' }}>
            Hour (00 - 23):
          </label>
          <select
            className="form-input"
            value={currentH}
            onChange={(e) => onChange(`${e.target.value}:${currentM}`)}
            style={{ fontFamily: 'monospace', fontSize: '0.95rem', background: '#0f172a', color: '#fff' }}
          >
            {hours.map(hour => (
              <option key={hour} value={hour} style={{ background: '#0f172a', color: '#fff' }}>
                {hour}:00
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem', display: 'block' }}>
            Minute (00 - 59):
          </label>
          <select
            className="form-input"
            value={currentM}
            onChange={(e) => onChange(`${currentH}:${e.target.value}`)}
            style={{ fontFamily: 'monospace', fontSize: '0.95rem', background: '#0f172a', color: '#fff' }}
          >
            {minutes.map(min => (
              <option key={min} value={min} style={{ background: '#0f172a', color: '#fff' }}>
                :{min}
              </option>
            ))}
          </select>
        </div>
      </div>

      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.35rem', display: 'block' }}>
        {sublabel}
      </span>
    </div>
  );
}

export default function Settings() {
  const { updateUserTimezone } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [browserPermission, setBrowserPermission] = useState('default');
  const [nowTick, setNowTick] = useState(Date.now());

  // Ticker for live 24h clock display
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    if (e) e.preventDefault();
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
      updateUserTimezone(updated.timezone);

      // Immediately poll notifications to trigger any newly due reminders right now
      await api.getNotifications();

      setSuccessMsg(`✓ Saved! Reminders will alert you according to ${updated.timezone} time.`);
      setTimeout(() => setSuccessMsg(''), 5000);
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

  const detectedTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
  let currentTimeInSelectedTz = '';
  try {
    currentTimeInSelectedTz = new Date(nowTick).toLocaleTimeString('en-GB', {
      timeZone: settings?.timezone || 'UTC',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (e) {
    currentTimeInSelectedTz = '';
  }

  const known = new Set(TIMEZONES.map(t => t.value));
  const timezoneList = [...TIMEZONES];
  if (detectedTz && !known.has(detectedTz)) {
    timezoneList.splice(2, 0, { value: detectedTz, label: `${detectedTz} (Detected Device Timezone)` });
    known.add(detectedTz);
  }
  if (settings?.timezone && !known.has(settings.timezone)) {
    timezoneList.push({ value: settings.timezone, label: settings.timezone });
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
          App Settings & Reminders
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
          Configure your daily automated schedules, timezone, and desktop notifications in pure 24-hour format (00:00 - 23:59).
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} color="#6366f1" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                Daily Reminder Times (24-Hour International: 00:00 - 23:59)
              </h3>
            </div>
            {currentTimeInSelectedTz && (
              <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontFamily: 'monospace', background: 'rgba(56, 189, 248, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                Current time: <strong>{currentTimeInSelectedTz} (24h)</strong>
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <International24hTimeInput
              label='a) "Plan Your Day" Reminder Time (24h: 00-23)'
              sublabel='Alert message: "Please plan your day"'
              value={settings?.plan_reminder_time || '08:00'}
              onChange={(newVal) => setSettings({ ...settings, plan_reminder_time: newVal })}
            />

            <International24hTimeInput
              label='b) "Journal Your Day" Reminder Time (24h: 00-23)'
              sublabel='Alert message: "How was your day? Write your journal."'
              value={settings?.journal_reminder_time || '21:00'}
              onChange={(newVal) => setSettings({ ...settings, journal_reminder_time: newVal })}
            />
          </div>

          {/* Direct Save Button for Schedule */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saving}
              onClick={handleSave}
              style={{ fontWeight: 700 }}
            >
              {saving ? 'Saving...' : '💾 Save Reminder Schedule'}
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              Alerts trigger according to {settings?.timezone || 'UTC'} time.
            </span>
          </div>

          {/* Instant Alert Testing Section */}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Test Alerts Right Now:</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  await api.triggerTestAlert('reminder_plan');
                  setSuccessMsg('Triggered: "Plan Your Day" alert sent!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                } catch (err) {
                  setErrorMsg('Failed to trigger test alert');
                }
              }}
            >
              🔔 Test "Plan Your Day" Alert
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  await api.triggerTestAlert('reminder_journal');
                  setSuccessMsg('Triggered: "Journal Your Day" alert sent!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                } catch (err) {
                  setErrorMsg('Failed to trigger test alert');
                }
              }}
            >
              📖 Test "Journal Your Day" Alert
            </button>
          </div>
        </div>

        {/* Timezone & Localization */}
        <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={20} color="#38bdf8" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                Timezone Selection
              </h3>
            </div>
            {currentTimeInSelectedTz && (
              <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontFamily: 'monospace', background: 'rgba(56, 189, 248, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                {settings?.timezone || 'UTC'}: <strong>{currentTimeInSelectedTz} (24h)</strong>
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Selected Timezone (All alerts and tasks follow this 24-hour time):</label>
            <select
              className="form-input"
              value={settings?.timezone || 'UTC'}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              style={{ fontSize: '0.9rem' }}
            >
              {timezoneList.map(tz => (
                <option key={tz.value} value={tz.value} style={{ background: '#111827', color: '#fff' }}>
                  {tz.label} — [{getTzCurrentTime(tz.value)} 24h]
                </option>
              ))}
            </select>
          </div>

          {detectedTz && settings?.timezone !== detectedTz && (
            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '0.6rem 0.85rem', borderRadius: '8px', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#c7d2fe' }}>
                📍 Your browser device timezone is <strong>{detectedTz}</strong> (Current time: <strong>{getTzCurrentTime(detectedTz)} 24h</strong>).
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSettings({ ...settings, timezone: detectedTz })}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              >
                Set to {detectedTz}
              </button>
            </div>
          )}
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
            {saving ? 'Saving changes...' : 'Save All Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

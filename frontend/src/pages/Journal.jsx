import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Smile, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  PenTool 
} from 'lucide-react';
import { api } from '../services/api';

const MOODS = [
  { id: 'energized', label: 'Energized', icon: '⚡' },
  { id: 'calm', label: 'Calm', icon: '🌿' },
  { id: 'focused', label: 'Focused', icon: '🎯' },
  { id: 'reflective', label: 'Reflective', icon: '📖' },
  { id: 'tired', label: 'Tired', icon: '🌙' },
];

export default function Journal() {
  // Current active date string YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const [currentDate, setCurrentDate] = useState(todayStr);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'unsaved'
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [loggedDates, setLoggedDates] = useState([]);
  const [loading, setLoading] = useState(true);

  const debounceTimeout = useRef(null);

  // Fetch journal entry when currentDate changes
  useEffect(() => {
    let isMounted = true;
    async function loadEntry() {
      setLoading(true);
      try {
        const entry = await api.getJournal(currentDate);
        if (isMounted) {
          setContent(entry.content || '');
          setMood(entry.mood || null);
          setSaveStatus('saved');
        }
      } catch (err) {
        console.error('Failed to load journal:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    async function loadDates() {
      try {
        const dates = await api.getJournalDates();
        if (isMounted) setLoggedDates(dates);
      } catch (err) {
        console.error(err);
      }
    }

    loadEntry();
    loadDates();

    return () => {
      isMounted = false;
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [currentDate]);

  // Debounced Autosave
  const triggerAutosave = (newContent, newMood) => {
    setSaveStatus('unsaved');
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await api.saveJournal(currentDate, newContent, newMood);
        setSaveStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
        if (newContent.trim() && !loggedDates.includes(currentDate)) {
          setLoggedDates(prev => [...prev, currentDate]);
        }
      } catch (err) {
        setSaveStatus('error');
      }
    }, 1200); // Autosave 1.2s after user finishes typing
  };

  const handleContentChange = (e) => {
    const val = e.target.value;
    setContent(val);
    triggerAutosave(val, mood);
  };

  const handleMoodSelect = (moodId) => {
    const newMood = mood === moodId ? null : moodId;
    setMood(newMood);
    triggerAutosave(content, newMood);
  };

  // Day navigation
  const navigateDay = (offset) => {
    const d = new Date(currentDate + 'T12:00:00'); // Use noon to avoid timezone rollover
    d.setDate(d.getDate() + offset);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  // Formatted date string (e.g. "Saturday, October 24, 2026")
  const dateObj = new Date(currentDate + 'T12:00:00');
  const formattedDate = dateObj.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const isToday = currentDate === todayStr;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Date Navigation & Calendar Jump Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            className="btn btn-secondary btn-icon"
            onClick={() => navigateDay(-1)}
            title="Previous Day"
          >
            <ChevronLeft size={18} />
          </button>

          <button 
            className="btn btn-secondary btn-icon"
            onClick={() => navigateDay(1)}
            title="Next Day"
          >
            <ChevronRight size={18} />
          </button>

          {!isToday && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentDate(todayStr)}
            >
              Today
            </button>
          )}
        </div>

        {/* Date Picker Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <CalendarIcon size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
            <input
              type="date"
              className="form-input"
              value={currentDate}
              onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
              style={{ paddingLeft: '2.4rem', fontSize: '0.85rem', cursor: 'pointer' }}
            />
          </div>

          {/* Autosave Status Indicator */}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '130px' }}>
            {saveStatus === 'saving' && (
              <>
                <Loader2 size={13} className="spin" color="#6366f1" />
                <span>Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 size={13} color="#10b981" />
                <span>{lastSavedTime ? `Saved ${lastSavedTime}` : 'All changes saved'}</span>
              </>
            )}
            {saveStatus === 'unsaved' && <span>Unsaved changes</span>}
            {saveStatus === 'error' && <span style={{ color: '#f43f5e' }}>Failed to save</span>}
          </div>
        </div>
      </div>

      {/* Ruled Notebook Page */}
      <div className="notebook-container">
        {/* Red Vertical Margin Line */}
        <div className="notebook-margin-line" />

        {/* Notebook Page Header */}
        <div className="notebook-header">
          <div>
            <div className="notebook-date-display">
              <PenTool size={22} color="#6366f1" />
              <span>{formattedDate}</span>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              One entry per day • Strictly private to you
            </p>
          </div>

          {/* Mood Selector Chips */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              How are you feeling?
            </div>
            <div className="mood-chip-group">
              {MOODS.map(m => (
                <button
                  key={m.id}
                  className={`mood-chip ${mood === m.id ? 'selected' : ''}`}
                  onClick={() => handleMoodSelect(m.id)}
                  type="button"
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notebook Ruled Text Area */}
        {loading ? (
          <div style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            Loading your notebook page...
          </div>
        ) : (
          <textarea
            className="notebook-ruled-textarea"
            placeholder="How was your day spent? What did you achieve, learn, or struggle with today? Start writing here..."
            value={content}
            onChange={handleContentChange}
            autoFocus
          />
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Smile, 
  CheckCircle2, 
  Loader2,
  Sparkles, 
  PenTool,
  Search,
  Trophy,
  AlertTriangle,
  Lightbulb
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

  // Stage 2: Structured Output AI Journal Insights
  const [showInsights, setShowInsights] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsData, setInsightsData] = useState(null);
  const [insightsError, setInsightsError] = useState('');

  // Stage 3: Chroma Vector Search & LangChain 'Ask My Journal'
  const [showAskPanel, setShowAskPanel] = useState(false);
  const [askQuery, setAskQuery] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askResult, setAskResult] = useState(null);
  const [askError, setAskError] = useState('');

  const handleFetchInsights = async () => {
    setInsightsLoading(true);
    setInsightsError('');
    setShowInsights(true);
    try {
      const data = await api.getJournalInsights(currentDate);
      setInsightsData(data);
    } catch (err) {
      setInsightsError(err.message || 'Failed to generate journal insights.');
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleAskJournal = async (queryText) => {
    const q = queryText || askQuery;
    if (!q.trim()) return;
    setAskLoading(true);
    setAskError('');
    try {
      const res = await api.askJournal(q);
      setAskResult(res);
    } catch (err) {
      setAskError(err.message || 'Failed to search your journal vector store.');
    } finally {
      setAskLoading(false);
    }
  };

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

      {/* AI Controls Ribbon */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowAskPanel(!showAskPanel)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: showAskPanel ? 'rgba(99, 102, 241, 0.2)' : undefined, borderColor: showAskPanel ? '#818cf8' : undefined }}
        >
          <Search size={14} style={{ color: '#38bdf8' }} />
          <span>Ask My Journal (Vector Search)</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleFetchInsights}
          disabled={insightsLoading || !content.trim()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: showInsights ? 'rgba(168, 85, 247, 0.15)' : undefined, borderColor: showInsights ? '#c084fc' : undefined }}
        >
          {insightsLoading ? <Loader2 size={14} className="spin-animate" /> : <Sparkles size={14} style={{ color: '#c084fc' }} />}
          <span>{insightsLoading ? 'Analyzing...' : "Analyze Day's Journal (Gemini)"}</span>
        </button>
      </div>

      {/* Panel 1: Ask My Journal (Chroma Vector DB + LangChain) */}
      {showAskPanel && (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={16} style={{ color: '#38bdf8' }} />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f0f9ff', margin: 0 }}>
                Ask My Journal (Semantic Vector Search & RAG)
              </h4>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
              ChromaDB + LangChain
            </span>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleAskJournal(); }} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              className="form-input"
              style={{ flex: 1, fontSize: '0.85rem' }}
              placeholder='e.g. "when did I feel most productive?" or "what did I do on my birthday last year?"'
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              disabled={askLoading}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={askLoading || !askQuery.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
            >
              {askLoading ? <Loader2 size={14} className="spin-animate" /> : <Search size={14} />}
              Search
            </button>
          </form>

          {/* Quick prompt suggestions */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Suggestions:</span>
            {['When did I feel most productive?', 'What were my proudest moments?', 'What obstacles did I encounter recently?'].map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', background: 'rgba(30, 41, 59, 0.6)' }}
                onClick={() => { setAskQuery(suggestion); handleAskJournal(suggestion); }}
                disabled={askLoading}
              >
                {suggestion}
              </button>
            ))}
          </div>

          {askError && (
            <div style={{ padding: '0.6rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '6px', color: '#fda4af', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              {askError}
            </div>
          )}

          {askResult && (
            <div style={{ marginTop: '0.75rem', padding: '0.85rem', background: 'rgba(30, 41, 59, 0.9)', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.25)' }}>
              <p style={{ color: '#f8fafc', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 0.6rem 0' }}>
                {askResult.answer}
              </p>
              {askResult.source_dates && askResult.source_dates.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>Citations / Sources:</span>
                  {askResult.source_dates.map((dateStr, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem', padding: '0.1rem 0.45rem', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.4)' }}
                      onClick={() => setCurrentDate(dateStr)}
                      title={`Jump to ${dateStr} in journal`}
                    >
                      📅 {dateStr}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Panel 2: Structured Output AI Journal Insights */}
      {showInsights && (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} style={{ color: '#c084fc' }} />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f3e8ff', margin: 0 }}>
                AI Journal Insights ({currentDate})
              </h4>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}
              onClick={() => setShowInsights(false)}
            >
              Close
            </button>
          </div>

          {insightsLoading && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#c084fc', fontSize: '0.85rem' }}>
              <Loader2 size={18} className="spin-animate" style={{ display: 'inline', marginRight: '0.5rem' }} />
              Generating structured insights with Gemini...
            </div>
          )}

          {insightsError && (
            <div style={{ padding: '0.6rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '6px', color: '#fda4af', fontSize: '0.8rem' }}>
              {insightsError}
            </div>
          )}

          {insightsData && !insightsLoading && (
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.85rem' }}>
                Detected Mindset / Mood: {insightsData.mood}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '0.85rem' }}>
                {/* Wins */}
                <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    <Trophy size={14} /> Wins & Gratitude
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#e2e8f0' }}>
                    {insightsData.wins && insightsData.wins.length > 0 ? (
                      insightsData.wins.map((w, idx) => <li key={idx}>{w}</li>)
                    ) : (
                      <li style={{ color: 'var(--text-dim)' }}>None specifically recorded</li>
                    )}
                  </ul>
                </div>

                {/* Problems */}
                <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#fbbf24', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    <AlertTriangle size={14} /> Obstacles & Struggles
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#e2e8f0' }}>
                    {insightsData.problems && insightsData.problems.length > 0 ? (
                      insightsData.problems.map((p, idx) => <li key={idx}>{p}</li>)
                    ) : (
                      <li style={{ color: 'var(--text-dim)' }}>No major friction reported</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Tomorrow's Suggestion */}
              {insightsData.suggestion_for_tomorrow && (
                <div style={{ padding: '0.75rem 0.9rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Lightbulb size={16} style={{ color: '#38bdf8', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                      One Suggestion for Tomorrow:
                    </span>
                    <span style={{ fontSize: '0.84rem', color: '#f0f9ff' }}>
                      {insightsData.suggestion_for_tomorrow}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Play, 
  CheckCircle, 
  Trash2, 
  Clock, 
  AlertCircle, 
  Check, 
  Filter, 
  Calendar,
  Sparkles,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  format24hTime, 
  format12hTime, 
  format24hDate, 
  format24hInterval,
  localDateTimeToUtcIso,
  getCurrentDateTimeInTimezone,
  convert24to12,
  addMinutesToDateTimeLocal,
  setTargetTimeToDateTimeLocal
} from '../utils/dateUtils';

export default function Dashboard() {
  const { userTimezone } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'not_started', 'started', 'completed', 'overdue'

  // Task creation form state - accurately initialized in user's timezone
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(() => getCurrentDateTimeInTimezone(userTimezone));
  const [endTime, setEndTime] = useState(() => getCurrentDateTimeInTimezone(userTimezone, 60));
  const [formError, setFormError] = useState('');

  // Keep form dates synced with user's selected timezone when form is opened
  useEffect(() => {
    if (showAddForm) {
      setStartTime(getCurrentDateTimeInTimezone(userTimezone));
      setEndTime(getCurrentDateTimeInTimezone(userTimezone, 60));
    }
  }, [showAddForm, userTimezone]);

  // AI Quick Schedule State (Stage 2 Gemini Function Calling)
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCandidates, setAiCandidates] = useState([]);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState('');

  const handleAISchedule = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiSuccess('');
    setAiCandidates([]);
    setAiExplanation('');

    try {
      const response = await api.parseTasksWithAI(aiPrompt, userTimezone);
      if (response.candidate_tasks && response.candidate_tasks.length > 0) {
        setAiCandidates(response.candidate_tasks);
        setAiExplanation(response.explanation);
      } else {
        setAiError('No specific tasks or times could be extracted. Try stating: "Gym tomorrow 6 to 7pm and study 8 to 10"');
      }
    } catch (err) {
      setAiError(err.message || 'Failed to parse scheduling prompt with Gemini.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleConfirmAICandidates = async () => {
    if (aiCandidates.length === 0) return;
    setAiLoading(true);
    setAiError('');
    try {
      await api.confirmTasksWithAI(aiCandidates);
      setAiSuccess(`Successfully scheduled ${aiCandidates.length} task(s)!`);
      setAiCandidates([]);
      setAiPrompt('');
      setAiExplanation('');
      fetchTasks();
    } catch (err) {
      setAiError(err.message || 'Failed to save confirmed tasks.');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // Refresh tasks every 20 seconds to auto-detect overdue states
    const interval = setInterval(fetchTasks, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setFormError('');

    try {
      const startIso = localDateTimeToUtcIso(startTime, userTimezone);
      const endIso = localDateTimeToUtcIso(endTime, userTimezone);

      if (new Date(endIso) <= new Date(startIso)) {
        setFormError('End time must be later than start time.');
        return;
      }

      await api.createTask(title, startIso, endIso);
      setTitle('');
      setShowAddForm(false);
      fetchTasks();
    } catch (err) {
      setFormError(err.message || 'Could not create task.');
    }
  };

  const getTimeDisplayBadge = (dateTimeStr) => {
    if (!dateTimeStr || !dateTimeStr.includes('T')) return '';
    const timePart = dateTimeStr.split('T')[1];
    return `[${timePart} 24h]`;
  };

  const handleStartTask = async (taskId) => {
    try {
      await api.startTask(taskId);
      fetchTasks();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      await api.completeTask(taskId);
      fetchTasks();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      alert(err.message);
    }
  };

  // Filter tasks: overdue tasks appear ONLY in 'overdue', NOT in 'not_started' or 'started'
  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return task.is_overdue && task.status !== 'completed';
    if (filter === 'not_started') return task.status === 'not_started' && !task.is_overdue;
    if (filter === 'started') return task.status === 'started' && !task.is_overdue;
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

  // International 24-hour time format (HH:mm)
  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div>
      {/* Top action header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            Daily To-Do & Execution
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Schedule tasks, track real elapsed minutes, and eliminate overdue procrastination.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', background: 'rgba(99, 102, 241, 0.1)', padding: '0.2rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.25)', fontSize: '0.75rem', color: '#818cf8' }}>
            <Clock size={12} /> International 24-Hour Sync: <strong>{userTimezone}</strong>
          </div>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={18} /> Plan New Task
        </button>
      </div>

      {/* Gemini AI Natural Language Task Scheduler (Stage 2 Function Calling) */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} style={{ color: '#c084fc' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f3e8ff', margin: 0 }}>
              AI Quick Schedule (Gemini Function Calling)
            </h3>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#c084fc', background: 'rgba(192, 132, 252, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(192, 132, 252, 0.3)' }}>
            google-genai Tool Use
          </span>
        </div>

        <form onSubmit={handleAISchedule} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            style={{ flex: '1 1 320px', fontSize: '0.9rem' }}
            placeholder='Type naturally, e.g. "gym tomorrow 6 to 7pm and study 8 to 10"'
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            disabled={aiLoading}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={aiLoading || !aiPrompt.trim()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
          >
            {aiLoading ? <Loader2 size={16} className="spin-animate" /> : <Sparkles size={16} />}
            {aiLoading ? 'Parsing with Gemini...' : 'Extract Tasks'}
          </button>
        </form>

        {aiError && (
          <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '6px', color: '#fda4af', fontSize: '0.82rem' }}>
            {aiError}
          </div>
        )}

        {aiSuccess && (
          <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', color: '#6ee7b7', fontSize: '0.82rem' }}>
            {aiSuccess}
          </div>
        )}

        {/* Candidate Tasks Confirmation Modal/Card */}
        {aiCandidates.length > 0 && (
          <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '8px', border: '1px solid rgba(192, 132, 252, 0.4)' }}>
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '0.75rem', fontWeight: 600 }}>
              {aiExplanation}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {aiCandidates.map((cand, idx) => (
                <div key={idx} style={{ padding: '0.75rem', background: 'rgba(30, 41, 59, 0.8)', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                  <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                    {cand.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Start: <strong style={{ color: '#38bdf8' }}>{format24hDate(cand.planned_start_time, userTimezone)} {format24hTime(cand.planned_start_time, userTimezone)}</strong> ({format12hTime(cand.planned_start_time, userTimezone)})
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    End: <strong style={{ color: '#a5b4fc' }}>{format24hDate(cand.planned_end_time, userTimezone)} {format24hTime(cand.planned_end_time, userTimezone)}</strong> ({format12hTime(cand.planned_end_time, userTimezone)})
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAiCandidates([])}
                disabled={aiLoading}
              >
                Discard
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirmAICandidates}
                disabled={aiLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderColor: '#10b981' }}
              >
                {aiLoading ? <Loader2 size={14} className="spin-animate" /> : <Check size={14} />}
                Confirm & Add {aiCandidates.length} Task(s)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Task Creation Modal / Dropdown */}
      {showAddForm && (
        <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem' }}>
            Plan a Scheduled Task
          </h3>

          {formError && (
            <div style={{ color: '#f43f5e', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateTask}>
            <div className="form-group">
              <label className="form-label">Task Title</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="e.g. Build API endpoints, Workout, Deep reading"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Planned Start Time</span>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                    {getTimeDisplayBadge(startTime)}
                  </span>
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'block' }}>
                  Timezone: {userTimezone}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Planned End Time (Deadline)</span>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                    {getTimeDisplayBadge(endTime)}
                  </span>
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'block' }}>
                  Overdue alert fires when this deadline passes
                </span>
              </div>
            </div>

            {/* Quick time interval presets */}
            <div style={{ marginTop: '0.5rem', marginBottom: '1rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>Quick Deadline Pick:</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                onClick={() => {
                  if (startTime) {
                    setEndTime(addMinutesToDateTimeLocal(startTime, 30));
                  }
                }}
              >
                +30 min
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                onClick={() => {
                  if (startTime) {
                    setEndTime(addMinutesToDateTimeLocal(startTime, 60));
                  }
                }}
              >
                +1 hour
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                onClick={() => {
                  if (startTime) {
                    setEndTime(addMinutesToDateTimeLocal(startTime, 120));
                  }
                }}
              >
                +2 hours
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                onClick={() => {
                  if (startTime) {
                    setEndTime(setTargetTimeToDateTimeLocal(startTime, 15, 0));
                  }
                }}
              >
                Set to 15:00 (24h)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                onClick={() => {
                  if (startTime) {
                    setEndTime(setTargetTimeToDateTimeLocal(startTime, 17, 0));
                  }
                }}
              >
                Set to 17:00 (24h)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                onClick={() => {
                  if (startTime) {
                    setEndTime(setTargetTimeToDateTimeLocal(startTime, 21, 0));
                  }
                }}
              >
                Set to 21:00 (24h)
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Task
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs - Overdue tasks appear ONLY in Overdue */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: `All (${tasks.length})` },
          { id: 'not_started', label: `Not Started (${tasks.filter(t => t.status === 'not_started' && !t.is_overdue).length})` },
          { id: 'started', label: `In Progress (${tasks.filter(t => t.status === 'started' && !t.is_overdue).length})` },
          { id: 'completed', label: `Completed (${tasks.filter(t => t.status === 'completed').length})` },
          { id: 'overdue', label: `Overdue (${tasks.filter(t => t.is_overdue && t.status !== 'completed').length})` },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: filter === item.id ? '#6366f1' : 'var(--border-glass)',
              background: filter === item.id ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: filter === item.id ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
          Loading your daily tasks...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <Clock size={40} color="var(--text-dim)" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 700 }}>No tasks found in this view</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
            Click "Plan New Task" above to schedule your daily commitments.
          </p>
        </div>
      ) : (
        <div>
          {filteredTasks.map(task => {
            const isCompleted = task.status === 'completed';
            const isStarted = task.status === 'started';
            const isOverdue = task.is_overdue && !isCompleted;

            return (
              <div 
                key={task.id} 
                className={`task-card ${isOverdue ? 'overdue' : ''} ${isCompleted ? 'completed' : ''}`}
              >
                {/* Left section: Checkbox & Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  {/* Clickable completion checkbox */}
                  <button
                    onClick={() => !isCompleted && handleCompleteTask(task.id)}
                    title={isCompleted ? 'Completed' : 'Mark Complete'}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      border: isCompleted ? 'none' : '2px solid rgba(255,255,255,0.3)',
                      background: isCompleted ? '#10b981' : 'transparent',
                      cursor: isCompleted ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isCompleted && <Check size={16} color="#fff" strokeWidth={3} />}
                  </button>

                  <div>
                    <span className={`task-title ${isCompleted ? 'completed' : ''}`}>
                      {task.title}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                      {/* Scheduled interval converted to user's timezone in 24h and 12h format */}
                      {(() => {
                        const interval = format24hInterval(task.planned_start_time, task.planned_end_time, userTimezone);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                              <Clock size={13} color="#6366f1" />
                              <span>{interval.date}</span> · <span style={{ color: '#38bdf8' }}>{interval.timeRange24} (24h)</span>
                              {interval.duration && <span style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{interval.duration}</span>}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                              Timezone: {interval.tzShort}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Status badge: Appears ONLY as OVERDUE if deadline passed */}
                      <span className={`status-badge ${isOverdue ? 'overdue' : task.status}`}>
                        {isOverdue ? 'OVERDUE' : (task.status === 'started' ? 'IN PROGRESS' : task.status.replace('_', ' '))}
                      </span>

                      {/* Real recorded times in user's timezone (24h) */}
                      {task.started_at && (
                        <span style={{ fontSize: '0.72rem', color: '#38bdf8' }}>
                          Started: {format24hTime(task.started_at, userTimezone)}
                        </span>
                      )}
                      {task.completed_at && (
                        <span style={{ fontSize: '0.72rem', color: '#10b981' }}>
                          Completed: {format24hTime(task.completed_at, userTimezone)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right section: Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {task.status === 'not_started' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleStartTask(task.id)}
                      title="Start Working on this task"
                    >
                      <Play size={13} /> Start
                    </button>
                  )}

                  {isStarted && (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleCompleteTask(task.id)}
                      title="Finish and Complete Task"
                    >
                      <CheckCircle size={14} /> Complete
                    </button>
                  )}

                  <button
                    className="btn btn-secondary btn-icon btn-sm"
                    onClick={() => handleDeleteTask(task.id)}
                    title="Delete task"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

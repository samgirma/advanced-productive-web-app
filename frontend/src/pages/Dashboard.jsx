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
  Calendar 
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
  convert24to12 
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
                    const [d, t] = startTime.split('T');
                    const [h, m] = t.split(':').map(Number);
                    const endDt = new Date(Date.UTC(2000, 0, 1, h, m + 30));
                    const pad = n => String(n).padStart(2, '0');
                    setEndTime(`${d}T${pad(endDt.getUTCHours())}:${pad(endDt.getUTCMinutes())}`);
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
                    const [d, t] = startTime.split('T');
                    const [h, m] = t.split(':').map(Number);
                    const endDt = new Date(Date.UTC(2000, 0, 1, h + 1, m));
                    const pad = n => String(n).padStart(2, '0');
                    setEndTime(`${d}T${pad(endDt.getUTCHours())}:${pad(endDt.getUTCMinutes())}`);
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
                    const [d] = startTime.split('T');
                    setEndTime(`${d}T15:00`);
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
                    const [d] = startTime.split('T');
                    setEndTime(`${d}T17:00`);
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
                    const [d] = startTime.split('T');
                    setEndTime(`${d}T21:00`);
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

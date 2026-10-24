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

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'not_started', 'started', 'completed', 'overdue'

  // Task creation form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  
  // Default to today with 1-hour interval starting now
  const now = new Date();
  const formatInputDateTime = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  const [startTime, setStartTime] = useState(formatInputDateTime(now));
  const [endTime, setEndTime] = useState(formatInputDateTime(oneHourLater));
  const [formError, setFormError] = useState('');

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

    if (new Date(endTime) <= new Date(startTime)) {
      setFormError('End time must be later than start time.');
      return;
    }

    try {
      await api.createTask(
        title,
        new Date(startTime).toISOString(),
        new Date(endTime).toISOString()
      );
      setTitle('');
      setShowAddForm(false);
      fetchTasks();
    } catch (err) {
      setFormError(err.message || 'Could not create task.');
    }
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

  // Filter tasks based on selected tab
  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return task.is_overdue && task.status !== 'completed';
    return task.status === filter;
  });

  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Planned Start Time</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Planned End Time</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
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

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: `All (${tasks.length})` },
          { id: 'not_started', label: `Not Started (${tasks.filter(t => t.status === 'not_started').length})` },
          { id: 'started', label: `In Progress (${tasks.filter(t => t.status === 'started').length})` },
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
                      {/* Scheduled interval */}
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={12} />
                        {formatDate(task.planned_start_time)} {formatTime(task.planned_start_time)} - {formatTime(task.planned_end_time)}
                      </span>

                      {/* Status badge */}
                      <span className={`status-badge ${isOverdue ? 'overdue' : task.status}`}>
                        {isOverdue ? 'Overdue' : task.status.replace('_', ' ')}
                      </span>

                      {/* Real recorded times */}
                      {task.started_at && (
                        <span style={{ fontSize: '0.72rem', color: '#38bdf8' }}>
                          Started: {formatTime(task.started_at)}
                        </span>
                      )}
                      {task.completed_at && (
                        <span style={{ fontSize: '0.72rem', color: '#10b981' }}>
                          Completed: {formatTime(task.completed_at)}
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

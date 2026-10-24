import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Zap, 
  HelpCircle, 
  Activity, 
  BarChart3 
} from 'lucide-react';
import { api } from '../services/api';

export default function Analytics() {
  const [period, setPeriod] = useState('weekly'); // 'daily', 'weekly', 'monthly', 'annual'
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await api.getAnalytics(period);
        setAnalytics(data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [period]);

  const periods = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'annual', label: 'Annual' },
  ];

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
        Calculating your performance metrics...
      </div>
    );
  }

  const metrics = analytics?.current_metrics || {};
  const comparison = analytics?.comparison;
  const chartData = analytics?.chart_data || [];

  const score = metrics.productivity_score || 0;
  
  // Color code productivity score
  let scoreColor = '#10b981'; // Green
  if (score < 50) scoreColor = '#f43f5e'; // Red
  else if (score < 75) scoreColor = '#f59e0b'; // Amber
  else if (score < 90) scoreColor = '#38bdf8'; // Cyan

  // Circular gauge calculations
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div>
      {/* Header and Period Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            Performance Tracking & Analytics
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Data-backed metrics on your schedule discipline, completion speed, and productivity trends.
          </p>
        </div>

        {/* Period Buttons */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '0.3rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: period === p.id ? '#6366f1' : 'transparent',
                color: period === p.id ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Score Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Circular Gauge Card */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="180" height="180" style={{ transform: 'rotate(-90deg)' }}>
              {/* Background track circle */}
              <circle
                cx="90"
                cy="90"
                r={radius}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="14"
                fill="transparent"
              />
              {/* Dynamic progress circle */}
              <circle
                cx="90"
                cy="90"
                r={radius}
                stroke={scoreColor}
                strokeWidth="14"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>

            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <span className="score-display-number" style={{ color: scoreColor }}>
                {Math.round(score)}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginTop: '-0.3rem' }}>
                OUT OF 100
              </span>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
              Productivity Score
            </h3>
            
            {/* Period-over-period comparison */}
            {comparison && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: comparison.improved ? '#10b981' : '#f43f5e' }}>
                {comparison.improved ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>
                  {comparison.score_difference >= 0 ? `+${comparison.score_difference}` : comparison.score_difference} pts vs last {period}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4 Metric Breakdown Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* Completion Rate */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completion</span>
              <CheckCircle size={16} color="#10b981" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>
              {metrics.completion_rate}%
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
              {metrics.completed_tasks} of {metrics.total_tasks} tasks finished
            </p>
          </div>

          {/* On-Time Rate */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>On-Time Rate</span>
              <Clock size={16} color="#38bdf8" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>
              {metrics.on_time_rate}%
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
              {metrics.on_time_tasks} completed on or before end time
            </p>
          </div>

          {/* Time Efficiency */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time Efficiency</span>
              <Zap size={16} color="#818cf8" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>
              {metrics.time_efficiency_rate}%
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
              {metrics.planned_minutes}m planned vs {metrics.actual_minutes}m actual
            </p>
          </div>

          {/* Overdue Count */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overdue Count</span>
              <AlertTriangle size={16} color="#f43f5e" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: metrics.overdue_count > 0 ? '#f43f5e' : '#fff' }}>
              {metrics.overdue_count}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
              Tasks passing end times without completion
            </p>
          </div>
        </div>
      </div>

      {/* Trend Bar Chart Section */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <BarChart3 size={20} color="#6366f1" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
            Productivity Trend ({period.toUpperCase()})
          </h3>
        </div>

        {chartData.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            No task data available for this chart period.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '180px', paddingBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {chartData.map((pt, idx) => {
              const barHeight = Math.max(8, (pt.productivity_score / 100) * 140);
              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>
                    {Math.round(pt.productivity_score)}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '36px',
                      height: `${barHeight}px`,
                      background: 'linear-gradient(to top, #4f46e5, #6366f1)',
                      borderRadius: '6px 6px 2px 2px',
                      transition: 'height 0.4s ease',
                    }}
                    title={`${pt.label}: ${pt.completed_count}/${pt.total_count} tasks completed`}
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    {pt.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formula Explanation Card */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <HelpCircle size={18} color="#10b981" />
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
            How Your Productivity Score Is Calculated
          </h4>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          {analytics?.formula_explanation}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>40% Completion:</span>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Finishing tasks you scheduled.</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>40% On-Time:</span>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Finishing before deadline passes.</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>20% Efficiency:</span>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Actual vs planned duration.</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
            <span style={{ color: '#f43f5e', fontWeight: 700, fontSize: '0.85rem' }}>-15% Overdue:</span>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Penalizes neglected deadlines.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

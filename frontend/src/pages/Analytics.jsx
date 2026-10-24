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
  BarChart3,
  Sparkles,
  Loader2,
  Target,
  ShieldCheck
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

  // AI Coach Review State (Stage 2)
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachData, setCoachData] = useState(null);
  const [coachError, setCoachError] = useState('');

  const fetchCoachReview = async () => {
    setCoachLoading(true);
    setCoachError('');
    try {
      const data = await api.getAICoachReview();
      setCoachData(data);
    } catch (err) {
      setCoachError(err.message || 'Failed to generate weekly AI coach review.');
    } finally {
      setCoachLoading(false);
    }
  };

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

      {/* Weekly AI Performance Coach Review (Stage 2) */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)', border: '1px solid rgba(168, 85, 247, 0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} style={{ color: '#c084fc' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f3e8ff', margin: 0 }}>
                Weekly AI Performance Coach
              </h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Gemini executive analysis of your completion rates, on-time punctuality, and execution habits.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={fetchCoachReview}
            disabled={coachLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', borderColor: '#a855f7' }}
          >
            {coachLoading ? <Loader2 size={15} className="spin-animate" /> : <Sparkles size={15} />}
            {coachLoading ? 'Auditing Performance...' : 'Run Weekly AI Audit'}
          </button>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.12)', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '1rem' }}>
          <ShieldCheck size={14} style={{ color: '#38bdf8' }} />
          <span>Strict Privacy Protection: Analyzes numerical score trends only (private journal text withheld unless opted-in).</span>
        </div>

        {coachError && (
          <div style={{ padding: '0.75rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '6px', color: '#fda4af', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {coachError}
          </div>
        )}

        {coachData && (
          <div style={{ marginTop: '0.5rem' }}>
            {/* Motivational summary */}
            <div style={{ padding: '0.85rem 1rem', background: 'rgba(30, 41, 59, 0.85)', borderRadius: '8px', borderLeft: '4px solid #c084fc', marginBottom: '1.25rem' }}>
              <p style={{ color: '#f8fafc', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                {coachData.motivational_summary}
              </p>
            </div>

            {/* Strengths and Weaknesses */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              {/* Strengths */}
              <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.6rem' }}>
                  <CheckCircle size={15} /> Demonstrated Strengths
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#e2e8f0', lineHeight: '1.6' }}>
                  {coachData.strengths.map((str, idx) => <li key={idx}>{str}</li>)}
                </ul>
              </div>

              {/* Weaknesses / Opportunities */}
              <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fbbf24', fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.6rem' }}>
                  <AlertTriangle size={15} /> Areas for Improvement
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#e2e8f0', lineHeight: '1.6' }}>
                  {coachData.weaknesses.map((w, idx) => <li key={idx}>{w}</li>)}
                </ul>
              </div>
            </div>

            {/* 3 Action Items */}
            <div style={{ padding: '1rem 1.25rem', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                <Target size={16} /> 3 High-Impact Actions for Next Week
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {coachData.action_items.map((act, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.84rem', color: '#f0f9ff' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: '#38bdf8', color: '#0f172a', fontWeight: 800, fontSize: '0.72rem', flexShrink: 0, marginTop: '1px' }}>
                      {idx + 1}
                    </span>
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>
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

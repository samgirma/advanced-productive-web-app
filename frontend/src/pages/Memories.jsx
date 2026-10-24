import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Trash2, 
  X, 
  Film, 
  Image as ImageIcon, 
  Info, 
  Calendar, 
  FileCheck, 
  Plus 
} from 'lucide-react';
import { api } from '../services/api';

export default function Memories() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDate, setUploadDate] = useState(todayStr);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Lightbox viewer state
  const [activeMemory, setActiveMemory] = useState(null);

  const fetchMemories = async () => {
    try {
      const data = await api.getMemories(selectedDate || null);
      setMemories(data);
    } catch (err) {
      console.error('Failed to load memories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [selectedDate]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadFile(file);
      setUploadError('');
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select an image or video file.');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      await api.uploadMemory(uploadFile, uploadDate, caption);
      setShowUploadModal(false);
      setUploadFile(null);
      setCaption('');
      fetchMemories();
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (memoryId) => {
    if (!confirm('Are you sure you want to permanently delete this memory?')) return;
    try {
      await api.deleteMemory(memoryId);
      setMemories(prev => prev.filter(m => m.id !== memoryId));
      if (activeMemory?.id === memoryId) setActiveMemory(null);
    } catch (err) {
      alert(err.message);
    }
  };

  // Group memories by entry_date
  const groupedMemories = memories.reduce((groups, item) => {
    const date = item.entry_date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedMemories).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            Daily Memories Gallery
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Capture moments, photos, and video reflections of your day.
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => setShowUploadModal(true)}
        >
          <Plus size={18} /> Upload Memory
        </button>
      </div>

      {/* Explanation Banner: Why File Limits Matter */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.85rem', borderLeft: '4px solid #6366f1' }}>
        <Info size={20} color="#6366f1" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
          <strong style={{ color: '#fff' }}>Storage Policy & Security:</strong> We accept pictures (JPG, PNG, WEBP, GIF ≤ 10MB) and videos (MP4, WEBM, MOV ≤ 50MB). 
          Strict size and type limits defend our servers from denial-of-service disk exhaustion attacks and ensure lightning-fast browser loading across your devices.
        </p>
      </div>

      {/* Date Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Filter by Date:
        </span>
        <input
          type="date"
          className="form-input"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ fontSize: '0.85rem', padding: '0.45rem 0.8rem' }}
        />
        {selectedDate && (
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedDate('')}
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Media Gallery Grouped by Date */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
          Loading your memories...
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
          <ImageIcon size={44} color="var(--text-dim)" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 700 }}>No memories recorded yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
            Click "Upload Memory" above to preserve a photo or video from your day.
          </p>
        </div>
      ) : (
        sortedDates.map((dateKey) => {
          const items = groupedMemories[dateKey];
          const displayDate = new Date(dateKey + 'T12:00:00').toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          });

          return (
            <div key={dateKey} style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Calendar size={18} color="#6366f1" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>{displayDate}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="memory-grid">
                {items.map((mem) => (
                  <div 
                    key={mem.id} 
                    className="memory-card"
                    onClick={() => setActiveMemory(mem)}
                  >
                    {mem.file_type === 'image' ? (
                      <img src={mem.file_path} alt={mem.caption || mem.file_name} className="memory-thumb" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b' }}>
                        <Film size={40} color="#38bdf8" />
                      </div>
                    )}

                    <div className="memory-overlay">
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {mem.caption || mem.file_name}
                      </p>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)' }}>
                        {(mem.file_size_bytes / (1024 * 1024)).toFixed(1)} MB • {mem.file_type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Lightbox Modal Viewer */}
      {activeMemory && (
        <div className="modal-backdrop" onClick={() => setActiveMemory(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                  {activeMemory.caption || activeMemory.file_name}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {activeMemory.entry_date} • {(activeMemory.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
              <button 
                className="btn btn-secondary btn-icon"
                onClick={() => setActiveMemory(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: '60vh', marginBottom: '1.25rem' }}>
              {activeMemory.file_type === 'image' ? (
                <img 
                  src={activeMemory.file_path} 
                  alt={activeMemory.caption || 'Memory'} 
                  style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} 
                />
              ) : (
                <video 
                  src={activeMemory.file_path} 
                  controls 
                  autoPlay 
                  style={{ maxWidth: '100%', maxHeight: '60vh' }} 
                />
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '0.9rem', color: '#e5e7eb' }}>
                {activeMemory.caption}
              </p>
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(activeMemory.id)}
              >
                <Trash2 size={14} /> Delete Memory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-backdrop" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                Upload Daily Memory
              </h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowUploadModal(false)}>
                <X size={18} />
              </button>
            </div>

            {uploadError && (
              <div style={{ color: '#f43f5e', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit}>
              <div className="form-group">
                <label className="form-label">Date of Memory</label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={uploadDate}
                  onChange={(e) => setUploadDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Choose Picture or Video</label>
                <input
                  type="file"
                  className="form-input"
                  required
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  onChange={handleFileSelect}
                  style={{ padding: '0.5rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                  Images ≤ 10MB • Videos ≤ 50MB
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Caption / Memory Story (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Morning run by the river, Finished the project demo"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Save Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

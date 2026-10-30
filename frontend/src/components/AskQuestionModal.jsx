import React, { useState, useEffect } from 'react';
import { createPost } from '../services/api.js';
import { HelpCircle, X, Users, Sparkles, Shield } from 'lucide-react';

export default function AskQuestionModal({
  isOpen,
  onClose,
  onSuccess,
  communityId = null,
  communityName = '',
  communityTopic = '',
  defaultCommunityId = null
}) {
  const targetCommunityId = communityId || defaultCommunityId || null;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(communityTopic || 'General Discussion');
  const [hasBeenThroughThis, setHasBeenThroughThis] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (communityTopic) {
        setCategory(communityTopic);
      } else {
        setCategory('General Discussion');
      }
    }
  }, [isOpen, communityTopic]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      const res = await createPost({
        title,
        content,
        communityId: targetCommunityId || null,
        category,
        hasBeenThroughThis
      });

      if (res.success) {
        setTitle('');
        setContent('');
        onSuccess(res.post);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to publish question.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HelpCircle size={20} />
            <h3 style={{ fontSize: '1.35rem' }}>
              {targetCommunityId ? `Ask in c/${communityName || 'Sphere'}` : 'Ask the Crowd'}
            </h3>
          </div>
          <button className="btn btn-subtle btn-sm" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="alert-banner alert-warning" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Your Question or Struggle</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. How do you cope with feeling overwhelmed or isolated?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Details / Context</label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="Explain what you are going through. You don't have to share anything identifying..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              minLength={10}
              maxLength={5000}
            />
            <div className="form-hint">{content.length}/5000 characters</div>
          </div>

          <div className="modal-two-col-grid">
            <div className="form-group">
              <label className="form-label">Posting In</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 10,
                  fontSize: '0.875rem',
                  color: 'var(--text-main)',
                  fontWeight: 500,
                  minHeight: 42
                }}
              >
                {targetCommunityId ? (
                  <>
                    <Users size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>c/{communityName || 'Community'}</span>
                    <span
                      className="crowd-tag-pill highlight"
                      style={{ marginLeft: 'auto', fontSize: '0.68rem', padding: '2px 8px' }}
                    >
                      Joined Sphere
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span>Public Discussion Feed</span>
                  </>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="General Discussion">General Discussion</option>
                <option value="Mental Well-being">Mental Well-being</option>
                <option value="Relationships">Relationships</option>
                <option value="Family Stress">Family Stress</option>
                <option value="School & Pressure">School & Pressure</option>
                <option value="Sexual Health">Sexual Health</option>
                <option value="Habits & Recovery">Habits & Recovery</option>
              </select>
            </div>
          </div>

          {/* "Has anyone been through this?" Toggle */}
          <div
            className="form-group"
            style={{
              background: 'var(--bg-subtle)',
              padding: 14,
              border: '1px solid var(--border-light)',
              borderRadius: 10,
              marginTop: 4
            }}
          >
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hasBeenThroughThis}
                onChange={(e) => setHasBeenThroughThis(e.target.checked)}
              />
              <div>
                <span style={{ fontWeight: 600 }}>“Has anyone been through this?”</span>
                <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                  Enables a dedicated button for peers to self-report and mark that they have faced this exact situation.
                </p>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Posting anonymously...' : targetCommunityId ? 'Publish to Sphere' : 'Publish Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

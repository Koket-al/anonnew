import React, { useState } from 'react';
import { requestConversation } from '../services/api.js';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { MessageSquare, X } from 'lucide-react';

export default function ConnectModal({ isOpen, onClose, targetIdentityId, targetUsername, relatedPostId, onSuccess }) {
  const { showToast } = useRealtime();
  const [initialNote, setInitialNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;
  if (!targetIdentityId && (!targetUsername || targetUsername === 'Anonymous')) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await requestConversation({
        targetIdentityId,
        targetUsername,
        initialNote,
        relatedPostId
      });

      if (res.success) {
        showToast({
          type: 'connection',
          title: 'Connection Request Sent',
          message: `Your request was delivered to @${targetUsername || 'Peer'} in real-time. Status: Pending Acceptance.`
        });
        if (onSuccess) onSuccess(res.conversationId);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Unable to send connection request.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={18} />
            <h3 style={{ fontSize: '1.25rem' }}>Connect with {targetUsername || 'Peer'}</h3>
          </div>
          <button className="btn btn-subtle btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
          To protect everyone's privacy and comfort, your peer must accept your connection request before private messages can be sent.
        </p>

        {error && (
          <div className="alert-banner alert-warning">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Introductory Note</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="e.g. I saw your question about finals stress and would love to share what helped me..."
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              maxLength={300}
            />
            <div className="form-hint">{300 - initialNote.length} characters remaining</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Sending Request...' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

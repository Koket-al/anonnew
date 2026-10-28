import React, { useState } from 'react';
import { submitReport } from '../services/api.js';
import { ShieldAlert, X } from 'lucide-react';

const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment, bullying, or intimidation' },
  { value: 'threat_or_harm', label: 'Threat of harm, suicide, or violence' },
  { value: 'doxxing_or_pii', label: 'Exposing personal identities or contact info' },
  { value: 'hate_speech', label: 'Hate speech or discriminatory abuse' },
  { value: 'spam_or_solicitation', label: 'Spam, ads, or inappropriate solicitation' },
  { value: 'medical_misinformation', label: 'Dangerous medical advice or false claims' },
  { value: 'other', label: 'Other violation of community safety rules' }
];

export default function ReportModal({ isOpen, onClose, targetType, targetId, targetTitle }) {
  const [reason, setReason] = useState('harassment');
  const [explanation, setExplanation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      await submitReport({
        targetType,
        targetId,
        reason,
        explanation
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
            <ShieldAlert size={18} color="#B3261E" />
            <span>Report Content to Moderation</span>
          </div>
          <button className="btn btn-subtle btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="alert-banner alert-info" style={{ marginTop: 12 }}>
            Thank you. Your report has been submitted to the safety team for review.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {targetTitle && (
              <div style={{ fontSize: '0.875rem', marginBottom: 14, color: 'var(--text-muted)' }}>
                Reporting: <strong style={{ color: 'var(--text-main)' }}>{targetTitle}</strong>
              </div>
            )}

            {error && (
              <div className="alert-banner alert-warning" style={{ marginBottom: 14 }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Reason for reporting</label>
              <select
                className="form-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Additional context <span className="text-muted">(Optional)</span>
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Provide any details that will help moderators understand the situation..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                maxLength={500}
              />
              <div className="form-hint">{500 - explanation.length} characters remaining</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

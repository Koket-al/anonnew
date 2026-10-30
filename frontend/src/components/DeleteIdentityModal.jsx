import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, CheckCircle2, Shield, X, MessageSquare, HeartHandshake, Sparkles } from 'lucide-react';

export default function DeleteIdentityModal({ isOpen, onClose, targetIdentity, onConfirmDelete, isDeleting }) {
  const [deleteMessages, setDeleteMessages] = useState(false);

  if (!isOpen || !targetIdentity) return null;

  async function handleConfirm() {
    await onConfirmDelete(targetIdentity.id, { deleteMessages });
    onClose();
  }

  const modalContent = (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-dialog crowd-card modal-center-pop"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 540,
          background: 'var(--bg-card)',
          borderRadius: 20,
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.35)',
          border: '1px solid var(--border-light)',
          position: 'relative',
          margin: 'auto'
        }}
      >
        {/* Vintage corner accents */}
        <div className="corner-cross tl" aria-hidden="true" />
        <div className="corner-cross tr" aria-hidden="true" />
        <div className="corner-cross bl" aria-hidden="true" />
        <div className="corner-cross br" aria-hidden="true" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 4
          }}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: '#FEE2E2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="mono-subtle" style={{ color: '#DC2626', display: 'block', fontSize: '0.72rem' }}>
              CONSCIOUS REMOVAL //
            </span>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', margin: 0, color: 'var(--text-main)' }}>
              Remove Identity
            </h3>
          </div>
        </div>

        {/* Identity Pill */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-card-alt)',
            borderRadius: 12,
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 14
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span className="identity-dot" style={{ width: 8, height: 8, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'clamp(0.95rem, 3.5vw, 1.1rem)', letterSpacing: '0.04em', color: 'var(--text-main)', wordBreak: 'break-all' }}>
              {targetIdentity.username}
            </span>
          </div>
          <span className="mono-subtle" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
            CRYPTOGRAPHIC CODE
          </span>
        </div>

        {/* AI Chat & Community Warning Box */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 16,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start'
          }}
        >
          <Sparkles size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.82rem', lineHeight: 1.5, color: '#EF4444' }}>
            <strong>Permanent AI Sanctuary & Community Warning:</strong> Removing this identity will permanently delete your confidential <strong>AI Well-being Guide conversation history</strong> and withdraw you from all joined communities. Once removed, this identity and its AI chat history cannot be recovered.
          </div>
        </div>

        <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-muted)', marginBottom: 18 }}>
          Identities on ANON persist on your device indefinitely even when you switch personas, unless you consciously choose to remove them.
        </p>

        {/* Content Choice Selection */}
        <div style={{ marginBottom: 22 }}>
          <span className="mono-subtle" style={{ display: 'block', marginBottom: 10, color: 'var(--text-main)', fontWeight: 600 }}>
            WHAT SHOULD HAPPEN TO YOUR QUESTIONS & MESSAGES?
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Option 1: Leave messages */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 12,
                cursor: 'pointer',
                border: !deleteMessages ? '2px solid var(--border-dark)' : '1px solid var(--border-light)',
                background: !deleteMessages ? 'var(--bg-subtle)' : 'var(--bg-card)',
                transition: 'all 0.15s ease'
              }}
            >
              <input
                type="radio"
                name="msgAction"
                checked={!deleteMessages}
                onChange={() => setDeleteMessages(false)}
                style={{ marginTop: 3, accentColor: 'var(--primary)' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  <HeartHandshake size={14} color="#16A34A" />
                  <span>Leave messages for others (Recommended)</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.45 }}>
                  Your questions, replies, and lived experience notes stay visible to help community peers who face the same hardships. Only the persona code is deleted.
                </div>
              </div>
            </label>

            {/* Option 2: Purge messages */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 12,
                cursor: 'pointer',
                border: deleteMessages ? '2px solid #DC2626' : '1px solid var(--border-light)',
                background: deleteMessages ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-card)',
                transition: 'all 0.15s ease'
              }}
            >
              <input
                type="radio"
                name="msgAction"
                checked={deleteMessages}
                onChange={() => setDeleteMessages(true)}
                style={{ marginTop: 3, accentColor: '#DC2626' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.9rem', color: '#DC2626' }}>
                  <Trash2 size={14} />
                  <span>Purge all my questions, replies & private messages</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.45 }}>
                  Permanently deletes all questions, comments, and private messages sent under <code style={{ fontFamily: 'var(--font-mono)' }}>{targetIdentity.username}</code> with zero trace.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Modal Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="crowd-pill-btn"
            onClick={onClose}
            disabled={isDeleting}
            style={{ padding: '8px 18px', fontSize: '0.85rem' }}
          >
            Cancel & Keep Identity
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            style={{
              padding: '8px 18px',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: 9999,
              cursor: 'pointer',
              background: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Trash2 size={14} />
            <span>{isDeleting ? 'Removing...' : 'Confirm Conscious Removal'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateClientCryptoCode } from '../services/api.js';
import { Shield, Sparkles, RefreshCw, X, Plus, KeyRound } from 'lucide-react';

export default function CreateIdentityModal({
  isOpen,
  onClose,
  onSubmitCreate,
  isCreating = false,
  reason = ''
}) {
  const [bio, setBio] = useState('');
  const [previewCode, setPreviewCode] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setPreviewCode(generateClientCryptoCode(7));
      setBio('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen && !isCreating) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCreating, onClose]);

  if (!isOpen) return null;

  function handleShuffle(e) {
    e.preventDefault();
    setPreviewCode(generateClientCryptoCode(7));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError(null);
      await onSubmitCreate(bio);
    } catch (err) {
      setError(err.message || 'Failed to create identity. Please try again.');
    }
  }

  const modalContent = (
    <div className="modal-backdrop" onClick={!isCreating ? onClose : undefined} role="presentation">
      <div
        className="modal-dialog modal-center-pop"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #141413',
          boxShadow: '0 24px 48px -12px rgba(20, 20, 19, 0.28)',
          position: 'relative',
          margin: 'auto'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-identity-title"
      >
        {/* Archival corner crosses */}
        <div className="corner-cross tl" aria-hidden="true" />
        <div className="corner-cross tr" aria-hidden="true" />
        <div className="corner-cross bl" aria-hidden="true" />
        <div className="corner-cross br" aria-hidden="true" />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <span
              className="mono-subtle"
              style={{
                display: 'block',
                fontSize: '0.68rem',
                letterSpacing: '0.08em',
                color: '#71717A',
                marginBottom: 4
              }}
            >
              SEC // 00 · IDENTITY ON DEMAND
            </span>
            <h2 id="create-identity-title" style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: '#141413' }}>
              Create Anonymous Identity
            </h2>
          </div>

          <button
            type="button"
            className="btn btn-subtle btn-sm"
            onClick={onClose}
            disabled={isCreating}
            aria-label="Close dialog"
            style={{ padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Context reason banner (e.g. why identity is needed) */}
        {reason && (
          <div
            className="alert-banner alert-info"
            style={{
              marginBottom: 16,
              background: '#F4F4F5',
              border: '1px solid #E4E4E7',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: '0.82rem',
              color: '#27272A',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Shield size={15} style={{ flexShrink: 0, color: '#141413' }} />
            <span>{reason}</span>
          </div>
        )}

        <p style={{ fontSize: '0.85rem', color: '#71717A', lineHeight: 1.5, marginBottom: 20 }}>
          ANON does not automatically assign identities to visitors. You hold full sovereignty: create a cryptographic persona when you are ready to speak, ask, or connect.
        </p>

        {/* Cryptographic pseudonym preview showcase */}
        <div
          style={{
            background: '#FAFAFA',
            border: '1px solid var(--border-light)',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 20
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="mono-subtle" style={{ fontSize: '0.68rem', color: '#71717A' }}>
              PREVIEW CRYPTOGRAPHIC CODE //
            </span>
            <button
              type="button"
              onClick={handleShuffle}
              disabled={isCreating}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.72rem',
                color: '#71717A',
                fontFamily: 'var(--font-mono)'
              }}
              title="Generate another sample code"
            >
              <RefreshCw size={11} />
              <span>Shuffle</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="identity-dot" style={{ width: 9, height: 9 }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(1rem, 3.8vw, 1.25rem)',
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: '#141413',
                wordBreak: 'break-all'
              }}
            >
              {previewCode}
            </span>
            <span
              className="crowd-tag-pill highlight"
              style={{ fontSize: '0.65rem', padding: '2px 8px', marginLeft: 'auto' }}
            >
              Zero Real-World Linkage
            </span>
          </div>
        </div>

        {error && (
          <div className="alert-banner alert-warning" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 22 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3F3F46' }}>
              Optional Personal Focus or Bio (Private & Anonymous)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. High school senior, dealing with stress and sleep..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={120}
              disabled={isCreating}
              style={{ borderRadius: 10, padding: '10px 12px', fontSize: '0.85rem' }}
            />
            <div className="form-hint" style={{ fontSize: '0.7rem', color: '#A1A1AA', marginTop: 4 }}>
              Optional. Leave blank to generate pure anonymous persona.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isCreating}
              style={{ borderRadius: 9999, padding: '8px 18px', fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-black-pill"
              disabled={isCreating}
              style={{ padding: '8px 20px', fontSize: '0.82rem' }}
            >
              <KeyRound size={14} />
              <span>{isCreating ? 'Creating Identity...' : 'Create Identity'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

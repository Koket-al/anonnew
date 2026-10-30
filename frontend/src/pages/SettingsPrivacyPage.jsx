import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import DeleteIdentityModal from '../components/DeleteIdentityModal.jsx';
import {
  Shield,
  RotateCw,
  LogOut,
  Lock,
  EyeOff,
  CheckCircle,
  XCircle,
  HelpCircle,
  Server,
  ArrowRight,
  Plus,
  Trash2,
  Check,
  Sparkles,
  KeyRound,
  Layers,
  MessageSquare,
  Bell,
  BellOff
} from 'lucide-react';

export default function SettingsPrivacyPage() {
  const {
    identity,
    identities,
    maxIdentities,
    canCreateMore,
    isAuthenticated,
    createIdentity,
    openCreateModal,
    switchIdentity,
    removeIdentity,
    leave
  } = useAuth();
  const { showToast, isMuted, toggleMute } = useRealtime();

  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false, targetIdentity: null });

  function handleCreateIdentity() {
    if (!canCreateMore) {
      showToast({
        type: 'warning',
        title: 'Identity Limit Reached',
        message: 'You have reached the maximum of 5 identities. Please remove an existing persona first to create a new one.'
      });
      return;
    }
    openCreateModal({
      reason: identities.length === 0
        ? 'Create your first anonymous cryptographic persona.'
        : 'Generate an additional cryptographic persona (up to 5 max).'
    });
  }

  async function handleSwitch(targetId) {
    try {
      await switchIdentity(targetId);
      navigate('/home', { replace: true });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to switch identity.' });
    }
  }

  async function handleConfirmDelete(identityId, options) {
    try {
      setIsDeleting(true);
      await removeIdentity(identityId, options);
    } catch (err) {
      console.error('Failed to remove identity:', err);
    } finally {
      setIsDeleting(false);
      setDeleteModalState({ isOpen: false, targetIdentity: null });
    }
  }

  function handleRemoveActiveIdentity() {
    if (identity) {
      setDeleteModalState({ isOpen: true, targetIdentity: identity });
    }
  }

  // Create array of 5 slots for visual display
  const identitySlots = [];
  for (let i = 0; i < maxIdentities; i++) {
    identitySlots.push(identities[i] || null);
  }

  return (
    <div className="home-page-container crowd-page-container">
      {/* Conscious Removal Confirmation Modal */}
      <DeleteIdentityModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, targetIdentity: null })}
        targetIdentity={deleteModalState.targetIdentity}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Continuous 1px Vertical Architectural Grid Guide Lines */}
      <div className="page-vertical-line left" aria-hidden="true" />
      <div className="page-vertical-line right" aria-hidden="true" />

      {/* ====================================================================
          1. Editorial Hero Frame
          ==================================================================== */}
      <section className="editorial-faq-frame crowd-hero-frame" aria-label="Settings and Privacy">
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="crowd-hero-content">
          <div className="editorial-faq-header" style={{ marginBottom: 20 }}>
            <div className="hero-brand-crest-wrap">
              <img src="/anonlogo_dark.png" alt="ANON" className="hero-page-logo" />
            </div>
            <span className="manifesto-pill">Cryptographic Personas // Multi-Identity Hub</span>
            <h1 className="editorial-faq-title" style={{ fontSize: 'clamp(2.1rem, 4vw, 3rem)' }}>
              Settings & Privacy
            </h1>
            <p className="secure-comm-expressive" style={{ margin: '8px auto 14px auto', fontSize: '1.2rem' }}>
              “Total sovereignty over your identities and words. Switch, preserve, or purge anytime.”
            </p>
            <p className="editorial-faq-desc" style={{ maxWidth: 680 }}>
              Hold up to 5 concurrent cryptographic personas (e.g., <code style={{ fontFamily: 'var(--font-mono)' }}>Ab1z4Qt</code>). Your identities persist indefinitely until consciously removed. Choose to preserve or purge your contributions, or delete individual messages anytime.
            </p>
          </div>

          <div className="crowd-hero-badges-row">
            <div className="crowd-assurance-item">
              <KeyRound size={14} className="crowd-assurance-icon" />
              <span>Crypto Entropy (e.g. Ab1z4Qt)</span>
            </div>
            <div className="crowd-assurance-item">
              <Layers size={14} className="crowd-assurance-icon" />
              <span>Up to 5 Persistent Personas</span>
            </div>
            <div className="crowd-assurance-item">
              <Shield size={14} className="crowd-assurance-icon" />
              <span>Conscious Erasure Control</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. Multi-Identity Control Hub (Up to 5 identities)
          ==================================================================== */}
      <section className="crowd-card" style={{ padding: '32px 36px' }}>
        <div className="corner-cross tl" aria-hidden="true" />
        <div className="corner-cross tr" aria-hidden="true" />
        <div className="corner-cross bl" aria-hidden="true" />
        <div className="corner-cross br" aria-hidden="true" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div>
            <span className="mono-subtle" style={{ display: 'block', marginBottom: 4, color: 'var(--text-muted)' }}>
              CRYPTOGRAPHIC IDENTITY SLOTS //
            </span>
            <h2 className="crowd-card-title" style={{ fontSize: '1.5rem', margin: 0 }}>
              Your Anonymous Personas ({identities.length} of {maxIdentities} Active)
            </h2>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-black-pill"
              onClick={handleCreateIdentity}
              disabled={!canCreateMore}
              title={canCreateMore ? 'Generate a new cryptographic identity' : 'Limit of 5 identities reached'}
            >
              <Plus size={14} />
              <span>{canCreateMore ? 'Create New Identity' : 'Slot Limit Reached (5/5)'}</span>
            </button>

            {isAuthenticated && (
              <button
                type="button"
                className="crowd-pill-btn identity-slot-btn-remove"
                onClick={handleRemoveActiveIdentity}
                title="Consciously remove your active persona while preserving your other identities"
              >
                <Trash2 size={14} />
                <span>Remove Active Identity</span>
              </button>
            )}
          </div>
        </div>

        <p className="crowd-card-body" style={{ WebkitLineClamp: 'none', marginBottom: 24, maxWidth: 760 }}>
          Each user is eligible to create and use up to <strong>5 independent cryptographic personas</strong>. Your identities are generated by a secure crypto random function (such as <code style={{ fontFamily: 'var(--font-mono)' }}>Ab1z4Qt</code>). Personas persist on this device even when switching, unless you <strong>consciously remove</strong> them.
        </p>

        {/* 5-Slot Identity Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
          {identitySlots.map((slot, index) => {
            if (!slot) {
              return (
                <div
                  key={`empty-${index}`}
                  className="identity-slot-card empty"
                >
                  <span className="mono-subtle identity-slot-label" style={{ fontSize: '0.72rem', marginBottom: 6 }}>
                    SLOT 0{index + 1} • AVAILABLE
                  </span>
                  <div className="identity-slot-empty-text" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
                    Unused identity slot
                  </div>
                  <button
                    type="button"
                    className="crowd-pill-btn"
                    onClick={handleCreateIdentity}
                    style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                  >
                    <Plus size={12} />
                    <span>Generate Persona</span>
                  </button>
                </div>
              );
            }

            const isCurrent = slot.isCurrent || (identity && (slot.id === identity.id || slot.username === identity.username));

            return (
              <div
                key={slot.id}
                className={`identity-slot-card ${isCurrent ? 'current' : ''}`}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span className="mono-subtle identity-slot-label" style={{ fontSize: '0.68rem', fontWeight: 600 }}>
                      SLOT 0{index + 1} //
                    </span>
                    {isCurrent ? (
                      <span className="crowd-tag-pill highlight" style={{ fontSize: '0.65rem', padding: '1px 8px' }}>
                        Active Persona
                      </span>
                    ) : (
                      <span className="mono-subtle identity-slot-stored-label" style={{ fontSize: '0.65rem' }}>
                        Stored Persona
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="identity-dot" style={{ width: 8, height: 8 }} />
                    <span className="identity-slot-username">
                      {slot.username}
                    </span>
                  </div>

                  <div className="mono-subtle identity-slot-date">
                    CREATED: {new Date(slot.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                  {isCurrent ? (
                    <span className="identity-slot-active-indicator" style={{ fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={14} /> Currently in Use
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn-black-pill"
                      style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                      onClick={() => handleSwitch(slot.id)}
                    >
                      <span>Switch to this Persona</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setDeleteModalState({ isOpen: true, targetIdentity: slot })}
                    className="crowd-pill-btn identity-slot-btn-remove"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem'
                    }}
                    title="Consciously remove this identity"
                  >
                    <Trash2 size={12} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ====================================================================
          2.5 Real-Time Notification & Alert Preferences
          ==================================================================== */}
      <section className="crowd-card" style={{ padding: '26px 32px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span className="mono-subtle" style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', marginBottom: 4 }}>
              NOTIFICATIONS & ALERT PREFERENCES //
            </span>
            <h3 className="crowd-card-title" style={{ fontSize: '1.25rem', margin: 0 }}>
              Real-Time Community & Discussion Notifications
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              Control whether incoming question alerts, replies, and connection requests trigger in-app banners.
            </p>
          </div>

          <button
            type="button"
            className={`crowd-pill-btn settings-mute-btn ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            style={{
              padding: '8px 18px',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {isMuted ? <BellOff size={15} /> : <Bell size={15} />}
            <span>{isMuted ? 'Notifications Muted (Click to Unmute)' : 'Notifications Active (Click to Mute)'}</span>
          </button>
        </div>
      </section>

      {/* ====================================================================
          3. Educational Manifesto / Principles
          ==================================================================== */}
      <section className="crowd-card" style={{ padding: '32px 36px' }}>
        <span className="mono-subtle" style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)' }}>
          PLATFORM ARCHITECTURE //
        </span>
        <h2 className="crowd-card-title" style={{ fontSize: '1.5rem', marginBottom: 14 }}>
          How Identity & Content Sovereignty Work on ANON
        </h2>
        <p className="crowd-card-body" style={{ WebkitLineClamp: 'none', marginBottom: 24 }}>
          ANON is designed around cryptographic integrity and zero personal exposure. Here is an exact breakdown of our identity mechanics:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {/* Card 1: Cryptographic Pseudonyms */}
          <div className="settings-info-card">
            <div className="settings-info-card-title" style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
              <KeyRound size={16} />
              <span>1. Cryptographic String Format</span>
            </div>
            <p className="settings-info-card-desc" style={{ fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
              Identities never look like dictionary usernames or personal names. Every pseudonym is a high-entropy string generated by a secure crypto random function (such as <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Ab1z4Qt</code>).
            </p>
          </div>

          {/* Card 2: 5 Persistent Identities */}
          <div className="settings-info-card">
            <div className="settings-info-card-title" style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
              <Layers size={16} />
              <span>2. Up to 5 Concurrent Identities</span>
            </div>
            <p className="settings-info-card-desc" style={{ fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
              Each visitor is eligible to create and maintain up to 5 concurrent identities. You can dedicate one identity to academic stress, one to relationships, and another to peer listening. Switching never removes previous personas.
            </p>
          </div>

          {/* Card 3: Conscious Removal & Content Choice */}
          <div className="settings-info-card">
            <div className="settings-info-card-title" style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
              <Shield size={16} />
              <span>3. Conscious Removal & Message Options</span>
            </div>
            <p className="settings-info-card-desc" style={{ fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
              Identities stay permanently unless you consciously remove them. When removing an identity, you are asked whether to <strong>leave your messages for others</strong> to help peers or <strong>purge all your messages</strong> completely.
            </p>
          </div>

          {/* Card 4: Standalone Message Deletion */}
          <div className="settings-info-card">
            <div className="settings-info-card-title" style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
              <MessageSquare size={16} />
              <span>4. Standalone Message Deletion</span>
            </div>
            <p className="settings-info-card-desc" style={{ fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
              You have complete sovereignty over your contributions. You can delete any individual question, reply, or private message at any time without needing to delete your identity.
            </p>
          </div>
        </div>
      </section>

      {/* ====================================================================
          4. Verifiable Engineering Boundary
          ==================================================================== */}
      <section className="crowd-card" style={{ padding: '32px 36px' }}>
        <span className="mono-subtle" style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)' }}>
          PRIVACY BOUNDARY //
        </span>
        <h2 className="crowd-card-title" style={{ fontSize: '1.5rem', marginBottom: 12 }}>
          What We Never Collect vs. What We Store
        </h2>
        <p className="crowd-card-body" style={{ WebkitLineClamp: 'none', marginBottom: 24 }}>
          ANON guarantees absolute non-linkage between real-world credentials and your pseudonyms:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          <div className="settings-boundary-card never">
            <div className="settings-boundary-never-title" style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
              <CheckCircle size={16} />
              <span>What We NEVER Collect</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', lineHeight: 1.5 }}>
              <li>&bull; Real names, emails, or phone numbers</li>
              <li>&bull; GPS coordinates, Wi-Fi location, or device telemetry</li>
              <li>&bull; IP address logs or tracking cookies</li>
              <li>&bull; Third-party tracking or behavioral advertising pixels</li>
            </ul>
          </div>

          <div className="settings-boundary-card store">
            <div className="settings-boundary-store-title" style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
              <Server size={16} />
              <span>What We Store in Encrypted DB</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', lineHeight: 1.5 }}>
              <li>&bull; SHA-256 hashed ephemeral session token</li>
              <li>&bull; Cryptographic identity codes (e.g. <code style={{ fontFamily: 'var(--font-mono)' }}>Ab1z4Qt</code>)</li>
              <li>&bull; Discussion questions and replies (editable & deletable)</li>
              <li>&bull; Private 1-on-1 messages (deletable anytime by author)</li>
              <li>&bull; Community membership references</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance">
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A' }}>
          ANON PRIVACY SHIELD • 5 CRYPTOGRAPHIC PERSONAS • FULL MESSAGE SOVEREIGNTY
        </p>
      </section>
    </div>
  );
}

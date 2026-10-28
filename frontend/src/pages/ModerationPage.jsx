import React, { useState, useEffect } from 'react';
import { useRealtime } from '../context/RealtimeContext.jsx';
import {
  getModerationReports,
  resolveModerationReport,
  removeModerationContent,
  suspendModerationIdentity,
  getPendingProfessionalsModeration,
  reviewProfessionalVerificationModeration
} from '../services/api.js';
import {
  ShieldAlert,
  Lock,
  CheckCircle,
  XCircle,
  Trash2,
  UserX,
  FileText,
  AlertTriangle,
  UserCheck,
  Shield,
  ArrowRight
} from 'lucide-react';

export default function ModerationPage() {
  const { showToast, showConfirm } = useRealtime();
  // No shared passphrase — authentication uses the anonymous session cookie.
  // Backend verifies isModerator flag server-side.
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState('reports'); // 'reports' or 'professionals'

  const [reports, setReports] = useState([]);
  const [pendingPros, setPendingPros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadModerationData();
  }, [activeTab]);

  async function loadModerationData() {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'reports') {
        const res = await getModerationReports({ status: 'pending' });
        if (res.reports) {
          setReports(res.reports);
          setIsUnlocked(true);
        }
      } else if (activeTab === 'professionals') {
        const res = await getPendingProfessionalsModeration();
        if (res.professionals) {
          setPendingPros(res.professionals);
          setIsUnlocked(true);
        }
      }
    } catch (err) {
      setError(err.message || 'Access denied. Your identity does not have moderator permissions.');
      setIsUnlocked(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleDismiss(reportId) {
    try {
      await resolveModerationReport(reportId, { action: 'dismiss', resolutionNotes: 'Reviewed and dismissed by moderator.' });
      setReports(reports.filter(r => r.id !== reportId));
      showToast('Report dismissed.', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to dismiss report.', 'error');
    }
  }

  async function handleRemoveContent(report) {
    const confirmed = await showConfirm(
      `Permanently remove this reported ${report.targetType}?`,
      { title: 'Remove Reported Content', confirmText: 'Remove Content', danger: true }
    );
    if (!confirmed) return;
    try {
      await removeModerationContent({
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason
      });
      await resolveModerationReport(report.id, {
        action: 'take_action',
        resolutionNotes: 'Content removed for community safety violations.'
      });
      setReports(reports.filter(r => r.id !== report.id));
      showToast('Content removed successfully.', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to remove content.', 'error');
    }
  }

  async function handleVerifyPro(proId, decision) {
    const confirmed = await showConfirm(
      `Are you sure you want to ${decision} this clinician?`,
      { title: `${decision === 'approve' ? 'Approve' : 'Reject'} Clinician`, confirmText: decision === 'approve' ? 'Approve' : 'Reject', danger: decision === 'reject' }
    );
    if (!confirmed) return;

    try {
      await reviewProfessionalVerificationModeration(proId, {
        decision,
        notes: `Official license credential reviewed - ${decision}ed by moderator.`
      });
      setPendingPros(pendingPros.filter(p => p.id !== proId));
      showToast(`Clinician has been ${decision}ed.`, 'info');
    } catch (err) {
      showToast(err.message || 'Verification update failed.', 'error');
    }
  }


  return (
    <div className="home-page-container crowd-page-container">
      {/* Continuous 1px Vertical Architectural Grid Guide Lines */}
      <div className="page-vertical-line left" aria-hidden="true" />
      <div className="page-vertical-line right" aria-hidden="true" />

      {/* ====================================================================
          1. Editorial Hero Frame
          ==================================================================== */}
      <section className="editorial-faq-frame crowd-hero-frame" aria-label="Moderation Center">
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="crowd-hero-content">
          <div className="editorial-faq-header" style={{ marginBottom: 20 }}>
            <div className="hero-brand-crest-wrap">
              <img src="/anonlogo_dark.png" alt="ANON" className="hero-page-logo" />
            </div>
            <span className="manifesto-pill">Sanctuary Defense // Content Safety</span>
            <h1 className="editorial-faq-title" style={{ fontSize: 'clamp(2.1rem, 4vw, 3rem)' }}>
              Moderation & Safety Center
            </h1>
            <p className="secure-comm-expressive" style={{ margin: '8px auto 14px auto', fontSize: '1.2rem' }}>
              “Protecting the sanctuary without compromising privacy.”
            </p>
            <p className="editorial-faq-desc" style={{ maxWidth: 640 }}>
              Administrative console for reviewing flagged questions, safety violations, and clinician credential verifications.
            </p>
          </div>

          {isUnlocked && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <button
                type="button"
                className="crowd-pill-btn"
                onClick={() => {
                  setIsUnlocked(false);
                }}
              >
                <Lock size={13} />
                <span>Lock Console</span>
              </button>
            </div>
          )}

          <div className="crowd-hero-badges-row">
            <div className="crowd-assurance-item">
              <ShieldAlert size={14} className="crowd-assurance-icon" />
              <span>Flagged Content Review</span>
            </div>
            <div className="crowd-assurance-item">
              <UserCheck size={14} className="crowd-assurance-icon" />
              <span>Clinician Verification</span>
            </div>
            <div className="crowd-assurance-item">
              <Shield size={14} className="crowd-assurance-icon" />
              <span>Community Protection</span>
            </div>
          </div>
        </div>
      </section>

      {!isUnlocked ? (
        /* Access denied / loading screen — no passphrase form */
        <div style={{ maxWidth: 460, margin: '20px auto' }}>
          <div className="crowd-card" style={{ padding: '32px 36px', textAlign: 'center' }}>
            <Lock size={32} style={{ opacity: 0.35, marginBottom: 12 }} />
            <h2 className="crowd-card-title" style={{ fontSize: '1.4rem', marginBottom: 6 }}>
              Authorized Moderators Only
            </h2>
            <p className="crowd-card-body" style={{ WebkitLineClamp: 'none', marginBottom: 20, fontSize: '0.85rem' }}>
              This console is accessible to identities with moderator privileges assigned by the platform administrator.
            </p>

            {error && (
              <div className="alert-banner alert-warning" style={{ marginBottom: 16, borderRadius: 12 }}>
                {error}
              </div>
            )}

            {loading && (
              <div style={{ color: '#71717A', fontSize: '0.9rem' }}>Verifying access...</div>
            )}
          </div>
        </div>
      ) : (
        /* Moderator Console */
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`crowd-cat-pill ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              Pending Content Reports ({reports.length})
            </button>
            <button
              type="button"
              className={`crowd-cat-pill ${activeTab === 'professionals' ? 'active' : ''}`}
              onClick={() => setActiveTab('professionals')}
            >
              Pending Clinician Verifications ({pendingPros.length})
            </button>
          </div>

          {activeTab === 'reports' ? (
            /* Reports Queue */
            <main className="crowd-posts-stream">
              {loading ? (
                <div className="editorial-faq-frame crowd-empty-frame" style={{ padding: '60px 24px', textAlign: 'center' }}>
                  <span className="mono-subtle" style={{ display: 'block', marginBottom: 12 }}>LOADING REPORTS...</span>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>
                    Retrieving reported items...
                  </h3>
                </div>
              ) : reports.length === 0 ? (
                <div className="editorial-faq-frame crowd-empty-frame">
                  <div className="crowd-empty-inner">
                    <CheckCircle size={32} style={{ color: '#065F46', marginBottom: 8 }} />
                    <h3 className="crowd-empty-title">All clear!</h3>
                    <p className="crowd-empty-desc">
                      No pending safety reports in the queue. The sanctuary is calm.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="crowd-posts-grid">
                  {reports.map((report) => (
                    <article key={report.id} className="crowd-card" style={{ borderLeft: '4px solid #DC2626' }}>
                      <div className="crowd-card-header">
                        <div>
                          <span className="crowd-tag-pill" style={{ color: '#DC2626', background: '#FEE2E2', marginBottom: 6 }}>
                            REASON: {report.reason.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <h3 className="crowd-card-title" style={{ fontSize: '1.25rem' }}>
                            Reported {report.targetType} (ID: <code>{report.targetId}</code>)
                          </h3>
                          <div className="mono-subtle" style={{ color: '#71717A' }}>
                            SUBMITTED BY // <strong>{report.reporterUsername}</strong> &bull; {new Date(report.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {report.explanation && (
                        <div style={{ fontSize: '0.875rem', background: '#F4F4F5', padding: 14, borderRadius: 12, marginBottom: 14 }}>
                          <span className="mono-subtle" style={{ display: 'block', marginBottom: 4 }}>REPORTER EXPLANATION //</span>
                          "{report.explanation}"
                        </div>
                      )}

                      {report.targetSummary && (
                        <div style={{ fontSize: '0.875rem', border: '1px solid var(--border-light)', padding: 14, borderRadius: 12, marginBottom: 16 }}>
                          <span className="mono-subtle" style={{ display: 'block', marginBottom: 4 }}>CONTENT PREVIEW //</span>
                          {report.targetSummary.title && <div style={{ fontWeight: 600, marginBottom: 4 }}>{report.targetSummary.title}</div>}
                          <div>{report.targetSummary.content || report.targetSummary.username}</div>
                          {report.targetSummary.author && (
                            <div className="mono-subtle" style={{ marginTop: 6, color: '#71717A' }}>Author: {report.targetSummary.author}</div>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 10, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14 }}>
                        <button
                          type="button"
                          className="crowd-pill-btn"
                          onClick={() => handleDismiss(report.id)}
                        >
                          <CheckCircle size={13} />
                          <span>Dismiss as Non-violation</span>
                        </button>
                        <button
                          type="button"
                          className="crowd-pill-btn"
                          style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                          onClick={() => handleRemoveContent(report)}
                        >
                          <Trash2 size={13} />
                          <span>Remove Content</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </main>
          ) : (
            /* Pending Professional Verifications */
            <main className="crowd-posts-stream">
              {loading ? (
                <div className="editorial-faq-frame crowd-empty-frame" style={{ padding: '60px 24px', textAlign: 'center' }}>
                  <span className="mono-subtle" style={{ display: 'block', marginBottom: 12 }}>LOADING CLINICIANS...</span>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>
                    Retrieving registration queue...
                  </h3>
                </div>
              ) : pendingPros.length === 0 ? (
                <div className="editorial-faq-frame crowd-empty-frame">
                  <div className="crowd-empty-inner">
                    <CheckCircle size={32} style={{ color: '#065F46', marginBottom: 8 }} />
                    <h3 className="crowd-empty-title">No pending reviews.</h3>
                    <p className="crowd-empty-desc">
                      All registered clinician credentials have been evaluated.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="crowd-posts-grid">
                  {pendingPros.map((pro) => (
                    <article key={pro.id} className="crowd-card">
                      <div className="crowd-card-header">
                        <div>
                          <span className="crowd-tag-pill" style={{ background: '#FFFBEB', color: '#B45309', marginBottom: 6 }}>
                            Awaiting Credential Review
                          </span>
                          <h3 className="crowd-card-title" style={{ fontSize: '1.35rem' }}>{pro.displayName}</h3>
                          <div className="mono-subtle" style={{ color: '#71717A' }}>
                            LEGAL NAME // <strong>{pro.fullName}</strong> &bull; {pro.email}
                          </div>
                        </div>
                        <span className="crowd-card-time">Registered {new Date(pro.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div style={{ background: '#F4F4F5', padding: 18, borderRadius: 12, marginBottom: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: '0.85rem' }}>
                          <div>
                            <span className="mono-subtle" style={{ display: 'block' }}>LICENSE TYPE</span>
                            <div style={{ fontWeight: 600 }}>{pro.licenseType}</div>
                          </div>
                          <div>
                            <span className="mono-subtle" style={{ display: 'block' }}>LICENSE NUMBER</span>
                            <div style={{ fontWeight: 600 }}>{pro.licenseNumber}</div>
                          </div>
                          <div>
                            <span className="mono-subtle" style={{ display: 'block' }}>JURISDICTION</span>
                            <div style={{ fontWeight: 600 }}>{pro.licenseJurisdiction}</div>
                          </div>
                          <div>
                            <span className="mono-subtle" style={{ display: 'block' }}>SPECIALTIES</span>
                            <div style={{ fontWeight: 600 }}>{pro.specialties?.join(', ') || 'General'}</div>
                          </div>
                        </div>
                        {pro.bio && (
                          <div style={{ marginTop: 12, fontSize: '0.875rem' }}>
                            <span className="mono-subtle" style={{ display: 'block', marginBottom: 2 }}>BIOGRAPHY</span>
                            {pro.bio}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          type="button"
                          className="btn-black-pill"
                          onClick={() => handleVerifyPro(pro.id, 'verify')}
                        >
                          <UserCheck size={14} />
                          <span>Approve & Verify Credentials</span>
                        </button>
                        <button
                          type="button"
                          className="crowd-pill-btn"
                          style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                          onClick={() => handleVerifyPro(pro.id, 'reject')}
                        >
                          <XCircle size={14} />
                          <span>Reject Credentials</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </main>
          )}
        </div>
      )}

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance">
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A' }}>
          ANON MODERATION CONSOLE • TRUST & SAFETY • CRYPTOGRAPHIC ISOLATION
        </p>
      </section>
    </div>
  );
}

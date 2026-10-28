import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getVerifiedProfessionals,
  submitConsultationRequest,
  getMyConsultations
} from '../services/api.js';
import {
  ShieldCheck,
  Send,
  MessageSquare,
  Clock,
  CheckCircle,
  FileText,
  User,
  X,
  Shield,
  Lock,
  ArrowRight
} from 'lucide-react';

export default function ProfessionalsPage() {
  const { isAuthenticated, openCreateModal } = useAuth();
  const [professionals, setProfessionals] = useState([]);
  const [myConsultations, setMyConsultations] = useState([]);
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' or 'my_consultations'
  const [specialty, setSpecialty] = useState('All');
  const [loading, setLoading] = useState(true);

  // Consultation modal state
  const [selectedPro, setSelectedPro] = useState(null);
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [urgency, setUrgency] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    loadProfessionals();
    if (isAuthenticated) {
      loadMyConsultations();
    }
  }, [specialty, isAuthenticated]);

  async function loadProfessionals() {
    try {
      setLoading(true);
      const res = await getVerifiedProfessionals({
        specialty: specialty !== 'All' ? specialty : undefined
      });
      if (res.professionals) setProfessionals(res.professionals);
    } catch (err) {
      console.error('Failed to load professionals:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyConsultations() {
    try {
      const res = await getMyConsultations();
      if (res.consultations) setMyConsultations(res.consultations);
    } catch (err) {
      console.error('Failed to load my consultations:', err);
    }
  }

  function handleOpenConsultation(pro) {
    if (!isAuthenticated) {
      openCreateModal({
        reason: 'Please create an anonymous identity before requesting a confidential consultation.',
        onSuccess: () => setSelectedPro(pro)
      });
    } else {
      setSelectedPro(pro);
    }
  }

  async function handleConsultationSubmit(e) {
    e.preventDefault();
    if (!isAuthenticated) {
      openCreateModal({
        reason: 'Please create an anonymous identity before requesting a confidential consultation.'
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const res = await submitConsultationRequest({
        professionalId: selectedPro.id,
        topic,
        message,
        urgency
      });

      if (res.success) {
        setSuccessMsg(res.message);
        setTopic('');
        setMessage('');
        loadMyConsultations();
        setTimeout(() => {
          setSuccessMsg(null);
          setSelectedPro(null);
        }, 2500);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit consultation request.');
    } finally {
      setIsSubmitting(false);
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
      <section className="editorial-faq-frame crowd-hero-frame" aria-label="Doctors & Counselors">
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="crowd-hero-content">
          <div className="editorial-faq-header" style={{ marginBottom: 20 }}>
            <div className="hero-brand-crest-wrap">
              <img src="/anonlogo_dark.png" alt="ANON" className="hero-page-logo" />
            </div>
            <span className="manifesto-pill">Clinical Verification // Licensed Care</span>
            <h1 className="editorial-faq-title" style={{ fontSize: 'clamp(2.2rem, 4.2vw, 3.1rem)' }}>
              Doctors & Counselors
            </h1>
            <p className="secure-comm-expressive" style={{ margin: '8px auto 14px auto', fontSize: '1.2rem' }}>
              “Real medical guidance from verified clinicians who protect your anonymity.”
            </p>
            <p className="editorial-faq-desc" style={{ maxWidth: 640 }}>
              State-licensed psychologists, therapists, and adolescent health specialists whose professional credentials have been manually verified by our team.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <Link to="/portal/pro" className="crowd-pill-btn" style={{ textDecoration: 'none' }}>
              <ShieldCheck size={14} />
              <span>Are you a clinician? Access Professional Portal</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="crowd-hero-badges-row">
            <div className="crowd-assurance-item">
              <ShieldCheck size={14} className="crowd-assurance-icon" />
              <span>Manually Verified Licenses</span>
            </div>
            <div className="crowd-assurance-item">
              <Lock size={14} className="crowd-assurance-icon" />
              <span>100% Cryptographic Anonymity</span>
            </div>
            <div className="crowd-assurance-item">
              <MessageSquare size={14} className="crowd-assurance-icon" />
              <span>Confidential Consultations</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. Directory Navigation Tabs
          ==================================================================== */}
      <section className="crowd-controls-section" aria-label="Directory Tabs">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`crowd-cat-pill ${activeTab === 'directory' ? 'active' : ''}`}
            onClick={() => setActiveTab('directory')}
          >
            Clinician Directory ({professionals.length})
          </button>
          {isAuthenticated && (
            <button
              type="button"
              className={`crowd-cat-pill ${activeTab === 'my_consultations' ? 'active' : ''}`}
              onClick={() => setActiveTab('my_consultations')}
            >
              My Inquiries & Replies ({myConsultations.length})
            </button>
          )}
        </div>
      </section>

      {/* ====================================================================
          3. Clinicians Directory
          ==================================================================== */}
      {activeTab === 'directory' ? (
        <main className="crowd-posts-stream" aria-label="Clinician Directory">
          {loading ? (
            <div className="editorial-faq-frame crowd-empty-frame" style={{ padding: '60px 24px', textAlign: 'center' }}>
              <span className="mono-subtle" style={{ display: 'block', marginBottom: 12 }}>VERIFYING CREDENTIALS...</span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>
                Retrieving verified clinicians...
              </h3>
            </div>
          ) : professionals.length === 0 ? (
            <div className="editorial-faq-frame crowd-empty-frame">
              <div className="crowd-empty-inner">
                <span className="manifesto-pill">Clinician Roster</span>
                <h3 className="crowd-empty-title">No clinicians found.</h3>
                <p className="crowd-empty-desc">
                  There are no verified clinicians matching this category right now.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20 }}>
              {professionals.map((pro) => (
                <article key={pro.id} className="crowd-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div className="corner-cross tl" aria-hidden="true" />
                  <div className="corner-cross tr" aria-hidden="true" />
                  <div className="corner-cross bl" aria-hidden="true" />
                  <div className="corner-cross br" aria-hidden="true" />

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span className="crowd-tag-pill highlight">
                        <ShieldCheck size={12} />
                        <span>Verified License</span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                      {pro.imageUrl ? (
                        <img
                          src={pro.imageUrl}
                          alt={pro.displayName}
                          style={{
                            width: 58,
                            height: 58,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #E4E4E7',
                            backgroundColor: '#FAFAF9',
                            flexShrink: 0
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 58,
                            height: 58,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(20, 20, 19, 0.05)',
                            border: '1px solid rgba(20, 20, 19, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            color: '#141413',
                            flexShrink: 0
                          }}
                        >
                          {pro.displayName ? pro.displayName.charAt(0).toUpperCase() : 'Dr'}
                        </div>
                      )}
                      <div>
                        <h3 className="crowd-card-title" style={{ fontSize: '1.25rem', marginBottom: 2 }}>
                          {pro.displayName}
                        </h3>
                        <div className="mono-subtle" style={{ color: '#71717A', fontSize: '0.78rem' }}>
                          {pro.licenseType}
                        </div>
                      </div>
                    </div>

                    <p className="crowd-card-body" style={{ WebkitLineClamp: 4 }}>
                      {pro.bio || 'Adolescent and youth health practitioner dedicated to safe, compassionate care.'}
                    </p>

                    <div style={{ marginBottom: 16 }}>
                      <span className="mono-subtle" style={{ display: 'block', marginBottom: 6 }}>SPECIALTIES //</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(pro.specialties || []).map((s, idx) => (
                          <span key={idx} className="crowd-tag-pill">{s}</span>
                        ))}
                      </div>
                    </div>

                    {pro.languages && pro.languages.length > 0 && (
                      <div className="mono-subtle" style={{ marginBottom: 16, color: '#71717A' }}>
                        LANGUAGES // <strong style={{ color: '#141413' }}>{pro.languages.join(', ')}</strong>
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
                    <button
                      type="button"
                      className="btn-black-pill"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => handleOpenConsultation(pro)}
                    >
                      <MessageSquare size={14} />
                      <span>Request Anonymous Consultation</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      ) : (
        /* My Consultations Tab */
        <main className="crowd-posts-stream" aria-label="My Consultations">
          {myConsultations.length === 0 ? (
            <div className="editorial-faq-frame crowd-empty-frame">
              <div className="crowd-empty-inner">
                <span className="manifesto-pill">Consultation Archive</span>
                <h3 className="crowd-empty-title">No consultation inquiries yet.</h3>
                <p className="crowd-empty-desc">
                  You haven't submitted any questions to verified professionals. When you do, their replies will appear here.
                </p>
                <button type="button" className="btn-black-pill" onClick={() => setActiveTab('directory')}>
                  Browse Clinicians
                </button>
              </div>
            </div>
          ) : (
            <div className="crowd-posts-grid">
              {myConsultations.map((c) => (
                <article key={c.id} className="crowd-card">
                  <div className="crowd-card-header">
                    <div>
                      <span className={`crowd-tag-pill ${c.status === 'responded' ? 'highlight' : ''}`} style={{ marginBottom: 6 }}>
                        STATUS: {c.status === 'responded' ? 'Responded by Clinician' : 'In Review'}
                      </span>
                      <h3 className="crowd-card-title" style={{ fontSize: '1.25rem' }}>{c.topic}</h3>
                      <div className="mono-subtle" style={{ color: '#71717A' }}>
                        INQUIRY TO // <strong>{c.professional?.displayName || 'Verified Clinician'}</strong>
                      </div>
                    </div>
                    <span className="crowd-card-time">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ background: '#F4F4F5', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: '0.925rem', lineHeight: 1.6 }}>
                    <span className="mono-subtle" style={{ display: 'block', marginBottom: 4 }}>YOUR INQUIRY //</span>
                    {c.message}
                  </div>

                  {c.response ? (
                    <div style={{ padding: 18, background: '#FFFFFF', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#065F46', marginBottom: 8, fontSize: '0.85rem' }}>
                        <CheckCircle size={15} />
                        <span>Clinician Response</span>
                      </div>
                      <div style={{ fontSize: '0.95rem', lineHeight: 1.65, whiteSpace: 'pre-line', color: '#141413' }}>
                        {c.response}
                      </div>
                      {c.respondedAt && (
                        <div className="mono-subtle" style={{ marginTop: 10, color: '#71717A' }}>
                          RESPONDED ON {new Date(c.respondedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mono-subtle" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#71717A' }}>
                      <Clock size={12} />
                      <span>Awaiting clinician response. You will see their reply right here when ready.</span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </main>
      )}

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance">
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A' }}>
          ANON CLINICAL NETWORK • VERIFIED CREDENTIALS • CONFIDENTIAL CONSULTATION
        </p>
      </section>

      {/* Consultation Request Modal */}
      {selectedPro && (
        <div className="modal-backdrop" onClick={() => setSelectedPro(null)}>
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 600, borderRadius: 20, border: '1px solid var(--border-light)', padding: 32 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <span className="mono-subtle" style={{ display: 'block', color: '#71717A' }}>CONFIDENTIAL INQUIRY</span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', margin: 0 }}>To {selectedPro.displayName}</h3>
              </div>
              <button
                type="button"
                className="crowd-search-clear"
                onClick={() => setSelectedPro(null)}
              >
                <X size={18} />
              </button>
            </div>

            {successMsg ? (
              <div className="alert-banner alert-info" style={{ borderRadius: 14 }}>
                {successMsg}
              </div>
            ) : (
              <form onSubmit={handleConsultationSubmit}>
                {errorMsg && (
                  <div className="alert-banner alert-warning" style={{ marginBottom: 14, borderRadius: 14 }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                    Subject / Topic
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Dealing with chronic panic attacks and sleep anxiety"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required
                    minLength={3}
                    maxLength={150}
                    style={{ borderRadius: 12, padding: '10px 14px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                    Your Question or Consultation Request
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    placeholder="Describe what you are experiencing. Sent privately and anonymously under your random persona..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    minLength={10}
                    maxLength={2500}
                    style={{ borderRadius: 12, padding: '10px 14px' }}
                  />
                  <div className="mono-subtle" style={{ fontSize: '0.68rem', marginTop: 4, color: '#A1A1AA' }}>
                    Never share credit card numbers, home addresses, or real-life names.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                    Urgency Level
                  </label>
                  <select
                    className="form-select"
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    style={{ borderRadius: 12, padding: '10px 14px' }}
                  >
                    <option value="general">General Guidance (within a week)</option>
                    <option value="soon">Soon (within 2-3 days)</option>
                    <option value="pressing">Pressing (as soon as available)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="crowd-pill-btn"
                    onClick={() => setSelectedPro(null)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-black-pill" disabled={isSubmitting}>
                    <span>{isSubmitting ? 'Submitting...' : 'Send Consultation Request'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

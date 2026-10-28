import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRealtime } from '../context/RealtimeContext.jsx';
import {
  registerProfessional,
  loginProfessional,
  getProfessionalProfile,
  getProfessionalConsultations,
  respondToConsultation,
  updateProfessionalProfile
} from '../services/api.js';
import {
  ShieldCheck,
  Lock,
  Clock,
  CheckCircle,
  FileText,
  Send,
  AlertCircle,
  UserCheck,
  Shield,
  ArrowRight
} from 'lucide-react';

export default function ProfessionalPortalPage() {
  const { showToast } = useRealtime();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [profile, setProfile] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [licenseType, setLicenseType] = useState('Licensed Clinical Psychologist');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseJurisdiction, setLicenseJurisdiction] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [languages, setLanguages] = useState('English');
  const [bio, setBio] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Response form state
  const [replyTextMap, setReplyTextMap] = useState({});
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    checkProSession();
  }, []);

  async function checkProSession() {
    try {
      setLoading(true);
      const res = await getProfessionalProfile();
      if (res.success && res.professional) {
        setProfile(res.professional);
        setIsLoggedIn(true);
        loadConsultations();
      }
    } catch {
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadConsultations() {
    try {
      const res = await getProfessionalConsultations();
      if (res.consultations) setConsultations(res.consultations);
    } catch (err) {
      console.error('Failed to load consultations:', err);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    try {
      setError(null);
      setLoading(true);
      const res = await loginProfessional({ email: loginEmail, password: loginPassword });
      if (res.success && res.professional) {
        setProfile(res.professional);
        setIsLoggedIn(true);
        loadConsultations();
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError('Image must be under 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleRegister(e) {
    e.preventDefault();
    try {
      setError(null);
      setLoading(true);
      const res = await registerProfessional({
        email,
        password,
        fullName,
        displayName,
        imageUrl,
        licenseType,
        licenseNumber,
        licenseJurisdiction,
        specialties: specialties.split(',').map(s => s.trim()).filter(Boolean),
        languages: languages.split(',').map(l => l.trim()).filter(Boolean),
        bio
      });

      if (res.success && res.professional) {
        setProfile(res.professional);
        setIsLoggedIn(true);
        loadConsultations();
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendConsultationReply(consultationId) {
    const response = replyTextMap[consultationId];
    if (!response || !response.trim()) return;

    try {
      setSubmittingReply(true);
      const res = await respondToConsultation(consultationId, response.trim());
      if (res.success) {
        setConsultations(consultations.map(c => {
          if (c.id === consultationId) {
            return {
              ...c,
              status: 'responded',
              response: res.consultation.response,
              respondedAt: res.consultation.respondedAt
            };
          }
          return c;
        }));
        setReplyTextMap({ ...replyTextMap, [consultationId]: '' });
      }
    } catch (err) {
      showToast(err.message || 'Failed to send response.', 'error');
    } finally {
      setSubmittingReply(false);
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
      <section className="editorial-faq-frame crowd-hero-frame" aria-label="Professional Portal">
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="crowd-hero-content">
          <div className="editorial-faq-header" style={{ marginBottom: 20 }}>
            <div className="hero-brand-crest-wrap">
              <img src="/anonlogo_dark.png" alt="ANON" className="hero-page-logo" />
            </div>
            <span className="manifesto-pill">Clinical Practice // Verified Counsel</span>
            <h1 className="editorial-faq-title" style={{ fontSize: 'clamp(2.1rem, 4vw, 3rem)' }}>
              Health Professional Portal
            </h1>
            <p className="secure-comm-expressive" style={{ margin: '8px auto 14px auto', fontSize: '1.2rem' }}>
              “Offer grounded medical guidance to young people seeking quiet support.”
            </p>
            <p className="editorial-faq-desc" style={{ maxWidth: 640 }}>
              Dedicated console for state-licensed psychologists, therapists, and physicians to respond to anonymous consultation requests securely.
            </p>
          </div>

          <div className="crowd-hero-badges-row">
            <div className="crowd-assurance-item">
              <ShieldCheck size={14} className="crowd-assurance-icon" />
              <span>Official License Verification</span>
            </div>
            <div className="crowd-assurance-item">
              <Lock size={14} className="crowd-assurance-icon" />
              <span>Secure Clinical Desk</span>
            </div>
            <div className="crowd-assurance-item">
              <UserCheck size={14} className="crowd-assurance-icon" />
              <span>Youth Sanctuary</span>
            </div>
          </div>
        </div>
      </section>

      {!isLoggedIn ? (
        /* Login or Register Form */
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
            <button
              type="button"
              className={`crowd-cat-pill ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => { setAuthMode('login'); setError(null); }}
            >
              Professional Login
            </button>
            <button
              type="button"
              className={`crowd-cat-pill ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => { setAuthMode('register'); setError(null); }}
            >
              Apply as Clinician
            </button>
          </div>

          <div className="crowd-card" style={{ padding: '32px 36px' }}>
            {error && (
              <div className="alert-banner alert-warning" style={{ marginBottom: 16, borderRadius: 12 }}>
                {error}
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={handleLogin}>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    style={{ borderRadius: 12, padding: '10px 14px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    style={{ borderRadius: 12, padding: '10px 14px' }}
                  />
                </div>

                <button type="submit" className="btn-black-pill" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                  <span>{loading ? 'Authenticating...' : 'Sign In to Clinical Desk'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ borderRadius: 12 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    style={{ borderRadius: 12 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Full Legal Name (for verification only)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    style={{ borderRadius: 12 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Public Display Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Dr. Maya Chen, PsyD"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    style={{ borderRadius: 12 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Professional Photo / Portrait</label>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 4 }}>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt="Preview"
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #E4E4E7',
                          backgroundColor: '#F4F4F5',
                          flexShrink: 0
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: '50%',
                          backgroundColor: '#F4F4F5',
                          border: '1px dashed #A1A1AA',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#71717A',
                          fontSize: '0.72rem',
                          textAlign: 'center',
                          padding: 4,
                          flexShrink: 0
                        }}
                      >
                        Photo
                      </div>
                    )}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFile}
                        style={{ fontSize: '0.8rem' }}
                      />
                      <input
                        type="url"
                        className="form-input"
                        placeholder="Or enter image URL (https://...)"
                        value={imageUrl.startsWith('data:') ? '' : imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        style={{ borderRadius: 10, fontSize: '0.8rem', padding: '6px 10px' }}
                      />
                    </div>
                  </div>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#DC2626',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        padding: '4px 0 0 0',
                        display: 'block'
                      }}
                    >
                      Remove photo
                    </button>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">License Type</label>
                  <select
                    className="form-select"
                    value={licenseType}
                    onChange={(e) => setLicenseType(e.target.value)}
                    style={{ borderRadius: 12 }}
                  >
                    <option value="Licensed Clinical Psychologist">Licensed Clinical Psychologist</option>
                    <option value="Licensed Professional Counselor">Licensed Professional Counselor</option>
                    <option value="Licensed Clinical Social Worker">Licensed Clinical Social Worker</option>
                    <option value="Psychiatrist (MD/DO)">Psychiatrist (MD/DO)</option>
                    <option value="Adolescent Health Physician">Adolescent Health Physician</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">License Number & Jurisdiction</label>
                  <div className="modal-two-col-grid" style={{ gap: 10 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="License #"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      required
                      style={{ borderRadius: 12 }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="State / Region"
                      value={licenseJurisdiction}
                      onChange={(e) => setLicenseJurisdiction(e.target.value)}
                      required
                      style={{ borderRadius: 12 }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Specialties (comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Anxiety, Youth Trauma, Depression"
                    value={specialties}
                    onChange={(e) => setSpecialties(e.target.value)}
                    style={{ borderRadius: 12 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">Professional Bio & Approach</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Describe your background and supportive philosophy for youth..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    style={{ borderRadius: 12 }}
                  />
                </div>

                <button type="submit" className="btn-black-pill" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                  <span>{loading ? 'Submitting Application...' : 'Submit Credential Verification'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        /* Logged in Clinician Console */
        <div>
          <div className="crowd-card" style={{ padding: '24px 28px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {profile.imageUrl ? (
                  <img
                    src={profile.imageUrl}
                    alt={profile.displayName}
                    style={{
                      width: 56,
                      height: 56,
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
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(20, 20, 19, 0.05)',
                      border: '1px solid rgba(20, 20, 19, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      color: '#141413',
                      flexShrink: 0
                    }}
                  >
                    {profile.displayName?.charAt(0) || 'Dr'}
                  </div>
                )}
                <div>
                  <span className="crowd-tag-pill highlight" style={{ marginBottom: 6 }}>
                    {profile.verificationStatus === 'verified' ? 'Verified Practitioner' : 'Verification Under Review'}
                  </span>
                  <h2 className="crowd-card-title" style={{ fontSize: '1.4rem', margin: 0 }}>
                    Welcome, {profile.displayName}
                  </h2>
                  <div className="mono-subtle" style={{ color: '#71717A', marginTop: 4 }}>
                    {profile.licenseType} &bull; License #{profile.licenseNumber} ({profile.licenseJurisdiction})
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="crowd-pill-btn"
                onClick={() => {
                  sessionStorage.removeItem('anon_session_token_backup');
                  setIsLoggedIn(false);
                }}
              >
                Sign Out
              </button>
            </div>
          </div>

          {consultations.length === 0 ? (
            <div className="editorial-faq-frame crowd-empty-frame">
              <div className="crowd-empty-inner">
                <span className="manifesto-pill">Inquiry Queue</span>
                <h3 className="crowd-empty-title">No pending inquiries.</h3>
                <p className="crowd-empty-desc">
                  When young people request confidential consultations, they will appear in this clinical desk.
                </p>
              </div>
            </div>
          ) : (
            <div className="crowd-posts-grid">
              {consultations.map((c) => (
                <article key={c.id} className="crowd-card">
                  <div className="crowd-card-header">
                    <div>
                      <span className={`crowd-tag-pill ${c.status === 'responded' ? 'highlight' : ''}`} style={{ marginBottom: 6 }}>
                        STATUS: {c.status}
                      </span>
                      <h3 className="crowd-card-title" style={{ fontSize: '1.3rem' }}>{c.topic}</h3>
                      <div className="mono-subtle" style={{ color: '#71717A' }}>
                        FROM // {c.inquirerPseudonym || 'Anonymous Youth'} &bull; Urgency: {c.urgency}
                      </div>
                    </div>
                    <span className="crowd-card-time">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div style={{ background: '#F4F4F5', padding: 18, borderRadius: 12, marginBottom: 16, fontSize: '0.925rem', lineHeight: 1.6 }}>
                    <span className="mono-subtle" style={{ display: 'block', marginBottom: 4 }}>INQUIRER'S QUESTION //</span>
                    {c.message}
                  </div>

                  {c.response ? (
                    <div style={{ background: '#FFFFFF', border: '1px solid rgba(16, 185, 129, 0.3)', padding: 18, borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#065F46', marginBottom: 6, fontSize: '0.85rem' }}>
                        <CheckCircle size={15} />
                        <span>Your Sent Response</span>
                      </div>
                      <div style={{ fontSize: '0.925rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{c.response}</div>
                    </div>
                  ) : (
                    <div>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Write your professional, confidential response..."
                        value={replyTextMap[c.id] || ''}
                        onChange={(e) => setReplyTextMap({ ...replyTextMap, [c.id]: e.target.value })}
                        style={{ borderRadius: 12, marginBottom: 12 }}
                      />
                      <button
                        type="button"
                        className="btn-black-pill"
                        disabled={submittingReply || !replyTextMap[c.id]?.trim()}
                        onClick={() => handleSendConsultationReply(c.id)}
                      >
                        <Send size={13} />
                        <span>{submittingReply ? 'Sending...' : 'Send Clinician Response'}</span>
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A', margin: 0 }}>
          ANON CLINICAL PORTAL • VERIFIED LICENSING • SECURE CONSULTATIONS
        </p>
        <Link to="/admin" style={{ fontSize: '0.78rem', color: '#A1A1AA', textDecoration: 'none' }}>
          Administrator Verification Desk &rarr;
        </Link>
      </section>
    </div>
  );
}

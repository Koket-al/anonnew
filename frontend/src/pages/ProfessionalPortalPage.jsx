import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { resizeImageFile } from '../utils/imageUtils.js';
import {
  registerProfessional,
  loginProfessional,
  logoutProfessional,
  getProfessionalProfile,
  getProfessionalConsultations,
  respondToConsultation,
  sendConsultationMessage,
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
  ArrowRight,
  Camera,
  Edit3,
  User,
  X
} from 'lucide-react';

export default function ProfessionalPortalPage() {
  const { socket, showToast } = useRealtime();
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
  const [isProcessingImg, setIsProcessingImg] = useState(false);

  // Edit Profile Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editSpecialties, setEditSpecialties] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Response & follow-up message form state
  const [replyTextMap, setReplyTextMap] = useState({});
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    checkProSession();
  }, []);

  // Real-time synchronization for Doctor Dashboard
  useEffect(() => {
    if (!socket || !profile?._id && !profile?.id) return;
    const proId = profile._id || profile.id;

    socket.emit('join_professional', { professionalId: proId });

    const handleNewConsultation = (newC) => {
      showToast('New confidential consultation inquiry received!', 'info');
      setConsultations((prev) => {
        if (prev.some((c) => (c.id || c._id) === (newC.id || newC._id))) return prev;
        return [newC, ...prev];
      });
    };

    const handleConsultationMessage = (data) => {
      setConsultations((prev) =>
        prev.map((c) => {
          const matchId = c.id || c._id;
          if (matchId === data.id || matchId === data._id) {
            return {
              ...c,
              status: data.status || c.status,
              response: data.response || c.response,
              respondedAt: data.respondedAt || c.respondedAt,
              messages: data.messages || (data.newMessage ? [...(c.messages || []), data.newMessage] : c.messages)
            };
          }
          return c;
        })
      );
    };

    socket.on('new_consultation', handleNewConsultation);
    socket.on('consultation_message', handleConsultationMessage);
    socket.on('consultation_updated', handleConsultationMessage);

    return () => {
      socket.emit('leave_professional', { professionalId: proId });
      socket.off('new_consultation', handleNewConsultation);
      socket.off('consultation_message', handleConsultationMessage);
      socket.off('consultation_updated', handleConsultationMessage);
    };
  }, [socket, profile?._id, profile?.id, showToast]);

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

  async function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessingImg(true);
      setError(null);
      const optimizedUrl = await resizeImageFile(file, 600, 600, 0.86);
      setImageUrl(optimizedUrl);
    } catch (err) {
      setError(err.message || 'Failed to process image.');
    } finally {
      setIsProcessingImg(false);
    }
  }

  async function handleEditImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessingImg(true);
      const optimizedUrl = await resizeImageFile(file, 600, 600, 0.86);
      setEditImageUrl(optimizedUrl);
    } catch (err) {
      showToast(err.message || 'Failed to optimize photo.', 'error');
    } finally {
      setIsProcessingImg(false);
    }
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
        specialties: specialties.split(',').map((s) => s.trim()).filter(Boolean),
        languages: languages.split(',').map((l) => l.trim()).filter(Boolean),
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

  function openEditModal() {
    if (!profile) return;
    setEditDisplayName(profile.displayName || '');
    setEditImageUrl(profile.imageUrl || '');
    setEditSpecialties((profile.specialties || []).join(', '));
    setEditBio(profile.bio || '');
    setShowEditModal(true);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const res = await updateProfessionalProfile({
        displayName: editDisplayName.trim(),
        imageUrl: editImageUrl,
        specialties: editSpecialties.split(',').map((s) => s.trim()).filter(Boolean),
        bio: editBio.trim()
      });

      if (res.success && res.professional) {
        setProfile(res.professional);
        setShowEditModal(false);
        showToast('Profile and portrait updated successfully!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSendConsultationReply(consultationId) {
    const text = replyTextMap[consultationId];
    if (!text || !text.trim()) return;

    try {
      setSubmittingReply(true);
      const c = consultations.find((item) => (item.id || item._id) === consultationId);

      let res;
      // If consultation already has a response or messages, use interactive follow-up messaging
      if (c && (c.response || (c.messages && c.messages.length > 0))) {
        res = await sendConsultationMessage(consultationId, text.trim());
      } else {
        res = await respondToConsultation(consultationId, text.trim());
      }

      if (res.success) {
        setConsultations((prev) =>
          prev.map((item) => {
            if ((item.id || item._id) === consultationId) {
              const updated = res.consultation || {};
              return {
                ...item,
                status: 'responded',
                response: updated.response || text.trim(),
                respondedAt: updated.respondedAt || new Date(),
                messages: updated.messages || [
                  ...(item.messages || []),
                  {
                    senderRole: 'professional',
                    senderName: profile?.displayName || 'Doctor',
                    text: text.trim(),
                    createdAt: new Date()
                  }
                ]
              };
            }
            return item;
          })
        );
        setReplyTextMap({ ...replyTextMap, [consultationId]: '' });
        showToast('Response delivered to inquirer.', 'success');
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
                <div style={{ position: 'relative' }}>
                  {profile.imageUrl ? (
                    <img
                      src={profile.imageUrl}
                      alt={profile.displayName}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--border-dark)',
                        backgroundColor: 'var(--bg-card-alt)',
                        display: 'block',
                        flexShrink: 0
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-light)',
                      display: profile.imageUrl ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1.25rem',
                      color: 'var(--text-main)',
                      flexShrink: 0
                    }}
                  >
                    {profile.displayName?.charAt(0)?.toUpperCase() || 'Dr'}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span className="crowd-tag-pill highlight">
                      <ShieldCheck size={12} />
                      <span>{profile.verificationStatus === 'verified' ? 'Verified Practitioner' : 'Verification Under Review'}</span>
                    </span>
                    <button
                      type="button"
                      className="crowd-tag-pill"
                      onClick={openEditModal}
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <Camera size={11} />
                      <span>Edit Photo & Profile</span>
                    </button>
                  </div>

                  <h2 className="crowd-card-title" style={{ fontSize: '1.4rem', margin: 0 }}>
                    Welcome, {profile.displayName}
                  </h2>
                  <div className="mono-subtle" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                    {profile.licenseType} &bull; License #{profile.licenseNumber} ({profile.licenseJurisdiction})
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  className="crowd-pill-btn"
                  onClick={openEditModal}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Edit3 size={13} />
                  <span>Update Profile</span>
                </button>
                <button
                  type="button"
                  className="crowd-pill-btn"
                  onClick={async () => {
                    try {
                      await logoutProfessional();
                    } catch {
                      // Ignore logout network error
                    }
                    setIsLoggedIn(false);
                    setProfile(null);
                  }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Edit Profile Modal */}
          {showEditModal && (
            <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
              <div
                className="modal-dialog"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 560, borderRadius: 20, padding: 32 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <span className="mono-subtle" style={{ display: 'block', color: 'var(--text-muted)' }}>CLINICIAN PROFILE</span>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', margin: 0, color: 'var(--text-main)' }}>
                      Update Profile & Portrait
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="crowd-search-clear"
                    onClick={() => setShowEditModal(false)}
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveProfile}>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Doctor Photo / Portrait</label>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8 }}>
                      {editImageUrl ? (
                        <img
                          src={editImageUrl}
                          alt="Preview"
                          style={{
                            width: 68,
                            height: 68,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid var(--border-dark)',
                            backgroundColor: 'var(--bg-card-alt)',
                            flexShrink: 0
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 68,
                            height: 68,
                            borderRadius: '50%',
                            backgroundColor: 'var(--bg-subtle)',
                            border: '1px dashed var(--border-dark)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '0.75rem',
                            flexShrink: 0
                          }}
                        >
                          <Camera size={20} />
                        </div>
                      )}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleEditImageFile}
                          style={{ fontSize: '0.8rem' }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="url"
                            className="form-input"
                            placeholder="Or enter image URL (https://...)"
                            value={editImageUrl.startsWith('data:') ? '' : editImageUrl}
                            onChange={(e) => setEditImageUrl(e.target.value)}
                            style={{ borderRadius: 10, fontSize: '0.8rem', padding: '6px 10px', flex: 1 }}
                          />
                          {editImageUrl && (
                            <button
                              type="button"
                              className="crowd-pill-btn"
                              onClick={() => setEditImageUrl('')}
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Public Display Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      required
                      style={{ borderRadius: 12, padding: '10px 14px' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Specialties (comma-separated)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Anxiety, Youth Trauma, Depression"
                      value={editSpecialties}
                      onChange={(e) => setEditSpecialties(e.target.value)}
                      style={{ borderRadius: 12, padding: '10px 14px' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Professional Bio</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      placeholder="Describe your background and supportive philosophy for youth..."
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      style={{ borderRadius: 12, padding: '10px 14px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      className="crowd-pill-btn"
                      onClick={() => setShowEditModal(false)}
                      disabled={savingProfile}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-black-pill"
                      disabled={savingProfile || isProcessingImg}
                    >
                      <span>{savingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {consultations.length === 0 ? (
            <div className="editorial-faq-frame crowd-empty-frame">
              <div className="crowd-empty-inner">
                <span className="manifesto-pill">Inquiry Queue</span>
                <h3 className="crowd-empty-title">No pending inquiries.</h3>
                <p className="crowd-empty-desc">
                  When young people request confidential consultations, they will appear in this clinical desk in real time.
                </p>
              </div>
            </div>
          ) : (
            <div className="crowd-posts-grid">
              {consultations.map((c) => {
                const consultationId = c.id || c._id;
                const inquirerName = c.inquirerPseudonym || c.anonymousUser?.username || 'Anonymous Youth';
                const threadMessages = Array.isArray(c.messages) && c.messages.length > 0 ? c.messages : [];

                return (
                  <article key={consultationId} className="crowd-card">
                    <div className="crowd-card-header">
                      <div>
                        <span
                          className={`crowd-tag-pill ${c.status === 'responded' ? 'highlight' : ''}`}
                          style={{ marginBottom: 6 }}
                        >
                          STATUS: {c.status}
                        </span>
                        <h3 className="crowd-card-title" style={{ fontSize: '1.3rem', color: 'var(--text-main)' }}>
                          {c.topic}
                        </h3>
                        <div className="mono-subtle" style={{ color: 'var(--text-muted)' }}>
                          FROM // <strong>{inquirerName}</strong> &bull; Urgency: {c.urgency}
                        </div>
                      </div>
                      <span className="crowd-card-time">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Initial Inquirer Question */}
                    <div
                      style={{
                        background: 'var(--bg-card-alt)',
                        border: '1px solid var(--border-light)',
                        padding: 18,
                        borderRadius: 14,
                        marginBottom: 16,
                        fontSize: '0.925rem',
                        lineHeight: 1.6,
                        color: 'var(--text-main)'
                      }}
                    >
                      <span className="mono-subtle" style={{ display: 'block', marginBottom: 4, color: 'var(--text-muted)' }}>
                        INITIAL INQUIRY //
                      </span>
                      {c.message}
                    </div>

                    {/* Interactive Message Thread */}
                    {threadMessages.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          marginBottom: 16,
                          maxHeight: 340,
                          overflowY: 'auto',
                          paddingRight: 4
                        }}
                      >
                        {threadMessages.map((msg, idx) => {
                          const isDoctor = msg.senderRole === 'professional';
                          return (
                            <div
                              key={msg._id || idx}
                              style={{
                                alignSelf: isDoctor ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                                background: isDoctor ? 'var(--bg-card)' : 'var(--bg-card-alt)',
                                border: isDoctor ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-light)',
                                borderRadius: isDoctor ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                                padding: '12px 16px',
                                fontSize: '0.9rem',
                                lineHeight: 1.6
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  color: isDoctor ? '#10B981' : 'var(--text-muted)',
                                  marginBottom: 4
                                }}
                              >
                                <span>{isDoctor ? (msg.senderName || 'You (Clinician)') : (msg.senderName || inquirerName)}</span>
                                <span style={{ opacity: 0.6 }}>&bull; {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div style={{ color: 'var(--text-main)', whiteSpace: 'pre-line' }}>{msg.text}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Legacy Single Response fallback if thread empty but c.response exists */}
                    {threadMessages.length === 0 && c.response && (
                      <div
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: 18,
                          borderRadius: 14,
                          marginBottom: 16
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontWeight: 600,
                            color: '#10B981',
                            marginBottom: 6,
                            fontSize: '0.85rem'
                          }}
                        >
                          <CheckCircle size={15} />
                          <span>Your Sent Response</span>
                        </div>
                        <div style={{ fontSize: '0.925rem', lineHeight: 1.6, whiteSpace: 'pre-line', color: 'var(--text-main)' }}>
                          {c.response}
                        </div>
                      </div>
                    )}

                    {/* Reply / Talk Box */}
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
                      <textarea
                        className="form-textarea"
                        rows={2}
                        placeholder={c.response ? 'Reply to continue confidential talk...' : 'Write your professional, confidential response...'}
                        value={replyTextMap[consultationId] || ''}
                        onChange={(e) => setReplyTextMap({ ...replyTextMap, [consultationId]: e.target.value })}
                        style={{ borderRadius: 12, marginBottom: 10 }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn-black-pill"
                          disabled={submittingReply || !replyTextMap[consultationId]?.trim()}
                          onClick={() => handleSendConsultationReply(consultationId)}
                        >
                          <Send size={13} />
                          <span>{submittingReply ? 'Sending...' : (c.response ? 'Send Follow-up' : 'Send Clinician Response')}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: 'var(--text-muted)', margin: 0 }}>
          ANON CLINICAL PORTAL • VERIFIED LICENSING • SECURE CONSULTATIONS
        </p>
        <Link to="/admin" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
          Administrator Verification Desk &rarr;
        </Link>
      </section>
    </div>
  );
}

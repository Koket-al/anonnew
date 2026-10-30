import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRealtime } from '../context/RealtimeContext.jsx';
import {
  adminLogin,
  adminLogout,
  getAdminMe,
  getAdminPlatformStats,
  getPublicUserCount,
  getAdminPendingProfessionals,
  getAdminAllProfessionals,
  reviewProfessionalApplication,
  createDirectProfessional,
  deleteAdminProfessional
} from '../services/api.js';
import {
  ShieldCheck,
  Check,
  X,
  UserPlus,
  Users,
  FileText,
  Lock,
  LogOut,
  Trash2,
  AlertCircle,
  Clock,
  Image as ImageIcon,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Activity,
  TrendingUp,
  MessageCircle,
  Layers,
  Headphones,
  Calendar,
  Stethoscope,
  Globe,
  Sparkles
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { showToast, showConfirm } = useRealtime();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Login form state (no hardcoded credentials)
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [submittingLogin, setSubmittingLogin] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'pending' | 'verified' | 'add'
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [publicUserCount, setPublicUserCount] = useState(null);
  const [pendingList, setPendingList] = useState([]);
  const [verifiedList, setVerifiedList] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Direct add clinician state
  const [addFullName, setAddFullName] = useState('');
  const [addDisplayName, setAddDisplayName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addLicenseType, setAddLicenseType] = useState('Licensed Clinical Psychologist');
  const [addLicenseNumber, setAddLicenseNumber] = useState('');
  const [addLicenseJurisdiction, setAddLicenseJurisdiction] = useState('');
  const [addSpecialties, setAddSpecialties] = useState('');
  const [addLanguages, setAddLanguages] = useState('English');
  const [addBio, setAddBio] = useState('');
  const [addImageUrl, setAddImageUrl] = useState('');
  const [directAddSuccess, setDirectAddSuccess] = useState(null);

  useEffect(() => {
    checkAdminAuth();
    loadPublicCount();
  }, []);

  async function loadPublicCount() {
    try {
      const res = await getPublicUserCount();
      if (res && res.success && typeof res.totalUsers === 'number') {
        setPublicUserCount(res.totalUsers);
      }
    } catch {
      // ignore
    }
  }

  async function checkAdminAuth() {
    try {
      setLoading(true);
      const res = await getAdminMe();
      if (res && res.success && res.admin) {
        setAdminUser(res.admin);
        setIsAdminAuthenticated(true);
        loadDashboardData();
      } else {
        setIsAdminAuthenticated(false);
      }
    } catch {
      setIsAdminAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboardData() {
    try {
      setStatsLoading(true);
      const [pendingRes, verifiedRes, statsRes] = await Promise.all([
        getAdminPendingProfessionals(),
        getAdminAllProfessionals('verified'),
        getAdminPlatformStats()
      ]);

      if (pendingRes && pendingRes.applications) {
        setPendingList(pendingRes.applications);
      }
      if (verifiedRes && verifiedRes.professionals) {
        setVerifiedList(verifiedRes.professionals);
      }
      if (statsRes && statsRes.stats) {
        setStats(statsRes.stats);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setStatsLoading(false);
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    try {
      setAuthError(null);
      setSubmittingLogin(true);
      const res = await adminLogin({
        email: emailInput,
        password: passwordInput
      });

      if (res && res.success && res.admin) {
        setAdminUser(res.admin);
        setIsAdminAuthenticated(true);
        setEmailInput('');
        setPasswordInput('');
        loadDashboardData();
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Please verify administrator credentials.');
    } finally {
      setSubmittingLogin(false);
    }
  }

  async function handleLogout() {
    await adminLogout();
    setIsAdminAuthenticated(false);
    setAdminUser(null);
  }

  async function handleReviewApplication(id, decision) {
    try {
      setActionLoading(true);
      const notes = reviewNotes[id] || '';
      const res = await reviewProfessionalApplication(id, { decision, notes });
      if (res && res.success) {
        setStatusMessage({
          type: 'success',
          text: decision === 'verify' ? 'Clinician verified and added to directory.' : 'Application rejected.'
        });
        loadDashboardData();
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Action failed.'
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteClinician(id, name) {
    const confirmed = await showConfirm(
      `Are you sure you want to remove clinician "${name}" from the verified directory?`,
      { title: 'Remove Clinician', confirmText: 'Remove Clinician', danger: true }
    );
    if (!confirmed) {
      return;
    }
    try {
      setActionLoading(true);
      const res = await deleteAdminProfessional(id);
      if (res && res.success) {
        setStatusMessage({
          type: 'success',
          text: `Clinician "${name}" removed successfully.`
        });
        showToast(`Clinician "${name}" removed successfully.`, 'info');
        loadDashboardData();
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to remove clinician.'
      });
      showToast(err.message || 'Failed to remove clinician.', 'error');
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setActionLoading(false);
    }
  }

  function handleDirectAddImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('Please choose an image under 3MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAddImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleDirectAddClinician(e) {
    e.preventDefault();
    try {
      setActionLoading(true);
      setDirectAddSuccess(null);
      const res = await createDirectProfessional({
        fullName: addFullName,
        displayName: addDisplayName,
        email: addEmail,
        password: addPassword,
        licenseType: addLicenseType,
        licenseNumber: addLicenseNumber,
        licenseJurisdiction: addLicenseJurisdiction,
        specialties: addSpecialties.split(',').map(s => s.trim()).filter(Boolean),
        languages: addLanguages.split(',').map(l => l.trim()).filter(Boolean),
        bio: addBio,
        imageUrl: addImageUrl
      });

      if (res && res.success) {
        setDirectAddSuccess(`Clinician "${res.professional.displayName}" created and verified successfully.`);
        // Reset form
        setAddFullName('');
        setAddDisplayName('');
        setAddEmail('');
        setAddPassword('');
        setAddLicenseNumber('');
        setAddLicenseJurisdiction('');
        setAddSpecialties('');
        setAddBio('');
        setAddImageUrl('');
        loadDashboardData();
        setActiveTab('verified');
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to create clinician.'
      });
      setTimeout(() => setStatusMessage(null), 4500);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="home-page-container crowd-page-container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div className="mono-subtle">Verifying Administrative Access...</div>
      </div>
    );
  }

  return (
    <div className="home-page-container crowd-page-container">
      {/* Continuous 1px Vertical Architectural Grid Guide Lines */}
      <div className="page-vertical-line left" aria-hidden="true" />
      <div className="page-vertical-line right" aria-hidden="true" />

      {/* Editorial Header Frame */}
      <section className="editorial-faq-frame crowd-hero-frame" aria-label="Admin Dashboard">
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="crowd-hero-content">
          <div className="editorial-faq-header" style={{ marginBottom: 16 }}>
            <div className="hero-brand-crest-wrap">
              <img src="/anonlogo_dark.png" alt="ANON" className="hero-page-logo" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <span className="manifesto-pill">Administrative Oversight // Clinician Approval</span>
              {publicUserCount !== null && (
                <span className="crowd-tag-pill highlight" style={{ fontSize: '0.72rem', padding: '3px 10px' }}>
                  <Users size={12} />
                  <span>{publicUserCount.toLocaleString()} Users on ANON</span>
                </span>
              )}
            </div>
            <h1 className="editorial-faq-title" style={{ fontSize: 'clamp(2rem, 3.8vw, 2.9rem)' }}>
              Admin Verification Desk
            </h1>
            <p className="secure-comm-expressive" style={{ margin: '8px auto 14px auto', fontSize: '1.15rem' }}>
              “Review incoming clinician credentials, verify practitioner identities, and maintain medical oversight.”
            </p>
          </div>

          {isAdminAuthenticated && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12 }}>
              <span className="crowd-tag-pill highlight" style={{ fontSize: '0.8rem' }}>
                <ShieldCheck size={13} />
                <span>Signed In: {adminUser?.email}</span>
              </span>
              <button
                type="button"
                className="crowd-pill-btn"
                onClick={handleLogout}
                style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Notification Toast */}
      {statusMessage && (
        <div
          className={`alert-banner ${statusMessage.type === 'success' ? 'alert-success' : 'alert-warning'}`}
          style={{ maxWidth: 840, margin: '0 auto 20px auto', borderRadius: 12, textAlign: 'center' }}
        >
          {statusMessage.text}
        </div>
      )}

      {!isAdminAuthenticated ? (
        /* Admin Login Screen */
        <div style={{ maxWidth: 460, margin: '0 auto 60px auto' }}>
          <div className="crowd-card" style={{ padding: '36px 32px' }}>
            <div className="corner-cross tl" aria-hidden="true" />
            <div className="corner-cross tr" aria-hidden="true" />
            <div className="corner-cross bl" aria-hidden="true" />
            <div className="corner-cross br" aria-hidden="true" />

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'rgba(20, 20, 19, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto'
                }}
              >
                <Lock size={22} style={{ color: 'var(--text-main)' }} />
              </div>
              <h2 className="crowd-card-title" style={{ fontSize: '1.4rem', margin: '0 0 6px 0' }}>
                Restricted Administrator Login
              </h2>
              <p className="mono-subtle" style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 12 }}>
                AUTHENTICATION RESTRICTED TO PLATFORM ADMINISTRATOR
              </p>
              {publicUserCount !== null && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 9999, background: 'var(--bg-card-alt)', border: '1px solid var(--border-light)', marginTop: 4 }}>
                  <span className="identity-dot" style={{ width: 7, height: 7 }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {publicUserCount.toLocaleString()} People Using ANON
                  </span>
                </div>
              )}
            </div>

            {authError && (
              <div className="alert-banner alert-warning" style={{ marginBottom: 16, borderRadius: 10, fontSize: '0.85rem' }}>
                <AlertCircle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                {authError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label
                  className="form-label"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}
                >
                  Admin Email
                </label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="admin@anon.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                  style={{ borderRadius: 12, padding: '10px 14px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 22 }}>
                <label
                  className="form-label"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}
                >
                  Admin Password
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                  style={{ borderRadius: 12, padding: '10px 14px' }}
                />
              </div>

              <button
                type="submit"
                className="btn-black-pill"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={submittingLogin}
              >
                <span>{submittingLogin ? 'Verifying...' : 'Authenticate as Administrator'}</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Authenticated Admin Dashboard */
        <div style={{ maxWidth: 1080, margin: '0 auto 60px auto' }}>
          {/* Live Top At-A-Glance Stat Banner */}
          {stats && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 14,
                marginBottom: 24
              }}
            >
              <div className="admin-stat-summary-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="mono-subtle" style={{ fontSize: '0.68rem', letterSpacing: '0.08em' }}>PEOPLE USING ANON</span>
                  <Users size={15} style={{ opacity: 0.7 }} />
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, fontFamily: 'var(--font-sans)', lineHeight: 1.1 }}>
                  {stats.users.totalUsers.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Total anonymous user sessions
                </div>
              </div>

              <div className="admin-stat-summary-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="mono-subtle" style={{ fontSize: '0.68rem', letterSpacing: '0.08em' }}>ACTIVE TODAY (24H)</span>
                  <span className="identity-dot" style={{ width: 8, height: 8 }} />
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, fontFamily: 'var(--font-sans)', lineHeight: 1.1, color: '#10B981' }}>
                  {stats.users.activeUsers24h.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Active on platform in last 24h
                </div>
              </div>

              <div className="admin-stat-summary-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="mono-subtle" style={{ fontSize: '0.68rem', letterSpacing: '0.08em' }}>CRYPTOGRAPHIC PERSONAS</span>
                  <Layers size={15} style={{ opacity: 0.7 }} />
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, fontFamily: 'var(--font-sans)', lineHeight: 1.1 }}>
                  {stats.users.totalPersonas.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Generated identities (up to 5 per user)
                </div>
              </div>

              <div className="admin-stat-summary-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="mono-subtle" style={{ fontSize: '0.68rem', letterSpacing: '0.08em' }}>SOLIDARITY & MESSAGES</span>
                  <MessageCircle size={15} style={{ opacity: 0.7 }} />
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, fontFamily: 'var(--font-sans)', lineHeight: 1.1 }}>
                  {(stats.activity.totalPosts + stats.activity.totalReplies + stats.activity.totalMessages).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Questions, replies & private messages
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
            <button
              type="button"
              className={`crowd-cat-pill ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <BarChart3 size={14} />
              <span>Platform Usage & People ({stats ? stats.users.totalUsers.toLocaleString() : '...'})</span>
            </button>

            <button
              type="button"
              className={`crowd-cat-pill ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Clock size={14} />
              <span>Pending Applications ({pendingList.length})</span>
            </button>

            <button
              type="button"
              className={`crowd-cat-pill ${activeTab === 'verified' ? 'active' : ''}`}
              onClick={() => setActiveTab('verified')}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Users size={14} />
              <span>Verified Clinicians ({verifiedList.length})</span>
            </button>

            <button
              type="button"
              className={`crowd-cat-pill ${activeTab === 'add' ? 'active' : ''}`}
              onClick={() => setActiveTab('add')}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <UserPlus size={14} />
              <span>Add Doctor / Counselor</span>
            </button>

            <button
              type="button"
              className="crowd-cat-pill"
              onClick={loadDashboardData}
              title="Refresh records and live usage stats"
              style={{ padding: '8px 12px' }}
              disabled={statsLoading}
            >
              <RefreshCw size={13} className={statsLoading ? 'spin-icon' : ''} />
            </button>
          </div>

          {/* TAB 0: PLATFORM USAGE & PEOPLE OVERVIEW */}
          {activeTab === 'overview' && (
            <div>
              <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <span className="mono-subtle" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontSize: '0.72rem' }}>
                    PLATFORM METRICS & USER BASE //
                  </span>
                  <h2 className="crowd-card-title" style={{ fontSize: '1.45rem', margin: 0 }}>
                    How Many People Use ANON
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0', maxWidth: 700 }}>
                    Real-time oversight of anonymous population growth, daily active visitors, community interactions, and clinical service demand.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="crowd-tag-pill highlight" style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="identity-dot" style={{ width: 6, height: 6 }} />
                    <span>Real-Time Live</span>
                  </span>
                </div>
              </div>

              {!stats ? (
                <div className="editorial-faq-frame crowd-empty-frame" style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 12px auto', display: 'block' }} />
                  <p className="mono-subtle">Aggregating platform usage metrics...</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Category 1: People & Population Breakdown */}
                  <div className="crowd-card" style={{ padding: '28px 30px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                      <Users size={18} />
                      <h3 className="crowd-card-title" style={{ fontSize: '1.15rem', margin: 0 }}>
                        User Population & Active Traffic
                      </h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                      <div className="admin-metric-card">
                        <span className="mono-subtle" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
                          TOTAL UNIQUE USERS
                        </span>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>
                          {stats.users.totalUsers.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Unique anonymous sessions created
                        </div>
                      </div>

                      <div className="admin-metric-card">
                        <span className="mono-subtle" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
                          ACTIVE TODAY (24 HOURS)
                        </span>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, color: '#10B981' }}>
                          {stats.users.activeUsers24h.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Visited or interacted today
                        </div>
                      </div>

                      <div className="admin-metric-card">
                        <span className="mono-subtle" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
                          WEEKLY ACTIVE USERS (7D)
                        </span>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>
                          {stats.users.activeUsers7d.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Active in the past 7 days
                        </div>
                      </div>

                      <div className="admin-metric-card">
                        <span className="mono-subtle" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
                          MONTHLY ACTIVE USERS (30D)
                        </span>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>
                          {stats.users.activeUsers30d.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Active in the past 30 days
                        </div>
                      </div>

                      <div className="admin-metric-card">
                        <span className="mono-subtle" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
                          NEW USERS TODAY
                        </span>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, color: '#3B82F6' }}>
                          +{stats.users.newUsersToday.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Joined since midnight
                        </div>
                      </div>

                      <div className="admin-metric-card">
                        <span className="mono-subtle" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
                          TOTAL PERSONAS
                        </span>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>
                          {stats.users.totalPersonas.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Cryptographic personas held
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category 2: Peer Engagement & Communications */}
                  <div className="crowd-card" style={{ padding: '28px 30px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                      <MessageCircle size={18} />
                      <h3 className="crowd-card-title" style={{ fontSize: '1.15rem', margin: 0 }}>
                        Discussion & Message Activity
                      </h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                      <div className="admin-metric-card">
                        <span className="mono-subtle" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
                          QUESTIONS & POSTS
                        </span>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>
                          {stats.activity.totalPosts.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          +{stats.activity.postsToday} shared today
                        </div>
                      </div>

                      <div className="admin-metric-card">
                        <span className="mono-subtle" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
                          PEER REPLIES & EXPERIENCES
                        </span>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>
                          {stats.activity.totalReplies.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Empathy & advice answers
                        </div>
                      </div>

                      <div className="admin-metric-card">
                        <span className="mono-subtle" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
                          PRIVATE 1-ON-1 MESSAGES
                        </span>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>
                          {stats.activity.totalMessages.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          +{stats.activity.messagesToday} messages today
                        </div>
                      </div>

                      <div className="admin-metric-card">
                        <span className="mono-subtle" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
                          PRIVATE CONVERSATIONS
                        </span>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>
                          {stats.activity.totalConversations.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Confidential peer channels
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category 3: Sanctuaries, Listening Rooms & Clinical Overview */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
                    <div className="crowd-card" style={{ padding: '24px 26px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <Headphones size={18} />
                        <h3 className="crowd-card-title" style={{ fontSize: '1.15rem', margin: 0 }}>
                          Sanctuaries & Rooms
                        </h3>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card-alt)' }}>
                          <span style={{ fontSize: '0.85rem' }}>Active Listening Rooms (Live)</span>
                          <span className="crowd-tag-pill highlight" style={{ fontWeight: 700 }}>
                            {stats.sanctuaries.activeListeningRooms} Live
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card-alt)' }}>
                          <span style={{ fontSize: '0.85rem' }}>Total Listening Rooms Created</span>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{stats.sanctuaries.totalListeningRooms}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card-alt)' }}>
                          <span style={{ fontSize: '0.85rem' }}>Peer Communities Formed</span>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{stats.sanctuaries.totalCommunities}</span>
                        </div>
                      </div>
                    </div>

                    <div className="crowd-card" style={{ padding: '24px 26px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <Stethoscope size={18} />
                        <h3 className="crowd-card-title" style={{ fontSize: '1.15rem', margin: 0 }}>
                          Clinical Care & Doctors
                        </h3>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card-alt)' }}>
                          <span style={{ fontSize: '0.85rem' }}>Consultations Requested</span>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{stats.clinical.totalConsultations}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card-alt)' }}>
                          <span style={{ fontSize: '0.85rem' }}>Active Consultation Cases</span>
                          <span className="crowd-tag-pill highlight" style={{ fontWeight: 700 }}>
                            {stats.clinical.activeConsultations} Ongoing
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card-alt)' }}>
                          <span style={{ fontSize: '0.85rem' }}>Verified Clinicians</span>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#10B981' }}>{stats.clinical.verifiedProfessionals}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card-alt)' }}>
                          <span style={{ fontSize: '0.85rem' }}>Applications Pending Review</span>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: stats.clinical.pendingProfessionals > 0 ? '#F59E0B' : 'var(--text-muted)' }}>
                            {stats.clinical.pendingProfessionals}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category 4: 7-Day Activity Trends Table */}
                  {stats.history && stats.history.length > 0 && (
                    <div className="crowd-card" style={{ padding: '28px 30px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <TrendingUp size={18} />
                          <h3 className="crowd-card-title" style={{ fontSize: '1.15rem', margin: 0 }}>
                            7-Day User Growth & Activity Trends
                          </h3>
                        </div>
                        <span className="mono-subtle" style={{ fontSize: '0.72rem' }}>
                          PAST 7 CALENDAR DAYS
                        </span>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>DAY / DATE</th>
                              <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>NEW USERS</th>
                              <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>QUESTIONS POSTED</th>
                              <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>PRIVATE MESSAGES</th>
                              <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>MOMENTUM</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.history.map((day, idx) => {
                              const totalDayActivity = day.newUsers + day.posts + day.messages;
                              const maxActivity = Math.max(...stats.history.map(d => d.newUsers + d.posts + d.messages), 1);
                              const barPercent = Math.min(100, Math.max(12, Math.round((totalDayActivity / maxActivity) * 100)));

                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <Calendar size={13} style={{ opacity: 0.6 }} />
                                      <span>{day.label}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <span style={{ fontWeight: 600, color: '#3B82F6' }}>+{day.newUsers}</span>
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <span style={{ fontWeight: 600 }}>{day.posts}</span>
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <span style={{ fontWeight: 600 }}>{day.messages}</span>
                                  </td>
                                  <td style={{ padding: '12px 14px', width: '30%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <div style={{ flex: 1, height: 8, background: 'var(--bg-card-alt)', borderRadius: 9999, overflow: 'hidden' }}>
                                        <div
                                          style={{
                                            width: `${barPercent}%`,
                                            height: '100%',
                                            background: 'linear-gradient(90deg, #10B981, #3B82F6)',
                                            borderRadius: 9999
                                          }}
                                        />
                                      </div>
                                      <span className="mono-subtle" style={{ fontSize: '0.72rem', width: 35, textAlign: 'right' }}>
                                        {totalDayActivity}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 1: PENDING CLINICIAN APPLICATIONS */}
          {activeTab === 'pending' && (
            <div>
              <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="crowd-card-title" style={{ fontSize: '1.35rem', margin: 0 }}>
                  Doctor & Counselor Applications Awaiting Review
                </h2>
                <span className="mono-subtle" style={{ color: '#71717A' }}>
                  {pendingList.length} applicant{pendingList.length === 1 ? '' : 's'}
                </span>
              </div>

              {pendingList.length === 0 ? (
                <div className="editorial-faq-frame crowd-empty-frame">
                  <div className="crowd-empty-inner">
                    <span className="manifesto-pill">Clean Queue</span>
                    <h3 className="crowd-empty-title">No pending applications at this time.</h3>
                    <p className="crowd-empty-desc">
                      When clinicians submit their license details and portrait photos for verification, they will appear here for review.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {pendingList.map((app) => (
                    <article key={app.id} className="crowd-card" style={{ padding: '24px 28px' }}>
                      <div className="corner-cross tl" aria-hidden="true" />
                      <div className="corner-cross tr" aria-hidden="true" />
                      <div className="corner-cross bl" aria-hidden="true" />
                      <div className="corner-cross br" aria-hidden="true" />

                      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {/* Clinician Photo */}
                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                          {app.imageUrl ? (
                            <img
                              src={app.imageUrl}
                              alt={app.displayName}
                              style={{
                                width: 88,
                                height: 88,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid #E4E4E7',
                                backgroundColor: '#FAFAF9',
                                display: 'block',
                                margin: '0 auto 8px auto'
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 88,
                                height: 88,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(20, 20, 19, 0.05)',
                                border: '1px dashed #A1A1AA',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.8rem',
                                fontWeight: 600,
                                color: '#71717A',
                                margin: '0 auto 8px auto'
                              }}
                            >
                              {app.displayName?.charAt(0) || 'Dr'}
                            </div>
                          )}
                          <span className="mono-subtle" style={{ fontSize: '0.68rem', color: '#71717A' }}>
                            {app.imageUrl ? 'Photo Provided' : 'No Photo'}
                          </span>
                        </div>

                        {/* Details */}
                        <div style={{ flex: 1, minWidth: 280 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span className="crowd-tag-pill highlight" style={{ fontSize: '0.72rem' }}>
                              <Clock size={11} />
                              <span>Pending Review</span>
                            </span>
                            <span className="mono-subtle" style={{ color: '#71717A', fontSize: '0.75rem' }}>
                              Applied: {new Date(app.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <h3 className="crowd-card-title" style={{ fontSize: '1.4rem', margin: '0 0 2px 0' }}>
                            {app.displayName}
                          </h3>
                          <div className="mono-subtle" style={{ color: '#52525B', fontSize: '0.85rem', marginBottom: 12 }}>
                            Legal Name: <strong style={{ color: '#141413' }}>{app.fullName}</strong> &bull; Email: <strong style={{ color: '#141413' }}>{app.email}</strong>
                          </div>

                          <div
                            style={{
                              background: '#F9F9F8',
                              border: '1px solid rgba(0,0,0,0.06)',
                              borderRadius: 10,
                              padding: '12px 16px',
                              marginBottom: 14
                            }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                              <div>
                                <span className="mono-subtle" style={{ fontSize: '0.68rem', color: '#71717A' }}>LICENSE TYPE //</span>
                                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{app.licenseType}</div>
                              </div>
                              <div>
                                <span className="mono-subtle" style={{ fontSize: '0.68rem', color: '#71717A' }}>LICENSE NUMBER //</span>
                                <div style={{ fontWeight: 600, fontSize: '0.88rem', fontFamily: 'var(--font-mono)' }}>{app.licenseNumber}</div>
                              </div>
                              <div>
                                <span className="mono-subtle" style={{ fontSize: '0.68rem', color: '#71717A' }}>JURISDICTION //</span>
                                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{app.licenseJurisdiction}</div>
                              </div>
                            </div>
                          </div>

                          {app.bio && (
                            <div style={{ marginBottom: 12 }}>
                              <span className="mono-subtle" style={{ fontSize: '0.68rem', color: '#71717A' }}>CLINICAL BIO & APPROACH //</span>
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', lineHeight: 1.5, color: '#3F3F46' }}>
                                {app.bio}
                              </p>
                            </div>
                          )}

                          {app.specialties && app.specialties.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <span className="mono-subtle" style={{ fontSize: '0.68rem', color: '#71717A', display: 'block', marginBottom: 4 }}>
                                SPECIALTIES //
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {app.specialties.map((s, idx) => (
                                  <span key={idx} className="crowd-tag-pill">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Verification Decision Controls */}
                          <div
                            style={{
                              borderTop: '1px solid rgba(0,0,0,0.06)',
                              paddingTop: 16,
                              marginTop: 12,
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: 12
                            }}
                          >
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Optional verification note or registry ID..."
                              value={reviewNotes[app.id] || ''}
                              onChange={(e) => setReviewNotes({ ...reviewNotes, [app.id]: e.target.value })}
                              style={{ flex: 1, minWidth: 200, borderRadius: 10, fontSize: '0.85rem', padding: '8px 12px' }}
                            />

                            <button
                              type="button"
                              className="btn-black-pill"
                              style={{ backgroundColor: '#15803D', borderColor: '#15803D' }}
                              disabled={actionLoading}
                              onClick={() => handleReviewApplication(app.id, 'verify')}
                            >
                              <Check size={14} />
                              <span>Approve & Add Clinician</span>
                            </button>

                            <button
                              type="button"
                              className="crowd-pill-btn"
                              style={{ color: '#DC2626', borderColor: '#FECACA' }}
                              disabled={actionLoading}
                              onClick={() => handleReviewApplication(app.id, 'reject')}
                            >
                              <X size={14} />
                              <span>Reject Application</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VERIFIED CLINICIANS DIRECTORY */}
          {activeTab === 'verified' && (
            <div>
              <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="crowd-card-title" style={{ fontSize: '1.35rem', margin: 0 }}>
                  Active Verified Doctors & Counselors
                </h2>
                <span className="mono-subtle" style={{ color: '#71717A' }}>
                  {verifiedList.length} verified clinician{verifiedList.length === 1 ? '' : 's'}
                </span>
              </div>

              {verifiedList.length === 0 ? (
                <div className="editorial-faq-frame crowd-empty-frame">
                  <div className="crowd-empty-inner">
                    <span className="manifesto-pill">Empty Directory</span>
                    <h3 className="crowd-empty-title">No verified clinicians yet.</h3>
                    <p className="crowd-empty-desc">
                      Approve pending applications or add doctors & counselors directly using the "Add Doctor / Counselor" tab.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 20 }}>
                  {verifiedList.map((pro) => (
                    <article key={pro.id} className="crowd-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div className="corner-cross tl" aria-hidden="true" />
                      <div className="corner-cross tr" aria-hidden="true" />
                      <div className="corner-cross bl" aria-hidden="true" />
                      <div className="corner-cross br" aria-hidden="true" />

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <span className="crowd-tag-pill highlight" style={{ fontSize: '0.72rem' }}>
                            <ShieldCheck size={12} />
                            <span>Verified</span>
                          </span>
                          <span className="mono-subtle" style={{ fontSize: '0.72rem', color: '#71717A' }}>
                            {pro.licenseJurisdiction}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                          {pro.imageUrl ? (
                            <img
                              src={pro.imageUrl}
                              alt={pro.displayName}
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
                                fontSize: '1.2rem',
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

                        <div className="mono-subtle" style={{ color: '#71717A', fontSize: '0.75rem', marginBottom: 8 }}>
                          License #{pro.licenseNumber} &bull; Email: {pro.email}
                        </div>

                        <p className="crowd-card-body" style={{ WebkitLineClamp: 3, fontSize: '0.88rem', marginBottom: 12 }}>
                          {pro.bio || 'Adolescent and youth health practitioner.'}
                        </p>

                        {pro.specialties && pro.specialties.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                            {pro.specialties.map((s, idx) => (
                              <span key={idx} className="crowd-tag-pill" style={{ fontSize: '0.72rem' }}>{s}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="crowd-pill-btn"
                          style={{ color: '#DC2626', borderColor: '#FECACA', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}
                          onClick={() => handleDeleteClinician(pro.id, pro.displayName)}
                          disabled={actionLoading}
                        >
                          <Trash2 size={13} />
                          <span>Remove Clinician</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIRECT ONBOARDING OF DOCTOR / COUNSELOR */}
          {activeTab === 'add' && (
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <div className="crowd-card" style={{ padding: '36px 36px' }}>
                <div className="corner-cross tl" aria-hidden="true" />
                <div className="corner-cross tr" aria-hidden="true" />
                <div className="corner-cross bl" aria-hidden="true" />
                <div className="corner-cross br" aria-hidden="true" />

                <div style={{ marginBottom: 24 }}>
                  <span className="crowd-tag-pill highlight" style={{ marginBottom: 8 }}>
                    Direct Verification
                  </span>
                  <h2 className="crowd-card-title" style={{ fontSize: '1.45rem', margin: 0 }}>
                    Directly Add Doctor or Counselor
                  </h2>
                  <p className="mono-subtle" style={{ color: '#71717A', fontSize: '0.78rem', marginTop: 4 }}>
                    IMMEDIATELY VERIFIES AND PUBLISHES PRACTITIONER TO THE PUBLIC DIRECTORY
                  </p>
                </div>

                {directAddSuccess && (
                  <div className="alert-banner alert-success" style={{ marginBottom: 18, borderRadius: 10 }}>
                    {directAddSuccess}
                  </div>
                )}

                <form onSubmit={handleDirectAddClinician}>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Full Legal Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Dr. Maya Eleanor Chen"
                      value={addFullName}
                      onChange={(e) => setAddFullName(e.target.value)}
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
                      value={addDisplayName}
                      onChange={(e) => setAddDisplayName(e.target.value)}
                      required
                      style={{ borderRadius: 12 }}
                    />
                  </div>

                  {/* Photo / Portrait with Upload and Preview */}
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Doctor / Counselor Portrait Photo</label>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 4 }}>
                      {addImageUrl ? (
                        <img
                          src={addImageUrl}
                          alt="Clinician Preview"
                          style={{
                            width: 60,
                            height: 60,
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
                            width: 60,
                            height: 60,
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
                          Portrait
                        </div>
                      )}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleDirectAddImageFile}
                          style={{ fontSize: '0.8rem' }}
                        />
                        <input
                          type="url"
                          className="form-input"
                          placeholder="Or paste an image URL (https://...)"
                          value={addImageUrl.startsWith('data:') ? '' : addImageUrl}
                          onChange={(e) => setAddImageUrl(e.target.value)}
                          style={{ borderRadius: 10, fontSize: '0.8rem', padding: '6px 10px' }}
                        />
                      </div>
                    </div>
                    {addImageUrl && (
                      <button
                        type="button"
                        onClick={() => setAddImageUrl('')}
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

                  <div className="modal-two-col-grid" style={{ gap: 12, marginBottom: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="doctor@practice.com"
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        required
                        style={{ borderRadius: 12 }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Account Password</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Min 8 characters"
                        value={addPassword}
                        onChange={(e) => setAddPassword(e.target.value)}
                        required
                        minLength={8}
                        style={{ borderRadius: 12 }}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">License Type</label>
                    <select
                      className="form-select"
                      value={addLicenseType}
                      onChange={(e) => setAddLicenseType(e.target.value)}
                      style={{ borderRadius: 12 }}
                    >
                      <option value="Licensed Clinical Psychologist">Licensed Clinical Psychologist</option>
                      <option value="Licensed Professional Counselor">Licensed Professional Counselor</option>
                      <option value="Licensed Clinical Social Worker">Licensed Clinical Social Worker</option>
                      <option value="Psychiatrist (MD/DO)">Psychiatrist (MD/DO)</option>
                      <option value="Adolescent Health Physician">Adolescent Health Physician</option>
                    </select>
                  </div>

                  <div className="modal-two-col-grid" style={{ gap: 12, marginBottom: 12 }}>
                    <div className="form-group">
                      <label className="form-label">License Number</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. PSY-99420"
                        value={addLicenseNumber}
                        onChange={(e) => setAddLicenseNumber(e.target.value)}
                        required
                        style={{ borderRadius: 12 }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Jurisdiction / State</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. California, US"
                        value={addLicenseJurisdiction}
                        onChange={(e) => setAddLicenseJurisdiction(e.target.value)}
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
                      value={addSpecialties}
                      onChange={(e) => setAddSpecialties(e.target.value)}
                      style={{ borderRadius: 12 }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Languages Spoken</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="English, Spanish"
                      value={addLanguages}
                      onChange={(e) => setAddLanguages(e.target.value)}
                      style={{ borderRadius: 12 }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label">Professional Bio & Philosophy</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      placeholder="Clinical experience and approach to supporting youth..."
                      value={addBio}
                      onChange={(e) => setAddBio(e.target.value)}
                      style={{ borderRadius: 12 }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-black-pill"
                    style={{ width: '100%', justifyContent: 'center' }}
                    disabled={actionLoading}
                  >
                    <span>{actionLoading ? 'Creating Clinician...' : 'Add & Verify Doctor / Counselor'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance">
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A' }}>
          ANON ADMINISTRATIVE DESK • CLINICAL CREDENTIAL VERIFICATION • RESTRICTED ACCESS
        </p>
      </section>
    </div>
  );
}

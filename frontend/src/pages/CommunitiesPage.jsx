import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { getCommunities, createCommunity, joinCommunity, leaveCommunity } from '../services/api.js';
import CommunityCard from '../components/CommunityCard.jsx';
import {
  Users,
  Plus,
  Search,
  X,
  Shield,
  HeartHandshake,
  Lock,
  ArrowRight,
  Sparkles
} from 'lucide-react';

const TOPICS = [
  'All',
  'Mental Well-being',
  'Relationships',
  'Family',
  'Addiction Recovery',
  'School & Career',
  'General Health'
];

export default function CommunitiesPage() {
  const { isAuthenticated, openCreateModal } = useAuth();
  const { socket, showConfirm, showToast } = useRealtime();
  const [communities, setCommunities] = useState([]);
  const [topic, setTopic] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Create community modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [communityTopic, setCommunityTopic] = useState('Mental Well-being');
  const [rules, setRules] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCommunities();
  }, [topic, search]);

  // Real-time socket updates for community directory counts
  useEffect(() => {
    if (!socket) return;

    const handleCommunityUpdate = (data) => {
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === data.communityId ? { ...c, memberCount: data.memberCount } : c
        )
      );
    };

    socket.on('communities_stream', handleCommunityUpdate);
    return () => {
      socket.off('communities_stream', handleCommunityUpdate);
    };
  }, [socket]);

  async function loadCommunities() {
    try {
      setLoading(true);
      const res = await getCommunities({
        topic: topic !== 'All' ? topic : undefined,
        search: search.trim() || undefined,
        limit: 50
      });
      if (res.communities) setCommunities(res.communities);
    } catch (err) {
      console.error('Failed to load communities:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinToggle(id, isMember) {
    if (!isAuthenticated) {
      openCreateModal({
        reason: 'Please create an anonymous identity before joining communities.',
        onSuccess: async () => {
          try {
            const res = await joinCommunity(id);
            setCommunities(communities.map(c => {
              if (c.id === id) {
                return { ...c, isMember: true, memberCount: res.memberCount !== undefined ? res.memberCount : c.memberCount + 1 };
              }
              return c;
            }));
            showToast({ type: 'success', message: 'Joined community!' });
          } catch (err) {
            showToast({ type: 'error', message: err.message || 'Action failed.' });
          }
        }
      });
      return;
    }

    try {
      if (isMember) {
        const comm = communities.find(c => c.id === id);
        const confirmed = await showConfirm({
          title: `Leave c/${comm?.name || 'Community'}?`,
          message: 'You can rejoin anytime from the communities directory.',
          confirmText: 'Leave Community',
          isDanger: true
        });

        if (!confirmed) return;

        const res = await leaveCommunity(id);
        setCommunities(communities.map(c => {
          if (c.id === id) {
            return {
              ...c,
              isMember: false,
              memberCount: res.memberCount !== undefined ? res.memberCount : Math.max(0, c.memberCount - 1)
            };
          }
          return c;
        }));
        showToast({ type: 'info', message: 'Left community.' });
      } else {
        const res = await joinCommunity(id);
        setCommunities(communities.map(c => {
          if (c.id === id) {
            return {
              ...c,
              isMember: true,
              memberCount: res.memberCount !== undefined ? res.memberCount : c.memberCount + 1
            };
          }
          return c;
        }));
        showToast({ type: 'success', message: 'Joined community!' });
      }
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Action failed.' });
    }
  }

  function handleOpenCreateModal() {
    if (!isAuthenticated) {
      openCreateModal({
        reason: 'Please create an anonymous identity before creating a community.',
        onSuccess: () => setIsCreateOpen(true)
      });
    } else {
      setIsCreateOpen(true);
    }
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    if (!isAuthenticated) {
      openCreateModal({
        reason: 'Please create an anonymous identity before creating a community.'
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const splitRules = rules
        .split('\n')
        .map(r => r.trim())
        .filter(Boolean);

      const res = await createCommunity({
        name,
        description,
        topic: communityTopic,
        rules: splitRules.length > 0 ? splitRules : undefined
      });

      if (res.success && res.community) {
        setCommunities([res.community, ...communities]);
        setName('');
        setDescription('');
        setRules('');
        setIsCreateOpen(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to create community.');
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
          1. Editorial Hero Banner
          ==================================================================== */}
      <section className="editorial-faq-frame crowd-hero-frame" aria-label="Communities Overview">
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="crowd-hero-content">
          <div className="editorial-faq-header" style={{ marginBottom: 26 }}>
            <div className="hero-brand-crest-wrap">
              <img src="/anonlogo_dark.png" alt="ANON" className="hero-page-logo" />
            </div>
            <span className="manifesto-pill">Peer Spheres // Shared Realities</span>
            <h1 className="editorial-faq-title" style={{ fontSize: 'clamp(2.2rem, 4.2vw, 3.1rem)' }}>
              Anonymous Communities
            </h1>
            <p className="secure-comm-expressive" style={{ margin: '8px auto 14px auto', fontSize: '1.2rem' }}>
              “Find the circle of people who truly understand what you carry.”
            </p>
            <p className="editorial-faq-desc" style={{ maxWidth: 640 }}>
              Dedicated, confidential spheres focused on specific health realities, life stages, and mutual struggles—maintained by peers for peers.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <button
              type="button"
              className="btn-black-pill"
              onClick={handleOpenCreateModal}
            >
              <Plus size={16} />
              <span>Create a New Community</span>
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="crowd-hero-badges-row">
            <div className="crowd-assurance-item">
              <Shield size={14} className="crowd-assurance-icon" />
              <span>100% Cryptographic Anonymity</span>
            </div>
            <div className="crowd-assurance-item">
              <Users size={14} className="crowd-assurance-icon" />
              <span>Dedicated Safe Havens</span>
            </div>
            <div className="crowd-assurance-item">
              <Lock size={14} className="crowd-assurance-icon" />
              <span>Zero Tracking · No Sign-Up</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. Topic Filter & Search Bar
          ==================================================================== */}
      <section className="crowd-controls-section" aria-label="Topic Filter and Search">
        <div className="crowd-categories-wrapper">
          <div className="crowd-categories-scroll">
            {TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                className={`crowd-cat-pill ${topic === t ? 'active' : ''}`}
                onClick={() => setTopic(t)}
              >
                {t === 'All' ? 'All Spheres' : t}
              </button>
            ))}
          </div>
        </div>

        <div className="crowd-filter-bar">
          <div className="crowd-search-box" style={{ maxWidth: 440 }}>
            <Search size={15} className="crowd-search-icon" />
            <input
              type="text"
              className="crowd-search-input"
              placeholder="Search communities by name or topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="crowd-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="crowd-filter-right">
            <span className="mono-subtle">SHOWING {communities.length} ACTIVE SPHERES</span>
          </div>
        </div>
      </section>

      {/* ====================================================================
          3. Communities Grid
          ==================================================================== */}
      <main className="crowd-posts-stream" aria-label="Communities List">
        {loading ? (
          <div className="editorial-faq-frame crowd-empty-frame" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <span className="mono-subtle" style={{ display: 'block', marginBottom: 12 }}>LOADING SPHERES...</span>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>
              Retrieving community sanctuaries...
            </h3>
          </div>
        ) : communities.length === 0 ? (
          <div className="editorial-faq-frame crowd-empty-frame">
            <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" style={{ width: '5.5rem' }} />
            <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" style={{ width: '5.5rem' }} />
            <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" style={{ width: '5.5rem' }} />
            <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" style={{ width: '5.5rem' }} />

            <div className="crowd-empty-inner">
              <span className="manifesto-pill">Sanctuary Sphere</span>
              <h3 className="crowd-empty-title">No communities found.</h3>
              <p className="crowd-empty-desc">
                {search
                  ? `No communities matched "${search}". Try another keyword or create a new community.`
                  : 'No active communities in this category yet. Be the first to establish this space.'}
              </p>
              <button
                type="button"
                className="btn-black-pill"
                onClick={handleOpenCreateModal}
              >
                <Plus size={16} />
                <span>Create this Community</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20 }}>
            {communities.map((c) => (
              <CommunityCard
                key={c.id}
                community={c}
                onJoinToggle={handleJoinToggle}
              />
            ))}
          </div>
        )}
      </main>

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance">
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A' }}>
          ANON PEER COMMUNITIES • ENCRYPTED IDENTITY • CONTINUOUS SANCTUARY
        </p>
      </section>

      {/* Create Community Modal */}
      {isCreateOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateOpen(false)}>
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 580, borderRadius: 20, border: '1px solid var(--border-light)', padding: 32 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={20} />
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', margin: 0 }}>Create a New Community</h3>
              </div>
              <button
                type="button"
                className="crowd-search-clear"
                onClick={() => setIsCreateOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="alert-banner alert-warning" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                  Community Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Navigating First-Gen College Anxiety"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={60}
                  style={{ borderRadius: 12, padding: '10px 14px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                  Topic / Sphere
                </label>
                <select
                  className="form-select"
                  value={communityTopic}
                  onChange={(e) => setCommunityTopic(e.target.value)}
                  style={{ borderRadius: 12, padding: '10px 14px' }}
                >
                  <option value="Mental Well-being">Mental Well-being</option>
                  <option value="Relationships">Relationships</option>
                  <option value="Family">Family</option>
                  <option value="Addiction Recovery">Addiction Recovery</option>
                  <option value="School & Career">School & Career</option>
                  <option value="General Health">General Health</option>
                  <option value="Identity & Self-Worth">Identity & Self-Worth</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                  Description
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Explain what this space is for and who it supports..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={5}
                  maxLength={600}
                  style={{ borderRadius: 12, padding: '10px 14px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                  Community Rules <span style={{ textTransform: 'none', color: '#A1A1AA' }}>(One rule per line)</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Be gentle with each other&#10;No unsolicited advice&#10;No sharing personal contact details"
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  style={{ borderRadius: 12, padding: '10px 14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="crowd-pill-btn"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-black-pill" disabled={isSubmitting}>
                  <span>{isSubmitting ? 'Creating...' : 'Create Community'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

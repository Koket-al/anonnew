import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import {
  getCommunity,
  getCommunityMembers,
  getPosts,
  joinCommunity,
  leaveCommunity,
  updateCommunity,
  removeCommunityPost,
  deletePost
} from '../services/api.js';
import PostCard from '../components/PostCard.jsx';
import AskQuestionModal from '../components/AskQuestionModal.jsx';
import ReportModal from '../components/ReportModal.jsx';
import ConnectModal from '../components/ConnectModal.jsx';
import {
  ArrowLeft,
  Users,
  FileText,
  Shield,
  Edit3,
  Trash2,
  Plus,
  Check,
  Lock,
  ArrowRight,
  LogOut,
  X,
  UserPlus,
  Crown,
  Bell,
  BellOff
} from 'lucide-react';

export default function CommunityDetailPage() {
  const { identifier } = useParams();
  const { identity, isAuthenticated, openCreateModal } = useAuth();
  const { socket, showConfirm, showToast, toggleMuteCommunity, isCommunityMuted } = useRealtime();

  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit community state (creator only)
  const [isEditing, setIsEditing] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editRules, setEditRules] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Members modal state (creator only)
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState(null);

  // Modals
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [reportState, setReportState] = useState({ isOpen: false, targetType: '', targetId: '', targetTitle: '' });
  const [connectState, setConnectState] = useState({ isOpen: false, targetIdentityId: '', targetUsername: '', relatedPostId: '' });

  useEffect(() => {
    loadCommunityData();
  }, [identifier]);

  // Real-time socket updates for this community's stream and member counts
  useEffect(() => {
    if (!socket || !community?.id) return;

    socket.emit('join_community', { communityId: community.id });

    const handleNewPost = (newPost) => {
      if (newPost.community && (newPost.community.id === community.id || newPost.community.slug === community.slug)) {
        setPosts((prev) => {
          if (prev.some((p) => p.id === newPost.id)) return prev;
          return [newPost, ...prev];
        });
        setCommunity((prev) => (prev ? { ...prev, postCount: (prev.postCount || 0) + 1 } : prev));
      }
    };

    const handlePostUpdated = (data) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === data.postId
            ? { ...p, replyCount: data.replyCount, lastActivityAt: data.lastActivityAt || p.lastActivityAt }
            : p
        )
      );
    };

    const handleReactionUpdated = (data) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === data.postId ? { ...p, beenThroughThisCount: data.beenThroughThisCount } : p
        )
      );
    };

    const handlePostDeleted = (data) => {
      setPosts((prev) => prev.filter((p) => p.id !== data.postId));
      setCommunity((prev) => (prev ? { ...prev, postCount: Math.max(0, (prev.postCount || 1) - 1) } : prev));
    };

    const handleMemberCount = (data) => {
      if (data.communityId === community.id) {
        setCommunity((prev) => (prev ? { ...prev, memberCount: data.memberCount } : prev));
      }
    };

    socket.on('new_post', handleNewPost);
    socket.on('post_updated', handlePostUpdated);
    socket.on('post_reaction_updated', handleReactionUpdated);
    socket.on('post_deleted', handlePostDeleted);
    socket.on('community_member_count_updated', handleMemberCount);

    return () => {
      socket.emit('leave_community', { communityId: community.id });
      socket.off('new_post', handleNewPost);
      socket.off('post_updated', handlePostUpdated);
      socket.off('post_reaction_updated', handleReactionUpdated);
      socket.off('post_deleted', handlePostDeleted);
      socket.off('community_member_count_updated', handleMemberCount);
    };
  }, [socket, community?.id, community?.slug]);

  async function loadCommunityData() {
    try {
      setLoading(true);
      setError(null);
      const res = await getCommunity(identifier);
      if (res.community) {
        setCommunity(res.community);
        setEditDesc(res.community.description);
        setEditRules((res.community.rules || []).join('\n'));

        // Load posts for this community ONLY if the user is a member
        if (res.community.isMember) {
          try {
            const postRes = await getPosts({ communityId: res.community.id, limit: 50 });
            if (postRes.posts) setPosts(postRes.posts);
          } catch {
            setPosts([]);
          }
        } else {
          setPosts([]);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load community.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!isAuthenticated) {
      openCreateModal({
        reason: 'Please create an anonymous identity before joining this community.',
        onSuccess: async () => {
          try {
            const res = await joinCommunity(community.id);
            setCommunity(prev => ({
              ...prev,
              isMember: true,
              memberCount: res.memberCount !== undefined ? res.memberCount : (prev ? prev.memberCount + 1 : 1)
            }));
            showToast({ type: 'success', message: `Joined c/${community.name}` });
            const postRes = await getPosts({ communityId: community.id, limit: 50 });
            if (postRes.posts) setPosts(postRes.posts);
          } catch (err) {
            showToast({ type: 'error', message: err.message || 'Failed to join community.' });
          }
        }
      });
      return;
    }

    try {
      const res = await joinCommunity(community.id);
      setCommunity(prev => ({
        ...prev,
        isMember: true,
        memberCount: res.memberCount !== undefined ? res.memberCount : prev.memberCount + 1
      }));
      showToast({ type: 'success', message: `Joined c/${community.name}` });
      const postRes = await getPosts({ communityId: community.id, limit: 50 });
      if (postRes.posts) setPosts(postRes.posts);
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to join community.' });
    }
  }

  async function handleLeave() {
    const confirmed = await showConfirm({
      title: `Leave c/${community.name}?`,
      message: 'You will no longer receive notifications or be able to post in this community until you rejoin.',
      confirmText: 'Leave Community',
      isDanger: true
    });

    if (!confirmed) return;

    try {
      const res = await leaveCommunity(community.id);
      setCommunity(prev => ({
        ...prev,
        isMember: false,
        memberCount: res.memberCount !== undefined ? res.memberCount : Math.max(0, prev.memberCount - 1)
      }));
      setPosts([]);
      showToast({ type: 'info', message: `Left c/${community.name}.` });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to leave community.' });
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    try {
      setIsSaving(true);
      const res = await updateCommunity(community.id, {
        description: editDesc,
        rules: editRules.split('\n').map(r => r.trim()).filter(Boolean)
      });
      if (res.success) {
        setCommunity({
          ...community,
          description: res.community.description,
          rules: res.community.rules
        });
        setIsEditing(false);
        showToast({ type: 'success', message: 'Community details updated.' });
      }
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to update community.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteOwnPost(postId) {
    const confirmed = await showConfirm({
      title: 'Delete Question?',
      message: 'This will permanently remove the question and all its replies from the community.',
      confirmText: 'Delete Question',
      isDanger: true
    });

    if (!confirmed) return;

    try {
      await deletePost(postId);
      setPosts(posts.filter(p => p.id !== postId));
      showToast({ type: 'info', message: 'Question deleted successfully.' });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to delete question.' });
    }
  }

  async function handleRemovePost(postId) {
    const confirmed = await showConfirm({
      title: 'Remove Community Question?',
      message: 'As community creator, this will permanently remove this question and all its replies from the community.',
      confirmText: 'Remove Question',
      isDanger: true
    });

    if (!confirmed) return;

    try {
      await removeCommunityPost(community.id, postId);
      setPosts(posts.filter(p => p.id !== postId));
      setCommunity(prev => ({
        ...prev,
        postCount: Math.max(0, (prev.postCount || 1) - 1)
      }));
      showToast({ type: 'info', message: 'Question removed from community.' });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to remove post.' });
    }
  }

  async function handleOpenMembers() {
    setIsMembersModalOpen(true);
    try {
      setLoadingMembers(true);
      setMembersError(null);
      const res = await getCommunityMembers(community.slug || community.id);
      if (res.members) {
        setMembers(res.members);
      }
    } catch (err) {
      setMembersError(err.message || 'Failed to load community members.');
    } finally {
      setLoadingMembers(false);
    }
  }

  if (loading) {
    return (
      <div className="home-page-container crowd-page-container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <span className="mono-subtle" style={{ display: 'block', marginBottom: 12 }}>LOADING COMMUNITY...</span>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>
          Opening community sphere...
        </h3>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="home-page-container crowd-page-container" style={{ padding: '60px 24px' }}>
        <div className="editorial-faq-frame crowd-empty-frame">
          <div className="crowd-empty-inner">
            <span className="manifesto-pill">Sphere Notice</span>
            <h3 className="crowd-empty-title">{error || 'Community not found.'}</h3>
            <p className="crowd-empty-desc">This sanctuary may have moved or does not exist.</p>
            <Link to="/communities" className="btn-black-pill">
              <ArrowLeft size={15} />
              <span>All Communities</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page-container crowd-page-container">
      {/* Continuous 1px Vertical Architectural Grid Guide Lines */}
      <div className="page-vertical-line left" aria-hidden="true" />
      <div className="page-vertical-line right" aria-hidden="true" />

      {/* Back button */}
      <div style={{ marginBottom: 16 }}>
        <Link to="/communities" className="crowd-pill-btn" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={14} />
          <span>All Communities</span>
        </Link>
      </div>

      {/* ====================================================================
          1. Editorial Community Hero Card
          ==================================================================== */}
      <section className="editorial-faq-frame crowd-hero-frame" aria-label="Community Details">
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="crowd-hero-content">
          <div className="editorial-faq-header" style={{ marginBottom: 20 }}>
            <span className="manifesto-pill">{community.topic || 'Peer Sanctuary'}</span>
            <h1 className="editorial-faq-title" style={{ fontSize: 'clamp(2.1rem, 3.8vw, 2.9rem)', marginTop: 10 }}>
              {community.name}
            </h1>
            <div className="crowd-card-time" style={{ justifyContent: 'center', gap: 16, marginTop: 8 }}>
              <span>Created by {community.creator}</span>
              <span>&bull;</span>
              <span>{community.memberCount} members</span>
              <span>&bull;</span>
              <span>{community.postCount} questions</span>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            {community.isMember ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  className="crowd-tag-pill highlight"
                  style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Check size={14} />
                  <span>Member of this Sphere</span>
                </span>
                <button
                  type="button"
                  className="crowd-pill-btn"
                  onClick={() => {
                    toggleMuteCommunity(community.id || community.slug);
                    showToast({
                      type: 'info',
                      message: isCommunityMuted(community.id || community.slug)
                        ? `Notifications unmuted for c/${community.name}.`
                        : `Notifications muted for c/${community.name}.`
                    });
                  }}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: isCommunityMuted(community.id || community.slug) ? '#DC2626' : '#141413',
                    borderColor: isCommunityMuted(community.id || community.slug) ? '#FECACA' : 'rgba(0,0,0,0.12)',
                    background: isCommunityMuted(community.id || community.slug) ? '#FEF2F2' : '#FFFFFF'
                  }}
                  title={isCommunityMuted(community.id || community.slug) ? 'Unmute notifications for this community' : 'Mute notifications for this community'}
                >
                  {isCommunityMuted(community.id || community.slug) ? <BellOff size={14} /> : <Bell size={14} />}
                  <span>{isCommunityMuted(community.id || community.slug) ? 'Alerts Muted' : 'Mute Alerts'}</span>
                </button>
                <button
                  type="button"
                  className="crowd-pill-btn"
                  onClick={handleLeave}
                  style={{
                    color: '#DC2626',
                    borderColor: '#FECACA',
                    background: '#FFFFFF',
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  title="Leave this community"
                >
                  <LogOut size={14} />
                  <span>Leave Community</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-black-pill"
                onClick={handleJoin}
              >
                <Plus size={15} />
                <span>Join Community</span>
              </button>
            )}

            {community.isMember && (
              <button
                type="button"
                className="crowd-pill-btn"
                onClick={() => setIsAskModalOpen(true)}
                style={{ background: '#FFFFFF' }}
              >
                <Plus size={14} />
                <span>Ask in this Sphere</span>
              </button>
            )}

            {community.isCreator && (
              <>
                <button
                  type="button"
                  className="crowd-pill-btn"
                  onClick={handleOpenMembers}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: isMembersModalOpen ? '#141413' : '#FFFFFF',
                    color: isMembersModalOpen ? '#FFFFFF' : '#141413'
                  }}
                  title="View anonymous members who joined your sphere"
                >
                  <Users size={14} />
                  <span>Joined Members ({community.memberCount})</span>
                </button>
                <button
                  type="button"
                  className="crowd-pill-btn"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit3 size={14} />
                  <span>{isEditing ? 'Close Manage' : 'Manage Guidelines'}</span>
                </button>
              </>
            )}
          </div>

          {/* Creator Edit Form or Description */}
          {isEditing ? (
            <form onSubmit={handleSaveEdit} style={{ textAlign: 'left', background: 'rgba(20,20,19,0.03)', padding: 24, borderRadius: 14, maxWidth: 640, margin: '0 auto 20px auto' }}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Community Guidelines (one per line)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={editRules}
                  onChange={(e) => setEditRules(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn-black-pill" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Updates'}
                </button>
                <button type="button" className="crowd-pill-btn" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p className="editorial-faq-desc" style={{ maxWidth: 640, margin: '0 auto' }}>
              {community.description}
            </p>
          )}

          {/* Guidelines */}
          {community.rules && community.rules.length > 0 && !isEditing && (
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid rgba(0,0,0,0.06)', maxWidth: 560, margin: '24px auto 0 auto', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <Shield size={12} />
                <span>Sphere Guidelines</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.875rem', color: '#52525B', lineHeight: 1.6 }}>
                {community.rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Section Grid Divider */}
      {/* ====================================================================
          2. Discussions Feed
          ==================================================================== */}
      <section className="crowd-posts-stream" aria-label="Community Discussions">
        {!community.isMember ? (
          <div className="editorial-faq-frame crowd-empty-frame" style={{ textAlign: 'center', padding: '64px 28px' }}>
            <div className="crowd-empty-inner">
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  background: '#F4F4F5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  border: '1px solid var(--border-light)'
                }}
              >
                <Lock size={26} style={{ color: '#141413' }} />
              </div>
              <span className="manifesto-pill">Members Only Sanctuary</span>
              <h3 className="crowd-empty-title" style={{ marginTop: 12, fontSize: '1.6rem' }}>
                Join c/{community.name} to View & Post
              </h3>
              <p className="crowd-empty-desc" style={{ maxWidth: 520, margin: '10px auto 26px auto', lineHeight: 1.6 }}>
                Questions, suggestions, comments, and replies in this community are reserved exclusively for joined members. Join this sphere to see the discussions and post your own questions.
              </p>
              <button
                type="button"
                className="btn-black-pill"
                onClick={handleJoin}
                style={{ padding: '12px 28px', fontSize: '0.95rem' }}
              >
                <Plus size={16} />
                <span>Join Community</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="editorial-faq-frame crowd-empty-frame">
            <div className="crowd-empty-inner">
              <span className="manifesto-pill">Open Discussion</span>
              <h3 className="crowd-empty-title">No questions in this sphere yet.</h3>
              <p className="crowd-empty-desc">
                Be the first to ask or share an experience within this circle.
              </p>
              <button
                type="button"
                className="btn-black-pill"
                onClick={() => setIsAskModalOpen(true)}
              >
                <Plus size={16} />
                <span>Ask the First Question</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="crowd-posts-grid">
            {posts.map((post) => (
              <div key={post.id} style={{ position: 'relative' }}>
                <PostCard
                  post={{
                    ...post,
                    canDelete: community.isCreator || post.isOwnPost,
                    isCommunityOwner: community.isCreator
                  }}
                  onDeletePost={handleRemovePost}
                  onReport={(targetType, targetId, title) =>
                    setReportState({ isOpen: true, targetType, targetId, targetTitle: title })
                  }
                  onConnectRequest={(authorId, username, postId) =>
                    setConnectState({ isOpen: true, targetIdentityId: authorId, targetUsername: username, relatedPostId: postId })
                  }
                />
                {community.isCreator && (
                  <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
                    <button
                      type="button"
                      className="crowd-btn-report"
                      onClick={() => handleRemovePost(post.id)}
                      title="Remove post from this community"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance">
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A' }}>
          ANON SPHERE • PEER CREATED & ENCRYPTED • EPHEMERAL
        </p>
      </section>

      {/* Community Members Modal (Owner Only) */}
      {isMembersModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" onClick={() => setIsMembersModalOpen(false)} role="dialog" aria-modal="true">
          <div
            className="modal-dialog crowd-card modal-center-pop"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 560,
              background: '#FFFFFF',
              borderRadius: 20,
              boxShadow: '0 25px 60px -15px rgba(0,0,0,0.35)',
              border: '1px solid #141413',
              position: 'relative',
              margin: 'auto',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column'
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
              onClick={() => setIsMembersModalOpen(false)}
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#71717A',
                padding: 4
              }}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: '#F4F4F5',
                  color: '#141413',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Users size={18} />
              </div>
              <div>
                <span className="mono-subtle" style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.06em' }}>
                  COMMUNITY ROSTER // c/{community.name}
                </span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', margin: 0, color: '#141413' }}>
                  Joined Anonymous Members
                </h3>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', lineHeight: 1.5, color: '#52525B', marginBottom: 14 }}>
              As community creator, you can see all anonymous pseudonyms holding membership in your sphere ({members.length} members).
            </p>

            {membersError && (
              <div className="alert-banner alert-warning" style={{ marginBottom: 12 }}>
                {membersError}
              </div>
            )}

            {/* Scrollable Members List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingRight: 4,
                marginBottom: 16
              }}
            >
              {loadingMembers ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#71717A' }}>
                  <span className="mono-subtle">LOADING SPHERE MEMBERS...</span>
                </div>
              ) : members.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#71717A' }}>
                  <p style={{ fontSize: '0.9rem' }}>No members found in this sphere yet.</p>
                </div>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: '#F9FAFB',
                      borderRadius: 12,
                      border: '1px solid var(--border-light)',
                      gap: 12,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span
                        className="identity-dot"
                        style={{
                          width: 8,
                          height: 8,
                          background: member.role === 'creator' ? '#DC2626' : '#141413',
                          flexShrink: 0
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              fontSize: '0.95rem',
                              color: '#141413'
                            }}
                          >
                            {member.username}
                          </span>
                          {member.role === 'creator' ? (
                            <span
                              className="crowd-tag-pill highlight"
                              style={{
                                fontSize: '0.68rem',
                                padding: '2px 8px',
                                background: '#FEE2E2',
                                color: '#DC2626',
                                borderColor: '#FCA5A5'
                              }}
                            >
                              <Crown size={10} style={{ marginRight: 3 }} />
                              Sphere Creator
                            </span>
                          ) : (
                            <span
                              className="crowd-tag-pill"
                              style={{ fontSize: '0.68rem', padding: '2px 8px' }}
                            >
                              Member
                            </span>
                          )}
                          {member.identityId === identity?.id && (
                            <span className="crowd-you-tag" style={{ fontSize: '0.72rem' }}>(you)</span>
                          )}
                        </div>
                        {member.joinedAt && (
                          <span className="crowd-card-time" style={{ fontSize: '0.72rem', display: 'block', marginTop: 2 }}>
                            Joined {new Date(member.joinedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {member.identityId !== identity?.id && (
                      <button
                        type="button"
                        className="crowd-connect-btn"
                        onClick={() => {
                          setIsMembersModalOpen(false);
                          setConnectState({
                            isOpen: true,
                            targetIdentityId: member.identityId,
                            targetUsername: member.username,
                            relatedPostId: ''
                          });
                        }}
                        title="Send private connection request"
                      >
                        <UserPlus size={11} />
                        <span>Connect</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
              <button
                type="button"
                className="crowd-pill-btn"
                onClick={() => setIsMembersModalOpen(false)}
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modals */}
      <AskQuestionModal
        isOpen={isAskModalOpen}
        communityId={community.id}
        communityName={community.name}
        communityTopic={community.topic}
        onClose={() => setIsAskModalOpen(false)}
        onSuccess={(newPost) => setPosts([newPost, ...posts])}
      />

      <ReportModal
        isOpen={reportState.isOpen}
        targetType={reportState.targetType}
        targetId={reportState.targetId}
        targetTitle={reportState.targetTitle}
        onClose={() => setReportState({ isOpen: false, targetType: '', targetId: '', targetTitle: '' })}
      />

      <ConnectModal
        isOpen={connectState.isOpen}
        targetIdentityId={connectState.targetIdentityId}
        targetUsername={connectState.targetUsername}
        relatedPostId={connectState.relatedPostId}
        onClose={() => setConnectState({ isOpen: false, targetIdentityId: '', targetUsername: '', relatedPostId: '' })}
      />
    </div>
  );
}

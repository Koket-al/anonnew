import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { getPosts, deletePost } from '../services/api.js';
import PostCard from '../components/PostCard.jsx';
import AskQuestionModal from '../components/AskQuestionModal.jsx';
import ReportModal from '../components/ReportModal.jsx';
import ConnectModal from '../components/ConnectModal.jsx';
import {
  Search,
  Plus,
  HeartHandshake,
  Shield,
  Lock,
  ArrowRight,
  MessageSquare,
  Sparkles,
  Users,
  X
} from 'lucide-react';

const CATEGORIES = [
  'All',
  'Mental Well-being',
  'Relationships',
  'Family',
  'School & Career',
  'Sexual Health',
  'General Health'
];

export default function AskTheCrowdPage() {
  const { isAuthenticated, openCreateModal } = useAuth();
  const { socket, showConfirm, showToast } = useRealtime();
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState('All');
  const [filter, setFilter] = useState('all'); // 'all' or 'been_through_this'
  const [sort, setSort] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [reportState, setReportState] = useState({ isOpen: false, targetType: '', targetId: '', targetTitle: '' });
  const [connectState, setConnectState] = useState({ isOpen: false, targetIdentityId: '', targetUsername: '', relatedPostId: '' });

  useEffect(() => {
    loadPosts();
  }, [category, filter, sort]);

  // Real-time socket updates for posts stream
  useEffect(() => {
    if (!socket) return;

    socket.emit('join_stream');

    const handleNewPost = (newPost) => {
      setPosts((prev) => {
        if (prev.some((p) => p.id === newPost.id)) return prev;
        if (category !== 'All' && newPost.category !== category) return prev;
        return [newPost, ...prev];
      });
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
    };

    socket.on('new_post', handleNewPost);
    socket.on('post_updated', handlePostUpdated);
    socket.on('post_reaction_updated', handleReactionUpdated);
    socket.on('post_deleted', handlePostDeleted);

    return () => {
      socket.emit('leave_stream');
      socket.off('new_post', handleNewPost);
      socket.off('post_updated', handlePostUpdated);
      socket.off('post_reaction_updated', handleReactionUpdated);
      socket.off('post_deleted', handlePostDeleted);
    };
  }, [socket, category]);

  async function loadPosts() {
    try {
      setLoading(true);
      const res = await getPosts({
        category: category !== 'All' ? category : undefined,
        filter,
        sort,
        limit: 50
      });
      if (res.posts) setPosts(res.posts);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePost(postId) {
    const confirmed = await showConfirm({
      title: 'Delete Question?',
      message: 'This will permanently remove the question and all its replies from the platform.',
      confirmText: 'Delete Question',
      isDanger: true
    });

    if (!confirmed) return;

    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      showToast({ type: 'info', message: 'Question deleted successfully.' });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to delete question.' });
    }
  }

  function handleAskClick() {
    if (!isAuthenticated) {
      openCreateModal({
        reason: 'Please create an anonymous identity before asking a question.',
        onSuccess: () => setIsAskModalOpen(true)
      });
    } else {
      setIsAskModalOpen(true);
    }
  }

  // Client-side search filtering by keyword
  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(p =>
      p.title?.toLowerCase().includes(q) ||
      p.content?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.community?.name?.toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  return (
    <div className="home-page-container crowd-page-container">
      {/* Continuous 1px Vertical Architectural Grid Guide Lines */}
      <div className="page-vertical-line left" aria-hidden="true" />
      <div className="page-vertical-line right" aria-hidden="true" />

      {/* ====================================================================
          1. Editorial Hero Banner (Framed with Vintage Floral Corners)
          ==================================================================== */}
      <section className="editorial-faq-frame crowd-hero-frame" aria-label="Discussions Sanctuary">
        {/* Large Vintage Floral Corner Ornaments ('flower.png') like home page */}
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="crowd-hero-content">
          <div className="editorial-faq-header" style={{ marginBottom: 26 }}>
            <div className="hero-brand-crest-wrap">
              <img src="/anonlogo_dark.png" alt="ANON" className="hero-page-logo" />
            </div>
            <span className="manifesto-pill">Sanctuary // Peer Collective</span>
            <h1 className="editorial-faq-title" style={{ fontSize: 'clamp(2.2rem, 4.2vw, 3.1rem)' }}>
              Ask the Crowd
            </h1>
            <p className="secure-comm-expressive" style={{ margin: '8px auto 14px auto', fontSize: '1.2rem' }}>
              “Speak your honest questions into a room that understands.”
            </p>
            <p className="editorial-faq-desc" style={{ maxWidth: 640 }}>
              An encrypted, judgment-free space to ask what hurts, wonder what is normal, and receive grounded answers from peers who have walked through the same path.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <button
              type="button"
              className="btn-black-pill"
              onClick={handleAskClick}
            >
              <Plus size={16} />
              <span>Ask an Anonymous Question</span>
              <ArrowRight size={15} />
            </button>
          </div>

          {/* Three Assurance Badges */}
          <div className="crowd-hero-badges-row">
            <div className="crowd-assurance-item">
              <Shield size={14} className="crowd-assurance-icon" />
              <span>100% Cryptographic Anonymity</span>
            </div>
            <div className="crowd-assurance-item">
              <HeartHandshake size={14} className="crowd-assurance-icon" />
              <span>Verified Shared Experiences</span>
            </div>
            <div className="crowd-assurance-item">
              <Lock size={14} className="crowd-assurance-icon" />
              <span>Zero Tracking · No Sign-Up</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. Category Selection & Controls Bar
          ==================================================================== */}
      <section className="crowd-controls-section" aria-label="Topic Filter and Search">
        {/* Category Tabs */}
        <div className="crowd-categories-wrapper">
          <div className="crowd-categories-scroll">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`crowd-cat-pill ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat === 'All' ? 'All Topics' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Search, Filter & Sort Controls */}
        <div className="crowd-filter-bar">
          <div className="crowd-filter-left">
            {/* Search Input */}
            <div className="crowd-search-box">
              <Search size={15} className="crowd-search-icon" />
              <input
                type="text"
                className="crowd-search-input"
                placeholder="Search questions or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="crowd-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Shared Experiences Toggle */}
            <button
              type="button"
              className={`crowd-pill-btn ${filter === 'been_through_this' ? 'active' : ''}`}
              onClick={() => setFilter(filter === 'been_through_this' ? 'all' : 'been_through_this')}
              title="Show only questions asking for lived experience"
            >
              <HeartHandshake size={15} />
              <span>Shared Experiences {filter === 'been_through_this' ? '• Active' : ''}</span>
            </button>
          </div>

          {/* Sort Selector */}
          <div className="crowd-filter-right">
            <span className="crowd-sort-label">SORT //</span>
            <select
              className="crowd-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">Most Recent</option>
              <option value="active">Active Activity</option>
            </select>
          </div>
        </div>
      </section>

      {/* ====================================================================
          3. Posts Stream List
          ==================================================================== */}
      <main className="crowd-posts-stream" aria-label="Questions list">
        {loading ? (
          <div className="editorial-faq-frame crowd-empty-frame" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <span className="mono-subtle" style={{ display: 'block', marginBottom: 12 }}>LOADING ARCHIVE...</span>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--text-main)' }}>
              Retrieving community questions...
            </h3>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="editorial-faq-frame crowd-empty-frame">
            <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" style={{ width: '5.5rem' }} />
            <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" style={{ width: '5.5rem' }} />
            <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" style={{ width: '5.5rem' }} />
            <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" style={{ width: '5.5rem' }} />

            <div className="crowd-empty-inner">
              <span className="manifesto-pill">Sanctuary Circle</span>
              <h3 className="crowd-empty-title">
                No questions found in this circle.
              </h3>
              <p className="crowd-empty-desc">
                {searchQuery
                  ? `No questions matched "${searchQuery}". Try a different keyword or reset filters.`
                  : 'Be the first voice to open this circle. Whatever is on your mind, you are safe to ask.'}
              </p>
              <button type="button" className="btn-black-pill" onClick={handleAskClick}>
                <Plus size={16} />
                <span>Ask the First Question</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="crowd-posts-grid">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDeletePost={handleDeletePost}
                onReport={(targetType, targetId, title) =>
                  setReportState({ isOpen: true, targetType, targetId, targetTitle: title })
                }
                onConnectRequest={(authorId, username, postId) => {
                  if (!isAuthenticated) {
                    openCreateModal({
                      reason: 'Please create an anonymous identity to send connection requests.',
                      onSuccess: () => setConnectState({ isOpen: true, targetIdentityId: authorId, targetUsername: username, relatedPostId: postId })
                    });
                  } else {
                    setConnectState({ isOpen: true, targetIdentityId: authorId, targetUsername: username, relatedPostId: postId });
                  }
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance">
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A' }}>
          ANON CROWD DISCUSSIONS • EPHEMERAL PEER NETWORK • ALL DATA ENCRYPTED
        </p>
      </section>

      {/* Modals */}
      <AskQuestionModal
        isOpen={isAskModalOpen}
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

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import {
  getPost,
  createReply,
  toggleBeenThroughThis,
  updatePost,
  deletePost,
  updateReply,
  deleteReply,
  joinCommunity
} from '../services/api.js';
import ReportModal from '../components/ReportModal.jsx';
import ConnectModal from '../components/ConnectModal.jsx';
import {
  ArrowLeft,
  HeartHandshake,
  ShieldAlert,
  Send,
  MessageSquare,
  Clock,
  UserPlus,
  CheckCircle2,
  Lock,
  Shield,
  Trash2,
  Plus,
  Pencil
} from 'lucide-react';

export default function PostDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { identity, isAuthenticated, openCreateModal } = useAuth();
  const { socket, showConfirm, showToast } = useRealtime();

  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [membershipRequired, setMembershipRequired] = useState(null);

  // Reply form state
  const [replyContent, setReplyContent] = useState('');
  const [isExperienceShare, setIsExperienceShare] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [marked, setMarked] = useState(false);
  const [count, setCount] = useState(0);

  // Post Editing state
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostTitle, setEditPostTitle] = useState('');
  const [editPostContent, setEditPostContent] = useState('');
  const [savingPostEdit, setSavingPostEdit] = useState(false);

  // Reply Editing state
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editReplyContent, setEditReplyContent] = useState('');
  const [savingReplyEdit, setSavingReplyEdit] = useState(false);

  // Modals
  const [reportState, setReportState] = useState({ isOpen: false, targetType: '', targetId: '', targetTitle: '' });
  const [connectState, setConnectState] = useState({ isOpen: false, targetIdentityId: '', targetUsername: '', relatedPostId: '' });

  useEffect(() => {
    loadPostData();
  }, [id]);

  // Real-time socket updates for replies, reactions, and deletions
  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('join_post', { postId: id });

    const handleNewReply = (newReply) => {
      setReplies((prev) => {
        if (prev.some((r) => r.id === newReply.id)) return prev;
        const currentUserId = identity?._id?.toString() || identity?.id?.toString();
        const isOwnReply = currentUserId && newReply.authorId?.toString() === currentUserId;
        return [...prev, { ...newReply, isOwnReply }];
      });
      setPost((prev) => (prev ? { ...prev, replyCount: (prev.replyCount || 0) + 1 } : prev));
    };

    const handleReplyDeleted = (data) => {
      setReplies((prev) => prev.filter((r) => r.id !== data.replyId));
      setPost((prev) => (prev ? { ...prev, replyCount: data.replyCount } : prev));
    };

    const handleReactionUpdated = (data) => {
      setCount(data.beenThroughThisCount);
      const currentUserId = identity?._id?.toString() || identity?.id?.toString();
      if (currentUserId && data.userId === currentUserId) {
        setMarked(data.hasMarkedBeenThroughThis);
      }
    };

    const handlePostDeleted = (data) => {
      if (data.postId === id) {
        showToast({ type: 'warning', title: 'Question Removed', message: 'This discussion was removed.' });
        navigate('/crowd', { replace: true });
      }
    };

    const handlePostEdited = (data) => {
      if (data.postId === id) {
        setPost((prev) => (prev ? {
          ...prev,
          title: data.title !== undefined ? data.title : prev.title,
          content: data.content !== undefined ? data.content : prev.content,
          isEdited: true,
          editedAt: data.editedAt
        } : prev));
      }
    };

    const handleReplyEdited = (data) => {
      setReplies((prev) =>
        prev.map((r) =>
          r.id === data.replyId
            ? { ...r, content: data.content, isEdited: true, editedAt: data.editedAt }
            : r
        )
      );
    };

    socket.on('new_reply', handleNewReply);
    socket.on('reply_deleted', handleReplyDeleted);
    socket.on('reply_edited', handleReplyEdited);
    socket.on('post_reaction_updated', handleReactionUpdated);
    socket.on('post_deleted', handlePostDeleted);
    socket.on('post_edited', handlePostEdited);

    return () => {
      socket.emit('leave_post', { postId: id });
      socket.off('new_reply', handleNewReply);
      socket.off('reply_deleted', handleReplyDeleted);
      socket.off('reply_edited', handleReplyEdited);
      socket.off('post_reaction_updated', handleReactionUpdated);
      socket.off('post_deleted', handlePostDeleted);
      socket.off('post_edited', handlePostEdited);
    };
  }, [socket, id, identity?.id || identity?._id]);

  async function loadPostData() {
    try {
      setLoading(true);
      setError(null);
      setMembershipRequired(null);
      const res = await getPost(id);
      if (res.post) {
        setPost(res.post);
        setMarked(res.post.hasMarkedBeenThroughThis);
        setCount(res.post.beenThroughThisCount || 0);
        setReplies(res.replies || []);
      }
    } catch (err) {
      if (err.status === 403 && err.data?.requiresMembership) {
        setMembershipRequired({
          community: err.data.community,
          message: err.message
        });
      } else {
        setError(err.message || 'Failed to load post.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinFromPost() {
    const targetCommunityId = membershipRequired?.community?.id || post?.community?.id;
    if (!targetCommunityId) return;

    if (!isAuthenticated) {
      openCreateModal({
        reason: 'Please create an anonymous identity before joining this community.',
        onSuccess: async () => {
          try {
            await joinCommunity(targetCommunityId);
            setMembershipRequired(null);
            showToast({ type: 'success', message: 'Joined community successfully!' });
            await loadPostData();
          } catch (joinErr) {
            showToast({ type: 'error', message: joinErr.message || 'Failed to join community.' });
          }
        }
      });
      return;
    }

    try {
      await joinCommunity(targetCommunityId);
      setMembershipRequired(null);
      showToast({ type: 'success', message: 'Joined community successfully!' });
      await loadPostData();
    } catch (joinErr) {
      showToast({ type: 'error', message: joinErr.message || 'Failed to join community.' });
    }
  }

  async function handleToggleBeenThroughThis() {
    if (post?.community && !post.community.isMember) {
      showToast({ type: 'warning', message: `You must join c/${post.community.name} to participate.` });
      return;
    }

    try {
      const res = await toggleBeenThroughThis(post.id);
      if (res.success) {
        setMarked(res.hasMarkedBeenThroughThis);
        setCount(res.beenThroughThisCount);
      }
    } catch (err) {
      showToast({ type: 'warning', message: err.message || 'Please create an identity first.' });
    }
  }

  async function handleReplySubmit(e) {
    e.preventDefault();
    if (!replyContent.trim()) return;

    if (post?.community && !post.community.isMember) {
      showToast({ type: 'warning', message: `You must join c/${post.community.name} before replying or commenting.` });
      return;
    }

    if (!isAuthenticated) {
      openCreateModal({
        reason: 'Please create an anonymous identity before posting your reply.'
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createReply(id, {
        content: replyContent,
        isExperienceShare
      });

      if (res.success && res.reply) {
        setReplies((prev) => (prev.some((r) => r.id === res.reply.id) ? prev : [...prev, res.reply]));
        setReplyContent('');
        setIsExperienceShare(false);
        showToast({ type: 'success', message: 'Reply posted.' });
      }
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to send reply.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeletePost() {
    const isOwnerAction = post.isCommunityOwner && !post.isOwnPost;
    const confirmPrompt = isOwnerAction
      ? 'Delete this question and all its replies from your community? This action cannot be undone.'
      : 'Delete this question and all its replies? This action cannot be undone.';

    const confirmed = await showConfirm({
      title: 'Delete Question?',
      message: confirmPrompt,
      confirmText: 'Delete Question',
      isDanger: true
    });

    if (!confirmed) return;

    try {
      await deletePost(post.id);
      showToast({ type: 'info', message: 'Question deleted successfully.' });
      if (post.community) {
        navigate(`/communities/${post.community.slug || post.community.id}`);
      } else {
        navigate('/crowd');
      }
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to delete question.' });
    }
  }

  async function handleDeleteReply(replyId) {
    const targetReply = replies.find(r => r.id === replyId);
    const isOwnerAction = post.isCommunityOwner && (!targetReply || !targetReply.isOwnReply);
    const confirmPrompt = isOwnerAction
      ? 'Delete this message from your community?'
      : 'Delete your reply?';

    const confirmed = await showConfirm({
      title: 'Delete Reply?',
      message: confirmPrompt,
      confirmText: 'Delete Reply',
      isDanger: true
    });

    if (!confirmed) return;

    try {
      await deleteReply(replyId);
      setReplies(prev => prev.filter(r => r.id !== replyId));
      showToast({ type: 'info', message: 'Reply deleted.' });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to delete reply.' });
    }
  }

  function startEditingPost() {
    setIsEditingPost(true);
    setEditPostTitle(post.title);
    setEditPostContent(post.content);
  }

  function cancelEditingPost() {
    setIsEditingPost(false);
    setEditPostTitle('');
    setEditPostContent('');
  }

  async function handleSavePostEdit() {
    if (!editPostTitle.trim() || !editPostContent.trim()) {
      showToast({ type: 'warning', message: 'Title and content cannot be empty.' });
      return;
    }

    setSavingPostEdit(true);
    try {
      const res = await updatePost(id, {
        title: editPostTitle.trim(),
        content: editPostContent.trim()
      });
      if (res && res.post) {
        setPost((prev) => ({
          ...prev,
          title: res.post.title,
          content: res.post.content,
          isEdited: true,
          editedAt: res.post.editedAt
        }));
      }
      setIsEditingPost(false);
      showToast({ type: 'success', message: 'Question updated successfully.' });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to update question.' });
    } finally {
      setSavingPostEdit(false);
    }
  }

  function startEditingReply(reply) {
    setEditingReplyId(reply.id);
    setEditReplyContent(reply.content);
  }

  function cancelEditingReply() {
    setEditingReplyId(null);
    setEditReplyContent('');
  }

  async function handleSaveReplyEdit(replyId) {
    if (!editReplyContent.trim()) {
      showToast({ type: 'warning', message: 'Reply cannot be empty.' });
      return;
    }

    setSavingReplyEdit(true);
    try {
      const res = await updateReply(replyId, { content: editReplyContent.trim() });
      if (res && res.reply) {
        setReplies((prev) =>
          prev.map((r) =>
            r.id === replyId
              ? { ...r, content: res.reply.content, isEdited: true, editedAt: res.reply.editedAt }
              : r
          )
        );
      }
      setEditingReplyId(null);
      setEditReplyContent('');
      showToast({ type: 'success', message: 'Reply updated successfully.' });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to update reply.' });
    } finally {
      setSavingReplyEdit(false);
    }
  }

  if (loading) {
    return (
      <div className="home-page-container crowd-page-container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <span className="mono-subtle" style={{ display: 'block', marginBottom: 12 }}>LOADING QUESTION...</span>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>
          Opening discussion archive...
        </h3>
      </div>
    );
  }

  if (membershipRequired) {
    return (
      <div className="home-page-container crowd-page-container" style={{ padding: '60px 24px' }}>
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
            <span className="manifesto-pill">Members Only Discussion</span>
            <h3 className="crowd-empty-title" style={{ marginTop: 12, fontSize: '1.6rem' }}>
              Join c/{membershipRequired.community?.name || 'Sphere'} to View & Reply
            </h3>
            <p className="crowd-empty-desc" style={{ maxWidth: 520, margin: '10px auto 26px auto', lineHeight: 1.6 }}>
              Questions, suggestions, comments, and replies in this community are reserved exclusively for members. Join this sphere to unlock the discussion and post your response.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-black-pill"
                onClick={handleJoinFromPost}
                style={{ padding: '12px 28px', fontSize: '0.95rem' }}
              >
                <Plus size={16} />
                <span>Join c/{membershipRequired.community?.name || 'Sphere'} & Unlock</span>
              </button>
              <Link
                to={`/communities/${membershipRequired.community?.slug || membershipRequired.community?.id}`}
                className="crowd-pill-btn"
                style={{ textDecoration: 'none', padding: '12px 24px', fontSize: '0.95rem', background: '#FFFFFF' }}
              >
                <span>Visit Community Sphere</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="home-page-container crowd-page-container" style={{ padding: '60px 24px' }}>
        <div className="editorial-faq-frame crowd-empty-frame">
          <div className="crowd-empty-inner">
            <span className="manifesto-pill">Archive Notice</span>
            <h3 className="crowd-empty-title">{error || 'Question not found.'}</h3>
            <p className="crowd-empty-desc">This discussion may have been removed or does not exist.</p>
            <Link to="/crowd" className="btn-black-pill">
              <ArrowLeft size={15} />
              <span>Return to Discussions</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(post.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="home-page-container crowd-page-container">
      {/* Continuous 1px Vertical Architectural Grid Guide Lines */}
      <div className="page-vertical-line left" aria-hidden="true" />
      <div className="page-vertical-line right" aria-hidden="true" />

      {/* Back button */}
      <div style={{ marginBottom: 16 }}>
        <Link to="/crowd" className="crowd-pill-btn" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={14} />
          <span>Back to Discussions</span>
        </Link>
      </div>

      {/* ====================================================================
          1. Main Post Detailed Card (Archival Editorial Frame)
          ==================================================================== */}
      <article className="crowd-card crowd-detail-card" tabIndex="0">
        <div className="corner-cross tl" aria-hidden="true" />
        <div className="corner-cross tr" aria-hidden="true" />
        <div className="corner-cross bl" aria-hidden="true" />
        <div className="corner-cross br" aria-hidden="true" />

        <div className="crowd-card-header">
          <div className="crowd-card-tags">
            <span className="crowd-tag-pill">{post.category || 'General'}</span>
            {post.community && (
              <Link
                to={`/communities/${post.community.slug || post.community.id}`}
                className="crowd-tag-pill community"
              >
                c/{post.community.name}
              </Link>
            )}
            {post.hasBeenThroughThis && (
              <span className="crowd-tag-pill highlight">
                <HeartHandshake size={12} />
                <span>Shared Experience Request</span>
              </span>
            )}
          </div>

          <div className="crowd-card-time">
            <Clock size={12} />
            <span>{formattedDate}</span>
            {post.isEdited && (
              <span className="mono-subtle" style={{ fontSize: '0.7rem', color: '#71717A', fontStyle: 'italic', marginLeft: 4 }}>
                (edited)
              </span>
            )}
          </div>
        </div>

        {isEditingPost ? (
          <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="mono-subtle" style={{ display: 'block', marginBottom: 4, color: '#71717A' }}>TITLE</label>
              <input
                type="text"
                className="form-input"
                value={editPostTitle}
                onChange={(e) => setEditPostTitle(e.target.value)}
                maxLength={200}
                style={{ width: '100%', fontSize: '1.25rem', fontWeight: 600 }}
              />
            </div>
            <div>
              <label className="mono-subtle" style={{ display: 'block', marginBottom: 4, color: '#71717A' }}>CONTENT</label>
              <textarea
                className="form-input"
                value={editPostContent}
                onChange={(e) => setEditPostContent(e.target.value)}
                rows={6}
                maxLength={5000}
                style={{ width: '100%', fontSize: '1rem', lineHeight: 1.6 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="crowd-pill-btn"
                onClick={cancelEditingPost}
                disabled={savingPostEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-black-pill"
                onClick={handleSavePostEdit}
                disabled={savingPostEdit || !editPostTitle.trim() || !editPostContent.trim()}
              >
                {savingPostEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="crowd-card-title" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.1rem)', marginBottom: 18 }}>
              {post.title}
            </h1>

            <div className="crowd-detail-body" style={{ fontSize: '1.025rem', lineHeight: 1.75, color: '#27272A', marginBottom: 28, whiteSpace: 'pre-line' }}>
              {post.content}
            </div>
          </>
        )}

        <div className="crowd-card-footer">
          <div className="crowd-card-author-section">
            <div className="crowd-author-badge">
              <span className="identity-dot" aria-hidden="true" />
              <span className="crowd-author-name">{post.author?.username || 'Anonymous'}</span>
              {post.author?.isRemoved && (
                <span
                  className="crowd-tag-pill"
                  style={{ fontSize: '0.65rem', padding: '1px 7px', background: '#F4F4F5', color: '#71717A', border: '1px solid #E4E4E7' }}
                >
                  Identity Removed
                </span>
              )}
              {post.isOwnPost ? (
                <span className="crowd-you-tag">(you)</span>
              ) : post.canConnect && post.authorId && !post.author?.isRemoved && !post.author?.isInactive ? (
                <button
                  type="button"
                  className="crowd-connect-btn"
                  onClick={() =>
                    setConnectState({
                      isOpen: true,
                      targetIdentityId: post.authorId,
                      targetUsername: post.author?.username,
                      relatedPostId: post.id
                    })
                  }
                  title="Send a private conversation request"
                >
                  <UserPlus size={11} />
                  <span>Connect Privately</span>
                </button>
              ) : null}
            </div>

            <div className="crowd-replies-link">
              <MessageSquare size={13} />
              <span>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
            </div>
          </div>

          <div className="crowd-card-actions">
            {post.isOwnPost && !isEditingPost && (
              <button
                type="button"
                className="crowd-pill-btn"
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={startEditingPost}
                title="Edit your question"
              >
                <Pencil size={13} />
                <span>Edit</span>
              </button>
            )}

            {(post.isOwnPost || post.canDelete || post.isCommunityOwner) && (
              <button
                type="button"
                className="crowd-pill-btn"
                style={{ color: '#DC2626', borderColor: '#FCA5A5', padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={handleDeletePost}
                title={post.isCommunityOwner && !post.isOwnPost ? "Delete question as community owner" : "Delete your question"}
              >
                <Trash2 size={13} />
                <span>{post.isCommunityOwner && !post.isOwnPost ? "Delete as Owner" : "Delete Question"}</span>
              </button>
            )}

            {post.hasBeenThroughThis && (
              <button
                type="button"
                className={`crowd-btn-been-through ${marked ? 'active' : ''}`}
                onClick={handleToggleBeenThroughThis}
                title="Click if you have lived through this"
              >
                <HeartHandshake size={14} />
                <span>I've been through this ({count})</span>
              </button>
            )}

            <button
              type="button"
              className="crowd-btn-report"
              onClick={() =>
                setReportState({
                  isOpen: true,
                  targetType: 'post',
                  targetId: post.id,
                  targetTitle: post.title
                })
              }
              title="Report question"
            >
              <ShieldAlert size={14} />
            </button>
          </div>
        </div>
      </article>

      {/* ====================================================================
          2. Reply Composer
          ==================================================================== */}
      <section className="crowd-reply-composer-frame" style={{ marginBottom: 28 }}>
        {post.community && !post.community.isMember ? (
          <div className="crowd-card" style={{ padding: '28px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#F4F4F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}
            >
              <Lock size={20} style={{ color: '#141413' }} />
            </div>
            <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginBottom: 6 }}>
              Members Only Discussion
            </h4>
            <p style={{ fontSize: '0.875rem', color: '#52525B', maxWidth: 460, margin: '0 auto 16px auto', lineHeight: 1.5 }}>
              You must join c/{post.community.name} before you can write comments or replies to this question.
            </p>
            <button
              type="button"
              className="btn-black-pill"
              onClick={handleJoinFromPost}
              style={{ padding: '8px 22px', fontSize: '0.85rem' }}
            >
              <Plus size={14} />
              <span>Join c/{post.community.name} to Reply</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleReplySubmit} className="crowd-card" style={{ padding: '24px 28px' }}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                Add a Supportive Reply
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Share advice, lived experience, or words of gentle support..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                required
                maxLength={2500}
                style={{ borderRadius: 12, padding: '12px 14px', fontSize: '0.925rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <label className="checkbox-label" style={{ fontSize: '0.825rem', color: '#52525B', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isExperienceShare}
                  onChange={(e) => setIsExperienceShare(e.target.checked)}
                  style={{ accentColor: '#141413' }}
                />
                <span>I am speaking from personal firsthand experience</span>
              </label>

              <button
                type="submit"
                className="btn-black-pill"
                disabled={isSubmitting || !replyContent.trim()}
                style={{ padding: '8px 20px', fontSize: '0.825rem' }}
              >
                <Send size={13} />
                <span>{isSubmitting ? 'Posting...' : 'Post Reply'}</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ====================================================================
          3. Replies List Stream
          ==================================================================== */}
      <section className="crowd-replies-stream">
        {replies.length === 0 ? (
          <div className="editorial-faq-frame crowd-empty-frame" style={{ padding: '48px 24px' }}>
            <span className="mono-subtle" style={{ display: 'block', marginBottom: 10 }}>EMPTY CIRCLE</span>
            <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: '#141413', margin: '0 0 6px 0' }}>
              No replies yet.
            </h4>
            <p className="crowd-empty-desc" style={{ maxWidth: 440, margin: '0 auto' }}>
              Be the first voice to offer understanding and comfort.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {replies.map((reply) => {
              const rDate = new Date(reply.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <article key={reply.id} className="crowd-card" style={{ padding: '22px 26px' }}>
                  <div className="crowd-card-header" style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div className="crowd-author-badge">
                        <span className="identity-dot" aria-hidden="true" />
                        <span className="crowd-author-name">{reply.author?.username || 'Anonymous'}</span>
                        {reply.author?.isRemoved && (
                          <span
                            className="crowd-tag-pill"
                            style={{ fontSize: '0.65rem', padding: '1px 7px', background: '#F4F4F5', color: '#71717A', border: '1px solid #E4E4E7' }}
                          >
                            Identity Removed
                          </span>
                        )}
                      </div>
                      {reply.isOwnReply && <span className="crowd-you-tag">(you)</span>}
                      {reply.isExperienceShare && (
                        <span className="crowd-tag-pill highlight">
                          <CheckCircle2 size={11} />
                          <span>Shared Firsthand Experience</span>
                        </span>
                      )}
                      <span className="crowd-card-time">&bull; {rDate}</span>
                      {reply.isEdited && (
                        <span className="mono-subtle" style={{ fontSize: '0.68rem', color: '#71717A', fontStyle: 'italic', marginLeft: 4 }}>
                          (edited)
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {reply.isOwnReply && editingReplyId !== reply.id && (
                        <button
                          type="button"
                          className="crowd-pill-btn"
                          style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                          onClick={() => startEditingReply(reply)}
                          title="Edit your reply"
                        >
                          <Pencil size={11} />
                          <span>Edit</span>
                        </button>
                      )}
                      {(reply.isOwnReply || reply.canDelete || post.isCommunityOwner) && (
                        <button
                          type="button"
                          className="crowd-pill-btn"
                          style={{ color: '#DC2626', borderColor: '#FCA5A5', padding: '2px 8px', fontSize: '0.72rem' }}
                          onClick={() => handleDeleteReply(reply.id)}
                          title={post.isCommunityOwner && !reply.isOwnReply ? "Delete message as community owner" : "Delete your reply"}
                        >
                          <Trash2 size={11} />
                          <span>Delete</span>
                        </button>
                      )}
                      {!reply.isOwnReply && reply.canConnect && reply.authorId && !reply.author?.isRemoved && !reply.author?.isInactive && (
                        <button
                          type="button"
                          className="crowd-connect-btn"
                          onClick={() =>
                            setConnectState({
                              isOpen: true,
                              targetIdentityId: reply.authorId,
                              targetUsername: reply.author?.username,
                              relatedPostId: post.id
                            })
                          }
                          title="Message privately"
                        >
                          <UserPlus size={11} />
                          <span>Connect</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="crowd-btn-report"
                        onClick={() =>
                          setReportState({
                            isOpen: true,
                            targetType: 'reply',
                            targetId: reply.id,
                            targetTitle: `Reply by ${reply.author?.username}`
                          })
                        }
                        title="Report reply"
                      >
                        <ShieldAlert size={12} />
                      </button>
                    </div>
                  </div>

                  {editingReplyId === reply.id ? (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea
                        className="form-input"
                        value={editReplyContent}
                        onChange={(e) => setEditReplyContent(e.target.value)}
                        rows={3}
                        maxLength={2500}
                        disabled={savingReplyEdit}
                        style={{ width: '100%', fontSize: '0.95rem', lineHeight: 1.6 }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="crowd-pill-btn"
                          onClick={cancelEditingReply}
                          disabled={savingReplyEdit}
                          style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-black-pill"
                          onClick={() => handleSaveReplyEdit(reply.id)}
                          disabled={savingReplyEdit || !editReplyContent.trim()}
                          style={{ padding: '3px 12px', fontSize: '0.75rem' }}
                        >
                          {savingReplyEdit ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.95rem', lineHeight: 1.65, color: '#3F3F46', whiteSpace: 'pre-line' }}>
                      {reply.content}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance">
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A' }}>
          ANON CROWD DISCUSSIONS • EPHEMERAL PEER NETWORK • ALL DATA ENCRYPTED
        </p>
      </section>

      {/* Modals */}
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

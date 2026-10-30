import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, HeartHandshake, ShieldAlert, UserPlus, Clock, Trash2 } from 'lucide-react';
import { toggleBeenThroughThis } from '../services/api.js';
import { useRealtime } from '../context/RealtimeContext.jsx';

export default function PostCard({ post, onReport, onConnectRequest, onDeletePost }) {
  const { showToast } = useRealtime();
  const [marked, setMarked] = useState(post.hasMarkedBeenThroughThis);
  const [count, setCount] = useState(post.beenThroughThisCount || 0);
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleToggle() {
    try {
      setIsUpdating(true);
      const res = await toggleBeenThroughThis(post.id);
      if (res.success) {
        setMarked(res.hasMarkedBeenThroughThis);
        setCount(res.beenThroughThisCount);
      }
    } catch (err) {
      showToast({ type: 'warning', message: err.message || 'Please create an identity first.' });
    } finally {
      setIsUpdating(false);
    }
  }

  const formattedDate = new Date(post.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <article className="crowd-card" tabIndex="0">
      {/* Corner crosshairs markers */}
      <div className="corner-cross tl" aria-hidden="true" />
      <div className="corner-cross tr" aria-hidden="true" />
      <div className="corner-cross bl" aria-hidden="true" />
      <div className="corner-cross br" aria-hidden="true" />

      {/* Top Meta Bar */}
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
            <span className="mono-subtle" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: 4 }}>
              (edited)
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="crowd-card-title">
        <Link to={`/posts/${post.id}`} className="crowd-card-title-link">
          {post.title}
        </Link>
      </h3>

      {/* Excerpt Body */}
      <p className="crowd-card-body">
        {post.content}
      </p>

      {/* Footer Actions */}
      <div className="crowd-card-footer">
        <div className="crowd-card-author-section">
          <div className="crowd-author-badge">
            <span className="identity-dot" aria-hidden="true" />
            <span className="crowd-author-name">{post.author?.username || 'Anonymous'}</span>
            {post.author?.isRemoved && (
              <span
                className="crowd-tag-pill"
                style={{ fontSize: '0.65rem', padding: '1px 6px', background: 'var(--bg-card-alt)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}
              >
                Identity Removed
              </span>
            )}
            {post.isOwnPost ? (
              <span className="crowd-you-tag">(you)</span>
            ) : post.canConnect && post.authorId && !post.author?.isRemoved && !post.author?.isInactive && onConnectRequest ? (
              <button
                type="button"
                className="crowd-connect-btn"
                onClick={() => onConnectRequest(post.authorId, post.author?.username, post.id)}
                title="Request private anonymous message"
              >
                <UserPlus size={11} />
                <span>Connect</span>
              </button>
            ) : null}
          </div>

          <Link to={`/posts/${post.id}`} className="crowd-replies-link">
            <MessageSquare size={13} />
            <span>{post.replyCount || 0} {post.replyCount === 1 ? 'reply' : 'replies'}</span>
          </Link>
        </div>

        <div className="crowd-card-actions">
          {post.hasBeenThroughThis && (
            <button
              type="button"
              className={`crowd-btn-been-through ${marked ? 'active' : ''}`}
              onClick={handleToggle}
              disabled={isUpdating}
              title="Click if you have been through this experience yourself"
            >
              <HeartHandshake size={13} />
              <span>I've been through this ({count})</span>
            </button>
          )}

          {(post.isOwnPost || post.canDelete || post.isCommunityOwner) && onDeletePost && (
            <button
              type="button"
              className="crowd-btn-report"
              style={{ color: '#DC2626' }}
              onClick={() => onDeletePost(post.id)}
              title={post.isCommunityOwner && !post.isOwnPost ? "Delete message as community owner" : "Delete this question"}
            >
              <Trash2 size={13} />
            </button>
          )}

          {onReport && (
            <button
              type="button"
              className="crowd-btn-report"
              onClick={() => onReport('post', post.id, post.title)}
              title="Report this question"
            >
              <ShieldAlert size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="arch-card-accent" aria-hidden="true" />
    </article>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, Check, Plus, ArrowRight, LogOut } from 'lucide-react';

export default function CommunityCard({ community, onJoinToggle }) {
  return (
    <article className="crowd-card community-card-editorial" tabIndex="0">
      {/* Corner crosshairs markers */}
      <div className="corner-cross tl" aria-hidden="true" />
      <div className="corner-cross tr" aria-hidden="true" />
      <div className="corner-cross bl" aria-hidden="true" />
      <div className="corner-cross br" aria-hidden="true" />

      {/* Top Meta Bar */}
      <div className="crowd-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="crowd-tag-pill">{community.topic || 'General'}</span>
          {community.isMember && (
            <span className="crowd-tag-pill highlight" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
              ✓ Joined
            </span>
          )}
        </div>

        {onJoinToggle && (
          community.isMember ? (
            <button
              type="button"
              className="crowd-pill-btn"
              onClick={() => onJoinToggle(community.id, true)}
              style={{
                padding: '3px 10px',
                fontSize: '0.72rem',
                color: '#DC2626',
                borderColor: '#FECACA',
                background: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
              title="Leave this community"
            >
              <LogOut size={11} />
              <span>Leave</span>
            </button>
          ) : (
            <button
              type="button"
              className="crowd-btn-been-through"
              onClick={() => onJoinToggle(community.id, false)}
              style={{ padding: '4px 12px', fontSize: '0.75rem' }}
              title="Join this community"
            >
              <Plus size={12} />
              <span>Join</span>
            </button>
          )
        )}
      </div>

      {/* Title */}
      <h3 className="crowd-card-title">
        <Link to={`/communities/${community.slug || community.id}`} className="crowd-card-title-link">
          {community.name}
        </Link>
      </h3>

      {/* Description */}
      <p className="crowd-card-body" style={{ minHeight: '3.3em' }}>
        {community.description}
      </p>

      {/* Footer Meta */}
      <div className="crowd-card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#71717A' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Users size={12} />
            <span>{community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <FileText size={12} />
            <span>{community.postCount || 0} {community.postCount === 1 ? 'question' : 'questions'}</span>
          </span>
        </div>

        <Link
          to={`/communities/${community.slug || community.id}`}
          className="crowd-pill-btn"
          style={{ padding: '4px 12px', fontSize: '0.75rem', textDecoration: 'none' }}
        >
          <span>Enter</span>
          <ArrowRight size={12} />
        </Link>
      </div>

      <div className="arch-card-accent" aria-hidden="true" />
    </article>
  );
}

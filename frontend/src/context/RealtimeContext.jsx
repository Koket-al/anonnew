import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import { getApiToken } from '../services/api.js';
import {
  Bell,
  BellOff,
  MessageSquare,
  Users,
  CheckCircle,
  AlertTriangle,
  X,
  Volume2,
  VolumeX,
  UserCheck,
  Sparkles
} from 'lucide-react';

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { identity, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  // Mute notification state persisted in localStorage
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem('anon_notifications_muted') === 'true';
    } catch {
      return false;
    }
  });

  const [mutedCommunities, setMutedCommunities] = useState(() => {
    try {
      const saved = localStorage.getItem('anon_muted_communities');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Active in-app notification toasts
  const [toasts, setToasts] = useState([]);

  // In-app confirmation dialog state (replaces native window.confirm)
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDanger: false,
    resolve: null
  });

  // Toggle global notifications mute
  function toggleMute() {
    setIsMuted((prev) => {
      const nextVal = !prev;
      try {
        localStorage.setItem('anon_notifications_muted', String(nextVal));
      } catch {}
      return nextVal;
    });
  }

  // Toggle mute for a specific community
  function toggleMuteCommunity(communityIdOrSlug) {
    if (!communityIdOrSlug) return;
    const str = String(communityIdOrSlug);
    setMutedCommunities((prev) => {
      const exists = prev.includes(str);
      const updated = exists ? prev.filter((id) => id !== str) : [...prev, str];
      try {
        localStorage.setItem('anon_muted_communities', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }

  function isCommunityMuted(communityIdOrSlug) {
    if (isMuted) return true;
    if (!communityIdOrSlug) return false;
    return mutedCommunities.includes(String(communityIdOrSlug));
  }

  // Show in-app notification toast (replaces native browser alert and browser popups)
  function showToast({
    type = 'info',
    title = '',
    message = '',
    senderUsername = '',
    actionText = '',
    onAction = null,
    duration = 5500
  }) {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    const newToast = {
      id,
      type,
      title,
      message,
      senderUsername,
      actionText,
      onAction
    };

    setToasts((prev) => [...prev.slice(-3), newToast]); // Keep at most 4 stacked

    if (duration > 0) {
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }

  function dismissToast(id) {
    setToasts((current) => current.filter((t) => t.id !== id));
  }

  // Show in-app confirmation modal (replaces native window.confirm)
  function showConfirm({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDanger = false
  }) {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        isDanger,
        resolve
      });
    });
  }

  function handleConfirmResolve(val) {
    if (confirmDialog.resolve) {
      confirmDialog.resolve(val);
    }
    setConfirmDialog((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }

  // Initialize and maintain shared socket connection
  useEffect(() => {
    const token = getApiToken();

    const socket = io({
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Real-time Community Post Notification
    socket.on('community_post_notification', (data) => {
      const isMutedForComm = isMuted || (data.communityId && mutedCommunities.includes(data.communityId)) || (data.communitySlug && mutedCommunities.includes(data.communitySlug));
      if (isMutedForComm) return;

      showToast({
        type: 'community',
        title: `c/${data.communityName}`,
        senderUsername: `@${data.authorUsername}`,
        message: `Posted a question: "${data.postTitle}"`,
        onAction: () => navigate(`/posts/${data.postId}`)
      });
    });

    // Real-time Post Reply Notification
    socket.on('post_reply_notification', (data) => {
      if (isMuted) return;

      showToast({
        type: 'reply',
        title: 'New Reply to Your Question',
        senderUsername: `@${data.replierUsername}`,
        message: `"${data.replyContent}" on "${data.postTitle}"`,
        onAction: () => navigate(`/posts/${data.postId}`)
      });
    });

    // Real-time Connection Request Received
    socket.on('connection_request_received', (data) => {
      if (isMuted) return;

      showToast({
        type: 'connection',
        title: 'Private Connection Request',
        senderUsername: `@${data.sender.username}`,
        message: data.initialNote || 'Wants to establish a private, confidential connection with you.',
        actionText: 'Review in Messages',
        onAction: () => navigate('/messages')
      });
    });

    // Real-time Connection Request Accepted
    socket.on('connection_accepted_notification', (data) => {
      showToast({
        type: 'connection_accepted',
        title: 'Connection Accepted!',
        senderUsername: `@${data.partnerUsername}`,
        message: data.message || `@${data.partnerUsername} accepted your connection request.`,
        actionText: 'Open Chat',
        onAction: () => navigate('/messages', { state: { conversationId: data.conversationId } })
      });
    });

    // Real-time Message Notification
    socket.on('incoming_message_notification', (data) => {
      if (isMuted) return;
      if (location.pathname === '/messages') return;

      showToast({
        type: 'message',
        title: 'New Private Message',
        senderUsername: `@${data.senderUsername}`,
        message: data.content,
        actionText: 'View',
        onAction: () => navigate('/messages', { state: { conversationId: data.conversationId } })
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, identity?.id || identity?._id, isMuted, mutedCommunities, location.pathname]);

  // Context value exposed to all components
  const value = {
    socket: socketRef.current,
    isConnected,
    isMuted,
    toggleMute,
    mutedCommunities,
    toggleMuteCommunity,
    isCommunityMuted,
    showToast,
    showConfirm
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}

      {/* Floating In-App Real-time Notification Toasts */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 76,
            right: 24,
            zIndex: 10001,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxWidth: 380,
            width: 'calc(100vw - 48px)',
            pointerEvents: 'none'
          }}
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="incoming-toast-banner"
              style={{
                pointerEvents: 'auto',
                position: 'static',
                width: '100%',
                maxWidth: '100%',
                margin: 0
              }}
              onClick={() => {
                if (toast.onAction) {
                  toast.onAction();
                  dismissToast(toast.id);
                }
              }}
            >
              <div
                className="incoming-toast-icon"
                style={{
                  background:
                    toast.type === 'connection_accepted'
                      ? 'rgba(16, 185, 129, 0.2)'
                      : toast.type === 'community'
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(37, 99, 235, 0.2)',
                  color:
                    toast.type === 'connection_accepted'
                      ? '#10B981'
                      : toast.type === 'community'
                      ? '#F59E0B'
                      : '#60A5FA'
                }}
              >
                {toast.type === 'connection_accepted' ? (
                  <CheckCircle size={16} />
                ) : toast.type === 'community' ? (
                  <Users size={16} />
                ) : toast.type === 'connection' ? (
                  <UserCheck size={16} />
                ) : (
                  <MessageSquare size={16} />
                )}
              </div>

              <div className="incoming-toast-content">
                <div className="incoming-toast-title">
                  <span>{toast.title}</span>
                  {toast.senderUsername && (
                    <span className="incoming-toast-sender">{toast.senderUsername}</span>
                  )}
                </div>
                <div className="incoming-toast-snippet">{toast.message}</div>
              </div>

              <button
                type="button"
                className="incoming-toast-close"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(toast.id);
                }}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* In-App Confirmation Modal (Replaces native browser window.confirm) */}
      {confirmDialog.isOpen && (
        <div
          className="modal-backdrop"
          onClick={() => handleConfirmResolve(false)}
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 10005 }}
        >
          <div
            className="modal-dialog crowd-card modal-center-pop"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              background: '#FFFFFF',
              borderRadius: 20,
              padding: '28px 30px',
              boxShadow: '0 25px 60px -15px rgba(0,0,0,0.35)',
              border: '1px solid #141413',
              position: 'relative',
              margin: 'auto'
            }}
          >
            {/* Vintage corner accents */}
            <div className="corner-cross tl" aria-hidden="true" />
            <div className="corner-cross tr" aria-hidden="true" />
            <div className="corner-cross bl" aria-hidden="true" />
            <div className="corner-cross br" aria-hidden="true" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: confirmDialog.isDanger ? '#FEE2E2' : 'rgba(20, 20, 19, 0.05)',
                  color: confirmDialog.isDanger ? '#DC2626' : '#141413',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {confirmDialog.isDanger ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.35rem',
                  margin: 0,
                  color: '#141413',
                  lineHeight: 1.25
                }}
              >
                {confirmDialog.title}
              </h3>
            </div>

            <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: '#52525B', margin: '0 0 24px 0' }}>
              {confirmDialog.message}
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="crowd-pill-btn"
                onClick={() => handleConfirmResolve(false)}
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmResolve(true)}
                style={{
                  padding: '8px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: 9999,
                  cursor: 'pointer',
                  background: confirmDialog.isDanger ? '#DC2626' : '#141413',
                  color: '#FFFFFF',
                  border: 'none',
                  transition: 'opacity 0.15s ease'
                }}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}

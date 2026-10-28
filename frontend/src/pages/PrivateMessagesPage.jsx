import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import {
  getConversations,
  getMessages,
  sendMessage as apiSendMessage,
  respondToConversationRequest,
  blockUser,
  closeConversation,
  deleteMessage,
  getApiToken
} from '../services/api.js';
import ReportModal from '../components/ReportModal.jsx';
import { io } from 'socket.io-client';
import {
  MessageSquare,
  Send,
  UserX,
  ShieldAlert,
  Clock,
  Check,
  CheckCheck,
  X,
  Lock,
  Archive,
  Shield,
  ArrowRight,
  Trash2
} from 'lucide-react';

export default function PrivateMessagesPage() {
  const { identity, isAuthenticated } = useAuth();
  const { socket, showConfirm, showToast } = useRealtime();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Modals
  const [reportState, setReportState] = useState({ isOpen: false, targetType: '', targetId: '', targetTitle: '' });
  const messagesEndRef = useRef(null);

  // Synchronized refs to avoid stale closures in socket callbacks
  const activeConvIdRef = useRef(activeConvId);
  const identityRef = useRef(identity);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated]);

  // If user explicitly clicked an incoming toast notification with a target conversation
  useEffect(() => {
    if (location.state?.conversationId) {
      setActiveConvId(location.state.conversationId);
    }
  }, [location.state?.conversationId]);

  useEffect(() => {
    if (activeConvId) {
      loadActiveMessages(activeConvId);
      if (socket && socket.connected) {
        socket.emit('join_conversation', { conversationId: activeConvId });
      }
    }
  }, [activeConvId, socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time socket events for private messages and connection requests
  useEffect(() => {
    if (!socket) return;

    if (activeConvIdRef.current) {
      socket.emit('join_conversation', { conversationId: activeConvIdRef.current });
    }

    const handleNewMessage = (payload) => {
      const msgConvId = String(payload.conversationId);
      const currentActive = activeConvIdRef.current ? String(activeConvIdRef.current) : null;

      if (currentActive && msgConvId === currentActive) {
        const isMine = Boolean(
          (identityRef.current?.id && String(payload.senderId) === String(identityRef.current.id)) ||
          (identityRef.current?._id && String(payload.senderId) === String(identityRef.current._id)) ||
          (identityRef.current?.username && payload.senderUsername === identityRef.current.username)
        );

        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(payload.id))) {
            return prev;
          }
          return [
            ...prev,
            {
              id: String(payload.id),
              conversationId: msgConvId,
              content: payload.content,
              senderId: payload.senderId ? String(payload.senderId) : null,
              senderUsername: payload.senderUsername,
              isMine,
              readAt: payload.readAt || null,
              createdAt: payload.createdAt
            }
          ];
        });

        if (!isMine) {
          socket.emit('mark_messages_read', { conversationId: msgConvId });
        }
      }

      loadConversations();
    };

    const handleMessagesRead = ({ conversationId, readAt }) => {
      const currentActive = activeConvIdRef.current ? String(activeConvIdRef.current) : null;
      if (currentActive && String(conversationId) === currentActive) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.isMine && !m.readAt) {
              return { ...m, readAt: readAt || new Date().toISOString() };
            }
            return m;
          })
        );
      }
    };

    const handleMessageDeleted = ({ conversationId, messageId }) => {
      const currentActive = activeConvIdRef.current ? String(activeConvIdRef.current) : null;
      if (currentActive && String(conversationId) === currentActive) {
        setMessages((prev) => prev.filter((m) => String(m.id) !== String(messageId)));
      }
      loadConversations();
    };

    const handleConversationUpdated = () => {
      loadConversations();
    };

    // Instant real-time updates when connection requests are sent or received
    const handleConnectionReceived = (data) => {
      loadConversations();
    };

    const handleConnectionSent = (data) => {
      loadConversations();
    };

    const handleConnectionStatusUpdated = (data) => {
      loadConversations();
      if (activeConvIdRef.current && String(activeConvIdRef.current) === String(data.conversationId)) {
        loadActiveMessages(data.conversationId);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('messages_read', handleMessagesRead);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('connection_request_received', handleConnectionReceived);
    socket.on('connection_request_sent', handleConnectionSent);
    socket.on('connection_status_updated', handleConnectionStatusUpdated);
    socket.on('connection_accepted_notification', handleConnectionStatusUpdated);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('messages_read', handleMessagesRead);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('connection_request_received', handleConnectionReceived);
      socket.off('connection_request_sent', handleConnectionSent);
      socket.off('connection_status_updated', handleConnectionStatusUpdated);
      socket.off('connection_accepted_notification', handleConnectionStatusUpdated);
    };
  }, [socket]);

  async function loadConversations() {
    try {
      setLoading(true);
      const res = await getConversations();
      if (res && res.conversations) {
        setConversations(res.conversations);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadActiveMessages(convId) {
    try {
      const res = await getMessages(convId);
      if (res.conversation) setActiveConv(res.conversation);
      if (res.messages) {
        setMessages(
          res.messages.map((m) => ({
            ...m,
            id: String(m.id),
            isMine: Boolean(
              m.isMine ||
              (identityRef.current?.id && String(m.senderId) === String(identityRef.current.id)) ||
              (identityRef.current?._id && String(m.senderId) === String(identityRef.current._id)) ||
              (identityRef.current?.username && m.senderUsername === identityRef.current.username)
            )
          }))
        );
      }
      loadConversations();
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!newMessage.trim() || sending || !activeConvId) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Send via authenticated API to persist in DB and trigger broadcasts
      const res = await apiSendMessage(activeConvId, content);
      if (res && res.message) {
        const sentMsg = {
          id: String(res.message.id),
          conversationId: String(res.message.conversationId || activeConvId),
          content: res.message.content,
          senderId: String(res.message.senderId),
          senderUsername: res.message.senderUsername || identity?.username,
          isMine: true,
          readAt: null, // Single tick: sent
          createdAt: res.message.createdAt || new Date().toISOString()
        };

        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(sentMsg.id))) return prev;
          return [...prev, sentMsg];
        });
      }

      loadConversations();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to send message.' });
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteMessage(messageId) {
    const confirmed = await showConfirm({
      title: 'Delete Message?',
      message: 'This message will be removed immediately from this private conversation.',
      confirmText: 'Delete Message',
      isDanger: true
    });

    if (!confirmed) return;

    try {
      await deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(messageId)));
      loadConversations();
      showToast({ type: 'info', message: 'Message deleted.' });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to delete message.' });
    }
  }

  async function handleRespondRequest(convId, action) {
    try {
      await respondToConversationRequest(convId, action);
      loadConversations();
      if (action === 'accept') {
        setActiveConvId(convId);
        showToast({ type: 'success', message: 'Connection accepted. You can now exchange messages.' });
      } else {
        showToast({ type: 'info', message: 'Connection declined.' });
      }
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Action failed.' });
    }
  }

  async function handleBlockUser() {
    if (!activeConv?.partner?.id) return;
    const confirmed = await showConfirm({
      title: `Block ${activeConv.partner.username}?`,
      message: 'They will no longer be able to message you or send connection requests.',
      confirmText: 'Block User',
      isDanger: true
    });

    if (!confirmed) return;

    try {
      await blockUser({ targetIdentityId: activeConv.partner.id, conversationId: activeConvId });
      showToast({ type: 'warning', message: 'User blocked.' });
      setActiveConvId(null);
      setActiveConv(null);
      loadConversations();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to block user.' });
    }
  }

  async function handleCloseConversation() {
    const confirmed = await showConfirm({
      title: 'End Conversation?',
      message: 'This will close the conversation and archive it.',
      confirmText: 'End Conversation',
      isDanger: false
    });

    if (!confirmed) return;

    try {
      await closeConversation(activeConvId);
      loadConversations();
      setActiveConvId(null);
      showToast({ type: 'info', message: 'Conversation ended.' });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to close conversation.' });
    }
  }

  const pendingRequests = conversations.filter(c => c.status === 'pending');
  const activeChats = conversations.filter(c => c.status === 'accepted' || c.status === 'closed');

  return (
    <div className="home-page-container crowd-page-container">
      {/* Continuous 1px Vertical Architectural Grid Guide Lines */}
      <div className="page-vertical-line left" aria-hidden="true" />
      <div className="page-vertical-line right" aria-hidden="true" />

      {/* ====================================================================
          1. Editorial Hero Frame
          ==================================================================== */}
      <section className="editorial-faq-frame crowd-hero-frame" aria-label="Private Messages">
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="crowd-hero-content">
          <div className="editorial-faq-header" style={{ marginBottom: 20 }}>
            <div className="hero-brand-crest-wrap">
              <img src="/anonlogo_dark.png" alt="ANON" className="hero-page-logo" />
            </div>
            <span className="manifesto-pill">Mutual Consent // End-to-End Encryption</span>
            <h1 className="editorial-faq-title" style={{ fontSize: 'clamp(2.1rem, 4vw, 3rem)' }}>
              Private Messages
            </h1>
            <p className="secure-comm-expressive" style={{ margin: '8px auto 14px auto', fontSize: '1.2rem' }}>
              “Direct conversation without phone numbers or real identities.”
            </p>
            <p className="editorial-faq-desc" style={{ maxWidth: 640 }}>
              Encrypted 1-on-1 conversations between pseudonyms. Both participants must mutually agree before any messages can be exchanged.
            </p>
          </div>

          <div className="crowd-hero-badges-row">
            <div className="crowd-assurance-item">
              <Shield size={14} className="crowd-assurance-icon" />
              <span>Mutual Consent Required</span>
            </div>
            <div className="crowd-assurance-item">
              <Lock size={14} className="crowd-assurance-icon" />
              <span>Encrypted In-Transit</span>
            </div>
            <div className="crowd-assurance-item">
              <Archive size={14} className="crowd-assurance-icon" />
              <span>One-Click Wipeout</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. Two-Column Dialogue Layout
          ==================================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: 20, minHeight: 560 }} className="messages-layout">
        {/* Left Side: Conversations & Requests List */}
        <aside className={`crowd-card ${activeConvId ? 'hide-mobile' : ''}`} style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          {/* Pending Requests Section */}
          {pendingRequests.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <span className="mono-subtle" style={{ display: 'block', marginBottom: 8, color: '#71717A' }}>
                REQUESTS ({pendingRequests.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingRequests.map((req) => (
                  <div key={req.id} style={{ padding: 12, background: '#F4F4F5', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#141413' }}>{req.partner?.username}</span>
                      <span className="crowd-tag-pill" style={{ padding: '2px 8px' }}>PENDING</span>
                    </div>
                    {req.initialNote && (
                      <div style={{ fontSize: '0.8rem', color: '#71717A', fontStyle: 'italic', marginBottom: 8 }}>
                        "{req.initialNote}"
                      </div>
                    )}
                    {req.requestedByMe ? (
                      <span className="mono-subtle" style={{ color: '#71717A' }}>AWAITING RESPONSE...</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button
                          type="button"
                          className="btn-black-pill"
                          style={{ flex: 1, padding: '4px 10px', fontSize: '0.75rem', justifyContent: 'center' }}
                          onClick={() => handleRespondRequest(req.id, 'accept')}
                        >
                          <Check size={12} />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          className="crowd-pill-btn"
                          style={{ flex: 1, padding: '4px 10px', fontSize: '0.75rem', justifyContent: 'center' }}
                          onClick={() => handleRespondRequest(req.id, 'reject')}
                        >
                          <X size={12} />
                          <span>Decline</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Conversations List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <span className="mono-subtle" style={{ display: 'block', marginBottom: 8, color: '#71717A' }}>
              CONVERSATIONS ({activeChats.length})
            </span>

            {loading ? (
              <div className="mono-subtle" style={{ padding: 12, color: '#71717A' }}>LOADING CONVERSATIONS...</div>
            ) : activeChats.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: '0.85rem', color: '#71717A' }}>
                No active conversations yet. You can request connection from questions in the discussion feed.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeChats.map((c) => {
                  const isSelected = c.id === activeConvId;
                  const hasUnread = c.unreadCount > 0;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setActiveConvId(c.id)}
                      style={{
                        padding: '12px 14px',
                        cursor: 'pointer',
                        borderRadius: 12,
                        background: isSelected
                          ? '#141413'
                          : hasUnread
                          ? '#F8FAFC'
                          : 'transparent',
                        color: isSelected ? '#FFFFFF' : '#141413',
                        border: isSelected
                          ? '1px solid #141413'
                          : hasUnread
                          ? '1px solid #93C5FD'
                          : '1px solid var(--border-light)',
                        borderLeft: isSelected
                          ? '4px solid #141413'
                          : hasUnread
                          ? '4px solid #2563EB'
                          : '1px solid var(--border-light)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: hasUnread ? 700 : 600, fontSize: '0.9rem' }}>{c.partner?.username}</span>
                        {hasUnread && (
                          <span className="crowd-tag-pill highlight" style={{ fontSize: '0.65rem', padding: '1px 6px', background: '#2563EB', color: '#FFFFFF' }}>
                            {c.unreadCount} new
                          </span>
                        )}
                      </div>
                      {c.lastMessage?.text && (
                        <div style={{
                          fontSize: '0.775rem',
                          color: isSelected ? '#C2C1BA' : hasUnread ? '#1E293B' : '#71717A',
                          fontWeight: hasUnread ? 600 : 400,
                          marginTop: 3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {c.lastMessage.isMine ? 'You: ' : ''}{c.lastMessage.text}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Right Side: Chat Window */}
        <main className={`crowd-card ${!activeConvId ? 'hide-mobile' : ''}`} style={{ padding: 24, display: 'flex', flexDirection: 'column', height: 560 }}>
          {activeConvId && activeConv ? (
            <>
              {/* Chat Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 14, marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="identity-dot" />
                    <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.04em', margin: 0 }}>
                      {activeConv.partner?.username || 'Peer'}
                    </h3>
                  </div>
                  <div className="mono-subtle" style={{ color: '#71717A', marginTop: 2 }}>STATUS: {activeConv.status}</div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="crowd-pill-btn hide-desktop"
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={() => {
                      setActiveConvId(null);
                      setActiveConv(null);
                    }}
                  >
                    ← Chats
                  </button>
                  <button
                    type="button"
                    className="crowd-pill-btn"
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={() => setReportState({ isOpen: true, targetType: 'user', targetId: activeConv.partner?.id, targetTitle: `User ${activeConv.partner?.username}` })}
                    title="Report user"
                  >
                    <ShieldAlert size={12} />
                    <span>Report</span>
                  </button>
                  <button
                    type="button"
                    className="crowd-pill-btn"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#DC2626', borderColor: '#FCA5A5' }}
                    onClick={handleBlockUser}
                    title="Block user"
                  >
                    <UserX size={12} />
                    <span>Block</span>
                  </button>
                  <button
                    type="button"
                    className="crowd-pill-btn"
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={handleCloseConversation}
                    title="End conversation"
                  >
                    <Archive size={12} />
                    <span>End</span>
                  </button>
                </div>
              </div>

              {/* Messages Body */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 6 }}>
                {messages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: '#71717A', fontSize: '0.85rem' }}>
                    Conversation opened. Say hello respectfully.
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div
                      key={m.id || idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: m.isMine ? 'flex-end' : 'flex-start'
                      }}
                    >
                      {!m.isMine && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700, color: '#71717A', marginBottom: 2, letterSpacing: '0.03em' }}>
                          {m.senderUsername || activeConv.partner?.username}
                        </span>
                      )}
                      <div
                        style={{
                          maxWidth: '75%',
                          padding: '12px 16px',
                          borderRadius: 14,
                          fontSize: '0.9375rem',
                          lineHeight: 1.55,
                          background: m.isMine ? '#141413' : '#F4F4F5',
                          color: m.isMine ? '#FFFFFF' : '#141413',
                          border: m.isMine ? 'none' : '1px solid var(--border-light)',
                          whiteSpace: 'pre-line'
                        }}
                      >
                        {m.content}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span className="mono-subtle" style={{ fontSize: '0.68rem', color: '#71717A' }}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {m.isMine && (
                          <span
                            style={{ display: 'inline-flex', alignItems: 'center' }}
                            title={m.readAt ? `Seen ${new Date(m.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Sent'}
                          >
                            {m.readAt ? (
                              <CheckCheck size={14} style={{ color: '#2563EB', strokeWidth: 2.3 }} />
                            ) : (
                              <Check size={13} style={{ color: '#9CA3AF', strokeWidth: 2 }} />
                            )}
                          </span>
                        )}
                        {m.isMine && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(m.id)}
                            title="Delete message"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#A1A1AA',
                              padding: 2,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#DC2626'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#A1A1AA'}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              {activeConv.status === 'accepted' ? (
                <form onSubmit={handleSend} style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14, marginTop: 14 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Type a private message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={sending}
                      maxLength={3000}
                      style={{
                        flex: 1,
                        borderRadius: 'var(--radius-pill)',
                        padding: '11px 18px',
                        background: '#FFFFFF',
                        border: '1px solid var(--border-light)'
                      }}
                    />
                    <button
                      type="submit"
                      className="btn-black-pill"
                      disabled={sending || !newMessage.trim()}
                      style={{ padding: '10px 20px' }}
                    >
                      <Send size={14} />
                      <span>Send</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="alert-banner alert-warning" style={{ marginTop: 14, marginBottom: 0, borderRadius: 12 }}>
                  This conversation is currently {activeConv.status}. Messages cannot be sent.
                </div>
              )}
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#71717A', padding: '40px 20px' }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#F4F4F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px auto',
                color: '#71717A'
              }}>
                <MessageSquare size={24} />
              </div>
              <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600, color: '#141413', margin: '0 0 6px 0' }}>
                Private Messages
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#71717A', maxWidth: 300, lineHeight: 1.4 }}>
                Click a conversation on the left to open and view messages.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance">
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A' }}>
          ANON PRIVATE MESSAGES • MUTUALLY AUTHORIZED • ZERO REAL-NAME TRACE
        </p>
      </section>

      <ReportModal
        isOpen={reportState.isOpen}
        targetType={reportState.targetType}
        targetId={reportState.targetId}
        targetTitle={reportState.targetTitle}
        onClose={() => setReportState({ isOpen: false, targetType: '', targetId: '', targetTitle: '' })}
      />
    </div>
  );
}

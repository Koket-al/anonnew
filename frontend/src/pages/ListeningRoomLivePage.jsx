import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { getListeningRoom, leaveListeningRoom, closeListeningRoom } from '../services/api.js';
import ReportModal from '../components/ReportModal.jsx';
import { io } from 'socket.io-client';
import {
  Headphones,
  Send,
  Users,
  ShieldAlert,
  ArrowLeft,
  XCircle,
  HeartHandshake,
  Shield,
  Lock
} from 'lucide-react';

export default function ListeningRoomLivePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { identity, isAuthenticated, openCreateModal } = useAuth();
  const { showToast, showConfirm } = useRealtime();

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [reportState, setReportState] = useState({ isOpen: false, targetType: '', targetId: '', targetTitle: '' });
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let isCancelled = false;
    let localSocket = null;

    async function init() {
      try {
        setLoading(true);
        setError(null);
        const res = await getListeningRoom(id);
        if (isCancelled) return;

        if (res.room) {
          setRoom(res.room);
          setParticipants(res.room.participants || []);

          if (isCancelled) return;

          localSocket = io({
            withCredentials: true,
            transports: ['websocket', 'polling']
          });

          socketRef.current = localSocket;

          localSocket.on('connect', () => {
            if (isCancelled) return;
            localSocket.emit('join_listening_room', { roomId: id });
          });

          // Fallback if already connected
          if (localSocket.connected) {
            localSocket.emit('join_listening_room', { roomId: id });
          }

          localSocket.on('new_room_message', (msg) => {
            if (isCancelled) return;
            setMessages((prev) => {
              // Deduplicate by message id
              if (msg.id && prev.some((m) => m.id === msg.id)) {
                return prev;
              }
              // Deduplicate fallback
              if (prev.some((m) => m.content === msg.content && m.senderUsername === msg.senderUsername && Math.abs(new Date(m.createdAt) - new Date(msg.createdAt)) < 1500)) {
                return prev;
              }
              return [...prev, msg];
            });
          });

          localSocket.on('user_joined_room', ({ username, userId, participantCount }) => {
            if (isCancelled) return;
            setMessages((prev) => {
              // Deduplicate join messages: show exactly once per user
              const alreadyAnnounced = prev.some(
                (m) => m.isSystem && m.type === 'join' && (m.userId === userId || m.username === username)
              );
              if (alreadyAnnounced) {
                return prev;
              }
              return [
                ...prev,
                { isSystem: true, type: 'join', userId, username, text: `${username} quietly joined the room.` }
              ];
            });
          });

          localSocket.on('user_left_room', ({ username, userId }) => {
            if (isCancelled) return;
            setMessages((prev) => {
              const alreadyAnnounced = prev.slice(-5).some(
                (m) => m.isSystem && m.type === 'leave' && (m.userId === userId || m.username === username)
              );
              if (alreadyAnnounced) {
                return prev;
              }
              return [
                ...prev,
                { isSystem: true, type: 'leave', userId, username, text: `${username} stepped out of the room.` }
              ];
            });
          });
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Unable to join this listening room.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      isCancelled = true;
      if (localSocket) {
        localSocket.emit('leave_listening_room', { roomId: id });
        localSocket.disconnect();
      }
      if (socketRef.current && socketRef.current !== localSocket) {
        socketRef.current.emit('leave_listening_room', { roomId: id });
        socketRef.current.disconnect();
      }
      socketRef.current = null;
      leaveListeningRoom(id).catch(() => {});
    };
  }, [id, isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    const content = input.trim();
    if (!content || !socketRef.current) return;

    socketRef.current.emit('send_room_message', {
      roomId: id,
      content
    });
    setInput('');
  }

  async function handleCloseRoom() {
    const confirmed = await showConfirm(
      'Close and end this listening room for all participants?',
      { title: 'Close Listening Room', confirmText: 'Close Room', danger: true }
    );
    if (confirmed) {
      try {
        await closeListeningRoom(id);
        navigate('/listening-rooms');
      } catch (err) {
        showToast(err.message || 'Failed to close room.', 'error');
      }
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="home-page-container crowd-page-container" style={{ padding: '60px 24px' }}>
        <div className="editorial-faq-frame crowd-empty-frame">
          <div className="crowd-empty-inner">
            <span className="manifesto-pill">Identity Required</span>
            <h3 className="crowd-empty-title">Anonymous Identity Needed</h3>
            <p className="crowd-empty-desc">
              To preserve presence and participate in this listening room, please create your anonymous persona.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
              <button
                type="button"
                className="btn-black-pill"
                onClick={() =>
                  openCreateModal({
                    reason: 'Please create an anonymous identity before entering this live listening room.',
                    onSuccess: () => initRoom()
                  })
                }
              >
                <span>Create Identity</span>
              </button>
              <Link to="/listening-rooms" className="btn btn-outline" style={{ borderRadius: 9999 }}>
                <span>Back to Rooms</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="home-page-container crowd-page-container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <span className="mono-subtle" style={{ display: 'block', marginBottom: 12 }}>JOINING LIVE ROOM...</span>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>
          Entering quiet sanctuary...
        </h3>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="home-page-container crowd-page-container" style={{ padding: '60px 24px' }}>
        <div className="editorial-faq-frame crowd-empty-frame">
          <div className="crowd-empty-inner">
            <span className="manifesto-pill">Room Closed</span>
            <h3 className="crowd-empty-title">{error || 'Room is unavailable or has ended.'}</h3>
            <p className="crowd-empty-desc">This live listening room has closed.</p>
            <Link to="/listening-rooms" className="btn-black-pill">
              <ArrowLeft size={15} />
              <span>Return to Listening Rooms</span>
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

      {/* Top Navigation Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Link to="/listening-rooms" className="crowd-pill-btn" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={14} />
          <span>Exit Room</span>
        </Link>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="crowd-pill-btn"
            onClick={() => setReportState({ isOpen: true, targetType: 'listening_room', targetId: room.id, targetTitle: room.title })}
          >
            <ShieldAlert size={13} />
            <span>Report</span>
          </button>

          {room.isCreator && (
            <button
              type="button"
              className="crowd-pill-btn"
              onClick={handleCloseRoom}
              style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
              title="Close room for everyone"
            >
              <XCircle size={13} />
              <span>End Room</span>
            </button>
          )}
        </div>
      </div>

      {/* Guidelines Reminder Header Card */}
      <article className="crowd-card" style={{ marginBottom: 16, padding: '22px 28px' }}>
        <div className="corner-cross tl" aria-hidden="true" />
        <div className="corner-cross tr" aria-hidden="true" />
        <div className="corner-cross bl" aria-hidden="true" />
        <div className="corner-cross br" aria-hidden="true" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className="crowd-tag-pill" style={{ marginBottom: 8 }}>{room.topic}</span>
            <h2 className="crowd-card-title" style={{ fontSize: '1.45rem', margin: '4px 0 6px 0' }}>{room.title}</h2>
            {room.description && (
              <p className="crowd-card-body" style={{ margin: 0, fontSize: '0.875rem' }}>{room.description}</p>
            )}
          </div>
          <div className="crowd-card-time" style={{ color: '#065F46' }}>
            <span className="identity-dot" style={{ width: 7, height: 7 }} />
            <span>Live Presence</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 12, marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#B45309' }}>
          <HeartHandshake size={15} style={{ flexShrink: 0 }} />
          <span>
            <strong>Listening Rule:</strong> {room.guidelines}
          </span>
        </div>
      </article>

      {/* Live Chat Window */}
      <div
        className="crowd-card"
        style={{
          height: 460,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '24px',
          marginBottom: 16
        }}
      >
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#71717A', fontSize: '0.9rem', maxWidth: 420 }}>
            <Headphones size={28} style={{ opacity: 0.35, marginBottom: 10 }} />
            <p style={{ margin: 0 }}>
              You are quietly in the room. Share whatever is on your mind freely, or simply be present to listen.
            </p>
          </div>
        ) : (
          messages.map((m, idx) => {
            if (m.isSystem) {
              return (
                <div key={idx} style={{ textAlign: 'center', margin: '4px 0', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#71717A' }}>
                  &bull; {m.text} &bull;
                </div>
              );
            }

            const isMine = m.senderUsername === identity?.username;

            return (
              <div
                key={m.id || idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMine ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#71717A', marginBottom: 2 }}>
                  {m.senderUsername}
                </div>
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '12px 16px',
                    borderRadius: 14,
                    fontSize: '0.9375rem',
                    lineHeight: 1.55,
                    background: isMine ? '#141413' : '#F4F4F5',
                    color: isMine ? '#FFFFFF' : '#141413',
                    border: isMine ? 'none' : '1px solid var(--border-light)',
                    whiteSpace: 'pre-line'
                  }}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          className="form-input"
          placeholder="Type your thoughts or a supportive listening note..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1500}
          style={{
            flex: 1,
            borderRadius: 'var(--radius-pill)',
            padding: '12px 18px',
            background: '#FFFFFF',
            border: '1px solid var(--border-light)'
          }}
        />
        <button
          type="submit"
          className="btn-black-pill"
          disabled={!input.trim()}
          style={{ padding: '11px 22px' }}
        >
          <Send size={14} />
          <span>Send</span>
        </button>
      </form>

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance">
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A' }}>
          ANON LIVE LISTENING • ZERO LOGS STORED • EPHEMERAL PRESENCE
        </p>
      </section>

      <ReportModal
        isOpen={reportState.isOpen}
        targetType={reportState.targetType}
        targetId={room.id}
        targetTitle={room.title}
        onClose={() => setReportState({ isOpen: false, targetType: '', targetId: '', targetTitle: '' })}
      />
    </div>
  );
}

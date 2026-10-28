import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getListeningRooms, createListeningRoom } from '../services/api.js';
import {
  Headphones,
  Plus,
  Users,
  Shield,
  HeartHandshake,
  X,
  Lock,
  ArrowRight
} from 'lucide-react';

export default function ListeningRoomsPage() {
  const { isAuthenticated, openCreateModal } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create room modal
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('General Venting');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRooms();
  }, []);

  async function loadRooms() {
    try {
      setLoading(true);
      const res = await getListeningRooms();
      if (res.rooms) setRooms(res.rooms);
    } catch (err) {
      console.error('Failed to load listening rooms:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreateModal() {
    if (!isAuthenticated) {
      openCreateModal({
        reason: 'Please create an anonymous identity before opening a listening room.',
        onSuccess: () => setIsOpen(true)
      });
    } else {
      setIsOpen(true);
    }
  }

  async function submitListeningRoom() {
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await createListeningRoom({
        title,
        topic,
        description
      });
      if (res.success && res.room) {
        navigate(`/listening-rooms/${res.room.id}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to open listening room.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!isAuthenticated) {
      openCreateModal({
        reason: 'Please create an anonymous identity before opening a listening room.',
        onSuccess: () => submitListeningRoom()
      });
      return;
    }
    submitListeningRoom();
  }

  return (
    <div className="home-page-container crowd-page-container">
      {/* Continuous 1px Vertical Architectural Grid Guide Lines */}
      <div className="page-vertical-line left" aria-hidden="true" />
      <div className="page-vertical-line right" aria-hidden="true" />

      {/* ====================================================================
          1. Editorial Hero Frame
          ==================================================================== */}
      <section className="editorial-faq-frame crowd-hero-frame" aria-label="Listening Rooms">
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="crowd-hero-content">
          <div className="editorial-faq-header" style={{ marginBottom: 22 }}>
            <div className="hero-brand-crest-wrap">
              <img src="/anonlogo_dark.png" alt="ANON" className="hero-page-logo" />
            </div>
            <span className="manifesto-pill">Presence // No Unsolicited Advice</span>
            <h1 className="editorial-faq-title" style={{ fontSize: 'clamp(2.1rem, 4vw, 3rem)' }}>
              “I Just Need Someone to Listen”
            </h1>
            <p className="secure-comm-expressive" style={{ margin: '8px auto 14px auto', fontSize: '1.2rem' }}>
              “Sometimes people need to be heard, not fixed.”
            </p>
            <p className="editorial-faq-desc" style={{ maxWidth: 640 }}>
              Quiet, ephemeral text spaces dedicated strictly to emotional presence and quiet listening. Zero debating, zero lecturing, zero judgment.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <button
              type="button"
              className="btn-black-pill"
              onClick={handleOpenCreateModal}
            >
              <Plus size={16} />
              <span>Open a Listening Room</span>
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="crowd-hero-badges-row">
            <div className="crowd-assurance-item">
              <HeartHandshake size={14} className="crowd-assurance-icon" />
              <span>Pure Emotional Presence</span>
            </div>
            <div className="crowd-assurance-item">
              <Shield size={14} className="crowd-assurance-icon" />
              <span>100% Cryptographic Anonymity</span>
            </div>
            <div className="crowd-assurance-item">
              <Lock size={14} className="crowd-assurance-icon" />
              <span>Transient · Zero Stored Chats</span>
            </div>
          </div>
        </div>
      </section>

      {/* Prominent Ethos Banner */}
      <div className="alert-banner alert-info" style={{ borderRadius: 16, padding: '18px 24px', margin: '24px 0' }}>
        <HeartHandshake size={22} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>The Golden Rule of Listening Rooms</div>
          <p className="text-sm" style={{ lineHeight: 1.6, margin: 0 }}>
            <strong>“Listen with an open heart. Ask whether advice is welcome before giving it.”</strong>
            <br />
            Listening with quiet empathy is often the deepest relief you can offer another human being.
          </p>
        </div>
      </div>

      {/* Rooms Directory */}
      <main className="crowd-posts-stream" aria-label="Active Listening Rooms">
        {loading ? (
          <div className="editorial-faq-frame crowd-empty-frame" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <span className="mono-subtle" style={{ display: 'block', marginBottom: 12 }}>CHECKING ACTIVE SANCTUARIES...</span>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>
              Finding active listening rooms...
            </h3>
          </div>
        ) : rooms.length === 0 ? (
          <div className="editorial-faq-frame crowd-empty-frame">
            <div className="crowd-empty-inner">
              <span className="manifesto-pill">Sanctuary Circle</span>
              <h3 className="crowd-empty-title">No rooms open right now.</h3>
              <p className="crowd-empty-desc">
                Be the first to open a room. You can share what’s weighing on you, or simply wait for someone who needs a gentle ear.
              </p>
              <button
                type="button"
                className="btn-black-pill"
                onClick={() => setIsOpen(true)}
              >
                <Plus size={16} />
                <span>Open the First Room</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20 }}>
            {rooms.map((room) => (
              <article key={room.id} className="crowd-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div className="corner-cross tl" aria-hidden="true" />
                <div className="corner-cross tr" aria-hidden="true" />
                <div className="corner-cross bl" aria-hidden="true" />
                <div className="corner-cross br" aria-hidden="true" />

                <div>
                  <div className="crowd-card-header">
                    <span className="crowd-tag-pill">{room.topic}</span>
                    <span className="crowd-card-time" style={{ color: '#065F46' }}>
                      <span className="identity-dot" style={{ width: 6, height: 6 }} />
                      <span>{room.activeParticipantCount} present</span>
                    </span>
                  </div>

                  <h3 className="crowd-card-title">
                    <Link to={`/listening-rooms/${room.id}`} className="crowd-card-title-link">
                      {room.title}
                    </Link>
                  </h3>

                  {room.description && (
                    <p className="crowd-card-body" style={{ WebkitLineClamp: 3 }}>
                      {room.description}
                    </p>
                  )}

                  <div className="mono-subtle" style={{ fontStyle: 'italic', marginBottom: 16, color: '#71717A' }}>
                    ETHOS // "{room.guidelines}"
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14 }}>
                  <Link
                    to={`/listening-rooms/${room.id}`}
                    className="btn-black-pill"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Headphones size={14} />
                    <span>Enter Room & Listen</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance">
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A' }}>
          ANON LISTENING ROOMS • EPHEMERAL LIVE STREAMS • ZERO TRANSCRIPTS STORED
        </p>
      </section>

      {/* Create Room Modal */}
      {isOpen && (
        <div className="modal-backdrop" onClick={() => setIsOpen(false)}>
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560, borderRadius: 20, border: '1px solid var(--border-light)', padding: 32 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Headphones size={20} />
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', margin: 0 }}>Open a Listening Room</h3>
              </div>
              <button
                type="button"
                className="crowd-search-clear"
                onClick={() => setIsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="alert-banner alert-warning" style={{ marginBottom: 14, borderRadius: 14 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                  Room Title
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Quiet Venting: Need to get today's heavy feelings off my chest"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  minLength={3}
                  maxLength={120}
                  style={{ borderRadius: 12, padding: '10px 14px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                  Topic / Mood
                </label>
                <select
                  className="form-select"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  style={{ borderRadius: 12, padding: '10px 14px' }}
                >
                  <option value="General Venting">General Venting</option>
                  <option value="School & Academic Stress">School & Academic Stress</option>
                  <option value="Loneliness & Isolation">Loneliness & Isolation</option>
                  <option value="Family Struggles">Family Struggles</option>
                  <option value="Grief & Big Transitions">Grief & Big Transitions</option>
                  <option value="Quiet Space">Quiet Space (Few words)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717A' }}>
                  Context / Note for Listeners <span style={{ textTransform: 'none', color: '#A1A1AA' }}>(Optional)</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Tell listeners what you are experiencing or what kind of quiet space you need..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={300}
                  style={{ borderRadius: 12, padding: '10px 14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="crowd-pill-btn"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-black-pill" disabled={isSubmitting}>
                  <span>{isSubmitting ? 'Opening...' : 'Open Room'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

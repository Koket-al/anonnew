import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/AuthContext.jsx';
import { getAIStatus, askAI } from '../services/api.js';
import {
  Sparkles,
  Send,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Shield,
  Lock,
  Info,
  HelpCircle,
  ArrowRight,
  X,
  Copy,
  Check
} from 'lucide-react';

/**
 * Normalizes and cleans raw markdown outputs from LLMs:
 * - Cleans up symbol clumping artifacts like '****' or '*****'
 * - Fixes awkward nested heading syntax like '### **Heading**' or '**### Heading**'
 * - Cleans up dangling double-asterisk lines
 */
function cleanMarkdownContent(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // 1. Replace 4+ asterisks with a clean divider
  cleaned = cleaned.replace(/\*{4,}/g, '\n---\n');

  // 2. Fix ### **Heading** into ### Heading
  cleaned = cleaned.replace(/(^|\n)(#{1,6})\s*\*\*(.*?)\*\*/g, '$1$2 $3');

  // 3. Fix **### Heading** into ### Heading
  cleaned = cleaned.replace(/(^|\n)\*\*(#{1,6}\s*.*?)\*\*/g, '$1$2');

  // 4. Fix dangling asterisks on bullet points
  cleaned = cleaned.replace(/(^|\n)\*\s*\*\s+/g, '$1* ');

  return cleaned.trim();
}

const markdownComponents = {
  h1: ({ node, ...props }) => (
    <h3
      style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '1.25rem',
        fontWeight: 600,
        color: '#141413',
        marginTop: 14,
        marginBottom: 8,
        lineHeight: 1.3
      }}
      {...props}
    />
  ),
  h2: ({ node, ...props }) => (
    <h4
      style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '1.15rem',
        fontWeight: 600,
        color: '#141413',
        marginTop: 12,
        marginBottom: 6,
        lineHeight: 1.3
      }}
      {...props}
    />
  ),
  h3: ({ node, ...props }) => (
    <h5
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '1.02rem',
        fontWeight: 600,
        color: '#141413',
        marginTop: 10,
        marginBottom: 6,
        lineHeight: 1.3
      }}
      {...props}
    />
  ),
  h4: ({ node, ...props }) => (
    <h6
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '0.94rem',
        fontWeight: 600,
        color: '#141413',
        marginTop: 8,
        marginBottom: 4,
        lineHeight: 1.3
      }}
      {...props}
    />
  ),
  p: ({ node, ...props }) => (
    <p
      style={{
        margin: '0 0 10px 0',
        lineHeight: 1.7,
        color: '#27272A',
        fontSize: '0.9375rem'
      }}
      {...props}
    />
  ),
  ul: ({ node, ...props }) => (
    <ul
      style={{
        paddingLeft: 22,
        margin: '6px 0 12px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}
      {...props}
    />
  ),
  ol: ({ node, ...props }) => (
    <ol
      style={{
        paddingLeft: 22,
        margin: '6px 0 12px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}
      {...props}
    />
  ),
  li: ({ node, ...props }) => (
    <li
      style={{
        lineHeight: 1.6,
        color: '#27272A',
        fontSize: '0.9375rem'
      }}
      {...props}
    />
  ),
  strong: ({ node, ...props }) => (
    <strong
      style={{
        fontWeight: 600,
        color: '#09090B'
      }}
      {...props}
    />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote
      style={{
        borderLeft: '3px solid #141413',
        background: 'rgba(20, 20, 19, 0.03)',
        padding: '8px 14px',
        borderRadius: '0 8px 8px 0',
        margin: '10px 0',
        fontStyle: 'italic',
        color: '#52525B'
      }}
      {...props}
    />
  ),
  code: ({ node, inline, ...props }) => (
    <code
      style={{
        background: 'rgba(20, 20, 19, 0.06)',
        color: '#18181B',
        padding: '2px 6px',
        borderRadius: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.85em'
      }}
      {...props}
    />
  ),
  hr: () => (
    <hr
      style={{
        border: 'none',
        borderTop: '1px dashed #E4E4E7',
        margin: '14px 0'
      }}
    />
  )
};

const PROMPT_SUGGESTIONS = [
  'How do I ground myself during sudden anxiety?',
  'How can I tell if my friendship dynamic is unhealthy?',
  'Bedtime techniques when my mind won’t stop racing',
  'What should I expect when speaking to a therapist?'
];

export default function AIAssistantPage() {
  const { isAuthenticated, openCreateModal, identity } = useAuth();
  const [status, setStatus] = useState(null);
  const storageKey = identity ? `anon_ai_chat_${identity.id}` : 'anon_ai_chat_guest';

  const [messages, setMessages] = useState(() => {
    try {
      const key = identity ? `anon_ai_chat_${identity.id}` : 'anon_ai_chat_guest';
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error('Failed to load initial AI chat history:', err);
    }
    return [];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const prevKeyRef = useRef(storageKey);

  function handleCopyResponse(text, index) {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      }).catch(() => {});
    } catch {
      // Ignore clipboard write failures in unsupported contexts
    }
  }

  useEffect(() => {
    loadAIStatus();
  }, []);

  // When storageKey changes (e.g. persona switch or identity created), load that identity's chat
  useEffect(() => {
    if (prevKeyRef.current !== storageKey) {
      prevKeyRef.current = storageKey;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
            return;
          }
        }
        setMessages([]);
      } catch (err) {
        console.error('Failed to load persona AI chat:', err);
        setMessages([]);
      }
    }
  }, [storageKey]);

  // Persist conversation to localStorage whenever messages update
  useEffect(() => {
    try {
      if (messages && messages.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (err) {
      console.error('Failed to persist AI chat to localStorage:', err);
    }
  }, [messages, storageKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function loadAIStatus() {
    try {
      const res = await getAIStatus();
      setStatus(res);
    } catch (err) {
      console.error('Failed to get AI status:', err);
    }
  }

  async function sendMessage(queryText) {
    const userMessage = { role: 'user', content: queryText };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const res = await askAI(userMessage.content, messages);
      if (res.response) {
        setMessages([...newHistory, { role: 'assistant', content: res.response }]);
      }
    } catch (err) {
      setError(err.message || 'The AI assistant was unable to process your request.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend(e, textOverride) {
    if (e) e.preventDefault();
    const queryText = (textOverride || input).trim();
    if (!queryText || isLoading) return;

    if (!isAuthenticated) {
      openCreateModal({
        reason: 'Please create an anonymous identity before consulting the AI Well-being Guide.',
        onSuccess: () => sendMessage(queryText)
      });
      return;
    }

    sendMessage(queryText);
  }

  function handleOpenClearModal() {
    if (messages.length > 0) {
      setIsClearModalOpen(true);
    }
  }

  function handleConfirmClear() {
    setMessages([]);
    try {
      localStorage.removeItem(storageKey);
    } catch (err) {
      console.error('Failed to clear storage:', err);
    }
    setError(null);
    setIsClearModalOpen(false);
  }

  return (
    <div className="home-page-container crowd-page-container">
      {/* Continuous 1px Vertical Architectural Grid Guide Lines */}
      <div className="page-vertical-line left" aria-hidden="true" />
      <div className="page-vertical-line right" aria-hidden="true" />

      {/* ====================================================================
          1. Editorial Hero Banner
          ==================================================================== */}
      <section className="editorial-faq-frame crowd-hero-frame" aria-label="AI Guide Intro">
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="crowd-hero-content">
          <div className="editorial-faq-header" style={{ marginBottom: 20 }}>
            <div className="hero-brand-crest-wrap">
              <img src="/anonlogo_dark.png" alt="ANON" className="hero-page-logo" />
            </div>
            <span className="manifesto-pill">Gentle Reflection // AI Companion</span>
            <h1 className="editorial-faq-title" style={{ fontSize: 'clamp(2.2rem, 4.2vw, 3.1rem)' }}>
              AI Well-being Guide
            </h1>
            <p className="secure-comm-expressive" style={{ margin: '8px auto 14px auto', fontSize: '1.2rem' }}>
              “A calm, private mirror to untangle what you feel.”
            </p>
            <p className="editorial-faq-desc" style={{ maxWidth: 640 }}>
              An encrypted, non-judgmental space for sensitive wellness queries, reflection prompts, and emotional grounding. Persists privately on your device until identity removal.
            </p>
          </div>

          <div className="crowd-hero-badges-row">
            <div className="crowd-assurance-item">
              <Shield size={14} className="crowd-assurance-icon" />
              <span>100% Cryptographic Anonymity</span>
            </div>
            <div className="crowd-assurance-item">
              <Sparkles size={14} className="crowd-assurance-icon" />
              <span>Judgment-Free Guidance</span>
            </div>
            <div className="crowd-assurance-item">
              <Lock size={14} className="crowd-assurance-icon" />
              <span>Zero Server Logs</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. Dialogue Container & Suggestions
          ==================================================================== */}
      <div style={{ maxWidth: 840, margin: '0 auto', width: '100%' }}>
        {/* Role & Clinical Disclaimer */}
        <div className="alert-banner alert-info" style={{ marginBottom: 16, borderRadius: 14 }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div className="text-xs" style={{ lineHeight: 1.5 }}>
            <strong>Important Clinical Notice:</strong> This assistant provides gentle educational reflection only. It is an AI tool and <em>never</em> a substitute for a licensed doctor or clinical therapist. It cannot diagnose or prescribe.
          </div>
        </div>

        {/* Suggestion Chips */}
        {messages.length === 0 && (
          <div style={{ marginBottom: 20 }}>
            <span className="mono-subtle" style={{ display: 'block', marginBottom: 10 }}>SUGGESTED EXPLORATIONS //</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PROMPT_SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="crowd-cat-pill"
                  onClick={() => handleSend(null, s)}
                  style={{ fontSize: '0.8rem', padding: '7px 14px' }}
                >
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat History Box */}
        <div
          className="crowd-card"
          style={{
            minHeight: 400,
            maxHeight: 560,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: 24,
            marginBottom: 16
          }}
        >
          {messages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 440, color: '#71717A' }}>
              <Sparkles size={28} style={{ opacity: 0.35, marginBottom: 12 }} />
              <p style={{ fontSize: '1rem', color: '#27272A', fontWeight: 500, marginBottom: 6 }}>
                Your private space to reflect freely.
              </p>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                Ask anything about stress, mental well-being, healthy boundaries, or sleep. No queries are tied to your personal identity.
              </p>
            </div>
          ) : (
            messages.map((m, idx) => (
              m.role === 'user' ? (
                /* User Message Bubble */
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    maxWidth: '85%',
                    marginLeft: 'auto'
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.68rem',
                      color: '#71717A',
                      marginBottom: 5,
                      letterSpacing: '0.05em'
                    }}
                  >
                    YOU // {identity?.username ? `@${identity.username}` : 'ANONYMOUS'}
                  </div>
                  <div
                    style={{
                      padding: '13px 18px',
                      borderRadius: '18px 18px 4px 18px',
                      fontSize: '0.9375rem',
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                      background: '#18181B',
                      color: '#FFFFFF',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      wordBreak: 'break-word'
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              ) : (
                /* AI Response Editorial Card */
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    maxWidth: '94%',
                    marginRight: 'auto',
                    width: '100%'
                  }}
                >
                  {/* Top Bar: Icon, Crest, Label & Copy Button */}
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                      padding: '0 4px'
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        color: '#52525B',
                        letterSpacing: '0.06em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#141413',
                          color: '#FFFFFF',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Sparkles size={11} />
                      </span>
                      <strong style={{ color: '#141413' }}>ANON AI GUIDE</strong>
                      <span style={{ color: '#A1A1AA' }}>&bull;</span>
                      <span style={{ color: '#71717A' }}>CONFIDENTIAL REFLECTION</span>
                    </div>

                    <button
                      type="button"
                      className={`ai-copy-btn ${copiedIndex === idx ? 'copied' : ''}`}
                      onClick={() => handleCopyResponse(m.content, idx)}
                      title="Copy response to clipboard"
                    >
                      {copiedIndex === idx ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {/* Formatted Markdown Card */}
                  <div className="ai-response-card" style={{ width: '100%', maxWidth: '100%' }}>
                    <div className="corner-cross tl" aria-hidden="true" />
                    <div className="corner-cross tr" aria-hidden="true" />
                    <div className="corner-cross bl" aria-hidden="true" />
                    <div className="corner-cross br" aria-hidden="true" />

                    <div className="ai-response-content">
                      <ReactMarkdown components={markdownComponents}>
                        {cleanMarkdownContent(m.content)}
                      </ReactMarkdown>
                    </div>

                    <div
                      style={{
                        borderTop: '1px solid rgba(0,0,0,0.06)',
                        marginTop: 14,
                        paddingTop: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.72rem',
                        color: '#A1A1AA',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Shield size={11} />
                        <span>Encrypted Private Dialogue</span>
                      </span>
                      <span>General Educational Reflection</span>
                    </div>
                  </div>
                </div>
              )
            ))
          )}

          {isLoading && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                maxWidth: '85%',
                marginTop: 6
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: '#71717A',
                  marginBottom: 6,
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Sparkles size={12} style={{ color: '#D97706' }} />
                <span>AI GUIDE // REFLECTING</span>
              </div>
              <div
                style={{
                  padding: '16px 22px',
                  borderRadius: '18px 18px 18px 4px',
                  background: '#FFFFFF',
                  border: '1px solid rgba(20, 20, 19, 0.08)',
                  boxShadow: '0 4px 18px -2px rgba(20, 20, 19, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14
                }}
              >
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <span className="ai-dot-pulse" style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#141413' }} />
                  <span className="ai-dot-pulse" style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#141413', animationDelay: '0.2s' }} />
                  <span className="ai-dot-pulse" style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#141413', animationDelay: '0.4s' }} />
                </div>
                <span style={{ fontSize: '0.88rem', color: '#52525B', fontStyle: 'italic' }}>
                  Preparing a thoughtful, gentle reflection for you...
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="alert-banner alert-warning" style={{ margin: '8px 0' }}>
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <form onSubmit={(e) => handleSend(e)} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Ask your question respectfully and freely..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              maxLength={2500}
              style={{
                borderRadius: 'var(--radius-pill)',
                padding: '12px 18px',
                background: '#FFFFFF',
                border: '1px solid var(--border-light)'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-black-pill"
            disabled={isLoading || !input.trim()}
            style={{ padding: '11px 22px' }}
          >
            <Send size={14} />
            <span>Send</span>
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              className="crowd-btn-report"
              onClick={handleOpenClearModal}
              title="Clear dialogue history"
            >
              <Trash2 size={14} />
            </button>
          )}
        </form>
      </div>

      {/* Warning Modal: Clear AI Dialogue Without Deleting Identity */}
      {isClearModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" onClick={() => setIsClearModalOpen(false)} role="dialog" aria-modal="true">
          <div
            className="modal-dialog crowd-card modal-center-pop"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 500,
              background: '#FFFFFF',
              borderRadius: 20,
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

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsClearModalOpen(false)}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Trash2 size={18} />
              </div>
              <div>
                <span className="mono-subtle" style={{ color: '#DC2626', display: 'block', fontSize: '0.72rem' }}>
                  CONVERSATION WIPE //
                </span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', margin: 0, color: '#141413' }}>
                  Clear AI Dialogue History?
                </h3>
              </div>
            </div>

            <div
              style={{
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: 12,
                padding: '12px 14px',
                marginBottom: 16,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start'
              }}
            >
              <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.82rem', lineHeight: 1.5, color: '#92400E' }}>
                <strong>Warning:</strong> You are about to permanently erase your AI well-being reflection dialogue from this device.
              </div>
            </div>

            <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#52525B', marginBottom: 20 }}>
              Your cryptographic identity (<strong>{identity?.username || 'Current Session'}</strong>), joined communities, and public questions will remain completely safe and intact. Only your AI reflection dialogue will be deleted. This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="crowd-pill-btn"
                onClick={() => setIsClearModalOpen(false)}
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              >
                Cancel & Keep Dialogue
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                style={{
                  padding: '8px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: 9999,
                  cursor: 'pointer',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Trash2 size={14} />
                <span>Confirm & Delete Chat</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Archival Assurance Callout */}
      <section className="crowd-footer-assurance">
        <p className="mono-subtle" style={{ textAlign: 'center', letterSpacing: '0.12em', color: '#71717A' }}>
          ANON AI SANCTUARY • ZERO SERVER LOGS • PERSISTED ON DEVICE UNTIL IDENTITY REMOVAL
        </p>
      </section>
    </div>
  );
}

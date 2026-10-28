import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { getConversations } from '../services/api.js';
import DeleteIdentityModal from './DeleteIdentityModal.jsx';
import {
  Home,
  MessageSquare,
  Users,
  Sparkles,
  ShieldCheck,
  Headphones,
  Sliders,
  Menu,
  X,
  ChevronRight,
  Plus,
  Trash2,
  ChevronDown,
  Bell,
  BellOff,
  Sun,
  Moon
} from 'lucide-react';

export default function Navbar() {
  const {
    identity,
    identities,
    maxIdentities,
    canCreateMore,
    isAuthenticated,
    enter,
    createIdentity,
    openCreateModal,
    switchIdentity,
    removeIdentity,
    leave,
    isLoading
  } = useAuth();

  const { socket, isMuted, toggleMute, showToast } = useRealtime();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [identityDropdownOpen, setIdentityDropdownOpen] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false, targetIdentity: null });
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const dropdownRef = useRef(null);

  // Load unread count across all conversations
  async function fetchUnreadCount() {
    try {
      const res = await getConversations();
      if (res && res.conversations) {
        const total = res.conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setUnreadMessagesCount(total);
      }
    } catch {
      // ignore
    }
  }

  // Socket notification listener for incoming messages
  useEffect(() => {
    if (!isAuthenticated || !identity) {
      setUnreadMessagesCount(0);
      return;
    }

    fetchUnreadCount();

    if (!socket) return;

    const handleMsg = () => {
      setUnreadMessagesCount((prev) => prev + 1);
    };

    const handleUpdate = () => {
      fetchUnreadCount();
    };

    socket.on('incoming_message_notification', handleMsg);
    socket.on('conversation_updated', handleUpdate);

    return () => {
      socket.off('incoming_message_notification', handleMsg);
      socket.off('conversation_updated', handleUpdate);
    };
  }, [isAuthenticated, identity?.id || identity?._id, socket]);

  // When visiting messages page, refresh unread counter
  useEffect(() => {
    if (location.pathname === '/messages') {
      fetchUnreadCount();
    }
  }, [location.pathname]);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setIdentityDropdownOpen(false);
  }, [location.pathname]);

  // Close identity dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIdentityDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setIdentityDropdownOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent background scroll while mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  function handleOpenCreate() {
    openCreateModal({
      reason: 'Create an anonymous cryptographic persona to participate in discussions, send messages, and join communities.'
    });
  }

  function handleCreateIdentity() {
    if (!canCreateMore) {
      showToast({
        type: 'warning',
        title: 'Identity Limit Reached',
        message: 'You have reached the maximum of 5 identities. Please remove an existing persona first.'
      });
      return;
    }
    setIdentityDropdownOpen(false);
    openCreateModal({
      reason: 'Generate an additional cryptographic persona (up to 5 max).'
    });
  }

  async function handleSwitch(identityId) {
    try {
      await switchIdentity(identityId);
      setIdentityDropdownOpen(false);
      setMobileMenuOpen(false);
      navigate('/home', { replace: true });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Switch Failed',
        message: err.message || 'Failed to switch identity.'
      });
    }
  }

  async function handleConfirmDelete(identityId, options) {
    try {
      setIsDeleting(true);
      await removeIdentity(identityId, options);
    } catch (err) {
      console.error('Failed to remove identity:', err);
    } finally {
      setIsDeleting(false);
      setDeleteModalState({ isOpen: false, targetIdentity: null });
    }
  }

  function handleRemoveActiveIdentity() {
    if (identity) {
      setDeleteModalState({ isOpen: true, targetIdentity: identity });
    }
  }

  return (
    <>
      {/* Conscious Removal Confirmation Modal */}
      <DeleteIdentityModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, targetIdentity: null })}
        targetIdentity={deleteModalState.targetIdentity}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Dimmed backdrop portal for mobile overlay */}
      {mobileMenuOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="mobile-nav-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />,
        document.body
      )}

      <header className="navbar">
        <div className="navbar-inner">
          <div className="nav-brand">
            <Link to="/" className="brand-logo" onClick={() => setMobileMenuOpen(false)}>
              <img
                src={theme === 'dark' ? '/anonlogo_light.png' : '/anonlogo_dark.png'}
                alt="ANON"
                className="navbar-logo-img"
              />
              <span>ANON</span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="nav-links hide-mobile">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Home
            </NavLink>
            {isAuthenticated ? (
              <>
                <NavLink to="/crowd" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Discussions
                </NavLink>
                <NavLink to="/communities" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Communities
                </NavLink>
                <NavLink to="/ai-guide" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Sparkles size={14} /> AI Assistant
                </NavLink>
                <NavLink to="/professionals" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <ShieldCheck size={14} /> Doctors & Counselors
                </NavLink>
                <NavLink to="/listening-rooms" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Headphones size={14} /> Listening Rooms
                </NavLink>
                <NavLink to="/messages" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <MessageSquare size={14} /> Messages
                  {unreadMessagesCount > 0 && (
                    <span className="nav-unread-badge" title={`${unreadMessagesCount} unread message${unreadMessagesCount > 1 ? 's' : ''}`}>
                      {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                    </span>
                  )}
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/crowd" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Discussions</NavLink>
                <NavLink to="/communities" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Communities</NavLink>
                <NavLink to="/professionals" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Doctors & Counselors</NavLink>
                <NavLink to="/listening-rooms" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Listening Rooms</NavLink>
              </>
            )}
          </nav>

          {/* Right Action / Profile */}
          <div className="nav-actions-right">
            {isAuthenticated ? (
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="identity-badge"
                  onClick={() => {
                    // On mobile/tablet screens, open unified mobile sheet
                    if (window.innerWidth <= 1024) {
                      setMobileMenuOpen(!mobileMenuOpen);
                    } else {
                      setIdentityDropdownOpen(!identityDropdownOpen);
                    }
                  }}
                  title="Switch identity or manage cryptographic personas"
                >
                  <span className="identity-dot" />
                  <span className="identity-username-text">
                    {identity?.username}
                  </span>
                  <span className="identity-count-badge hide-mobile">
                    ({identities.length}/5)
                  </span>
                  <ChevronDown size={13} className="identity-chevron hide-mobile" />
                </button>

                {/* Identity Popover Dropdown (for desktop) */}
                {identityDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: 300,
                      maxWidth: 'calc(100vw - 32px)',
                      background: '#FFFFFF',
                      borderRadius: 16,
                      boxShadow: '0 16px 36px -8px rgba(0,0,0,0.25)',
                      border: '1px solid #141413',
                      padding: 16,
                      zIndex: 1000
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>
                      <div>
                        <span className="mono-subtle" style={{ fontSize: '0.65rem', color: '#71717A', display: 'block' }}>
                          CRYPTOGRAPHIC PERSONAS
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#141413' }}>
                          Identities ({identities.length}/{maxIdentities})
                        </span>
                      </div>
                      <span className="crowd-tag-pill highlight" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                        Max 5
                      </span>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: '#71717A', marginBottom: 12, lineHeight: 1.4 }}>
                      Switch personas anytime. Identities persist on this device until you consciously remove them.
                    </p>

                    {/* Identities List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', marginBottom: 12 }}>
                      {identities.map((item) => {
                        const isCurrent = item.isCurrent || (identity && (item.id === identity.id || item.username === identity.username));
                        return (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: 10,
                              background: isCurrent ? '#F4F4F5' : '#FAFAFA',
                              border: isCurrent ? '1px solid #141413' : '1px solid var(--border-light)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              <span className="identity-dot" style={{ width: 7, height: 7, flexShrink: 0 }} />
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.username}
                              </span>
                              {isCurrent && (
                                <span style={{ fontSize: '0.65rem', color: '#16A34A', fontWeight: 700, flexShrink: 0 }}>
                                  Active
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              {!isCurrent && (
                                <button
                                  type="button"
                                  className="crowd-pill-btn"
                                  style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                                  onClick={() => handleSwitch(item.id)}
                                >
                                  Switch
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeleteModalState({ isOpen: true, targetIdentity: item })}
                                title="Consciously remove identity"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#DC2626',
                                  padding: 4,
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Create New Identity Button */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
                      <button
                        type="button"
                        className="btn-black-pill"
                        style={{ width: '100%', justifyContent: 'center', padding: '7px 12px', fontSize: '0.78rem' }}
                        onClick={handleCreateIdentity}
                        disabled={!canCreateMore || isCreating}
                        title={canCreateMore ? 'Generate another cryptographic identity' : 'Limit of 5 identities reached'}
                      >
                        <Plus size={13} />
                        <span>{isCreating ? 'Creating...' : canCreateMore ? 'Create New Identity' : 'Identity Limit Reached (5/5)'}</span>
                      </button>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginTop: 2 }}>
                        <Link
                          to="/settings"
                          onClick={() => setIdentityDropdownOpen(false)}
                          style={{ color: '#141413', textDecoration: 'underline', fontWeight: 600 }}
                        >
                          Identity Settings & Privacy →
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setIdentityDropdownOpen(false);
                            handleRemoveActiveIdentity();
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#DC2626',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="Consciously remove active identity while preserving your other personas"
                        >
                          <Trash2 size={11} />
                          <span>Remove Identity</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-sm btn-nav-enter"
                onClick={handleOpenCreate}
                disabled={isLoading}
              >
                <Plus size={13} />
                <span className="enter-text-full">Create Identity</span>
                <span className="enter-text-short">Create</span>
              </button>
            )}

            {/* Dark / White Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="crowd-pill-btn nav-theme-toggle-btn"
              style={{
                padding: '6px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.78rem',
                borderRadius: 9999
              }}
              title={theme === 'dark' ? 'Switch to White Theme' : 'Switch to Dark Theme'}
              aria-label={theme === 'dark' ? 'Switch to White Theme' : 'Switch to Dark Theme'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span className="enter-text-full">{theme === 'dark' ? 'White' : 'Dark'}</span>
            </button>

            {/* Notification Mute Toggle Button */}
            <button
              type="button"
              onClick={toggleMute}
              className="crowd-pill-btn"
              style={{
                padding: '6px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.78rem',
                color: isMuted ? '#DC2626' : '#141413',
                borderColor: isMuted ? '#FECACA' : 'rgba(0,0,0,0.12)',
                background: isMuted ? '#FEF2F2' : 'transparent',
                borderRadius: 9999
              }}
              title={isMuted ? 'Notifications Muted (Click to Unmute)' : 'Notifications Active (Click to Mute)'}
              aria-label={isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
            >
              {isMuted ? <BellOff size={14} /> : <Bell size={14} />}
              <span className="enter-text-full">{isMuted ? 'Muted' : 'Alerts'}</span>
            </button>

            {/* Mobile hamburger toggle */}
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close Navigation' : 'Open Navigation'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="mobile-nav-menu" role="dialog" aria-label="Mobile Navigation">
            {/* Identity / Session banner */}
            {isAuthenticated ? (
              <div className="mobile-nav-identity-card">
                <div className="mobile-nav-identity-info">
                  <span className="identity-dot" />
                  <div className="mobile-nav-identity-text">
                    <span className="mobile-nav-identity-label">ACTIVE CRYPTOGRAPHIC PERSONA</span>
                    <span className="mobile-nav-identity-name" style={{ fontFamily: 'var(--font-mono)' }}>
                      {identity?.username}
                    </span>
                  </div>
                  <span className="crowd-tag-pill highlight" style={{ marginLeft: 'auto', fontSize: '0.65rem', flexShrink: 0 }}>
                    {identities.length}/5 Used
                  </span>
                </div>

                {/* Mobile Identities switcher */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 150, overflowY: 'auto' }}>
                    {identities.map((item) => {
                      const isCurrent = item.isCurrent || (identity && (item.id === identity.id || item.username === identity.username));
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: isCurrent ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                            border: isCurrent ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
                            padding: '6px 10px',
                            borderRadius: 10
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span className="identity-dot" style={{ width: 6, height: 6, flexShrink: 0 }} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.82rem', color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.username}
                            </span>
                            {isCurrent && (
                              <span style={{ fontSize: '0.65rem', color: '#50FA7B', fontWeight: 700, flexShrink: 0, marginLeft: 2 }}>
                                (Active)
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            {!isCurrent && (
                              <button
                                type="button"
                                className="mobile-action-btn"
                                style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                                onClick={() => {
                                  handleSwitch(item.id);
                                  setMobileMenuOpen(false);
                                }}
                              >
                                Switch
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteModalState({ isOpen: true, targetIdentity: item });
                                setMobileMenuOpen(false);
                              }}
                              title="Consciously remove persona"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#EF4444',
                                cursor: 'pointer',
                                padding: 4,
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mobile-nav-identity-actions" style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    className="mobile-action-btn"
                    onClick={handleCreateIdentity}
                    disabled={!canCreateMore || isCreating}
                  >
                    <Plus size={13} />
                    <span>{canCreateMore ? 'Create Persona' : 'Max Personas (5/5)'}</span>
                  </button>
                  <button
                    type="button"
                    className="mobile-action-btn"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/settings');
                    }}
                  >
                    <Sliders size={13} />
                    <span>Settings</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mobile-nav-identity-card mobile-nav-guest-card">
                <span className="mobile-nav-identity-label">ANONYMOUS GUEST</span>
                <p style={{ fontSize: '0.8rem', color: '#C2C1BA', margin: '4px 0 10px 0', lineHeight: 1.35 }}>
                  Generate a zero-knowledge identity to ask questions, join communities, and send encrypted messages.
                </p>
                <button
                  type="button"
                  className="mobile-action-btn"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: '0.85rem' }}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleOpenCreate();
                  }}
                  disabled={isLoading}
                >
                  <Plus size={14} />
                  <span>Create Anonymous Identity</span>
                </button>
              </div>
            )}

            <div className="mobile-nav-divider" />

            {/* Navigation links */}
            <nav className="mobile-nav-links-list">
              <NavLink
                to="/"
                end
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="mobile-nav-item-left">
                  <Home size={18} className="mobile-nav-item-icon" />
                  <span>Home</span>
                </div>
                <ChevronRight size={16} className="mobile-nav-item-chevron" />
              </NavLink>

              <NavLink
                to="/crowd"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="mobile-nav-item-left">
                  <Users size={18} className="mobile-nav-item-icon" />
                  <span>Ask the Crowd</span>
                </div>
                <ChevronRight size={16} className="mobile-nav-item-chevron" />
              </NavLink>

              <NavLink
                to="/communities"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="mobile-nav-item-left">
                  <Users size={18} className="mobile-nav-item-icon" />
                  <span>Communities</span>
                </div>
                <ChevronRight size={16} className="mobile-nav-item-chevron" />
              </NavLink>

              <NavLink
                to="/ai-guide"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="mobile-nav-item-left">
                  <Sparkles size={18} className="mobile-nav-item-icon" />
                  <span>AI Assistant</span>
                </div>
                <ChevronRight size={16} className="mobile-nav-item-chevron" />
              </NavLink>

              <NavLink
                to="/professionals"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="mobile-nav-item-left">
                  <ShieldCheck size={18} className="mobile-nav-item-icon" />
                  <span>Doctors & Counselors</span>
                </div>
                <ChevronRight size={16} className="mobile-nav-item-chevron" />
              </NavLink>

              <NavLink
                to="/listening-rooms"
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="mobile-nav-item-left">
                  <Headphones size={18} className="mobile-nav-item-icon" />
                  <span>Listening Rooms</span>
                </div>
                <ChevronRight size={16} className="mobile-nav-item-chevron" />
              </NavLink>

              {isAuthenticated && (
                <NavLink
                  to="/messages"
                  className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="mobile-nav-item-left">
                    <MessageSquare size={18} className="mobile-nav-item-icon" />
                    <span>Private Messages</span>
                  </div>
                  {unreadMessagesCount > 0 ? (
                    <span className="nav-unread-badge" style={{ marginRight: 6 }}>
                      {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                    </span>
                  ) : (
                    <ChevronRight size={16} className="mobile-nav-item-chevron" />
                  )}
                </NavLink>
              )}

              {isAuthenticated && (
                <NavLink
                  to="/settings"
                  className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="mobile-nav-item-left">
                    <Sliders size={18} className="mobile-nav-item-icon" />
                    <span>Settings & Privacy</span>
                  </div>
                  <ChevronRight size={16} className="mobile-nav-item-chevron" />
                </NavLink>
              )}

              {/* Mobile Dark / White Theme Toggle */}
              <button
                type="button"
                className="mobile-nav-item"
                onClick={toggleTheme}
                style={{
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px'
                }}
              >
                <div className="mobile-nav-item-left">
                  {theme === 'dark' ? (
                    <Sun size={18} className="mobile-nav-item-icon" />
                  ) : (
                    <Moon size={18} className="mobile-nav-item-icon" />
                  )}
                  <span>{theme === 'dark' ? 'White Theme' : 'Dark Theme'}</span>
                </div>
                <span className="crowd-tag-pill highlight" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                  {theme === 'dark' ? 'Dark' : 'White'}
                </span>
              </button>

              <button
                type="button"
                className="mobile-nav-item"
                onClick={toggleMute}
                style={{
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px'
                }}
              >
                <div className="mobile-nav-item-left">
                  {isMuted ? (
                    <BellOff size={18} className="mobile-nav-item-icon" style={{ color: '#DC2626' }} />
                  ) : (
                    <Bell size={18} className="mobile-nav-item-icon" />
                  )}
                  <span>{isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</span>
                </div>
                <span className="crowd-tag-pill highlight" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                  {isMuted ? 'Muted' : 'Active'}
                </span>
              </button>
            </nav>

            {/* Mobile Nav Footer */}
            <div className="mobile-nav-footer">
              <span style={{ color: '#71717A', fontSize: '0.65rem' }}>ANON // Zero Tracking Architecture</span>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleRemoveActiveIdentity();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#DC2626',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Trash2 size={12} />
                  <span>Remove Identity</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}

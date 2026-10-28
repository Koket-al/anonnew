import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import {
  Shield,
  HeartHandshake,
  Sparkles,
  UserCheck,
  Headphones,
  ArrowRight,
  Lock,
  EyeOff,
  MessageSquare,
  HelpCircle,
  ChevronDown,
  RotateCw,
  PhoneCall,
  ExternalLink,
  Users,
  Shuffle,
  ToggleLeft,
  ToggleRight,
  Check,
  AlertTriangle,
  Plus,
  Sun,
  Moon
} from 'lucide-react';

const FAQ_ITEMS = [
  {
    category: 'Getting Started',
    badge: 'Sanctuary',
    question: 'What is ANON and who is it created for?',
    lead: 'Private youth sanctuary',
    answer: 'A confidential space for young people to speak freely about mental health, relationships, and struggles without fear of judgment.',
    footer: ['Peer-to-peer empathy', 'Zero judgment']
  },
  {
    category: 'Getting Started',
    badge: 'Zero Sign-Up',
    question: 'Do I need an email, phone number, or password to use ANON?',
    lead: 'No personal data required',
    answer: 'No personal data is ever collected. When you decide to create an identity, one gentle click generates an instant private pseudonym (e.g., Ab1z4Qt) with zero passwords or personal records.',
    footer: ['Instant pseudonym', 'Zero personal records']
  },
  {
    category: 'Getting Started',
    badge: 'Instant Access',
    question: 'What does the discussion room button do?',
    lead: 'Free community browsing',
    answer: 'It brings you straight into our main peer discussion room where you can read and explore without needing an identity. You only create a persona when you want to ask or reply.',
    footer: ['Browse freely first', 'Create identity on demand']
  },
  {
    category: 'Privacy & Identity',
    badge: 'Identity Shield',
    question: 'What do the cryptographic usernames look like and how are they generated?',
    lead: 'High-entropy crypto strings',
    answer: 'Identities are generated using cryptographic pseudo-random functions resulting in secure strings like Ab1z4Qt. They never look like dictionary words, real names, or recognizable nicknames.',
    footer: ['Crypto code: Ab1z4Qt', 'Zero real-world linkage']
  },
  {
    category: 'Privacy & Identity',
    badge: 'Up to 5 Personas',
    question: 'Can I have more than one identity and switch between them?',
    lead: '5 concurrent persistent identities',
    answer: 'Yes! Every user can create and hold up to 5 identities at a time. Switching personas never deletes your other identities—they stay preserved on your device until you consciously remove them.',
    footer: ['Hold up to 5 personas', 'Switch anytime without loss']
  },
  {
    category: 'Privacy & Identity',
    badge: 'Conscious Removal',
    question: 'How do I delete an identity and what happens to my messages?',
    lead: 'Conscious removal with content choice',
    answer: 'Identities persist until you consciously remove them. When deleting an identity, you decide whether to leave your messages for peers to learn from or completely purge all your questions and messages from the platform.',
    footer: ['Preserve or purge content', 'Re-eligible up to 5 slots']
  },
  {
    category: 'Privacy & Identity',
    badge: 'Content Sovereignty',
    question: 'Can I delete my messages without deleting my identity?',
    lead: 'Total individual message control',
    answer: 'Yes! You can delete any individual discussion question, reply, or private message at any time with a single click, without deleting your identity.',
    footer: ['Standalone message deletion', 'Immediate removal']
  },
  {
    category: 'Features & Rooms',
    badge: 'Lived Insight',
    question: 'What does the "Has anyone been through this?" feature do?',
    lead: 'Shared lived experience',
    answer: 'It surfaces grounded advice specifically from peers who personally walked through and survived the exact same hardship.',
    footer: ['Peer validation', 'Shared experience badges']
  },
  {
    category: 'Features & Rooms',
    badge: 'Listening Rooms',
    question: 'What is a Listening Room and how is it different from normal chat?',
    lead: 'Presence without debate',
    answer: 'A quiet text room dedicated strictly to emotional presence and patient listening without unsolicited advice or lecturing.',
    footer: ['Judgment-free space', 'Pure emotional presence']
  },
  {
    category: 'Features & Rooms',
    badge: 'Verified Care',
    question: 'Can I talk with real doctors or licensed counselors on ANON?',
    lead: 'Verified health professionals',
    answer: 'Yes, licensed mental health professionals are manually verified by our clinical team for safe, confidential consultations.',
    footer: ['Licensed clinicians', 'Verified credentials']
  },
  {
    category: 'Safety & Help',
    badge: 'Consent First',
    question: 'Can other people send me unwanted private messages?',
    lead: 'Strict mutual consent',
    answer: 'Private 1-on-1 messages require your explicit approval—nobody can message you without your direct consent.',
    footer: ['Mutual connection request', 'One-click block & report']
  },
  {
    category: 'Safety & Help',
    badge: '100% Free',
    question: 'Is ANON completely free? Are there advertisements or subscriptions?',
    lead: 'Free for everyone forever',
    answer: 'ANON is completely free with zero subscription paywalls, no paid tiers, and zero behavioral advertising.',
    footer: ['No paywalls', 'Zero commercial ads']
  },
  {
    category: 'Safety & Help',
    badge: 'Immediate Help',
    question: 'What should I do if I am in immediate crisis or having thoughts of self-harm?',
    lead: 'Emergency crisis support',
    answer: 'Please connect immediately with free, confidential 24/7 crisis specialists: call or text 988 (USA/Canada) or reach local emergency services.',
    footer: ['24/7 Crisis Lifeline 988', 'Confidential emergency care']
  }
];

const ARCH_FAQ_ITEMS = [
  {
    num: '01',
    badge: 'Privacy Barrier',
    icon: Shield,
    question: 'How do everyday social apps fail young people?',
    lead: 'Real identity risk',
    answer: 'Traditional social platforms link to your phone number and expose your personal struggles to classmates, parents, and friends.',
    footer: ['No phone required', 'Zero real-world linkage']
  },
  {
    num: '02',
    badge: 'Crypto Cloak',
    icon: Sparkles,
    question: 'How does ANON generate my identity and what does it look like?',
    lead: 'Cryptographic random string',
    answer: 'When you choose to create an identity, you are assigned a high-entropy string like Ab1z4Qt generated via secure crypto functions—never dictionary usernames or personal names.',
    footer: ['Crypto code: Ab1z4Qt', 'Zero real-world linkage']
  },
  {
    num: '03',
    badge: 'Peer Empathy',
    icon: HeartHandshake,
    question: 'How can I find advice from peers who truly understand?',
    lead: 'Lived experience',
    answer: 'Filter replies to connect directly with people who have walked through and survived the exact hardships you face today.',
    footer: ['Dedicated listening rooms', 'Non-judgmental support']
  },
  {
    num: '04',
    badge: '5 Personas & Sovereignty',
    icon: RotateCw,
    question: 'Can I have multiple identities and how do I delete messages?',
    lead: 'Up to 5 persistent identities',
    answer: 'You are eligible for up to 5 concurrent identities. They persist until you consciously remove them. You can delete any individual message anytime, and choose to preserve or purge all content when removing an identity.',
    footer: ['5 Persistent personas', 'Conscious message control']
  }
];

export default function HomePage() {
  const { identity, identities, openCreateModal, isAuthenticated, isLoading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [activeFaqCategory, setActiveFaqCategory] = useState('All');
  const [expandedFaqIndex, setExpandedFaqIndex] = useState(0);
  const [expandedArchIndex, setExpandedArchIndex] = useState(0);

  // Directly navigates to discussions without creating an identity automatically
  function handleExploreRoom() {
    navigate('/crowd');
  }

  function handleCreateIdentity() {
    openCreateModal({
      reason: 'Create an anonymous cryptographic persona to participate in discussions, send messages, and join communities.'
    });
  }

  function scrollToFAQ() {
    const el = document.getElementById('faq-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  const faqCategories = ['All', 'Getting Started', 'Privacy & Identity', 'Features & Rooms', 'Safety & Help'];

  const filteredFaqs = activeFaqCategory === 'All'
    ? FAQ_ITEMS
    : FAQ_ITEMS.filter((item) => item.category === activeFaqCategory);

  return (
    <div className="home-page-container">
      {/* Continuous 1px Vertical Architectural Grid Guide Lines */}
      <div className="page-vertical-line left" aria-hidden="true" />
      <div className="page-vertical-line right" aria-hidden="true" />


      {/* ====================================================================
          1. The Framed Editorial Hero (Two Profiles with Expressive Sentences)
             Directly inspired by Secure Communication Between Profiles
          ==================================================================== */}
      <section className="secure-hero-frame">
        {/* Vintage Engraved Filigree Ornaments */}
        <img src="/vintage/top-left.svg" className="filigree-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/top-right.svg" className="filigree-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/bottom-left.svg" className="filigree-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/bottom-left.svg" className="filigree-corner br" alt="" aria-hidden="true" />

        <div className="secure-hero-container">
          {/* Stage with Illustration and Live Encrypted Voice Transmission Overlay */}
          <div className="secure-comm-stage">
            <img
              src="/secure-communication.png"
              alt="Secure communication between two profiles"
              className="secure-comm-img"
            />

            {/* Encrypted Voice Streams (Boy Mouth -> Girl Ear, Girl Mouth -> Boy Ear) */}
            <div className="encrypted-voice-overlay" aria-hidden="true">
              <svg
                className="encrypted-voice-svg"
                viewBox="0 0 2172 724"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <linearGradient id="streamGradBoy" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#71717A" stopOpacity="0.85" />
                    <stop offset="50%" stopColor="#27272A" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#71717A" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="streamGradGirl" x1="100%" y1="0%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#71717A" stopOpacity="0.85" />
                    <stop offset="50%" stopColor="#27272A" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#71717A" stopOpacity="0.85" />
                  </linearGradient>
                </defs>

                {/* 1. Boy Voice Emission Arcs (Sound Leaving Boy Mouth) */}
                <g className="voice-mouth-arcs boy-arcs">
                  <path d="M 440 315 A 24 24 0 0 1 440 355" fill="none" stroke="#71717A" strokeWidth="2.5" />
                  <path d="M 460 305 A 36 36 0 0 1 460 365" fill="none" stroke="#71717A" strokeWidth="2.5" />
                  <path d="M 480 295 A 48 48 0 0 1 480 375" fill="none" stroke="#71717A" strokeWidth="2.5" />
                </g>

                {/* 2. Girl Voice Emission Arcs (Sound Leaving Girl Mouth) */}
                <g className="voice-mouth-arcs girl-arcs">
                  <path d="M 1740 370 A 24 24 0 0 0 1740 410" fill="none" stroke="#71717A" strokeWidth="2.5" />
                  <path d="M 1720 360 A 36 36 0 0 0 1720 420" fill="none" stroke="#71717A" strokeWidth="2.5" />
                  <path d="M 1700 350 A 48 48 0 0 0 1700 430" fill="none" stroke="#71717A" strokeWidth="2.5" />
                </g>

                {/* 3. Girl Ear Receiving Arcs */}
                <g className="voice-ear-arcs girl-ear">
                  <path d="M 1845 325 A 24 24 0 0 0 1845 365" fill="none" stroke="#71717A" strokeWidth="2.5" strokeDasharray="5 5" />
                  <path d="M 1825 315 A 36 36 0 0 0 1825 375" fill="none" stroke="#71717A" strokeWidth="2.5" strokeDasharray="5 5" />
                </g>

                {/* 4. Boy Ear Receiving Arcs */}
                <g className="voice-ear-arcs boy-ear">
                  <path d="M 315 280 A 24 24 0 0 1 315 320" fill="none" stroke="#71717A" strokeWidth="2.5" strokeDasharray="5 5" />
                  <path d="M 335 270 A 36 36 0 0 1 335 330" fill="none" stroke="#71717A" strokeWidth="2.5" strokeDasharray="5 5" />
                </g>
              </svg>

              {/* Rhythmic voice equalizer bars near mouth positions */}
              <div className="voice-eq-bars boy-eq" title="Boy voice encrypted transmission">
                <span className="eq-bar bar-1" />
                <span className="eq-bar bar-2" />
                <span className="eq-bar bar-3" />
                <span className="eq-bar bar-4" />
              </div>

              <div className="voice-eq-bars girl-eq" title="Girl voice encrypted transmission">
                <span className="eq-bar bar-1" />
                <span className="eq-bar bar-2" />
                <span className="eq-bar bar-3" />
                <span className="eq-bar bar-4" />
              </div>
            </div>
          </div>

          {/* Expressive Sentences & Actions centered between the two people */}
          <div className="secure-comm-center">
            <div className="hero-brand-crest-wrap landing-crest">
              <img
                src={theme === 'dark' ? '/anonlogo_light.png' : '/anonlogo_dark.png'}
                alt="ANON"
                className="hero-page-logo landing"
              />
            </div>
            <span className="secure-comm-badge">Private Youth Well-being</span>

            <h1 className="secure-comm-title">
              Speak freely.<br />
              Stay anonymous.
            </h1>

            <p className="secure-comm-expressive">
              “You don't have to carry it alone.”
            </p>

            <p className="secure-comm-desc">
              A private, safe space to share what hurts, ask what's hard, and find real support—without anyone ever knowing who you are.
            </p>

            <div className="secure-comm-actions">
              {!isAuthenticated ? (
                <>
                  <button
                    className="btn-black-pill"
                    onClick={handleCreateIdentity}
                    disabled={authLoading}
                  >
                    <Plus size={16} />
                    <span>Create Identity</span>
                    <ArrowRight size={15} />
                  </button>

                  <button
                    className="btn btn-outline"
                    onClick={handleExploreRoom}
                  >
                    <MessageSquare size={15} />
                    <span>Explore Discussions</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn-black-pill"
                    onClick={handleExploreRoom}
                  >
                    <MessageSquare size={16} />
                    <span>Go to Discussions</span>
                    <ArrowRight size={15} />
                  </button>

                  <button
                    className="btn btn-outline"
                    onClick={handleCreateIdentity}
                  >
                    <Plus size={15} />
                    <span>Add Another Persona</span>
                  </button>
                </>
              )}

              <button
                className="btn btn-subtle"
                onClick={scrollToFAQ}
              >
                <HelpCircle size={15} />
                <span>How It Works & FAQs</span>
              </button>
            </div>

            {/* Minimal Dark & White Theme Switcher */}
            <div className="home-theme-toggle-bar">
              <div className="home-theme-toggle-pill" role="group" aria-label="Theme mode switch">
                <button
                  type="button"
                  className={`home-theme-toggle-btn ${theme === 'white' ? 'active' : ''}`}
                  onClick={() => setTheme('white')}
                  title="Switch to White Theme"
                >
                  <Sun size={13} />
                  <span>White</span>
                </button>
                <button
                  type="button"
                  className={`home-theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                  title="Switch to Dark Theme"
                >
                  <Moon size={13} />
                  <span>Dark</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          3. Core Architecture FAQ Section (Simple, 1-Sentence, Interactive)
          Framed with 'flower.png' corners prominent like upper hero
          ==================================================================== */}
      <section id="faq-section" className="editorial-faq-frame" aria-label="Frequently Asked Questions">
        {/* Vintage Floral Corner Ornaments ('flower.png') like upper hero */}
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="editorial-faq-header">
          <span className="manifesto-pill">FAQ & Architecture</span>
          <h2 className="editorial-faq-title">How ANON Protects Your Peace of Mind</h2>
          <p className="editorial-faq-desc">
            Four honest answers about privacy, anonymity, and how we protect your voice.
          </p>
        </div>

        <div className="arch-faq-list">
          {ARCH_FAQ_ITEMS.map((item, index) => {
            const isOpen = expandedArchIndex === index;
            const IconComp = item.icon;
            return (
              <article
                key={item.num}
                className={`arch-faq-item ${isOpen ? 'open' : ''}`}
                tabIndex="0"
              >
                <button
                  type="button"
                  className="arch-faq-trigger"
                  onClick={() => setExpandedArchIndex(isOpen ? -1 : index)}
                  aria-expanded={isOpen}
                >
                  <div className="arch-faq-left">
                    <span className="arch-faq-num">{item.num}</span>
                    <span className="arch-faq-badge">{item.badge}</span>
                    <h3 className="arch-faq-question-text">{item.question}</h3>
                  </div>

                  <div className="arch-faq-right">
                    <div className="arch-faq-icon-wrap" aria-hidden="true">
                      <IconComp size={16} />
                    </div>
                    <div className="arch-faq-icon-toggle" aria-hidden="true">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="arch-faq-panel">
                    <p className="arch-faq-answer">
                      <strong className="faq-lead">{item.lead}</strong> — {item.answer}
                    </p>

                    <div className="arch-faq-footer">
                      <span className="arch-pill">{item.footer[0]}</span>
                      <span className="arch-dot" aria-hidden="true">·</span>
                      <span className="arch-pill">{item.footer[1]}</span>
                    </div>
                  </div>
                )}

                <div className="arch-card-accent" aria-hidden="true" />
              </article>
            );
          })}
        </div>
      </section>

      {/* ====================================================================
          5. How It Works in 3 Steps (Simple English, Framed with Big 'flower.png' corners)
          ==================================================================== */}
      <section className="steps-frame" aria-label="How ANON Works in 3 Steps">
        {/* Large Vintage Floral Corner Ornaments ('flower.png') */}
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="steps-frame-header">
          <span className="manifesto-pill">The Process</span>
          <h2 className="steps-frame-title">How ANON Works in 3 Steps</h2>
          <p className="steps-frame-desc">
            Zero friction. No barrier between you and the honest answers you deserve.
          </p>
        </div>

        <div className="steps-columns-grid">
          {/* Step 01 */}
          <article className="step-item" tabIndex="0">
            <div className="step-item-top">
              <span className="step-item-num">01</span>
              <span className="step-item-badge">Crypto Code</span>
              <div className="step-item-icon" aria-hidden="true">
                <MessageSquare size={16} />
              </div>
            </div>

            <div className="step-item-content">
              <h3 className="step-item-title">Cryptographic Persona</h3>
              <p className="step-item-desc">
                <strong className="step-lead">Random crypto string (e.g. Ab1z4Qt)</strong> — generated by secure crypto entropy. No forms, real names, or dictionary nicknames.
              </p>
            </div>

            <div className="step-item-footer">
              <span className="step-pill">Crypto: Ab1z4Qt</span>
              <span className="step-dot" aria-hidden="true">·</span>
              <span className="step-pill">Zero sign-up</span>
            </div>

            <div className="step-card-accent" aria-hidden="true" />
          </article>

          {/* Step 02 */}
          <article className="step-item" tabIndex="0">
            <div className="step-item-top">
              <span className="step-item-num">02</span>
              <span className="step-item-badge">Multi-Identity</span>
              <div className="step-item-icon" aria-hidden="true">
                <HeartHandshake size={16} />
              </div>
            </div>

            <div className="step-item-content">
              <h3 className="step-item-title">Up to 5 Persistent Personas</h3>
              <p className="step-item-desc">
                <strong className="step-lead">Switch without losing history</strong> — hold up to 5 identities simultaneously. Switching never erases your personas; they stay on your device.
              </p>
            </div>

            <div className="step-item-footer">
              <span className="step-pill">5 Eligible identities</span>
              <span className="step-dot" aria-hidden="true">·</span>
              <span className="step-pill">Persistent storage</span>
            </div>

            <div className="step-card-accent" aria-hidden="true" />
          </article>

          {/* Step 03 */}
          <article className="step-item" tabIndex="0">
            <div className="step-item-top">
              <span className="step-item-num">03</span>
              <span className="step-item-badge">Content Control</span>
              <div className="step-item-icon" aria-hidden="true">
                <RotateCw size={16} />
              </div>
            </div>

            <div className="step-item-content">
              <h3 className="step-item-title">Conscious Erasure & Message Choice</h3>
              <p className="step-item-desc">
                <strong className="step-lead">Total message sovereignty</strong> — delete individual messages anytime. When consciously deleting an identity, choose to leave messages for peers or purge completely.
              </p>
            </div>

            <div className="step-item-footer">
              <span className="step-pill">Standalone deletion</span>
              <span className="step-dot" aria-hidden="true">·</span>
              <span className="step-pill">Leave or purge</span>
            </div>

            <div className="step-card-accent" aria-hidden="true" />
          </article>
        </div>
      </section>

      {/* ====================================================================
          6. Knowledge Base FAQ Section (Framed with Big 'flower.png' corners)
          ==================================================================== */}
      <section id="knowledge-base" className="editorial-faq-frame knowledge-faq-frame" aria-label="Knowledge Base Frequently Asked Questions">
        {/* Large Vintage Floral Corner Ornaments ('flower.png') */}
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <div className="editorial-faq-header">
          <span className="manifesto-pill">Knowledge Base</span>
          <h2 className="editorial-faq-title">Frequently Asked Questions</h2>
          <p className="editorial-faq-desc">
            Clear, honest answers about privacy, identity rotation, and how the discussion room works.
          </p>
        </div>

        {/* FAQ Category Filter Tabs */}
        <div className="faq-filter-bar">
          {faqCategories.map((category) => (
            <button
              key={category}
              type="button"
              className={`faq-filter-btn ${activeFaqCategory === category ? 'active' : ''}`}
              onClick={() => {
                setActiveFaqCategory(category);
                setExpandedFaqIndex(0);
              }}
            >
              {category}
            </button>
          ))}
        </div>

        {/* FAQ Accordion List with Spotlight Reading */}
        <div className="arch-faq-list">
          {filteredFaqs.map((faq, index) => {
            const isOpen = expandedFaqIndex === index;
            const itemNum = String(index + 1).padStart(2, '0');
            return (
              <article
                key={faq.question}
                className={`arch-faq-item ${isOpen ? 'open' : ''}`}
                tabIndex="0"
              >
                <button
                  type="button"
                  className="arch-faq-trigger"
                  onClick={() => setExpandedFaqIndex(isOpen ? -1 : index)}
                  aria-expanded={isOpen}
                >
                  <div className="arch-faq-left">
                    <span className="arch-faq-num">{itemNum}</span>
                    <span className="arch-faq-badge">{faq.badge}</span>
                    <h3 className="arch-faq-question-text">{faq.question}</h3>
                  </div>

                  <div className="arch-faq-right">
                    <div className="arch-faq-icon-toggle" aria-hidden="true">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="arch-faq-panel">
                    <p className="arch-faq-answer">
                      <strong className="faq-lead">{faq.lead}</strong> — {faq.answer}
                    </p>

                    <div className="arch-faq-footer">
                      <span className="arch-pill">{faq.footer[0]}</span>
                      <span className="arch-dot" aria-hidden="true">·</span>
                      <span className="arch-pill">{faq.footer[1]}</span>
                    </div>
                  </div>
                )}

                <div className="arch-card-accent" aria-hidden="true" />
              </article>
            );
          })}
        </div>
      </section>

      {/* ====================================================================
          7. Bottom Callout Banner (Framed with Vintage 'flower.png' corners)
          ==================================================================== */}
      <section className="bottom-cta-box" aria-label="Ready to Enter">
        {/* Large Vintage Floral Corner Ornaments ('flower.png') */}
        <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
        <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

        <h2 className="bottom-cta-title">Ready to Join the Conversation?</h2>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
          {!isAuthenticated ? (
            <>
              <button
                className="btn-black-pill bottom-cta-btn"
                onClick={handleCreateIdentity}
                disabled={authLoading}
              >
                <Plus size={17} />
                <span>Create Identity</span>
                <ArrowRight size={17} />
              </button>
              <button
                className="btn btn-outline"
                style={{ borderRadius: 9999, padding: '10px 22px' }}
                onClick={handleExploreRoom}
              >
                <MessageSquare size={17} />
                <span>Explore Discussions First</span>
              </button>
            </>
          ) : (
            <button
              className="btn-black-pill bottom-cta-btn"
              onClick={handleExploreRoom}
            >
              <MessageSquare size={17} />
              <span>Enter Discussions</span>
              <ArrowRight size={17} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

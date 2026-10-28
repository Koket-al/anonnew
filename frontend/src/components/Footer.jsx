import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        {/* Framed Editorial Banner with Vintage Floral Corners */}
        <div className="footer-framed-card">
          {/* Vintage Floral Corner Ornaments ('flower.png') */}
          <img src="/vintage/flower.png" className="flower-corner tl" alt="" aria-hidden="true" />
          <img src="/vintage/flower.png" className="flower-corner tr" alt="" aria-hidden="true" />
          <img src="/vintage/flower.png" className="flower-corner bl" alt="" aria-hidden="true" />
          <img src="/vintage/flower.png" className="flower-corner br" alt="" aria-hidden="true" />

          <img
            src="/ANONimage.jpeg"
            alt="ANON"
            className="footer-anon-image"
          />
        </div>

        {/* Bottom Bar: Copyright & Slogan */}
        <div className="footer-bottom-row">
          <div className="footer-copyright-block">
            <span className="footer-copyright-text">
              © {new Date().getFullYear()} ANON Platform. All rights reserved.
            </span>
            <span className="footer-vertical-line" aria-hidden="true">·</span>
            <span className="footer-sub-slogan">
              Speak freely. Stay anonymous.
            </span>
            <span className="footer-vertical-line" aria-hidden="true">·</span>
            <Link to="/admin" className="footer-sub-slogan" style={{ textDecoration: 'none', opacity: 0.65 }}>
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

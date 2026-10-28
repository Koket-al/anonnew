# ANON — Anonymous Youth Health & Well-being Platform

> **“Speak freely. Stay anonymous.”**  
> A private space for young people to ask sensitive questions about health, relationships, mental well-being, sexual health, addiction, and personal struggles without fear of judgment, exposure, or discrimination.

---

## 1. Project Overview & Philosophy

Many young people hesitate to ask critical questions about their emotional and physical well-being because conventional platforms force them to provide real names, emails, phone numbers, or social media logins. They fear being judged by parents, teachers, or peers.

**ANON** solves this by providing:
1. **Frictionless Anonymous Entry**: One click creates a cryptographically secure anonymous session and a friendly random pseudonym (e.g., `QuietRiver42`, `SilverCloud83`). No email, phone number, real name, or password required.
2. **Identity Rotation**: Users can click **New Anonymous Identity** anytime to revoke the active session and receive a completely new, unlinked identity. The system never publishes or tracks linkages between identities.
3. **Ask the Crowd**: Ask sensitive questions publicly or within topic communities. Questions can feature the **“Has anyone been through this?”** flag, allowing peers with firsthand experience to respond with self-reported shared experience badges.
4. **Peer-Created Communities**: Users discover, join, and create their own communities around topics like Academic Pressure, Relationship Boundaries, Family Dynamics, and Sobriety. Community creators can curate guidelines and moderate content.
5. **AI Well-being Guide**: A backend-proxied AI assistant that provides calm, empathetic, scientifically grounded health guidance. Grounded in safety protocols for immediate crisis helplines, with clear clinical disclaimers.
6. **Verified Health Professionals**: A directory of state-licensed clinicians (psychologists, adolescent physicians, family therapists). All clinician registrations undergo a mandatory manual verification workflow before being listed publicly. Anonymous users can submit private consultation inquiries directly to verified professionals.
7. **Listening Rooms (“I Just Need Someone to Listen”)**: Live text spaces governed by the core guideline: *“Sometimes people need to be heard, not advised. Ask whether advice is welcome before giving it.”*
8. **Private Anonymous Messaging**: Mutual consent connection requests, real-time messaging powered by Socket.IO, server-side participant authorization, blocking, and reporting.
9. **Safety & Moderation Portal**: Passphrase-protected moderation console to investigate reports, remove harmful content, suspend abusive identities, and verify professional credentials.

---

## 2. Visual Direction & UI/UX

ANON is built following a minimal, editorial, human-designed aesthetic inspired by calm editorial publications:
- **Palette**: Warm off-white / light cream background (`#FBFBF9`), crisp white cards (`#FFFFFF`), charcoal typography (`#141413`), and thin, subtle borders (`#E7E5DF`).
- **Typography**: Restrained serif typography for major headings (`Newsreader`, Georgia) paired with a clean, readable sans-serif (`Inter`, system-ui) for body text and controls.
- **Restraint**: Zero glowing gradients, zero 3D floating shapes, no decorative cards or fake counters. Every element exists to provide clarity, dignity, and calm.
- **Regular CSS**: Built strictly with standard CSS (no Tailwind CSS).

---

## 3. Technology Stack

- **Frontend**:
  - React 18 + Vite
  - JavaScript (ES Modules)
  - React Router DOM v6
  - Lucide React (restrained, lightweight icons)
  - Regular CSS with CSS Custom Properties
  - Fetch API (`credentials: 'include'`)
  - Socket.IO Client for real-time private messages and listening rooms
- **Backend**:
  - Node.js (v20+) & Express.js
  - MongoDB & Mongoose ODM
  - Socket.IO for real-time events
  - `crypto` (SHA-256 session token hashing & cryptographically secure random bytes)
  - `bcryptjs` (salt 10 for professional clinician passwords)
  - `helmet`, `cors`, `cookie-parser`
  - `express-rate-limit` (protection against spam, brute force, and identity flood)
  - `xss` (HTML sanitization of user-generated text)
  - Configurable AI Adapter (Gemini API, OpenAI API, or None with fallback banner)

---

## 4. Architecture & Security Highlights

### Anonymous Session Management
- Clicking **Enter Anonymously** generates 32 bytes of cryptographic randomness.
- The raw token is stored in an `HttpOnly`, `SameSite=lax` cookie (`anon_session_token`).
- In the MongoDB database, only the **SHA-256 hash** of the token is saved (`AnonymousSession`), with an automatic MongoDB TTL index for expiration.
- Sessions can be rotated at will. Rotating revokes the previous session atomically and creates a new identity without retaining any relationship link.

### Content Authorization & Private Messages
- Every private conversation and message request is authorized on the server.
- The backend verifies that the requesting identity is one of the two participants. Attempting to access or send to an unjoined conversation returns `403 Forbidden`.
- Blocking immediately prevents communication in both directions.

### External AI Integration
- AI queries are routed strictly through the backend (`POST /api/ai/chat`).
- User identifiers, session tokens, and IP addresses are stripped before communicating with external AI providers.
- An adapter pattern (`getAIAdapter`) enables switching between **Gemini** and **OpenAI** via environment variables. If no API key is provided, the platform presents a helpful configuration message while keeping all other features fully operational.

### Verified Clinicians Lifecycle
- Clinicians register with full name, state licensing jurisdiction, license number, and specialties.
- Status is initialized to `pending`. **Unverified professionals are NEVER displayed in the public directory.**
- Authorized reviewers in the Moderation Portal inspect credentials and transition status to `verified`.

---

## 5. Prerequisites & Environment Setup

### Prerequisites
- **Node.js** v18+ or v20+
- **MongoDB** running locally (`mongodb://127.0.0.1:27017`) or a **MongoDB Atlas** connection string.

### Environment Variables

#### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Backend server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/anon_db` |
| `SESSION_SECRET` | Secret used to sign cookies | `dev_session_secret_32bytes_min` |
| `JWT_SECRET` | Secret used for professional tokens | `dev_jwt_secret_32bytes_min` |
| `MODERATOR_SECRET` | (Removed — moderator auth now uses server-side role on anonymous identity) | N/A |
| `CLIENT_ORIGIN` | Allowed CORS frontend origin | `http://localhost:5173` |
| `AI_PROVIDER` | AI provider adapter (`gemini`, `openai`, `none`) | `gemini` |
| `AI_API_KEY` | API Key for external AI service (optional) | *Leave blank or add key* |
| `AI_MODEL` | AI Model name | `gemini-1.5-flash` |

---

## 6. Installation & Quick Start

### 1. Install Dependencies
From the repository root:
```bash
npm run install:all
```
*(Or install separately with `cd backend && npm install` and `cd frontend && npm install`)*

### 2. Seed Initial Development Data
Pre-populates starter communities, questions with shared experience flags, a verified psychologist (`Dr. Maya Lin`), and a pending clinician awaiting review:
```bash
npm run seed
```

### 3. Start the Backend Server
```bash
npm run dev:backend
```
Server runs at **http://localhost:5000**.

### 4. Start the Frontend Application
In a second terminal window:
```bash
npm run dev:frontend
```
Frontend runs at **http://localhost:5173**. Open this URL in your web browser.

---

## 7. Running the Automated Tests

ANON includes a comprehensive integration test suite verifying anonymous session creation, identity rotation, community creation/joining, "Has anyone been through this?" toggles, private message authorization, directory filtering of unverified clinicians, and moderation approval:

```bash
npm test
```
*(All 13 integration tests run against the local MongoDB using Node's native test runner).*

---

## 8. Features & How to Test Each

### A. Anonymous Entry & Identity Rotation
1. Visit `http://localhost:5173`.
2. Click **Enter Anonymously**.
3. Notice your generated random pseudonym (e.g., `QuietRiver42`) in the navigation bar.
4. Click **New Identity** (or visit **Settings & Privacy**). Notice the confirmation prompt: your previous identity is revoked and a fresh pseudonym takes its place.

### B. Ask the Crowd & "Has anyone been through this?"
1. Navigate to **Ask the Crowd** (`/crowd`).
2. Click **Ask a Question**. Fill in your struggle and ensure **“Has anyone been through this?”** is checked.
3. Click the **“I've been through this”** button on any post to increment the shared experience counter.
4. Click on a question title to view the full discussion thread.
5. In the reply composer, check **“I am speaking from personal firsthand experience”** to attach a verified experience badge to your reply.

### C. Communities
1. Navigate to **Communities** (`/communities`).
2. Search by keyword or filter by topic (e.g. *Mental Well-being*, *Relationships*).
3. Click **Create a Community** to open a new space with custom rules and topics.
4. Open your created community to see the **Manage** and **Moderate** buttons available exclusively to the creator.

### D. Private Messages
1. On any post authored by another user, click **Connect**.
2. Write a gentle introductory note and submit.
3. Open a second browser window (or incognito) and enter as a second user.
4. Navigate to **Messages** (`/messages`). The second user will see the pending connection request and can click **Accept**.
5. Once accepted, real-time messaging is unlocked!

### E. "I Just Need Someone to Listen" Rooms
1. Navigate to **Listening Rooms** (`/listening-rooms`).
2. Notice the prominent rule: *“Sometimes people need to be heard, not advised. Ask whether advice is welcome before giving it.”*
3. Click **Enter Room & Listen** to enter live room chat.
4. Open a room or click **Exit Room** at any time.

### F. Verified Health Professionals & Inquiries
1. Navigate to **Verified Professionals** (`/professionals`).
2. Notice that only reviewed and verified clinicians (e.g. `Dr. Maya Lin, Ph.D.`) are listed.
3. Click **Request Anonymous Consultation** to submit an inquiry.
4. View your submitted questions and clinician replies under the **My Consultations** tab.

### G. Clinician & Moderation Portals
- **Clinicians**: Visit `/portal/pro` to register with professional credentials or sign in to respond to anonymous youth inquiries.
- **Moderators**: Visit `/portal/mod`. Access is granted server-side to anonymous identities with the `isModerator` role assigned by a platform administrator via the admin dashboard. Review pending content reports and approve/reject pending clinicians.

---

## 9. Transparent Privacy & Data Ethics

ANON enforces strict data minimization:
- **No PII Collected for Youth**: No real names, emails, phones, or GPS location data.
- **Hashed Sessions**: Tokens are stored as SHA-256 hashes in MongoDB with automated TTL expiration.
- **No Commercial Trackers**: Zero third-party ad networks or tracking scripts.
- **Honest Limitations**: The platform does not claim impossible anonymity. Raw TCP/IP traffic is subject to standard network routing by ISPs and host providers. Data retention and safety measures are documented clearly in the app.

---

## 10. License
MIT License. Built for compassionate, private, and accessible youth well-being.

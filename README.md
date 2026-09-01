# Signal Clone

Signal Clone is a full-stack messaging application inspired by Signal. It combines a FastAPI backend with a Next.js frontend to provide a realistic chat experience with authentication, real-time messaging, contacts, conversations, WebSocket updates, and a modern dark UI.

This project is designed as a learning and demo application for full-stack architecture, database modeling, live chat flows, and frontend/backend integration. It is not a production-grade encrypted messaging system, but it captures the main patterns and workflows of a real-time messaging app.

---

## 1. Project Overview

### What this app does
- User registration and login with phone-number-based mock OTP flow
- Direct and group chat conversations
- Message history and chat previews
- Typing indicators and online presence
- Contact management and favorites
- User avatar and profile support
- Real-time message delivery updates via WebSockets
- Dark-themed Signal-inspired UI
- Local SQLite persistence for quick setup and local development

### Core goal
The app demonstrates a practical full-stack chat architecture using:
- Python + FastAPI for backend APIs
- SQLAlchemy for ORM and data models
- SQLite for local persistence
- Next.js + React + TypeScript for frontend UI
- WebSockets for live updates

---

## 2. Tech Stack

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- App Router
- Client-side context providers for auth and conversations

### Backend
- Python 3.10+
- FastAPI
- SQLAlchemy 2
- SQLite
- Pydantic
- WebSockets
- Python multipart uploads

### Supporting tools
- JWT-style session handling
- Local file uploads for avatars/media
- Mock OTP authentication flow
- Redis-ready configuration hooks
- Local storage-based favorites and preferences in the frontend

---

## 3. Features

### Authentication
- Phone number login flow
- Mock OTP generation and verification
- User creation with display name and profile info
- Auth session handling and token-based access

### Conversations
- Create direct messages
- Create group conversations
- Show conversation list with timestamps and preview text
- unread counts and recent activity tracking
- open chat by conversation ID

### Messages
- Send text messages
- Store message metadata and timestamps
- Track delivery/read lifecycle
- Show typing indicator in real time
- Render chat previews for conversation list

### Presence and real-time features
- online/offline user status
- last active timestamps
- typing events over WebSockets
- live updates across connected clients

### Contacts and favorites
- Add users to contact list
- Favorite direct contacts
- Search across conversations and participant names
- Add favorite contacts from available direct chat users

### UI and UX
- Signal-inspired dark layout
- responsive sidebar and chat layout
- theme toggle support
- profile/account screen
- search input in sidebar
- new chat modal

---

## 4. Architecture

The app is separated into two main application layers:

### Frontend
The frontend is built in the `frontend/` folder and handles:
- login and auth state
- chat UI and sidebar navigation
- conversation list rendering
- WebSocket connection and live updates
- profile, settings, favorites, and new chat flows

### Backend
The backend is built in the `backend/` folder and handles:
- API routes for auth, users, contacts, conversations, and messages
- database access and schema definitions
- WebSocket sessions and broadcast events
- upload handling for files and avatars

### Shared responsibility
- Frontend calls backend REST endpoints for CRUD and event flows
- WebSockets coordinate live state updates
- SQLite stores persistent application data

---

## 5. Project Structure

```text
signal-clone/
├── README.md
├── .venv/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── logging.py
│   │   │   ├── security.py
│   │   │   ├── storage.py
│   │   │   └── ws_manager.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── contact.py
│   │   │   ├── conversation.py
│   │   │   ├── message.py
│   │   │   ├── pin.py
│   │   │   ├── reaction.py
│   │   │   ├── session.py
│   │   │   └── user.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── contacts.py
│   │   │   ├── conversations.py
│   │   │   ├── messages.py
│   │   │   ├── upload.py
│   │   │   ├── users.py
│   │   │   └── ws.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── conversation.py
│   │   │   └── message.py
│   │   ├── __init__.py
│   │   ├── database.py
│   │   ├── main.py
│   │   └── seed.py
│   ├── clear_db.py
│   ├── migrate_edited_at.py
│   ├── reset_db.py
│   ├── requirements.txt
│   ├── runtime.txt
│   └── signal_clone.db
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── chat/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── Avatar.tsx
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── GroupInfoModal.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── NewChatModal.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── UserProfileModal.tsx
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── auth-context.tsx
│   │   │   ├── conversations-context.tsx
│   │   │   ├── format.ts
│   │   │   ├── types.ts
│   │   │   └── ws-context.tsx
│   ├── AGENTS.md
│   ├── CLAUDE.md
│   ├── eslint.config.mjs
│   ├── next.config.ts
│   ├── next-env.d.ts
│   ├── package.json
│   ├── postcss.config.mjs
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── README.md
└── .gitignore
```

---

## 6. Database Design

The backend uses SQLAlchemy models to persist app data in SQLite. The project is centered around messaging and social/chat patterns.

### Main database models
- `User`
- `Session`
- `Contact`
- `Conversation`
- `ConversationParticipant`
- `Message`
- `MessageReceipt`
- `Pin`
- `Reaction`

### Relationships
- One user has many sessions
- One user has many contacts
- One user can participate in many conversations
- One conversation has many participants
- One conversation has many messages
- One message can have many receipts
- Messages can optionally be related to reactions and replies

### Design patterns used
- relational schema for chat data
- normalized participant relationships
- per-user message status tracking
- conversation preview data computed from message timestamps and unread counters

---

## 7. Backend API Overview

The backend exposes REST endpoints for the following areas:

### Auth
- login / OTP generation
- verify OTP
- register new account
- session validation

### Users
- fetch profile info
- search users
- update user settings

### Contacts
- add contact
- remove contact
- list contacts

### Conversations
- list conversations
- create direct conversations
- create group conversations
- fetch conversation details

### Messages
- list message history
- send new messages
- get unread or recent chat messages

### Uploads
- upload profile images or media
- return local file URL

### WebSockets
- connect to real-time chat updates
- receive typing events
- receive message events
- receive presence updates

### API docs
After starting the backend, open:

```text
http://localhost:8000/docs
```

---

## 8. Frontend App Flow

The frontend includes:
- login screen
- chat screen with sidebar and conversation list
- message window with bubbles and metadata
- new chat modal
- user profile modal
- settings view
- theme toggle
- favorites view

The app also saves local preferences such as favorites and cleared chats using browser local storage.

---

## 9. Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+ or newer
- npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/koushik4163/signal-clone.git
cd signal-clone
```

### 2. Backend setup

From the project root:

```bash
cd backend
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
source .venv/bin/activate
```

Then install dependencies:

```bash
pip install -r requirements.txt
```

Run the backend:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend setup

Open a second terminal and run:

```bash
cd frontend
npm install
npm run dev
```

If the environment is Windows and Next.js/Turbopack has issues, use:

```bash
npm run dev -- --webpack
```

Then open in the browser:

```text
http://localhost:3000
```

---

## 10. Useful Project Scripts

### Backend scripts
From the `backend/` folder:

```bash
python clear_db.py
python reset_db.py
python migrate_edited_at.py
```

What they do:
- `clear_db.py` clears database records
- `reset_db.py` resets the local database state
- `migrate_edited_at.py` handles DB migration tasks for message edited timestamps

### Frontend scripts
From the `frontend/` folder:

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

---

## 11. Known Setup Notes

### Port conflicts
If you see this error:

```text
[Errno 10048] error while attempting to bind on address ('0.0.0.0', 8000): only one usage of each socket address ...
```

then some other process is already using port `8000`.

Check and kill the process:

```powershell
netstat -ano | findstr :8000
```

Then stop it:

```powershell
taskkill /PID <PID> /F
```

### Next.js on Windows
In some Windows setups, the default Next.js/Turbopack install can fail due to native binding issues. If that happens, use webpack mode:

```bash
npm run dev -- --webpack
```

This is the safest fallback for local Windows development in this project.

### Run commands from the correct folder
The repo contains two independent apps. Always run:
- backend from `backend/`
- frontend from `frontend/`

Do not run `npm run dev` from the project root unless it is a root-level package, which this repo does not have.

---

## 12. Expected Local URLs

After both apps are running:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

---

## 13. Notes for Development

### Demo app assumptions
This app is intentionally built as a demo-style messaging system. It uses:
- mock OTP instead of SMS providers
- SQLite instead of a production database
- local upload filesystem instead of cloud object storage
- in-memory presence management for the realtime layer

### Practical use cases
This project is useful for:
- learning full-stack app architecture
- practicing API and database design
- building real-time chat workflows
- understanding Next.js + FastAPI integrations
- designing a Signal-like UI and messaging experience

---

## 14. Summary

Signal Clone is a full-stack messaging app that simulates a modern chat platform with:
- secure-looking user flows
- fast conversation UX
- live typing and presence updates
- direct/group chat model
- database-backed message persistence
- modern frontend and API architecture

It is a strong project for learning how a real-time messaging app can be structured across frontend, backend, and database layers.

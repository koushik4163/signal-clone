# Signal Clone

A Signal-inspired messaging application built with a Python FastAPI backend and a Next.js frontend. The project simulates a real-time messaging platform with authentication, chat history, contacts, group conversations, message status tracking, and WebSocket-based live updates.

---

## 1. Overview

This application is designed to resemble a modern secure messaging product, with the following core capabilities:

- Phone-number based authentication with OTP-style mock verification
- User registration with display name and optional avatar upload
- Chat creation with direct and group conversations
- Real-time messaging updates using WebSockets
- Typing indicators, online status, and read-status behavior
- Contact management and conversation list handling
- Dark/light theme support in the frontend
- Responsive Signal-like UI for desktop and mobile-style layouts

The app is intentionally structured as a full-stack demo platform rather than a production-grade encrypted messaging system. It focuses on architecture, schema design, real-time event flow, and frontend/backend integration.

---

## 2. Tech Stack

### Frontend
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- App Router architecture

### Backend
- Python 3.10+
- FastAPI
- SQLAlchemy ORM
- SQLite database
- WebSockets for live messaging events

### Additional Tools
- Pydantic for request/response validation
- Local file-based avatar uploads
- Mock OTP generation for testing without SMS providers

---

## 3. Architecture Overview

The application follows a simple layered architecture:

1. Frontend client (Next.js)
   - Handles login, chat UI, settings, contacts, and conversation rendering
   - Communicates with the backend through REST APIs and WebSockets
   - Maintains auth/session state via context providers

2. Backend API layer (FastAPI)
   - Exposes endpoints for auth, users, contacts, conversations, messages, uploads, and WebSocket connection management
   - Validates incoming data with Pydantic schemas
   - Performs database operations through SQLAlchemy sessions

3. Data layer (SQLite + SQLAlchemy)
   - Stores users, sessions, contacts, conversations, participants, messages, and receipts
   - Keeps chat data relational and queryable
   - Supports fast access for conversation history and user metadata

4. Real-time layer (WebSocket manager)
   - Tracks active online users
   - Broadcasts typing, message, delivery, and read updates
   - Keeps all connected clients synchronized in near real time

---

## 4. Project Structure

```text
signal-clone-source/
├── README.md
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── security.py
│   │   │   └── ws_manager.py
│   │   ├── models/
│   │   │   ├── contact.py
│   │   │   ├── conversation.py
│   │   │   ├── message.py
│   │   │   ├── session.py
│   │   │   ├── user.py
│   │   │   └── __init__.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── contacts.py
│   │   │   ├── conversations.py
│   │   │   ├── messages.py
│   │   │   ├── upload.py
│   │   │   ├── users.py
│   │   │   ├── ws.py
│   │   │   └── __init__.py
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── conversation.py
│   │   │   ├── message.py
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   ├── database.py
│   │   ├── main.py
│   │   └── seed.py
│   ├── clear_db.py
│   ├── reset_db.py
│   ├── requirements.txt
│   └── signal_clone.db
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   └── README.md
└── .venv/
```

---

## 5. Database Design

The database is designed as a relational schema optimized for messaging workflows. The schema includes core user identity, active sessions, contact relationships, message threads, and delivery metadata.

### 5.1 Design Principles

- Normalize user identity into a dedicated `users` table
- Represent chat threads in a separate `conversations` table
- Use a many-to-many mapping for participants via `conversation_participants`
- Store each message independently in `messages` with thread and sender references
- Track delivery status separately in `message_receipts` to support receipt semantics
- Use foreign keys and unique constraints to avoid duplicate relationships

### 5.2 Schema

#### users
Stores user account information.

| Column | Type | Notes |
| --- | --- | --- |
| id | String | Primary key, UUID-based |
| phone_number | String | Unique phone number used for login |
| username | String | Optional unique username |
| display_name | String | User-visible name |
| avatar_url | String | Optional avatar path |
| about | String | User bio/about text |
| is_online | Boolean | Presence flag |
| last_seen | DateTime | Last active timestamp |
| created_at | DateTime | Registration timestamp |

#### sessions
Stores active auth sessions for authenticated users.

| Column | Type | Notes |
| --- | --- | --- |
| id | String | Primary key |
| user_id | String | Foreign key to users |
| token | String | Unique bearer token |
| created_at | DateTime | Session creation time |
| expires_at | DateTime | Token expiry timestamp |

#### contacts
Represents a user’s personal contact list.

| Column | Type | Notes |
| --- | --- | --- |
| id | String | Primary key |
| owner_id | String | User who owns the contact |
| contact_user_id | String | User being added as a contact |
| nickname | String | Optional custom nickname |
| created_at | DateTime | Relationship creation time |

A unique constraint prevents duplicate contact entries for the same owner/contact pair.

#### conversations
Stores each chat thread or group conversation.

| Column | Type | Notes |
| --- | --- | --- |
| id | String | Primary key |
| type | Enum | `direct` or `group` |
| name | String | Optional group name |
| avatar_url | String | Optional group/avatar image |
| created_by | String | User who created the conversation |
| created_at | DateTime | Conversation creation time |
| last_message_at | DateTime | Most recent message time |

#### conversation_participants
Many-to-many relationship table linking users to conversations.

| Column | Type | Notes |
| --- | --- | --- |
| id | String | Primary key |
| conversation_id | String | Foreign key to conversations |
| user_id | String | Foreign key to users |
| role | Enum | `member` or `admin` |
| joined_at | DateTime | Join timestamp |
| last_read_message_id | String | Tracks last seen message |

A composite unique key prevents the same user from being added twice to the same conversation.

#### messages
Stores all messages in the app.

| Column | Type | Notes |
| --- | --- | --- |
| id | String | Primary key |
| conversation_id | String | Thread association |
| sender_id | String | Sender of the message |
| content | Text | Message content |
| status | Enum | `sending`, `sent`, `delivered`, `read` |
| reply_to_id | String | Optional reply target |
| is_deleted | Boolean | Soft-delete flag |
| created_at | DateTime | Message timestamp |

This table supports conversation history, replies, and message state tracking.

#### message_receipts
Tracks read/delivery confirmation on a per-user basis.

| Column | Type | Notes |
| --- | --- | --- |
| id | String | Primary key |
| message_id | String | Foreign key to messages |
| user_id | String | Recipient user |
| status | Enum | Delivery or read status |
| updated_at | DateTime | Last change time |

This allows the app to model independent status updates for each participant without duplicating message records.

### 5.3 Relationships

- One user may have many sessions
- One user may own many contacts
- One conversation contains many participants
- One conversation contains many messages
- One message may have many receipts
- A message may optionally reply to another message
- A participant belongs to a specific conversation and user

### 5.4 Assumptions in the Design

- SQLite is used for ease of local development and simple deployment
- Messages are stored as plain text content to keep the app lightweight
- OTP is mocked and not connected to a real SMS provider
- WebSocket presence is handled in memory rather than persisted to a distributed session store
- The schema prioritizes real-time messaging workflows and educational clarity over enterprise-scale production concerns

---

## 6. API Structure

The backend is organized into route modules:

- `auth.py` — OTP login, verification, account creation
- `users.py` — user lookup and profile management
- `contacts.py` — contact add/remove/list logic
- `conversations.py` — direct and group conversation creation
- `messages.py` — message retrieval and send operations
- `ws.py` — WebSocket connection management and events
- `upload.py` — avatar/media upload support

FastAPI Swagger docs are available at:

```text
http://localhost:8000/docs
```

---

## 7. Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm

### Backend

From the project root:

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

## 8. Database Management

Useful scripts included in the backend:

```bash
cd backend
python clear_db.py
python reset_db.py
```

- `clear_db.py` clears rows from the database tables
- `reset_db.py` removes the DB file for a fresh start

---

## 9. Assumptions and Notes

This project is designed as a practical demonstration of a real-time chat application and not as a fully production-grade end-to-end encrypted messaging system. Some assumptions include:

- A mock OTP flow is used instead of real SMS delivery
- SQLite is chosen for fast local setup and simplicity
- Media uploads are local filesystem-based rather than object storage
- WebSocket online presence is in-memory and not horizontally distributed
- API security is suitable for local demo use, but would need hardening for production deployment

---

## 10. Summary

This project demonstrates a complete full-stack messaging system with:

- relational database design
- real-time messaging logic
- user authentication flow
- contact and conversation data models
- modern frontend UX inspired by secure messaging apps

It is a strong starter implementation for learning full-stack architecture, chat systems, and real-time app design.

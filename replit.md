# IUSMK Barber Artist — Workspace

## Overview

This project is a pnpm workspace monorepo using TypeScript, designed for the "IUSMK Barber Artist" platform. It provides a comprehensive solution for managing a barber artist's business, including an AI assistant chatbot, a Stripe-based purchase system for courses, protected video streaming, push notifications, and a robust admin panel. The platform aims to streamline operations, enhance customer interaction, and provide a secure, engaging learning environment for students.

**Business Vision & Market Potential:** The platform caters to the growing demand for specialized online education in niche artistic fields like barbering. By offering an integrated system for course delivery, payment processing, and interactive support, it aims to establish itself as a leading digital academy for barber artists, expanding market reach beyond geographical limitations.

**Project Ambitions:** To create a scalable, secure, and user-friendly digital ecosystem that supports both the administrative needs of the barber artist and the learning journey of their students. Future ambitions include further gamification of learning, community features, and advanced analytics for course engagement.

## User Preferences

*   I want iterative development.
*   Ask before making major changes.
*   Provide detailed explanations for complex features.
*   Ensure clear separation of concerns in the codebase.
*   I prefer seeing the impact of changes on the frontend and backend.
*   Do not make changes to folder `artifacts/barber-artist/src/components/AiChatWidget.tsx` without explicit instruction.
*   Do not make changes to file `artifacts/api-server/src/lib/kb-search.ts` without explicit instruction.
*   I prefer functional programming paradigms where appropriate.
*   I prefer simple language in explanations and documentation.

## System Architecture

The project is built as a pnpm workspace monorepo.

**Monorepo Structure:**
- `artifacts/`: Deployable applications (`api-server`, `barber-artist` frontend).
- `lib/`: Shared libraries (`api-spec`, `api-client-react`, `api-zod`, `db`).
- `scripts/`: Utility scripts.

**Core Technologies:**
- **Node.js:** 24
- **Package Manager:** pnpm
- **TypeScript:** 5.9
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild

**UI/UX Decisions:**
- **Frontend Framework:** React (via Next.js for `barber-artist`)
- **Admin Panel:** Comprehensive admin interfaces for managing AI knowledge base, purchases, discount codes, user accounts, and notifications.
- **Video Player:** Custom video player with security features (watermarking, download prevention).
- **PWA Support:** Install prompt for PWA functionality and push notifications.

**Technical Implementations & Feature Specifications:**

**AI Assistant Chatbot:**
- **Model:** `gpt-5-mini` via Replit AI Integrations (stream: true).
- **Knowledge Base (KB):** PostgreSQL table `knowledge_base`.
- **Search:** Weighted KB search (title=3pt, keywords=2pt, content=1pt, category=1pt), synonym expansion (60+ Italian terms).
- **Fallback:** KB-synthesis for empty AI model streams.
- **Admin Features:** CRUD for KB entries, unanswered questions management, AI test panel, chat logs.
- **Public Endpoint:** `POST /api/ai/chat` (rate-limited).

**Stripe Purchase System:**
- **Credential Resolution:** Environment variables or Replit Connectors for Stripe API keys.
- **Webhook Handling:** Secure webhook verification, critical to be registered before `express.json()` middleware.
- **DB Tables:** `discount_codes`, `course_purchases`, `notifications`.
- **Flow:** Customer checkout -> Stripe redirect -> Webhook processes payment, generates access code -> Success page displays access code -> Admin notification.
- **Frontend Pages:** Checkout, success, cancel pages; admin panels for discount codes, purchases, and notifications.

**Push Notifications, Broadcast & PWA:**
- **DB Schema:** `push_subscriptions` (with `userId`, `role`), `notifications` (for admin).
- **Roles:** Separate endpoints for admin and customer push subscriptions.
- **Push Triggers:** Admin receives notifications for new customer chats, contact forms; customers receive replies.
- **Admin Broadcast:** `POST /admin/broadcast/send` for targeted or mass notifications with various modes (all, with_courses, specific_course, manual) and exclusion lists.
- **PWA:** Service Worker (`sw.js`) for caching and advanced notification handling. Install prompt modal for first-time visitors.

**Protected Video Streaming:**
- **Storage:** Videos uploaded to `artifacts/api-server/uploads/`.
- **Access Control:** `app.ts` blocks direct access to video files.
- **Tokenization:** `GET /api/student/courses/:id/modules/:id/video` generates short-lived JWTs (4h) for authorized access.
- **Streaming Endpoint:** `GET /api/video/stream?token=<jwt>` validates token and streams video with Range request support.
- **Security:** `Cache-Control: no-store`, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`.
- **Frontend Player:** `<video>` element with `controlsList="nodownload nofullscreen noremoteplayback"`, `disablePictureInPicture`, right-click/drag disabled, and a dynamic watermark overlay (name + email).

**API Server (`artifacts/api-server`):**
- Express 5 server.
- Routes in `src/routes/`, using `@workspace/api-zod` for validation and `@workspace/db` for persistence.
- CORS, JSON/urlencoded parsing, mounted at `/api`.

**Database (`lib/db`):**
- Drizzle ORM with PostgreSQL.
- Exports Drizzle client and schema models.
- Migrations handled by Replit (production) or `drizzle-kit push` (development).

## External Dependencies

- **Stripe:** Payment processing for course purchases.
- **Replit AI Integrations:** Powers the AI assistant chatbot using `gpt-5-mini`.
- **PostgreSQL:** Primary database for all application data.
- **Orval:** API client and schema generation from OpenAPI spec.
- **Zod:** Schema validation.
- **Express:** Web application framework for the API server.
- **pnpm:** Monorepo package manager.
- **esbuild:** JavaScript bundler.
- **React Query:** Data fetching and caching for the frontend.
- **Web Push API:** For sending and receiving push notifications.
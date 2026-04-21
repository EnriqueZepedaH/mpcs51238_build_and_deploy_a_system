# Design, Build, Ship · MPCS 51238 · Spring 2026

## Assignment 4: Build & Deploy a System

**Due:** Week 5 at the start of class

---

## Goal

Build and deploy a multi-service system — a background worker that polls a live data source, writes to a database, and a frontend that displays updates in real time.

---

## ✋ A Heads Up

This assignment is more complex than previous assignments—a full system: multiple services, running on different platforms, talking to each other.

Start early. Budget more time than you think you need. Use the architecture from class as your foundation.

---

## Overview

In class you built a live NBA scoreboard together. For this assignment, you'll build your own system using the same architecture pattern:


External Data Source → Background Worker (Railway) → Database (Supabase + Realtime) → Frontend (Next.js on Vercel)

Your system should:
- Poll a live or frequently-updating data source
- Store the data in Supabase
- Display it on a frontend that updates in real time (no refresh)

---

## Ideas to Explore (Pick One)

### 🛫 Flight Tracker
Monitor live aircraft positions worldwide. Filter by region, show a live map with moving planes.  
*(OpenSky Network — free)*

### 🌤️ Weather Dashboard
Monitor weather for favorite cities. Worker polls conditions, frontend shows live data.  
*(Open-Meteo — free, open source)*

### 🚌 Transit Tracker
Live bus/train positions for a city. Users pick routes, see vehicles on a map.  
*(CTA, MTA, MBTA — most are free)*

### ✨ Your Own Idea
Any live data source + background worker + realtime frontend.

---

## Requirements

- Monorepo — frontend and worker in one repo (`apps/web/` and `apps/worker/`)
- Built with Next.js + Tailwind CSS
- Background worker deployed on Railway (polls external data source)
- Data stored in Supabase (worker writes, frontend reads)
- Supabase Realtime for live updates
- User authentication (Clerk or Supabase Auth)
- Users can personalize what they see
- Environment variables in `.env.local` and platform dashboards
- Supabase MCP server configured
- `CLAUDE.md` describing architecture
- Multiple git commits showing iteration
- Deployed:
  - Frontend → Vercel
  - Worker → Railway
- Live URLs must work (classmates can use it)

---

## Steps

### 1. Choose Your Data Source
- What are you polling?
- How often does it update?
- Is the API free?
- Test the endpoint first

---

### 2. Plan Your Architecture
Create a `CLAUDE.md`:
- Worker responsibilities
- Database tables
- Data flow from source → frontend

---

### 3. Set Up Supabase
- Create tables via Supabase MCP
- Enable Realtime
- Set up authentication
- Write RLS policies

---

### 4. Build the Worker
- Node.js script
- Polls data source
- Parses response
- Upserts into Supabase
- Test locally

---

### 5. Build the Frontend
- Next.js app
- Reads from Supabase
- Subscribes to Realtime updates
- Displays personalized data

---

### 6. Deploy the System
- Worker → Railway (connect GitHub, add env vars)
- Frontend → Vercel (add env vars)
- Verify end-to-end functionality

---

### 7. Test with a Classmate
- Sign up
- Test auth
- Check personalization
- Confirm real-time updates

---

## Stretch Goals (Optional)

- Multiple data sources (e.g., NBA + MLB + NHL)
- Historical data view
- Notifications / alerts
- Data visualization (charts, maps)
- Worker health monitoring

---

## Submission

### Deliverables

1. **Vercel URL** — live frontend
2. **GitHub URL** — public repo with commits
3. **Slack Video Reflection (2–3 min)**  
   - Post in your section channel (#tuesday-night or #wednesday-night)
   - Talk about:
     - Your system
     - What you're proud of
     - What broke and how you fixed it

---

## Assessment

A complete assignment includes:

- ☐ Working Vercel app (users can sign up + see live data)
- ☐ Running Railway worker
- ☐ Supabase Realtime updates
- ☐ Auth + personalized data
- ☐ GitHub repo with multiple commits
- ☐ Slack video reflection

Evaluation focuses on:
- Working multi-service system
- Understanding of architecture
- Usability by classmates

---

## Notes

- This is the last structured assignment
- Next: individual projects for the rest of the quarter
- Key concepts:
  - Background workers
  - Realtime subscriptions
  - Multi-platform deployment

Refer to Week 4 lesson plan and slides in Google Classroom.

---

## Explore Claude Code + Codex

- **CLAUDE.md** — full system architecture
- **AGENTS.md** — optional for Codex experiments

### Supabase MCP
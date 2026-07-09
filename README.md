<div align="center">
  <h1>🌿 Suraksha Setu </h1>
  <p>
    <b>Community-Powered Citizen Environmental Reporting Platform</b>
  </p>

  <p>
    <a href="#-core-features"><img src="https://img.shields.io/badge/Features-Explore-brightgreen?style=for-the-badge&logo=appveyor" alt="Features" /></a>
    <a href="#-tech-stack"><img src="https://img.shields.io/badge/Tech_Stack-View-blue?style=for-the-badge&logo=javascript" alt="Tech Stack" /></a>
    <a href="#-getting-started"><img src="https://img.shields.io/badge/Quick_Start-Launch-orange?style=for-the-badge&logo=rocket" alt="Quick Start" /></a>
  </p>
</div>

<hr />

Suraksha Setu is a high-fidelity, privacy-first civic tech platform that bridges the gap between citizens spotting environmental issues and green organizations taking action. Built on a decoupled frontend and backend architecture, it leverages interactive GIS spatial layers, **Three.js 3D Globe Visualizations**, advanced **GSAP Animations**, real-time NGO analytics dashboards, and a RESTful PHP API.

---

## ✨ Core Value Propositions

- **🔒 Zero-Friction Reporting**: Zero registration, zero cookies, zero background tracking. True anonymity ensures high civic reporting volume.
- **🗺️ Live GIS Visualizations**: Renders reports in real-time onto an interactive Leaflet mapping coordinate layer with custom dynamic marker pins.
- **📊 Enterprise-Grade NGO Dashboard**: Provides non-profits and municipal bodies with spatial tracking tables, priority metrics, active Chart.js graphs, and status controls. Includes one-click PDF and Excel (SheetJS) exports.
- **⚡ Real-time Updates**: Real-time integration powered by WebSockets (Pusher) ensures live synchronization of reports and community feeds.
- **🤖 Smart AI Image Analysis**: Analyzes user-submitted photos using Gemini AI to automatically categorize and extract tags for environmental hazards.
- **🚨 Advanced Alert Management**: Automated security anomaly detection (brute force, suspicious IPs) and system health monitoring (CPU, Memory, API status) via dedicated cron jobs and worker queues.
- **📱 QR Code Integration**: Built-in HTML5 QR code scanning for quick reporting and verification.
- **🎨 Premium UI/UX**: Immersive user experience built with Tailwind CSS, Phosphor Icons, and fluid animations powered by GSAP, ScrollReveal, and Vanilla-Tilt.

---

## 📂 Codebase Directory Mapping

The project is structured into fully decoupled frontend and backend environments:
 
```text
suraksha-setu/
├── frontend/              # Frontend Web Application (Vercel Ready)
│   ├── template/          # UI Templates (Dashboard, Alerts, Reporting)
│   ├── css/               # Central Design Token System
│   └── js/                # Modular Scripts (3D, Maps, Realtime, App Logic)
├── backend/               # PHP RESTful API Backend (Render Ready)
│   ├── api/               # Core Endpoints (Reports, Alerts, Auth)
│   ├── cron/              # Background Monitors & Escalation Workers
│   ├── logs/              # System & Security Logs Export Directory
│   ├── config.php         # Database, Pusher, Security & Gemini config
│   └── database.sql       # MySQL schema for tables
├── .github/workflows/     # CI/CD & Automation Pipelines
│   ├── ci-cd.yml          # Automated Testing & Deployment Workflow
│   └── backup.yml         # Daily Automated MySQL Database Backup Workflow
└── README.md              # Project Documentation
```

---

## 🏗️ Architecture & CI/CD Flow

Suraksha Setu employs a decoupled architecture optimized for scalability and reliability:

1. **Frontend Presentation**: Lightweight HTML5/TailwindCSS/JS served via CDN (Vercel), communicating securely via Bearer Tokens to the API. Implements WebGL for 3D elements.
2. **Backend API Layer**: PHP 8.x REST API handling request validation, sanitization, business logic, and session state.
3. **Asynchronous Workers**: Dedicated CLI workers (`test_sync_retry.php`) and cron scripts (`system_monitor.php`, `escalate_alerts.php`) run completely isolated from the web server thread, preventing timeouts and ensuring reliable task processing.
4. **Real-time Event Bus**: Real-time Pusher WebSockets broadcast alerts and updates instantly to connected clients on secure channels.

### Continuous Integration & Deployment Pipeline

- **`ci-cd.yml`**: Ensures that every commit or PR to the main branch runs automated tests. Upon success, the pipeline triggers secure deployments to staging/production environments. It validates the code formatting, security linting, and unit tests before deployment.
- **`backup.yml`**: A critical Disaster Recovery (DR) workflow scheduled to run daily. It automatically performs full MySQL dumps of the production database and archives them securely to prevent data loss.

---

## 🛠️ Unified Tech Stack & Libraries

### **Frontend:**
- **Structure/Style**: HTML5, Tailwind CSS, Vanilla CSS
- **Interactivity**: Vanilla ES6 JS
- **3D & Animations**: Three.js, GSAP, ScrollReveal, Vanilla-tilt
- **GIS Engine**: LeafletJS v1.9.4 (OpenStreetMap coordinate mapping layers)
- **Data Visualization**: Chart.js, HTML5 Canvas 2D
- **Export & Utilities**: HTML2PDF, SheetJS (XLSX), CodeMirror, HTML5-QRCode
- **Icons & Typography**: Phosphor Icons, Google Fonts (Outfit, Nunito)
- **Real-Time Integration**: Pusher WebSockets

### **Backend & Infrastructure:**
- **Backend API**: PHP 8.x
- **Database**: MySQL (Aiven/Local)
- **AI Integration**: Google Gemini API for image analysis
- **Deployments**: Vercel (Frontend), Render / Docker (Backend)
- **CI/CD**: GitHub Actions

---

## 🔒 Security & Privacy Commitments

1.  **Strict Data Isolation**: Organizational files are fully partitioned from active GIS operations, leaving the main platform clean and performant.
2.  **Zero Personal Identifiable Data (PII)**: The database is built on anonymous civic diagnostics. No emails, phone logins, or trackers are present.
3.  **Environment Variables**: All sensitive API keys and database credentials are fully abstracted away using `.env` configurations.
4.  **Enterprise API Security**: All backend routes are protected by robust CSRF validation, Server-Side Session Token enforcement, Rate Limiting, and strict Output Sanitization.

---

## 🚀 Getting Started

### **1. Backend Setup**
Navigate to the backend directory and set up the environment:
```bash
cd backend
cp .env.example .env
```
Fill in the `.env` file with your MySQL database credentials, Pusher keys, and Gemini API Key.
Run the database schema in `database.sql` on your MySQL server.
Start a local PHP development server:
```bash
php -S localhost:8080
```

### **2. Frontend Setup**
Navigate to the frontend directory:
```bash
cd frontend
```
Serve the frontend using a lightweight HTTP server to prevent CORS issues with local files:
**Using Node.js:**
```bash
npx http-server -p 8000
```
Open **`http://localhost:8000/template/`** inside your web browser.

---

## 💚 Contributing & Swachh India Core Team

Suraksha Setu is built with love for a cleaner, greener India. We collaborate actively with environmental NGOs, student volunteers, and municipal teams.

<br>
<div align="center">
  <sub>Built with 💚 for a sustainable future.</sub>
</div>

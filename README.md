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

Suraksha Setu is a high-fidelity, privacy-first civic tech platform that bridges the gap between citizens spotting environmental issues and green organizations taking action. Built on a decoupled frontend and backend architecture, it leverages interactive GIS spatial layers, Canvas-based 3D trigonometry, real-time NGO analytics dashboards, and a RESTful PHP API.

---

## ✨ Core Value Propositions

- **🔒 Zero-Friction Reporting**: Zero registration, zero cookies, zero background tracking. True anonymity ensures high civic reporting volume.
- **🗺️ Live GIS Visualizations**: Renders reports in real-time onto an interactive Leaflet mapping coordinate layer with custom dynamic marker pins.
- **📊 Enterprise-Grade NGO Dashboard**: Provides non-profits and municipal bodies with spatial tracking tables, priority metrics, active HSL charts, and status controls.
- **⚡ Real-time Updates**: Real-time integration powered by WebSockets (Pusher) ensures live synchronization of reports.
- **🤖 Smart AI Image Analysis**: Analyzes user-submitted photos using Gemini AI to automatically categorize and extract tags for environmental hazards.

---

## 🎨 Premium SaaS Visual Aesthetics

The visual layer features a curated dark-mode forest scheme combined with soft pastel HSL tokens:

- **Typography**: Outfitted with Google Fonts (`Outfit` for bold modern headings, `Nunito` for high-readability copy, and `JetBrains Mono` for cryptographic ID representations).
- **Glassmorphism Effects**: Transparent header navigation utilizing `-webkit-backdrop-filter` saturation controls.
- **Micro-Animations**: Custom hover transformations, bouncing successful states, spinning loading loops, and dynamic sliding drawer accordions.

---

## 📂 Codebase Directory Mapping

The project is structured into fully decoupled frontend and backend environments:

```text
suraksha-setu/
├── frontend/              # Frontend Web Application (Vercel Ready)
│   ├── template/
│   │   ├── index.html       # Main Dashboard SPA (Home, Map, Feed, Admin, Report)
│   │   └── organisation.html# Isolated Info Hub
│   ├── css/
│   │   └── style.css        # Central Design Token System
│   ├── js/                  # Vanilla ES6 Modular Scripts
│   │   ├── app.js           # Core App Controller & Router
│   │   ├── api.js           # Backend API Communication Layer
│   │   ├── globe.js         # 3D Geographic Trigonometric Canvas
│   │   ├── map.js           # GIS leaf marker layers
│   │   └── ...
│   └── vercel.json          # Vercel deployment configuration
├── backend/               # PHP RESTful API Backend (Render Ready)
│   ├── api/                 # Endpoints for reports, statuses, AI
│   ├── config.php           # Database, Pusher, and Gemini config
│   ├── database.sql         # MySQL schema for tables
│   ├── .env                 # Environment variables configuration
│   └── Dockerfile           # Containerization configuration
└── render.yaml            # Render full-stack deployment configuration
```

---

## 🛠️ Unified Tech Stack & Libraries

- **Frontend**: HTML5 (Semantic Structure), Vanilla CSS3 (Custom Grid, Flex, Variables), Vanilla ES6 JS
- **Backend API**: PHP 8.x
- **Database**: MySQL (Aiven/Local)
- **GIS Engine**: LeafletJS v1.9.4 (OpenStreetMap coordinate mapping layers)
- **Visualization**: HTML5 Canvas 2D Context
- **Real-Time Integration**: Pusher WebSockets
- **AI Integration**: Google Gemini API for image analysis
- **Deployments**: Vercel (Frontend), Render / Docker (Backend)

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

## 💡 Dynamic NGO Partner Data Schema

Reports logged on the frontend map conform to the following schema stored via the PHP backend API:

```json
{
  "id": "ECO-001",
  "cat": "Garbage",
  "loc": "Sadar Bazaar, Agra",
  "lat": 27.195,
  "lng": 78.006,
  "desc": "Large pile of household waste near the market entrance, overflowing bins.",
  "status": "Verified",
  "priority": "High",
  "date": "2026-05-28",
  "photos": 3,
  "tags": ["garbage bags", "overflowing bin", "organic waste"],
  "reporter": "Anonymous"
}
```

---

## 🔒 Security & Privacy Commitments

1.  **Strict Data Isolation**: Organizational files are fully partitioned from active GIS operations, leaving the main platform clean and performant.
2.  **Zero Personal Identifiable Data (PII)**: The database is built on anonymous civic diagnostics. No emails, phone logins, or trackers are present.
3.  **Environment Variables**: All sensitive API keys and database credentials are fully abstracted away using `.env` configurations.

---

## 💚 Contributing & Swachh India Core Team

Suraksha Setu is built with love for a cleaner, greener India. We collaborate actively with environmental NGOs, student volunteers, and municipal teams.

- **NGO Partnerships**: [partners@surakshasetu.org](mailto:partners@surakshasetu.org)
- **General Inquiries**: [support@surakshasetu.org](mailto:support@surakshasetu.org)
- **Citizen Helpline**: +91 562 284 3922

<br>
<div align="center">
  <sub>Built with 💚 for a sustainable future.</sub>
</div>

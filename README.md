<div align="center">
  <h1>🌿 Eco Warrior </h1>
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

Eco Warrior is a high-fidelity, privacy-first civic tech platform that bridges the gap between citizens spotting environmental issues and green organizations taking action. Built on a modular, decoupled architecture, it leverages interactive GIS spatial layers, Canvas-based 3D trigonometry, localized AI diagnostic scanners, and a real-time NGO analytics dashboard.

---

## ✨ Core Value Propositions

- **🔒 Zero-Friction Reporting**: Zero registration, zero cookies, zero background tracking. True anonymity ensures high civic reporting volume.
- **🤖 Smart AI Diagnostic Classifier**: Auto-categorizes issues and computes dynamic priority rankings based on environmental severity and geographic hazard risk.
- **🗺️ Live GIS Visualizations**: Renders reports in real-time onto an interactive Leaflet mapping coordinate layer with custom dynamic marker pins.
- **📊 Enterprise-Grade NGO Dashboard**: Provides non-profits and municipal bodies with spatial tracking tables, priority metrics, active HSL charts, and CSV report export triggers.
- **⚡ Real-time Updates**: Real-time integration powered by WebSockets (Pusher) ensures live synchronization of reports.

---

## 🎨 Premium SaaS Visual Aesthetics

The visual layer features a curated dark-mode forest scheme combined with soft pastel HSL tokens:

- **Typography**: Outfitted with Google Fonts (`Outfit` for bold modern headings, `Nunito` for high-readability copy, and `JetBrains Mono` for cryptographic ID representations).
- **Glassmorphism Effects**: Transparent header navigation utilizing `-webkit-backdrop-filter` saturation controls.
- **Micro-Animations**: Custom hover transformations, bouncing successful states, spinning loading loops, and dynamic sliding drawer accordions.

---

## 📂 Codebase Directory Mapping

```text
eco-warrior/
├── index.html             # High-Fidelity Main Dashboard SPA (Home, Map, Feed, Admin)
├── organisation.html      # Isolated Info Hub (About, Impact Metrics, Privacy, Contact Forms)
├── backend/               # Backend modules & configurations
├── css/
│   └── style.css          # Central Design Token System (Pastels HSL, variables, responsive breakpoints)
└── js/
    ├── app.js             # Core App Controller (Sequential initialization, cross-file hash parameter routers)
    ├── data.js            # Unified Data Model Ledger (Coordinates, status mappings, color tokens)
    ├── globe.js           # 3D Geographic Trigonometric Canvas Spinning Globe
    ├── map.js             # GIS leaf marker layers and pill-filters rendering
    ├── report.js          # Multi-step report wizard (Photo-readers, GPS trackers, miniature maps)
    ├── feed.js            # Dynamic list render engines (Search and custom modals details mapping)
    ├── admin.js           # Metrics aggregation, live HSL SVG charts, and status controls
    ├── subpages.js        # Form validation scripts, PDF compilation loops, and accordion sliders
    └── realtime.js        # Real-time WebSocket (Pusher) subscriptions & live UI updates
```

---

## 🛠️ Unified Tech Stack & Libraries

- **UI Foundation**: HTML5 (Semantic Structure) & Vanilla CSS3 (Custom Grid, Flex, Variables)
- **GIS Engine**: LeafletJS v1.9.4 (OpenStreetMap coordinate mapping layers)
- **Visualization**: HTML5 Canvas 2D Context (Geographical polar-coordinate mapping)
- **Real-Time Integration**: Pusher WebSockets
- **Typefaces**: Google Fonts (Outfit, Nunito, JetBrains Mono)
- **Runtime Logic**: Vanilla ES6 Javascript (Decoupled modular architecture)

---

## 📊 Live Metrics & Ecological Ledger

Eco Warrior tracks and compiles ecological progress across the following core metrics:
1.  **Trash Diverted**: Ton-level tracking of household, industrial, and roadside waste.
2.  **Trees Planted**: Citizen plantation coordinate logs with calculated survival indicators.
3.  **Plastics Recycled**: Single-use plastics captured and sent to industrial recycling partners.
4.  **Areas Sanitized**: Historical resolution timelines mapping community parks and ghat restorations.

---

## 🚀 Getting Started

Since the platform is designed to be lightweight and ultra-performant, it has no heavy build pipelines or runtime compilation delays.

### **Method 1: Dynamic Background Server (Recommended)**
Start a lightweight development server using the pre-configured Node/Python environments to support AJAX and absolute anchor routing:

**Using Python:**
```bash
python -m http.server 8000
```

**Using Node.js:**
```bash
npx http-server -p 8000
```
Open **`http://localhost:8000/`** inside your web browser.

### **Method 2: Standalone Local Launch**
Simply double-click on `index.html` on your desktop environment. The internal chronological history states and URL query parsers are designed to execute directly within localized files.

---

## 💡 Dynamic NGO Partner Data Schema

Reports logged on the frontend map conform to the following schema within `js/data.js` and can be pushed to any RESTful database:

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

1.  **Automated Face & Plate Blurring**: All camera uploads are routed through computer vision classification to sign-seal image anonymity.
2.  **Zero Personal Identifiable Data (PII)**: The database is built on anonymous civic diagnostics. No emails, phone logins, or trackers are present.
3.  **Strict Data Isolation**: Organizational files are fully partitioned from active GIS operations, leaving the main platform clean and performant.

---

## 💚 Contributing & Swachh India Core Team

Eco Warrior is built with love for a cleaner, greener India. We collaborate actively with environmental NGOs, student volunteers, and municipal teams.

- **NGO Partnerships**: [partners@ecowarrior.org](mailto:partners@ecowarrior.org)
- **General Inquiries**: [support@ecowarrior.org](mailto:support@ecowarrior.org)
- **Citizen Helpline**: +91 562 284 3922

<br>
<div align="center">
  <sub>Built with 💚 for a sustainable future.</sub>
</div>

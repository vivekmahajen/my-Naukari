# Naukri+ — A Better Job Platform

> Built with the **website-analyzer-builder** workflow: analyze Naukri.com → benchmark competitors → gap analysis → rebuild preserving Naukri's visual identity while closing every gap.

**Naukri+** is a working front-end prototype of a job platform that keeps Naukri's familiar
blue identity but fixes the six issues that show up again and again in real Naukri reviews:
spam listings, irrelevant recommendations, no application visibility, hidden salaries,
stale duplicate posts, and weak candidate support.

Open `index.html` in a browser — no build step required.

---

## Phase 1 — Target Analysis: Naukri.com

| Area | Findings |
|------|----------|
| **Identity** | Naukri blue wordmark, white cards on light-grey canvas, dense information layout |
| **Core features** | Keyword/location search, resume upload, recruiter CV database (78M+), job alerts, paid visibility |
| **Strengths** | ~62–70% market share, ~200k daily listings, deep entry/mid-tier reach, recruiter liquidity |
| **Architecture** | SSR + SPA hybrid, legacy widgets + newer React modules, heavy ad/tracking scripts |

## Phase 2 — Competitor Benchmarking

| Platform | Edge over Naukri |
|----------|------------------|
| **LinkedIn** | Transparent "X applicants · posted Yd ago", referral graph, employer branding |
| **Indeed** | Clean search, fresher listings, 1-click apply |
| **Foundit** | Personalized recommendations, salary ranges, skill/trend insights |
| **Wellfound / Instahyre / Hirist** | Upfront salary, verified employers, recruiter response SLAs |
| **Glassdoor** | Salary + company transparency, reviews |

## Phase 3 — Gap Analysis

| # | Gap (from real Naukri reviews) | Severity | Fix shipped in Naukri+ |
|---|--------------------------------|----------|------------------------|
| 1 | Spam / fraudulent listings | High | **Verified-employer badge** + report flow |
| 2 | Irrelevant recommendations | High | **Explainable AI match score** ("why this matched") |
| 3 | No application-status visibility | High | **Application tracker**: Applied → Viewed → Shortlisted → Decision |
| 4 | Hidden salaries | Medium | **Mandatory salary range** on every card |
| 5 | Outdated / duplicate posts | Medium | **Freshness badge** + auto-expiry indicator |
| 6 | Spammy calls / weak support | Medium | **In-app messaging** + contact controls |

## Phase 4 — Design System (preserved Naukri identity)

See `assets/css/styles.css` for tokens. Highlights:

- **Primary blue** `#1875e5` (Naukri-family) · **Navy** `#12283f`
- **Verified green** `#14a800` · **Canvas** `#f3f5f8` · white cards, soft shadows
- System sans-serif stack, dense-but-breathable card layout

## Phase 5 — Rebuild

| Page | What it demonstrates |
|------|----------------------|
| `index.html` | Hero search, trust signals, differentiators vs Naukri, featured verified jobs |
| `jobs.html` | Search + filters, match score, verified badge, salary, freshness on every card |
| `job.html` | Job detail with full **transparency panel** (applicants, salary, hiring timeline) |
| `dashboard.html` | Candidate **application tracker** with live status stages |

## Project structure

```
.
├── index.html          # Landing
├── jobs.html           # Search + listings
├── job.html            # Job detail (?id=)
├── dashboard.html      # Application tracker
├── assets/
│   ├── css/styles.css  # Design system
│   └── js/
│       ├── data.js     # Mock jobs + applications
│       └── app.js      # Rendering / search / filters
└── .claude/skills/website-analyzer-builder/SKILL.md
```

## Run

```bash
# Any static server, or just open the file:
python3 -m http.server 8000   # then visit http://localhost:8000
```

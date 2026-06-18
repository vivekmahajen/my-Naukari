/* ============================================================
   Naukri+ rendering, search & filters
   ============================================================ */

const fmtSalary = (min, max) => `₹${min}–${max} LPA`;

function freshnessBadge(days) {
  if (days <= 3) return `<span class="badge badge-fresh">● Posted ${days === 0 ? "today" : days + "d ago"}</span>`;
  if (days <= 14) return `<span class="badge badge-soft">Posted ${days}d ago</span>`;
  return `<span class="badge badge-stale">⚠ ${days}d old — may be filled</span>`;
}

function verifiedBadge(v) {
  return v
    ? `<span class="badge badge-verified" title="Employer identity & job verified">✓ Verified employer</span>`
    : `<span class="badge badge-stale" title="Employer not yet verified">⚠ Unverified</span>`;
}

function matchRing(score) {
  return `
    <div class="match" title="Explainable AI match score">
      <div class="ring" style="--p:${score}"><i>${score}%</i></div>
      <small>match</small>
    </div>`;
}

function skillTags(skills) {
  return `<div class="skills">${skills.map(s => `<span class="skill-tag">${s}</span>`).join("")}</div>`;
}

function jobCard(j) {
  return `
  <a class="job-card" href="job.html?id=${j.id}">
    <div class="top">
      <div class="logo-box" style="background:${j.logoColor}">${j.logoText}</div>
      <div style="flex:1">
        <h3>${j.title}</h3>
        <div class="company">${j.company} · ${j.location} · ${j.remote}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          ${verifiedBadge(j.verified)} ${freshnessBadge(j.postedDays)}
        </div>
      </div>
      ${matchRing(j.matchScore)}
    </div>
    <div class="meta">
      <span>💼 ${j.experience}</span>
      <span>🕒 ${j.type}</span>
      <span class="salary">💰 ${fmtSalary(j.salaryMin, j.salaryMax)}</span>
      <span>👥 ${j.applicants} applicants</span>
    </div>
    ${skillTags(j.skills)}
    <div class="card-foot">
      <span class="posted">💡 ${j.matchReason}</span>
      <span class="btn btn-ghost btn-sm">View & apply →</span>
    </div>
  </a>`;
}

/* ---------- Home: featured jobs ---------- */
function renderFeatured() {
  const el = document.getElementById("featured-jobs");
  if (!el) return;
  const top = [...JOBS].sort((a, b) => b.matchScore - a.matchScore).slice(0, 4);
  el.innerHTML = top.map(jobCard).join("");
}

/* ---------- Listings: search + filters ---------- */
const state = { q: "", loc: "", cats: new Set(), remote: new Set(), verifiedOnly: false, freshOnly: false };

function applyFilters() {
  return JOBS.filter(j => {
    const q = state.q.toLowerCase();
    const matchesQ = !q ||
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      j.skills.some(s => s.toLowerCase().includes(q));
    const matchesLoc = !state.loc || j.location.toLowerCase().includes(state.loc.toLowerCase());
    const matchesCat = state.cats.size === 0 || state.cats.has(j.category);
    const matchesRemote = state.remote.size === 0 || state.remote.has(j.remote);
    const matchesVerified = !state.verifiedOnly || j.verified;
    const matchesFresh = !state.freshOnly || j.postedDays <= 7;
    return matchesQ && matchesLoc && matchesCat && matchesRemote && matchesVerified && matchesFresh;
  }).sort((a, b) => b.matchScore - a.matchScore);
}

function renderListings() {
  const list = document.getElementById("job-list");
  if (!list) return;
  const results = applyFilters();
  document.getElementById("result-count").textContent = `${results.length} job${results.length !== 1 ? "s" : ""}`;
  list.innerHTML = results.length
    ? results.map(jobCard).join("")
    : `<div class="panel center"><h3>No jobs match your filters</h3><p class="muted">Try removing a filter or broadening your search.</p></div>`;
}

function initListings() {
  const list = document.getElementById("job-list");
  if (!list) return;

  // pre-fill from URL (?q=&loc=)
  const p = new URLSearchParams(location.search);
  state.q = p.get("q") || "";
  state.loc = p.get("loc") || "";
  const qi = document.getElementById("f-q"), li = document.getElementById("f-loc");
  if (qi) qi.value = state.q;
  if (li) li.value = state.loc;

  qi && qi.addEventListener("input", e => { state.q = e.target.value; renderListings(); });
  li && li.addEventListener("input", e => { state.loc = e.target.value; renderListings(); });

  document.querySelectorAll("[data-cat]").forEach(c =>
    c.addEventListener("change", e => {
      e.target.checked ? state.cats.add(e.target.value) : state.cats.delete(e.target.value);
      renderListings();
    }));
  document.querySelectorAll("[data-remote]").forEach(c =>
    c.addEventListener("change", e => {
      e.target.checked ? state.remote.add(e.target.value) : state.remote.delete(e.target.value);
      renderListings();
    }));
  const vo = document.getElementById("f-verified");
  vo && vo.addEventListener("change", e => { state.verifiedOnly = e.target.checked; renderListings(); });
  const fo = document.getElementById("f-fresh");
  fo && fo.addEventListener("change", e => { state.freshOnly = e.target.checked; renderListings(); });

  renderListings();
}

/* ---------- Job detail ---------- */
function renderDetail() {
  const root = document.getElementById("detail-root");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  const j = JOBS.find(x => x.id === id) || JOBS[0];
  document.title = `${j.title} at ${j.company} · Naukri+`;

  const stages = [
    { t: "Application reviewed", s: "Median 2 days at " + j.company },
    { t: "Recruiter screen", s: "30-min call" },
    { t: "Technical round", s: "1–2 interviews" },
    { t: "Decision & offer", s: "Median 9 days end-to-end" }
  ];

  root.innerHTML = `
  <div class="detail-grid">
    <div>
      <div class="panel">
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div class="logo-box" style="background:${j.logoColor};width:60px;height:60px;font-size:22px">${j.logoText}</div>
          <div style="flex:1">
            <h2 style="margin:0">${j.title}</h2>
            <p class="muted" style="margin:2px 0 10px">${j.company} · ${j.location} · ${j.remote}</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${verifiedBadge(j.verified)} ${freshnessBadge(j.postedDays)}
              <span class="badge badge-match">${j.matchScore}% match</span>
            </div>
          </div>
        </div>
        <div style="background:#eef5fe;border-radius:10px;padding:14px;margin-top:18px">
          <b>💡 Why you're seeing this</b>
          <p class="muted" style="margin-top:4px">${j.matchReason}</p>
        </div>
        <h3>About the role</h3>
        <p class="muted">${j.about}</p>
        <h3>What you'll do</h3>
        <ul>${j.responsibilities.map(r => `<li>${r}</li>`).join("")}</ul>
        <h3>What we're looking for</h3>
        <ul>${j.requirements.map(r => `<li>${r}</li>`).join("")}</ul>
        <h3>Skills</h3>
        ${skillTags(j.skills)}
      </div>
    </div>

    <aside class="transparency">
      <div class="panel">
        <button class="btn btn-primary btn-block" onclick="openApplyModal('${j.id}')">⚡ One-click apply</button>
        <p class="muted center" style="font-size:12.5px;margin-top:8px">You'll be able to track this in your dashboard.</p>
        <div style="margin-top:16px">
          <div class="t-row"><span class="k">Salary (always shown)</span><span class="v">${fmtSalary(j.salaryMin, j.salaryMax)}</span></div>
          <div class="t-row"><span class="k">Experience</span><span class="v">${j.experience}</span></div>
          <div class="t-row"><span class="k">Openings</span><span class="v">${j.openings}</span></div>
          <div class="t-row"><span class="k">Applicants so far</span><span class="v">${j.applicants}</span></div>
          <div class="t-row"><span class="k">Posted</span><span class="v">${j.postedDays}d ago</span></div>
          <div class="t-row"><span class="k">Employer</span><span class="v">${j.verified ? "✓ Verified" : "Unverified"}</span></div>
        </div>
      </div>
      <div class="panel">
        <h3 style="margin-top:0">⏱ Hiring timeline</h3>
        <p class="muted" style="font-size:13px">Transparency Naukri doesn't offer — know what to expect.</p>
        <div class="timeline">
          ${stages.map((s, i) => `
            <div class="step ${i === 0 ? "now" : ""}">
              <div class="dot">${i + 1}</div>
              <div><b>${s.t}</b><span>${s.s}</span></div>
            </div>`).join("")}
        </div>
      </div>
      <div class="panel">
        <h3 style="margin-top:0">🛡 Safe job</h3>
        <p class="muted" style="font-size:13.5px">This employer is identity-verified and the listing was auto-checked for fee-fraud patterns. <a href="#" onclick="alert('Report submitted — our trust team reviews within 24h.');return false;">Report this job</a></p>
      </div>
    </aside>
  </div>`;
}

/* ---------- localStorage helpers (persist user activity) ---------- */
const LS_APPS = "naukriplus_apps";
const LS_POSTED = "naukriplus_posted";
const getStored = key => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
const setStored = (key, v) => localStorage.setItem(key, JSON.stringify(v));

/* ---------- One-click apply modal ---------- */
function openApplyModal(id) {
  const j = JOBS.find(x => x.id === id) || JOBS[0];
  const already = getStored(LS_APPS).some(a => a.jobId === id);

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  overlay.innerHTML = already ? `
    <div class="modal">
      <div class="ok">
        <div class="check-big">✓</div>
        <h2>Already applied</h2>
        <p class="muted" style="margin-top:6px">You've applied to ${j.title} at ${j.company}. Track it in your dashboard.</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:18px">
          <a class="btn btn-ghost" href="job.html?id=${j.id}" onclick="this.closest('.modal-overlay').remove()">Close</a>
          <a class="btn btn-primary" href="dashboard.html">Go to dashboard</a>
        </div>
      </div>
    </div>` : `
    <div class="modal">
      <div class="modal-head">
        <div class="logo-box" style="background:${j.logoColor}">${j.logoText}</div>
        <div><h2 style="margin:0">Apply to ${j.title}</h2>
          <p class="muted" style="font-size:13.5px">${j.company} · ${fmtSalary(j.salaryMin, j.salaryMax)}</p></div>
        <button class="x" aria-label="Close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <form class="modal-body" id="apply-form">
        <div class="form-row">
          <label>Full name <span class="req">*</span></label>
          <input name="name" required value="Aarav Sharma" />
        </div>
        <div class="form-row">
          <label>Email <span class="req">*</span></label>
          <input name="email" type="email" required value="aarav@example.com" />
        </div>
        <div class="form-row">
          <label>Resume <span class="req">*</span></label>
          <label class="file-drop" for="resume-file" id="resume-label">📎 Aarav_Sharma_Resume.pdf (using saved resume)</label>
          <input id="resume-file" type="file" accept=".pdf,.doc,.docx" style="display:none" />
        </div>
        <div class="form-row">
          <label>Message to recruiter <span class="muted">(optional)</span></label>
          <textarea name="msg" placeholder="A line on why you're a great fit…"></textarea>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Submit application</button>
        <p class="muted center" style="font-size:12px;margin-top:10px">🛡 Verified employer · contact happens in-app, not by phone spam</p>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  const fileInput = overlay.querySelector("#resume-file");
  fileInput && fileInput.addEventListener("change", e => {
    if (e.target.files[0]) overlay.querySelector("#resume-label").textContent = "📎 " + e.target.files[0].name;
  });

  const form = overlay.querySelector("#apply-form");
  form && form.addEventListener("submit", e => {
    e.preventDefault();
    const apps = getStored(LS_APPS);
    apps.unshift({ jobId: j.id, appliedDays: 0, stage: 0, status: "active", note: "Application submitted — recruiter notified" });
    setStored(LS_APPS, apps);
    overlay.querySelector(".modal").innerHTML = `
      <div class="ok">
        <div class="check-big">✓</div>
        <h2>Application sent!</h2>
        <p class="muted" style="margin-top:6px">You applied to <b>${j.title}</b> at ${j.company}. We'll keep you posted at every stage — no black hole.</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:18px">
          <a class="btn btn-ghost" href="jobs.html">Keep browsing</a>
          <a class="btn btn-primary" href="dashboard.html">Track application →</a>
        </div>
      </div>`;
  });
}

/* ---------- Dashboard / application tracker ---------- */
function renderDashboard() {
  const root = document.getElementById("dash-root");
  if (!root) return;

  // user's freshly-applied jobs (localStorage) first, then seed data — dedupe by jobId
  const stored = getStored(LS_APPS);
  const seen = new Set(stored.map(a => a.jobId));
  const apps = [...stored, ...APPLICATIONS.filter(a => !seen.has(a.jobId))];

  const active = apps.filter(a => a.status === "active").length;
  const offers = apps.filter(a => a.status === "offer").length;
  const interviews = apps.filter(a => a.stage >= 3 && a.status !== "rejected").length;

  const stats = `
    <div class="stat-cards">
      <div class="stat-card"><b>${apps.length}</b><span>Applications</span></div>
      <div class="stat-card"><b>${active}</b><span>In progress</span></div>
      <div class="stat-card"><b>${interviews}</b><span>At interview+</span></div>
      <div class="stat-card accent"><b>${offers}</b><span>Offers 🎉</span></div>
    </div>`;

  const rows = apps.map(a => {
    const j = JOBS.find(x => x.id === a.jobId);
    if (!j) return "";
    const steps = STAGES.map((label, i) => {
      let cls = "";
      if (a.status === "rejected" && i === a.stage) cls = "rejected";
      else if (a.status === "offer" && i === a.stage) cls = "current";
      else if (i < a.stage) cls = "done";
      else if (i === a.stage) cls = "current";
      const mark = cls === "done" ? "✓" : cls === "rejected" ? "✕" : (i + 1);
      return `<div class="st ${cls}"><div class="d">${mark}</div>${label}</div>`;
    }).join("");

    return `
    <div class="app-row">
      <div class="top">
        <div class="logo-box" style="background:${j.logoColor}">${j.logoText}</div>
        <div style="flex:1">
          <h3>${j.title}</h3>
          <div class="company">${j.company} · ${j.location} · Applied ${a.appliedDays === 0 ? "today" : a.appliedDays + "d ago"}</div>
        </div>
        <a class="btn btn-ghost btn-sm" href="job.html?id=${j.id}">View job</a>
      </div>
      <div class="stepper">${steps}</div>
      <p class="muted" style="font-size:13.5px;margin-top:12px">📌 ${a.note}</p>
    </div>`;
  }).join("");

  root.innerHTML = stats + `<h2 style="margin:24px 0 14px;font-size:20px">Your applications</h2>` + rows;
}

/* ---------- Home search submit ---------- */
function initHomeSearch() {
  const form = document.getElementById("home-search");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const q = document.getElementById("home-q").value.trim();
    const loc = document.getElementById("home-loc").value.trim();
    location.href = `jobs.html?q=${encodeURIComponent(q)}&loc=${encodeURIComponent(loc)}`;
  });
}

/* ---------- Employer: post a job (live preview + submit) ---------- */
function initPostJob() {
  const form = document.getElementById("post-form");
  if (!form) return;
  const preview = document.getElementById("post-preview");

  const read = () => {
    const f = new FormData(form);
    const title = f.get("title") || "Job title";
    const company = f.get("company") || "Your company";
    const skills = (f.get("skills") || "").split(",").map(s => s.trim()).filter(Boolean);
    return {
      id: "preview",
      title, company,
      logoColor: "#1875e5",
      logoText: (company.trim()[0] || "?").toUpperCase() + (company.trim().split(" ")[1]?.[0]?.toUpperCase() || ""),
      verified: f.get("verify") === "on",
      location: f.get("location") || "City",
      remote: f.get("remote") || "On-site",
      experience: f.get("experience") || "—",
      type: f.get("type") || "Full-time",
      salaryMin: f.get("salaryMin") || 0,
      salaryMax: f.get("salaryMax") || 0,
      postedDays: 0,
      applicants: 0,
      skills: skills.length ? skills : ["Add skills…"],
      matchScore: 100,
      matchReason: "Preview of how your listing appears to matched candidates."
    };
  };

  const refresh = () => { preview.innerHTML = jobCard(read()); };
  form.addEventListener("input", refresh);
  refresh();

  form.addEventListener("submit", e => {
    e.preventDefault();
    const min = Number(new FormData(form).get("salaryMin"));
    const max = Number(new FormData(form).get("salaryMax"));
    if (!min || !max || max < min) {
      alert("Salary range is required and max must be ≥ min.\n\nNaukri+ never lets employers hide pay — that's the point.");
      return;
    }
    const posted = getStored(LS_POSTED);
    posted.unshift(read());
    setStored(LS_POSTED, posted);
    document.getElementById("post-root").innerHTML = `
      <div class="panel center" style="max-width:560px;margin:48px auto">
        <div class="check-big" style="margin:0 auto 14px">✓</div>
        <h2>Job submitted for verification</h2>
        <p class="muted" style="margin-top:8px">Before going live, our trust team verifies your company identity and scans the listing for fee-fraud patterns — usually within 24 hours. This is why candidates trust Naukri+ listings.</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:20px">
          <a class="btn btn-ghost" href="post-job.html">Post another</a>
          <a class="btn btn-primary" href="jobs.html">View live jobs</a>
        </div>
      </div>`;
  });
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  renderFeatured();
  initListings();
  renderDetail();
  renderDashboard();
  initHomeSearch();
  initPostJob();
});

/* ============================================================
   Naukri+ frontend — now wired to the Express + Postgres API.
   Falls back to the bundled mock data (data.js) when the API is
   unreachable, so the static site still works via file://.
   ============================================================ */

/* ---------- Config & API client ---------- */
// Same-origin "/api" when deployed (Vercel); localhost API during local dev.
const API_BASE = localStorage.getItem("naukriplus_api") || (
  ["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:"
    ? "http://localhost:4000/api"
    : "/api"
);
const LS_TOKEN = "naukriplus_token";
const LS_USER  = "naukriplus_user";
const LS_APPS  = "naukriplus_apps";   // offline-only fallback store

const getToken = () => localStorage.getItem(LS_TOKEN);
const getUser  = () => { try { return JSON.parse(localStorage.getItem(LS_USER)); } catch { return null; } };
const setAuth  = (token, user) => { localStorage.setItem(LS_TOKEN, token); localStorage.setItem(LS_USER, JSON.stringify(user)); };
const clearAuth = () => { localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_USER); };
const getStored = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const setStored = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// Throws Error; HTTP errors carry .status, network/offline errors do not.
async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) headers.Authorization = "Bearer " + t;
  const res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status, data });
  return data;
}
const isOffline = err => err && err.status === undefined; // fetch threw -> no server

/* ---------- Data access (API first, mock fallback) ---------- */
async function fetchJobs(params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  try {
    return await api("/jobs" + (qs.toString() ? "?" + qs : ""));
  } catch (err) {
    if (!isOffline(err)) throw err;
    return filterMock(params);
  }
}
async function fetchJob(id) {
  try { return await api("/jobs/" + id); }
  catch (err) { if (!isOffline(err)) throw err; return (window.JOBS || []).find(j => j.id === id) || (window.JOBS || [])[0]; }
}
function filterMock(p) {
  let list = [...(window.JOBS || [])];
  const q = (p.q || "").toLowerCase();
  if (q) list = list.filter(j => j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.skills.some(s => s.toLowerCase().includes(q)));
  if (p.location) list = list.filter(j => j.location.toLowerCase().includes(p.location.toLowerCase()));
  if (p.category) list = list.filter(j => j.category === p.category);
  if (p.remote) list = list.filter(j => j.remote === p.remote);
  if (p.verified === "true") list = list.filter(j => j.verified);
  if (p.fresh === "true") list = list.filter(j => j.postedDays <= 7);
  return list.sort((a, b) => b.matchScore - a.matchScore);
}

/* ---------- Render helpers ---------- */
const fmtSalary = (min, max) => `₹${min}–${max} LPA`;
const STAGES = ["Applied", "Viewed", "Shortlisted", "Interview", "Decision"];

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
  return `<div class="match" title="Explainable AI match score">
      <div class="ring" style="--p:${score}"><i>${score}%</i></div><small>match</small></div>`;
}
function skillTags(skills) {
  return `<div class="skills">${(skills || []).map(s => `<span class="skill-tag">${s}</span>`).join("")}</div>`;
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
      <span>💼 ${j.experience || "—"}</span>
      <span>🕒 ${j.type}</span>
      <span class="salary">💰 ${fmtSalary(j.salaryMin, j.salaryMax)}</span>
      <span>👥 ${j.applicants} applicants</span>
    </div>
    ${skillTags(j.skills)}
    <div class="card-foot">
      <span class="posted">💡 ${j.matchReason || ""}</span>
      <span class="btn btn-ghost btn-sm">View & apply →</span>
    </div>
  </a>`;
}

/* ---------- Auth UI ---------- */
function updateAuthUI() {
  const user = getUser();
  document.querySelectorAll("#auth-slot").forEach(slot => {
    if (user) {
      slot.innerHTML = `<span class="muted" style="font-size:13.5px">Hi, ${user.name.split(" ")[0]}${user.role === "employer" ? " · Employer" : ""}</span>
        <button class="btn btn-ghost btn-sm" onclick="signOut()">Sign out</button>`;
    } else {
      slot.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="openAuthModal()">Sign in</button>`;
    }
  });
}
function signOut() { clearAuth(); updateAuthUI(); location.href = "index.html"; }

function openAuthModal(defaultRole = "candidate", onSuccess) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h2 id="auth-title">Sign in to Naukri+</h2>
        <button class="x" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;margin-bottom:18px">
          <button class="btn btn-sm tab-btn" data-mode="login">Sign in</button>
          <button class="btn btn-sm tab-btn" data-mode="register">Create account</button>
        </div>
        <form id="auth-form">
          <div class="form-row" data-only="register">
            <label>Full name</label><input name="name" placeholder="Your name" />
          </div>
          <div class="form-row" data-only="register">
            <label>I am a…</label>
            <select name="role">
              <option value="candidate" ${defaultRole === "candidate" ? "selected" : ""}>Job seeker</option>
              <option value="employer" ${defaultRole === "employer" ? "selected" : ""}>Employer</option>
            </select>
          </div>
          <div class="form-row" data-only="register" data-employer>
            <label>Company</label><input name="company" placeholder="Company name" />
          </div>
          <div class="form-row"><label>Email</label><input name="email" type="email" required value="aarav@example.com" /></div>
          <div class="form-row"><label>Password</label><input name="password" type="password" required value="password123" /></div>
          <p id="auth-err" class="hint" style="color:var(--red)"></p>
          <button class="btn btn-primary btn-block" type="submit" id="auth-submit">Sign in</button>
          <p class="muted center" style="font-size:12px;margin-top:10px">Demo: aarav@example.com / employer@acme.com · password123</p>
        </form>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  let mode = "login";
  const setMode = m => {
    mode = m;
    overlay.querySelectorAll(".tab-btn").forEach(b =>
      b.className = "btn btn-sm tab-btn " + (b.dataset.mode === m ? "btn-primary" : "btn-ghost"));
    overlay.querySelectorAll('[data-only="register"]').forEach(el => el.classList.toggle("hide", m !== "register"));
    overlay.querySelector("#auth-title").textContent = m === "login" ? "Sign in to Naukri+" : "Create your account";
    overlay.querySelector("#auth-submit").textContent = m === "login" ? "Sign in" : "Create account";
    toggleCompany();
  };
  const toggleCompany = () => {
    const role = overlay.querySelector('[name="role"]').value;
    overlay.querySelector("[data-employer]").classList.toggle("hide", !(mode === "register" && role === "employer"));
  };
  overlay.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  overlay.querySelector('[name="role"]').addEventListener("change", toggleCompany);
  setMode("login");

  overlay.querySelector("#auth-form").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const errEl = overlay.querySelector("#auth-err");
    errEl.textContent = "";
    const payload = mode === "login"
      ? { email: f.get("email"), password: f.get("password") }
      : { name: f.get("name"), email: f.get("email"), password: f.get("password"), role: f.get("role"), company: f.get("company") };
    try {
      const res = await api("/auth/" + (mode === "login" ? "login" : "register"), { method: "POST", body: payload });
      setAuth(res.token, res.user);
      updateAuthUI();
      overlay.remove();
      if (onSuccess) onSuccess(res.user); else location.reload();
    } catch (err) {
      errEl.textContent = isOffline(err) ? "Cannot reach the API server (start it with: cd server && npm start)." : err.message;
    }
  });
}

/* ---------- Home: featured ---------- */
async function renderFeatured() {
  const el = document.getElementById("featured-jobs");
  if (!el) return;
  const jobs = await fetchJobs();
  el.innerHTML = jobs.slice(0, 4).map(jobCard).join("");
}

/* ---------- Listings ---------- */
const state = { q: "", loc: "", cats: new Set(), remote: new Set(), verifiedOnly: false, freshOnly: false, allJobs: false };
let listingTimer;

async function renderListings() {
  const list = document.getElementById("job-list");
  if (!list) return;
  // single category/remote supported by API; if multiple selected, filter client-side after fetch
  const params = {
    q: state.q, location: state.loc,
    verified: state.verifiedOnly ? "true" : "", fresh: state.freshOnly ? "true" : "",
    category: state.cats.size === 1 ? [...state.cats][0] : "",
    remote: state.remote.size === 1 ? [...state.remote][0] : "",
    all: state.allJobs ? "true" : "",
  };
  let results = await fetchJobs(params);
  if (state.cats.size > 1) results = results.filter(j => state.cats.has(j.category));
  if (state.remote.size > 1) results = results.filter(j => state.remote.has(j.remote));

  document.getElementById("result-count").textContent = `${results.length} job${results.length !== 1 ? "s" : ""}`;
  list.innerHTML = results.length
    ? results.map(jobCard).join("")
    : `<div class="panel center"><h3>No jobs match your filters</h3><p class="muted">Try removing a filter or broadening your search.</p></div>`;
}
const debouncedListings = () => { clearTimeout(listingTimer); listingTimer = setTimeout(renderListings, 200); };

function initListings() {
  const list = document.getElementById("job-list");
  if (!list) return;
  const p = new URLSearchParams(location.search);
  state.q = p.get("q") || ""; state.loc = p.get("loc") || "";
  const qi = document.getElementById("f-q"), li = document.getElementById("f-loc");
  if (qi) { qi.value = state.q; qi.addEventListener("input", e => { state.q = e.target.value; debouncedListings(); }); }
  if (li) { li.value = state.loc; li.addEventListener("input", e => { state.loc = e.target.value; debouncedListings(); }); }
  document.querySelectorAll("[data-cat]").forEach(c => c.addEventListener("change", e => {
    e.target.checked ? state.cats.add(e.target.value) : state.cats.delete(e.target.value); renderListings(); }));
  document.querySelectorAll("[data-remote]").forEach(c => c.addEventListener("change", e => {
    e.target.checked ? state.remote.add(e.target.value) : state.remote.delete(e.target.value); renderListings(); }));
  const vo = document.getElementById("f-verified");
  vo && vo.addEventListener("change", e => { state.verifiedOnly = e.target.checked; renderListings(); });
  const fo = document.getElementById("f-fresh");
  fo && fo.addEventListener("change", e => { state.freshOnly = e.target.checked; renderListings(); });

  // Candidates can toggle between skill-matched jobs (default) and all jobs.
  const toggle = document.getElementById("match-toggle");
  const user = getUser();
  if (toggle && user && user.role === "candidate") {
    toggle.innerHTML = `<label class="check" style="font-size:13px;display:inline-flex;gap:6px;align-items:center">
      <input type="checkbox" id="show-all-jobs" /> Show all jobs (ignore my skills)</label>`;
    const cb = document.getElementById("show-all-jobs");
    cb.addEventListener("change", e => { state.allJobs = e.target.checked; renderListings(); });
  }
  renderListings();
}

/* ---------- Job detail ---------- */
async function renderDetail() {
  const root = document.getElementById("detail-root");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  const j = await fetchJob(id);
  if (!j) { root.innerHTML = `<div class="panel center" style="margin-top:40px"><h2>Job not found</h2></div>`; return; }
  document.title = `${j.title} at ${j.company} · Naukri+`;
  const me = getUser();
  const isOwner = me && me.role === "employer" && j.employerId && String(me.id) === String(j.employerId);

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
          <b>💡 Why you're seeing this</b><p class="muted" style="margin-top:4px">${j.matchReason || ""}</p>
        </div>
        <h3>About the role</h3><p class="muted">${j.about || ""}</p>
        <h3>What you'll do</h3><ul>${(j.responsibilities || []).map(r => `<li>${r}</li>`).join("")}</ul>
        <h3>What we're looking for</h3><ul>${(j.requirements || []).map(r => `<li>${r}</li>`).join("")}</ul>
        <h3>Skills</h3>${skillTags(j.skills)}
      </div>
    </div>
    <aside class="transparency">
      <div class="panel">
        ${isOwner
          ? `<a class="btn btn-primary btn-block" href="employer.html">👥 View ${j.applicants} applicant${j.applicants === 1 ? "" : "s"} →</a>
             <p class="muted center" style="font-size:12.5px;margin-top:8px">You posted this job. Manage applicants & résumés in your ATS.</p>`
          : `<button class="btn btn-primary btn-block" onclick="openApplyModal('${j.id}')">⚡ One-click apply</button>
             <p class="muted center" style="font-size:12.5px;margin-top:8px">You'll be able to track this in your dashboard.</p>`}
        <div style="margin-top:16px">
          <div class="t-row"><span class="k">Salary (always shown)</span><span class="v">${fmtSalary(j.salaryMin, j.salaryMax)}</span></div>
          <div class="t-row"><span class="k">Experience</span><span class="v">${j.experience || "—"}</span></div>
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
          ${stages.map((s, i) => `<div class="step ${i === 0 ? "now" : ""}"><div class="dot">${i + 1}</div><div><b>${s.t}</b><span>${s.s}</span></div></div>`).join("")}
        </div>
      </div>
      <div class="panel">
        <h3 style="margin-top:0">🛡 Safe job</h3>
        <p class="muted" style="font-size:13.5px">This employer is identity-verified and the listing was auto-checked for fee-fraud patterns. <a href="#" onclick="alert('Report submitted — our trust team reviews within 24h.');return false;">Report this job</a></p>
      </div>
    </aside>
  </div>`;
}

/* ---------- Apply ---------- */
function openApplyModal(id) {
  if (!getUser()) { openAuthModal("candidate", () => openApplyModal(id)); return; }
  fetchJob(id).then(j => showApplyForm(j));
}
function showApplyForm(j) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <div class="logo-box" style="background:${j.logoColor}">${j.logoText}</div>
        <div><h2 style="margin:0">Apply to ${j.title}</h2>
          <p class="muted" style="font-size:13.5px">${j.company} · ${fmtSalary(j.salaryMin, j.salaryMax)}</p></div>
        <button class="x" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <form class="modal-body" id="apply-form">
        <div class="form-row"><label>Resume <span class="req">*</span></label>
          <label class="file-drop" for="resume-file" id="resume-label">📎 Using your saved resume</label>
          <input id="resume-file" type="file" accept=".pdf,.doc,.docx" style="display:none" /></div>
        <div class="form-row"><label>Message to recruiter <span class="muted">(optional)</span></label>
          <textarea name="msg" placeholder="A line on why you're a great fit…"></textarea></div>
        <p id="apply-err" class="hint" style="color:var(--red)"></p>
        <button class="btn btn-primary btn-block" type="submit">Submit application</button>
        <p class="muted center" style="font-size:12px;margin-top:10px">🛡 Verified employer · contact happens in-app, not by phone spam</p>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  const fileInput = overlay.querySelector("#resume-file");
  fileInput.addEventListener("change", e => { if (e.target.files[0]) overlay.querySelector("#resume-label").textContent = "📎 " + e.target.files[0].name; });

  overlay.querySelector("#apply-form").addEventListener("submit", async e => {
    e.preventDefault();
    const note = overlay.querySelector('[name="msg"]').value.trim() || null;
    const errEl = overlay.querySelector("#apply-err");
    try {
      await api("/applications", { method: "POST", body: { jobId: j.id, note } });
      applySuccess(overlay, j);
    } catch (err) {
      if (isOffline(err)) {            // offline fallback: store locally
        const apps = getStored(LS_APPS);
        if (!apps.some(a => a.jobId === j.id)) { apps.unshift({ jobId: j.id, appliedDays: 0, stage: 0, status: "active", note: "Application submitted (offline)" }); setStored(LS_APPS, apps); }
        applySuccess(overlay, j);
      } else if (err.status === 409) {
        applySuccess(overlay, j, true);
      } else { errEl.textContent = err.message; }
    }
  });
}
function applySuccess(overlay, j, already) {
  overlay.querySelector(".modal").innerHTML = `
    <div class="ok">
      <div class="check-big">✓</div>
      <h2>${already ? "Already applied" : "Application sent!"}</h2>
      <p class="muted" style="margin-top:6px">${already ? "You've already applied to" : "You applied to"} <b>${j.title}</b> at ${j.company}. We'll keep you posted at every stage — no black hole.</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:18px">
        <a class="btn btn-ghost" href="jobs.html">Keep browsing</a>
        <a class="btn btn-primary" href="dashboard.html">Track application →</a>
      </div>
    </div>`;
}

/* ---------- Dashboard ---------- */
async function renderDashboard() {
  const root = document.getElementById("dash-root");
  if (!root) return;

  if (!getUser()) {
    root.innerHTML = `<div class="panel center" style="max-width:460px;margin:32px auto">
      <h2>Sign in to see your applications</h2>
      <p class="muted" style="margin:8px 0 16px">Track every application end-to-end — the transparency Naukri never gave you.</p>
      <button class="btn btn-primary" onclick="openAuthModal('candidate')">Sign in</button></div>`;
    return;
  }

  let apps;
  try {
    apps = await api("/applications");
  } catch (err) {
    if (!isOffline(err)) { root.innerHTML = `<div class="panel center"><p>${err.message}</p></div>`; return; }
    // offline fallback from mock data + local store
    const stored = getStored(LS_APPS);
    const seen = new Set(stored.map(a => a.jobId));
    const merged = [...stored, ...((window.APPLICATIONS || []).filter(a => !seen.has(a.jobId)))];
    apps = merged.map(a => ({ ...a, job: (window.JOBS || []).find(j => j.id === a.jobId) })).filter(a => a.job);
  }

  const active = apps.filter(a => a.status === "active").length;
  const offers = apps.filter(a => a.status === "offer").length;
  const interviews = apps.filter(a => a.stage >= 3 && a.status !== "rejected").length;

  const stats = `<div class="stat-cards">
      <div class="stat-card"><b>${apps.length}</b><span>Applications</span></div>
      <div class="stat-card"><b>${active}</b><span>In progress</span></div>
      <div class="stat-card"><b>${interviews}</b><span>At interview+</span></div>
      <div class="stat-card accent"><b>${offers}</b><span>Offers 🎉</span></div>
    </div>`;

  const rows = apps.map(a => {
    const j = a.job;
    const steps = STAGES.map((label, i) => {
      let cls = "";
      if (a.status === "rejected" && i === a.stage) cls = "rejected";
      else if (a.status === "offer" && i === a.stage) cls = "current";
      else if (i < a.stage) cls = "done";
      else if (i === a.stage) cls = "current";
      const mark = cls === "done" ? "✓" : cls === "rejected" ? "✕" : (i + 1);
      return `<div class="st ${cls}"><div class="d">${mark}</div>${label}</div>`;
    }).join("");
    return `<div class="app-row">
      <div class="top">
        <div class="logo-box" style="background:${j.logoColor}">${j.logoText}</div>
        <div style="flex:1"><h3>${j.title}</h3>
          <div class="company">${j.company} · ${j.location} · Applied ${a.appliedDays === 0 ? "today" : a.appliedDays + "d ago"}</div></div>
        <a class="btn btn-ghost btn-sm" href="job.html?id=${j.id}">View job</a>
      </div>
      <div class="stepper">${steps}</div>
      <p class="muted" style="font-size:13.5px;margin-top:12px">📌 ${a.note}</p>
    </div>`;
  }).join("");

  document.querySelector(".dash-head h1").textContent = `Welcome back, ${getUser().name.split(" ")[0]} 👋`;
  root.innerHTML = stats + `<h2 style="margin:24px 0 14px;font-size:20px">Your applications</h2>` + (rows || `<p class="muted">No applications yet — <a href="jobs.html">find a job</a>.</p>`);
}

/* ---------- Home search ---------- */
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

/* ---------- Post a job: role autocomplete + university picker ---------- */
async function populateRoleDatalist() {
  const dl = document.getElementById("role-list");
  if (!dl) return;
  try {
    const { roles } = await api("/job-roles?limit=300");
    dl.innerHTML = roles.map(r => `<option value="${r.title}">${r.category}</option>`).join("");
  } catch { /* optional — free-text title still works */ }
}

function initUniversityPicker(onChange) {
  const input = document.getElementById("uni-picker");
  const hidden = document.getElementById("universityId");
  const box = document.getElementById("uni-suggest");
  const hint = document.getElementById("uni-picked-hint");
  if (!input || !box || !hidden) return;
  const form = document.getElementById("post-form");
  let timer;

  const renderSuggest = (items) => {
    if (!items.length) { box.classList.add("hide"); box.innerHTML = ""; return; }
    box.innerHTML = items.map(e =>
      `<div class="opt" data-id="${e.id}" data-name="${encodeURIComponent(e.name)}" data-state="${encodeURIComponent(e.state || "")}">
         ${e.name}<small>${[shortType(e.type), e.state].filter(Boolean).join(" · ")}</small></div>`).join("");
    box.classList.remove("hide");
  };

  input.addEventListener("input", () => {
    hidden.value = ""; hint.textContent = "";  // editing unlinks until re-picked
    const q = input.value.trim();
    clearTimeout(timer);
    if (q.length < 2) { box.classList.add("hide"); return; }
    timer = setTimeout(async () => {
      try { renderSuggest((await fetchEmployers({ q, limit: 8 })).employers); }
      catch { box.classList.add("hide"); }
    }, 220);
  });

  box.addEventListener("click", e => {
    const opt = e.target.closest(".opt");
    if (!opt) return;
    const name = decodeURIComponent(opt.dataset.name);
    const state = decodeURIComponent(opt.dataset.state);
    hidden.value = opt.dataset.id;
    input.value = name;
    box.classList.add("hide");
    const companyEl = form.querySelector('[name="company"]');
    const locEl = form.querySelector('[name="location"]');
    if (companyEl) companyEl.value = name;
    if (locEl && state) locEl.value = state;
    hint.textContent = `✓ Linked to ${name} — this job will appear on the university's profile.`;
    onChange && onChange();
  });

  document.addEventListener("click", e => {
    if (!box.contains(e.target) && e.target !== input) box.classList.add("hide");
  });
}

/* ---------- Employer: post a job ---------- */
function initPostJob() {
  const form = document.getElementById("post-form");
  if (!form) return;
  const preview = document.getElementById("post-preview");
  const gate = document.getElementById("post-gate");

  const user = getUser();
  if (!user || user.role !== "employer") {
    if (gate) gate.innerHTML = `<div class="verify-note" style="background:#fef3e0;color:#b9770f">⚠ <span>You must be signed in as an <b>employer</b> to post a job. <a href="#" onclick="openAuthModal('employer');return false;">Sign in / create an employer account</a>.</span></div>`;
  }

  const read = () => {
    const f = new FormData(form);
    const company = f.get("company") || user?.company || "Your company";
    return {
      id: "preview", title: f.get("title") || "Job title", company,
      logoColor: "#1875e5",
      logoText: (company.trim()[0] || "?").toUpperCase() + (company.trim().split(" ")[1]?.[0]?.toUpperCase() || ""),
      verified: f.get("verify") === "on",
      location: f.get("location") || "City", remote: f.get("remote") || "On-site",
      experience: f.get("experience") || "—", type: f.get("type") || "Full-time",
      salaryMin: f.get("salaryMin") || 0, salaryMax: f.get("salaryMax") || 0,
      postedDays: 0, applicants: 0,
      skills: (f.get("skills") || "").split(",").map(s => s.trim()).filter(Boolean) || [],
      matchScore: 100, matchReason: "Preview of how your listing appears to matched candidates."
    };
  };
  const refresh = () => { preview.innerHTML = jobCard(read()); };
  form.addEventListener("input", refresh);
  refresh();

  populateRoleDatalist();
  initUniversityPicker(refresh);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const u = getUser();
    if (!u || u.role !== "employer") { openAuthModal("employer", () => location.reload()); return; }
    const f = new FormData(form);
    const body = {
      title: f.get("title"), company: f.get("company") || u.company, location: f.get("location"),
      remote: f.get("remote"), type: f.get("type"), experience: f.get("experience"),
      salaryMin: Number(f.get("salaryMin")), salaryMax: Number(f.get("salaryMax")),
      skills: (f.get("skills") || "").split(",").map(s => s.trim()).filter(Boolean),
      category: f.get("category") || "Other", verified: f.get("verify") === "on",
      universityId: f.get("universityId") || null,
    };
    try {
      await api("/jobs", { method: "POST", body });
      postSuccess();
    } catch (err) {
      if (isOffline(err)) { alert("Cannot reach the API server. Start it with: cd server && npm start"); return; }
      alert(err.message);
    }
  });
}
function postSuccess() {
  document.getElementById("post-root").innerHTML = `
    <div class="panel center" style="max-width:560px;margin:48px auto">
      <div class="check-big" style="margin:0 auto 14px">✓</div>
      <h2>Job submitted &amp; live for verification</h2>
      <p class="muted" style="margin-top:8px">Our trust team verifies company identity and scans for fee-fraud patterns — usually within 24 hours. This is why candidates trust Naukri+ listings.</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:20px">
        <a class="btn btn-ghost" href="post-job.html">Post another</a>
        <a class="btn btn-primary" href="jobs.html">View live jobs</a>
      </div>
    </div>`;
}

/* ---------- Employer ATS dashboard ---------- */
async function renderEmployer() {
  const root = document.getElementById("employer-root");
  if (!root) return;

  const user = getUser();
  if (!user || user.role !== "employer") {
    root.innerHTML = `<div class="panel center" style="max-width:480px;margin:32px auto">
      <h2>Sign in as an employer</h2>
      <p class="muted" style="margin:8px 0 16px">The ATS dashboard is for employer accounts. Post jobs and manage your candidate pipeline here.</p>
      <button class="btn btn-primary" onclick="openAuthModal('employer')">Sign in / create employer account</button></div>`;
    return;
  }

  let jobs;
  try { jobs = await api("/employer/jobs"); }
  catch (err) {
    root.innerHTML = `<div class="panel center"><p>${isOffline(err) ? "API server is not running (cd server && npm start)." : err.message}</p></div>`;
    return;
  }

  const totalApplicants = jobs.reduce((n, j) => n + j.applicants, 0);
  const stats = `<div class="stat-cards">
      <div class="stat-card"><b>${jobs.length}</b><span>Active postings</span></div>
      <div class="stat-card"><b>${totalApplicants}</b><span>Total applicants</span></div>
      <div class="stat-card"><b>${jobs.filter(j => j.verified).length}</b><span>Verified listings</span></div>
      <div class="stat-card accent"><b>Live</b><span>Pipeline syncs to candidates</span></div>
    </div>`;

  if (!jobs.length) {
    root.innerHTML = stats + `<div class="panel center" style="margin-top:20px"><h3>No postings yet</h3>
      <p class="muted">Post your first job to start receiving applicants.</p>
      <a class="btn btn-primary" href="post-job.html" style="margin-top:10px">Post a job</a></div>`;
    return;
  }

  const cards = jobs.map(j => `
    <div class="panel" style="margin-bottom:16px">
      <div style="display:flex;gap:14px;align-items:center">
        <div class="logo-box" style="background:${j.logoColor}">${j.logoText}</div>
        <div style="flex:1">
          <h3 style="font-size:17px">${j.title}</h3>
          <div class="company">${j.location} · ${j.remote} · ${fmtSalary(j.salaryMin, j.salaryMax)} · ${verifiedBadge(j.verified)}</div>
        </div>
        <div class="match"><div class="ring" style="--p:100"><i>${j.applicants}</i></div><small>applicants</small></div>
        <button class="btn btn-ghost btn-sm" onclick="atsToggle('${j.id}', this)">Hide applicants ▴</button>
      </div>
      <div id="ats-${j.id}" style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px">
        <p class="muted">Loading applicants…</p>
      </div>
    </div>`).join("");

  root.innerHTML = stats + `<h2 style="margin:24px 0 14px;font-size:20px">Your postings</h2>` + cards;
  // Show each posting's applicants (with résumés) inline, automatically.
  jobs.forEach(j => atsLoad(j.id));
}

async function atsLoad(jobId) {
  const box = document.getElementById("ats-" + jobId);
  if (!box) return;
  box.innerHTML = `<p class="muted">Loading applicants…</p>`;
  try {
    const data = await api(`/employer/jobs/${jobId}/applicants`);
    atsRenderApplicants(jobId, data);
  } catch (err) {
    box.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

async function atsToggle(jobId, btn) {
  const box = document.getElementById("ats-" + jobId);
  if (!box.classList.contains("hide")) { box.classList.add("hide"); btn.textContent = "View applicants ▾"; return; }
  box.classList.remove("hide");
  btn.textContent = "Hide applicants ▴";
  await atsLoad(jobId);
}

const atsApplicants = {};  // cache for the résumé modal (keyed by application id)

function atsRenderApplicants(jobId, data) {
  const box = document.getElementById("ats-" + jobId);
  data.applicants.forEach(a => { atsApplicants[a.id] = a; });
  const applicantsHtml = data.applicants.map(a => {
    const statusBadge = a.status === "offer" ? `<span class="badge badge-verified">Offer</span>`
      : a.status === "rejected" ? `<span class="badge badge-stale">Rejected</span>`
      : `<span class="badge badge-soft">In pipeline</span>`;
    const stageOpts = data.stages.map((s, i) => `<option value="${i}" ${i === a.stage ? "selected" : ""}>${s}</option>`).join("");
    const statusOpts = ["active", "offer", "rejected"].map(s => `<option value="${s}" ${s === a.status ? "selected" : ""}>${s === "active" ? "In pipeline" : s}</option>`).join("");
    return `
    <div class="app-row" style="margin-bottom:12px">
      <div class="top">
        <div class="logo-box" style="background:var(--navy)">${(a.name[0] || "?").toUpperCase()}</div>
        <div style="flex:1">
          <h3 style="font-size:15px">${a.name} ${statusBadge}</h3>
          ${a.headline ? `<div class="company">${a.headline}</div>` : ""}
          <div class="company" style="margin-top:2px">${[a.experience, a.city].filter(Boolean).join(" · ")}${a.experience || a.city ? " · " : ""}${a.email}</div>
          <div class="company" style="margin-top:2px">Applied ${a.appliedDays === 0 ? "today" : a.appliedDays + "d ago"} · Stage: ${data.stages[a.stage]}</div>
          ${a.skills && a.skills.length ? `<div class="skills" style="margin-top:8px">${a.skills.slice(0, 8).map(s => `<span class="skill-tag">${s}</span>`).join("")}</div>` : ""}
        </div>
        ${a.resume ? `<button class="btn btn-ghost btn-sm" onclick="viewResume(${a.id})">📄 Résumé</button>` : ""}
      </div>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:12px">
        <div class="form-row" style="margin:0">
          <label style="font-size:12px">Stage</label>
          <select id="stage-${a.id}" style="padding:7px 10px">${stageOpts}</select>
        </div>
        <div class="form-row" style="margin:0">
          <label style="font-size:12px">Status</label>
          <select id="status-${a.id}" style="padding:7px 10px">${statusOpts}</select>
        </div>
        <button class="btn btn-primary btn-sm" onclick="atsSave(${a.id}, '${jobId}')">Save & notify candidate</button>
      </div>
      <p class="muted" style="font-size:13px;margin-top:8px">📌 ${a.note || "—"}</p>
    </div>`;
  }).join("");

  const sourced = data.sourced || [];
  const sourcedHtml = sourced.length ? `
    <div style="margin-bottom:14px">
      <h4 style="margin:0 0 8px">🗂 Sourced candidates (${sourced.length})</h4>
      ${sourced.map(s => `
        <div class="app-row" style="margin-bottom:10px">
          <div class="top">
            <div class="logo-box" style="background:#5a3e9a">${(s.name?.[0] || "?").toUpperCase()}</div>
            <div style="flex:1">
              <h3 style="font-size:15px">${s.name || "—"} <span class="badge badge-soft">Sourced</span></h3>
              <div class="company">${[s.title, s.company].filter(Boolean).join(" · ")}${s.location ? " · " + s.location : ""}</div>
              <div class="company" style="margin-top:2px">${[s.email && ("✉ " + s.email), s.phone && ("📞 " + s.phone)].filter(Boolean).join(" · ") || ""}</div>
            </div>
            ${s.linkedin ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${s.linkedin.startsWith("http") ? s.linkedin : "https://" + s.linkedin}">in ↗</a>` : ""}
          </div>
        </div>`).join("")}
    </div>` : "";

  const applicantsHeader = data.applicants.length
    ? `<h4 style="margin:0 0 8px">📥 Applicants (${data.applicants.length})</h4>`
    : `<p class="muted">No direct applicants yet.</p>`;

  box.innerHTML = sourcedHtml + applicantsHeader + applicantsHtml;
}

async function atsSave(appId, jobId) {
  const stage = Number(document.getElementById("stage-" + appId).value);
  const status = document.getElementById("status-" + appId).value;
  try {
    await api(`/applications/${appId}`, { method: "PATCH", body: { stage, status } });
    const data = await api(`/employer/jobs/${jobId}/applicants`);
    atsRenderApplicants(jobId, data);
  } catch (err) {
    alert(err.message);
  }
}

/* ---------- Résumé modal (employer ATS) ---------- */
function resumeMarkup(a) {
  const r = a.resume || {};
  const exp = (r.experience || []).map(x => `
    <div style="margin-bottom:12px">
      <b>${x.role}</b> — ${x.org} <span class="muted">(${x.period})</span>
      <ul>${(x.points || []).map(p => `<li>${p}</li>`).join("")}</ul>
    </div>`).join("");
  return `
    <h2 style="margin:0">${a.name}</h2>
    <p style="margin:2px 0;font-weight:600">${a.headline || ""}</p>
    <p class="muted" style="font-size:13px">${[a.city, a.email, a.experience].filter(Boolean).join(" · ")}</p>
    ${r.summary ? `<h3>Summary</h3><p class="muted">${r.summary}</p>` : ""}
    ${exp ? `<h3>Experience</h3>${exp}` : ""}
    ${(r.education || []).length ? `<h3>Education</h3><ul>${r.education.map(e => `<li>${e}</li>`).join("")}</ul>` : ""}
    ${(r.achievements || []).length ? `<h3>Key achievements</h3><ul>${r.achievements.map(e => `<li>${e}</li>`).join("")}</ul>` : ""}
    ${(a.skills || []).length ? `<h3>Skills</h3><div class="skills">${a.skills.map(s => `<span class="skill-tag">${s}</span>`).join("")}</div>` : ""}
    ${(r.affiliations || []).length ? `<h3>Affiliations</h3><ul>${r.affiliations.map(e => `<li>${e}</li>`).join("")}</ul>` : ""}`;
}

function viewResume(id) {
  const a = atsApplicants[id];
  if (!a) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal" style="max-width:680px">
      <div class="modal-head">
        <h2 style="margin:0">Résumé</h2>
        <button class="x" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">${resumeMarkup(a)}
        <div style="margin-top:18px;display:flex;gap:10px">
          <button class="btn btn-primary btn-sm" onclick="downloadResumePdf(${a.id}, this)">⬇ Download PDF</button>
          <button class="btn btn-ghost btn-sm" onclick="window.print()">🖨 Print</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

/* Lazy-load jsPDF (only when a download is requested) and build a clean,
   text-based résumé PDF entirely in the browser — no server dependency. */
let _jspdfPromise;
function ensureJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  _jspdfPromise = _jspdfPromise || new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => resolve(window.jspdf.jsPDF);
    s.onerror = () => reject(new Error("network"));
    document.head.appendChild(s);
  });
  return _jspdfPromise;
}

async function downloadResumePdf(id, btn) {
  const a = atsApplicants[id];
  if (!a) return;
  let JsPDF;
  try { JsPDF = await ensureJsPDF(); }
  catch { alert("Couldn't load the PDF library (network). Use 🖨 Print → Save as PDF instead."); return; }
  if (btn) { btn.disabled = true; btn.textContent = "Generating…"; }

  const r = a.resume || {};
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const M = 48, PW = 595, maxY = 842 - 48;
  let y = M;
  const text = (str, { size = 11, bold = false, color = [26, 34, 51], gap = 5, indent = 0 } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    for (const ln of doc.splitTextToSize(String(str), PW - 2 * M - indent)) {
      if (y > maxY) { doc.addPage(); y = M; }
      doc.text(ln, M + indent, y);
      y += size + gap;
    }
  };
  const heading = (t) => { y += 8; text(t, { size: 12, bold: true, color: [24, 117, 229] }); y += 1; };
  const bullets = (arr) => (arr || []).forEach((it) => text("•  " + it, { indent: 6 }));

  text(a.name, { size: 20, bold: true });
  if (a.headline) text(a.headline, { size: 12, color: [24, 117, 229] });
  text([a.city, a.email, a.experience ? a.experience + " experience" : ""].filter(Boolean).join("  ·  "),
    { size: 9.5, color: [100, 112, 133] });

  if (r.summary) { heading("Professional Summary"); text(r.summary); }
  if ((r.experience || []).length) {
    heading("Experience");
    r.experience.forEach((x) => {
      text(`${x.role} — ${x.org}  (${x.period})`, { bold: true, size: 11 });
      bullets(x.points);
      y += 2;
    });
  }
  if ((r.education || []).length) { heading("Education"); bullets(r.education); }
  if ((r.achievements || []).length) { heading("Key Achievements"); bullets(r.achievements); }
  if ((a.skills || []).length) { heading("Core Skills"); text(a.skills.join(", ")); }
  if ((r.affiliations || []).length) { heading("Affiliations"); bullets(r.affiliations); }

  doc.save(a.name.replace(/[^a-z0-9]+/gi, "_") + "_Resume.pdf");
  if (btn) { btn.disabled = false; btn.textContent = "⬇ Download PDF"; }
}

/* ---------- Universities (potential employers) directory ---------- */
const UNI_PALETTE = ["#1875e5", "#e23744", "#12283f", "#fc8019", "#9c1ab1", "#00b386", "#387ed1", "#b9770f"];
const uniColor = name => UNI_PALETTE[[...(name || "?")].reduce((h, c) => h + c.charCodeAt(0), 0) % UNI_PALETTE.length];
const uniInitials = name => (name || "?").replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "U";
const shortType = t => (t || "").replace("Deemed to be Universities", "Deemed");

const uniState = { q: "", state: "", type: "", offset: 0, limit: 24, total: 0 };
let uniTimer;

async function fetchEmployers(params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null));
  return api("/employers" + (qs.toString() ? "?" + qs : ""));
}

function uniCard(e) {
  const loc = [e.state].filter(Boolean).join("");
  return `
  <a class="job-card" href="university.html?id=${e.id}">
    <div class="top">
      <div class="logo-box" style="background:${uniColor(e.name)}">${uniInitials(e.name)}</div>
      <div style="flex:1">
        <h3>${e.name}</h3>
        <div class="company">${loc || "India"}${e.zip ? " · " + e.zip : ""}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <span class="badge badge-soft">${shortType(e.type) || "University"}</span>
          ${e.ugc_status ? `<span class="badge badge-verified" title="UGC recognition status">UGC ${e.ugc_status}</span>` : ""}
        </div>
      </div>
    </div>
    ${e.address ? `<p class="muted" style="font-size:13.5px;margin-top:10px">📍 ${e.address}</p>` : ""}
    <div class="card-foot">
      <span class="posted">🏛 Potential employer · UGC-recognised</span>
      <span class="btn btn-ghost btn-sm">View profile →</span>
    </div>
  </a>`;
}

async function renderUniversities(append = false) {
  const list = document.getElementById("uni-list");
  if (!list) return;
  const countEl = document.getElementById("uni-count");
  if (!append) { uniState.offset = 0; list.innerHTML = `<p class="muted">Searching…</p>`; }

  let data;
  try {
    data = await fetchEmployers({ q: uniState.q, state: uniState.state, type: uniState.type, limit: uniState.limit, offset: uniState.offset });
  } catch (err) {
    list.innerHTML = `<div class="panel center"><h3>${isOffline(err) ? "API server is not running" : "Something went wrong"}</h3>
      <p class="muted">${isOffline(err) ? "Start it with: cd server && npm start" : err.message}</p></div>`;
    return;
  }

  uniState.total = data.total;
  const cards = data.employers.map(uniCard).join("");
  if (append) list.insertAdjacentHTML("beforeend", cards);
  else list.innerHTML = data.employers.length ? cards : `<div class="panel center"><h3>No universities match your search</h3><p class="muted">Try a different name, state or type.</p></div>`;

  if (countEl) countEl.textContent = `${data.total.toLocaleString()} universit${data.total === 1 ? "y" : "ies"}`;

  const shown = uniState.offset + data.employers.length;
  const more = document.getElementById("uni-more");
  if (more) {
    more.classList.toggle("hide", shown >= data.total);
    more.textContent = `Load more (${shown.toLocaleString()} of ${data.total.toLocaleString()})`;
  }
}
const debouncedUni = () => { clearTimeout(uniTimer); uniTimer = setTimeout(() => renderUniversities(false), 220); };

async function initUniversities() {
  const list = document.getElementById("uni-list");
  if (!list) return;

  // Populate state/type dropdowns from live data so they match exactly.
  try {
    const meta = await api("/employers/meta");
    const stateSel = document.getElementById("uni-state");
    const typeSel = document.getElementById("uni-type");
    if (stateSel) stateSel.insertAdjacentHTML("beforeend", meta.states.map(s => `<option value="${s}">${s}</option>`).join(""));
    if (typeSel) typeSel.insertAdjacentHTML("beforeend", meta.types.map(t => `<option value="${t}">${shortType(t)}</option>`).join(""));
  } catch { /* dropdowns stay as "All"; free-text search still works */ }

  // Seed state from the URL so deep links (e.g. ?state=Kerala) work.
  const p = new URLSearchParams(location.search);
  uniState.q = p.get("q") || "";
  uniState.state = p.get("state") || "";
  uniState.type = p.get("type") || "";

  const qi = document.getElementById("uni-q");
  const ss = document.getElementById("uni-state");
  const ts = document.getElementById("uni-type");
  if (qi) { qi.value = uniState.q; qi.addEventListener("input", e => { uniState.q = e.target.value.trim(); debouncedUni(); }); }
  if (ss) { if (uniState.state) ss.value = uniState.state; ss.addEventListener("change", e => { uniState.state = e.target.value; renderUniversities(false); }); }
  if (ts) { if (uniState.type) ts.value = uniState.type; ts.addEventListener("change", e => { uniState.type = e.target.value; renderUniversities(false); }); }
  const more = document.getElementById("uni-more");
  more && more.addEventListener("click", () => { uniState.offset += uniState.limit; renderUniversities(true); });

  renderUniversities(false);
}

/* ---------- University detail ---------- */
async function renderUniversityDetail() {
  const root = document.getElementById("uni-detail-root");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) { location.href = "universities.html"; return; }

  let e;
  try {
    e = await api("/employers/" + id);
  } catch (err) {
    root.innerHTML = `<div class="panel center" style="margin-top:40px">
      <h2>${isOffline(err) ? "API server is not running" : "University not found"}</h2>
      <p class="muted">${isOffline(err) ? "Start it with: cd server && npm start" : err.message}</p>
      <a class="btn btn-primary" href="universities.html" style="margin-top:12px">← Back to universities</a></div>`;
    return;
  }
  document.title = `${e.name} · Naukri+`;

  let cats = [];
  try { cats = (await api("/job-roles/categories")).categories; } catch { /* optional */ }
  let jobs = [];
  try { jobs = await api("/employers/" + id + "/jobs"); } catch { /* optional */ }
  const totalRoles = cats.reduce((a, c) => a + c.roles, 0);
  const mapsQ = encodeURIComponent([e.name, e.address, e.state].filter(Boolean).join(", "));
  const canPost = getUser()?.role === "employer";

  root.innerHTML = `
  <div class="detail-grid">
    <div>
      <div class="panel">
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div class="logo-box" style="background:${uniColor(e.name)};width:60px;height:60px;font-size:22px">${uniInitials(e.name)}</div>
          <div style="flex:1">
            <h2 style="margin:0">${e.name}</h2>
            <p class="muted" style="margin:2px 0 10px">${[e.state, e.zip].filter(Boolean).join(" · ") || "India"}</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <span class="badge badge-soft">${shortType(e.type) || "University"}</span>
              ${e.ugc_status ? `<span class="badge badge-verified" title="UGC recognition status">UGC ${e.ugc_status}</span>` : ""}
              <span class="badge badge-match">Potential employer</span>
            </div>
          </div>
        </div>
        ${e.address ? `<h3>Address</h3><p class="muted">📍 ${e.address}</p>
        <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${mapsQ}">Open in Maps ↗</a>` : ""}

        <h3 style="margin-top:22px">Leadership roles such institutions hire</h3>
        <p class="muted" style="font-size:13.5px">Drawn from our catalog of ${totalRoles || "150+"} university leadership positions across ${cats.length || 11} areas. Detailed descriptions are being added.</p>
        <div class="skills">
          ${cats.map(c => `<span class="skill-tag">${c.category} · ${c.roles}</span>`).join("")}
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <h3 style="margin-top:0">Open positions${jobs.length ? ` (${jobs.length})` : ""}</h3>
        ${jobs.length
          ? `<div class="job-list">${jobs.map(jobCard).join("")}</div>`
          : `<p class="muted">No open positions posted yet.${canPost ? ` <a href="post-job.html">Post a role at this university →</a>` : ""}</p>`}
      </div>
    </div>
    <aside class="transparency">
      <div class="panel">
        <h3 style="margin-top:0">Institution details</h3>
        <div class="t-row"><span class="k">Type</span><span class="v">${e.type || "—"}</span></div>
        <div class="t-row"><span class="k">State</span><span class="v">${e.state || "—"}</span></div>
        <div class="t-row"><span class="k">PIN code</span><span class="v">${e.zip || "—"}</span></div>
        <div class="t-row"><span class="k">UGC status</span><span class="v">${e.ugc_status || "—"}</span></div>
        <div class="t-row"><span class="k">Category</span><span class="v">${e.category || "University"}</span></div>
        <div class="t-row"><span class="k">Source</span><span class="v">${e.source || "—"}</span></div>
      </div>
      <div class="panel">
        <h3 style="margin-top:0">Explore more</h3>
        ${e.state ? `<a class="btn btn-ghost btn-block" href="universities.html?state=${encodeURIComponent(e.state)}">More in ${e.state}</a>` : ""}
        ${e.type ? `<a class="btn btn-ghost btn-block" style="margin-top:8px" href="universities.html?type=${encodeURIComponent(e.type)}">All ${shortType(e.type)} universities</a>` : ""}
      </div>
    </aside>
  </div>`;
}

/* ---------- Candidate search (employer talent pool) ---------- */
const candState = { q: "", title: "", seniority: "", loc: "", offset: 0, limit: 24, total: 0 };
let candTimer;
let candEmployerJobs = []; // employer's jobs, for the shortlist dropdown

function candCard(c) {
  const phone = c.mobile_phone || c.work_phone || c.corporate_phone;
  const kw = (c.keywords || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 8);
  const loc = [c.city, c.state, c.country].filter(Boolean).join(", ");
  const li = c.linkedin_url ? (c.linkedin_url.startsWith("http") ? c.linkedin_url : "https://" + c.linkedin_url) : null;
  return `
  <div class="job-card" style="cursor:default">
    <div class="top">
      <div class="logo-box" style="background:var(--navy)">${(c.full_name?.[0] || "?").toUpperCase()}</div>
      <div style="flex:1">
        <h3>${c.full_name || "—"}</h3>
        <div class="company">${[c.title, c.company].filter(Boolean).join(" · ")}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          ${c.seniority ? `<span class="badge badge-soft">${c.seniority}</span>` : ""}
          ${loc ? `<span class="badge badge-soft">📍 ${loc}</span>` : ""}
          ${c.industry ? `<span class="badge badge-soft">${c.industry}</span>` : ""}
        </div>
      </div>
      ${li ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${li}">in ↗</a>` : ""}
    </div>
    ${kw.length ? `<div class="skills" style="margin-top:10px">${kw.map(k => `<span class="skill-tag">${k}</span>`).join("")}</div>` : ""}
    <div class="meta" style="margin-top:10px">
      ${c.email ? `<span class="salary">✉ ${c.email}${c.email_status ? ` <span class="muted">(${c.email_status})</span>` : ""}</span>` : ""}
      ${phone ? `<span>📞 ${phone}</span>` : ""}
    </div>
    <div class="card-foot">
      <span class="posted">🗂 Sourced lead · ${c.source || "Apollo"}</span>
      <button class="btn btn-ghost btn-sm" onclick="viewCandidate(${c.id})">View &amp; shortlist →</button>
    </div>
  </div>`;
}

async function viewCandidate(id) {
  let c;
  try { c = await api("/candidates/" + id); }
  catch (err) { alert(err.message || "Could not load candidate"); return; }
  const kw = (c.keywords || "").split(",").map(s => s.trim()).filter(Boolean);
  const li = c.linkedin_url ? (c.linkedin_url.startsWith("http") ? c.linkedin_url : "https://" + c.linkedin_url) : null;
  const phone = c.mobile_phone || c.work_phone || c.corporate_phone;
  const row = (k, v) => v ? `<div class="t-row"><span class="k">${k}</span><span class="v">${v}</span></div>` : "";
  const jobOpts = candEmployerJobs.map(j => `<option value="${j.id}">${j.title}${j.company ? " — " + j.company : ""}</option>`).join("");

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="modal" style="max-width:680px">
      <div class="modal-head">
        <div class="logo-box" style="background:var(--navy)">${(c.full_name?.[0] || "?").toUpperCase()}</div>
        <div><h2 style="margin:0">${c.full_name || "—"}</h2>
          <p class="muted" style="font-size:13.5px">${[c.title, c.company].filter(Boolean).join(" · ")}</p></div>
        <button class="x" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        ${row("LinkedIn", li ? `<a href="${li}" target="_blank" rel="noopener">${li}</a>` : "")}
        ${row("Email", c.email ? `${c.email}${c.email_status ? ` (${c.email_status})` : ""}` : "")}
        ${row("Phone", phone || "")}
        ${row("Seniority", c.seniority)}
        ${row("Location", [c.city, c.state, c.country].filter(Boolean).join(", "))}
        ${row("Industry", c.industry)}
        ${row("Departments", c.departments)}
        ${row("Company size", c.num_employees ? c.num_employees.toLocaleString() + " employees" : "")}
        ${row("Company links", [c.company_linkedin_url, c.website].filter(Boolean).map(u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`).join("<br>"))}
        ${kw.length ? `<h3>Keywords</h3><div class="skills">${kw.slice(0, 40).map(k => `<span class="skill-tag">${k}</span>`).join("")}</div>` : ""}

        <h3>Shortlist to a job</h3>
        ${candEmployerJobs.length
          ? `<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
               <div class="form-row" style="margin:0;flex:1;min-width:220px">
                 <label style="font-size:12px">Your job postings</label>
                 <select id="shortlist-job-${c.id}">${jobOpts}</select>
               </div>
               <button class="btn btn-primary btn-sm" onclick="shortlistCandidate(${c.id})">Add to pipeline</button>
             </div>
             <p class="hint">Shortlisted candidates appear under that job in your Employer ATS.</p>`
          : `<p class="muted">Post a job first to shortlist candidates into its pipeline.</p>`}

        <h3>Candidate login</h3>
        ${c.email
          ? `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
               <button class="btn btn-ghost btn-sm" onclick="createCandidateLogin(${c.id})">Create login account</button>
               <span class="muted" id="login-result-${c.id}" style="font-size:13px"></span>
             </div>
             <p class="hint">Creates a candidate sign-in from <b>${c.email}</b> (default password: password123).</p>`
          : `<p class="muted">No email on file — can't create a login.</p>`}
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function createCandidateLogin(id) {
  try {
    const res = await api(`/candidates/${id}/create-login`, { method: "POST", body: {} });
    const el = document.getElementById("login-result-" + id);
    if (el) el.textContent = `✓ ${res.email} / ${res.password}`;
    alert(`Login created:\n\nEmail: ${res.email}\nPassword: ${res.password}\nRole: candidate`);
  } catch (err) {
    if (err.status === 409) { alert("A login already exists for " + (err.data && err.data.email ? err.data.email : "this email") + ". Password unchanged."); return; }
    alert(err.message || "Could not create login");
  }
}

async function shortlistCandidate(id) {
  const sel = document.getElementById("shortlist-job-" + id);
  if (!sel || !sel.value) return;
  try {
    const res = await api(`/candidates/${id}/shortlist`, { method: "POST", body: { jobId: sel.value } });
    alert(res.alreadyShortlisted ? "Already shortlisted to that job." : "✓ Added to the job's pipeline. See it in your Employer ATS.");
  } catch (err) {
    alert(err.message || "Could not shortlist");
  }
}

async function renderCandidates(append = false) {
  const list = document.getElementById("cand-list");
  if (!list) return;
  if (!append) { candState.offset = 0; list.innerHTML = `<p class="muted">Searching…</p>`; }
  let data;
  try {
    const qs = new URLSearchParams(Object.entries({
      q: candState.q, title: candState.title, seniority: candState.seniority, location: candState.loc,
      limit: candState.limit, offset: candState.offset,
    }).filter(([, v]) => v !== "" && v != null));
    data = await api("/candidates" + (qs.toString() ? "?" + qs : ""));
  } catch (err) {
    const countEl = document.getElementById("cand-count");
    if (countEl) countEl.textContent = "";
    if (err.status === 401 || err.status === 403) {
      list.innerHTML = `<div class="panel center"><h3>Employer sign-in required</h3>
        <p class="muted" style="margin:8px 0 14px">Candidate search is for employer accounts.</p>
        <button class="btn btn-primary" onclick="openAuthModal('employer', () => location.reload())">Sign in as employer</button></div>`;
      return;
    }
    list.innerHTML = `<div class="panel center"><h3>${isOffline(err) ? "API server is not running" : "Something went wrong"}</h3>
      <p class="muted">${isOffline(err) ? "Start it with: cd server && npm start" : err.message}</p></div>`;
    return;
  }
  candState.total = data.total;
  const cards = data.candidates.map(candCard).join("");
  if (append) list.insertAdjacentHTML("beforeend", cards);
  else list.innerHTML = data.candidates.length ? cards
    : `<div class="panel center"><h3>No candidates match</h3><p class="muted">Try a different search, or import an Apollo CSV.</p></div>`;
  const countEl = document.getElementById("cand-count");
  if (countEl) countEl.textContent = `${data.total.toLocaleString()} candidate${data.total === 1 ? "" : "s"}`;
  const shown = candState.offset + data.candidates.length;
  const more = document.getElementById("cand-more");
  if (more) { more.classList.toggle("hide", shown >= data.total); more.textContent = `Load more (${shown} of ${data.total})`; }
}
const debouncedCand = () => { clearTimeout(candTimer); candTimer = setTimeout(() => renderCandidates(false), 220); };

async function initCandidates() {
  const list = document.getElementById("cand-list");
  if (!list) return;

  // Populate filter dropdowns + load the employer's jobs (for shortlisting).
  try {
    const meta = await api("/candidates/meta");
    const ts = document.getElementById("cand-title");
    const ss = document.getElementById("cand-seniority");
    const ls = document.getElementById("cand-loc");
    if (ts) ts.insertAdjacentHTML("beforeend", meta.titles.map(t => `<option value="${t}">${t}</option>`).join(""));
    if (ss) ss.insertAdjacentHTML("beforeend", meta.seniorities.map(s => `<option value="${s}">${s}</option>`).join(""));
    if (ls) ls.insertAdjacentHTML("beforeend", (meta.locations || []).map(l => `<option value="${l}">${l}</option>`).join(""));
    candEmployerJobs = await api("/employer/jobs").catch(() => []);
  } catch { /* not an employer / not signed in — handled by renderCandidates */ }

  const qi = document.getElementById("cand-q"), ti = document.getElementById("cand-title"),
        si = document.getElementById("cand-seniority"), li = document.getElementById("cand-loc");
  qi && qi.addEventListener("input", e => { candState.q = e.target.value.trim(); debouncedCand(); });
  ti && ti.addEventListener("change", e => { candState.title = e.target.value; renderCandidates(false); });
  si && si.addEventListener("change", e => { candState.seniority = e.target.value; renderCandidates(false); });
  li && li.addEventListener("change", e => { candState.loc = e.target.value; renderCandidates(false); });
  const more = document.getElementById("cand-more");
  more && more.addEventListener("click", () => { candState.offset += candState.limit; renderCandidates(true); });

  const btn = document.getElementById("cand-import-btn"), file = document.getElementById("cand-import-file");
  if (btn && file) {
    btn.addEventListener("click", () => {
      if (!getUser() || getUser().role !== "employer") { openAuthModal("employer", () => location.reload()); return; }
      file.click();
    });
    file.addEventListener("change", async e => {
      const f = e.target.files[0];
      if (!f) return;
      btn.disabled = true; const orig = btn.textContent; btn.textContent = "Importing…";
      try {
        const text = await f.text();
        const res = await api("/candidates/import", { method: "POST", body: { csv: text } });
        alert(`Imported ✓ — processed ${res.processed} row(s). Total candidates: ${res.total}.`);
        renderCandidates(false);
      } catch (err) {
        alert(isOffline(err) ? "API not reachable." :
          (err.status === 401 || err.status === 403) ? "Employer sign-in required to import." : err.message);
      } finally { btn.disabled = false; btn.textContent = orig; file.value = ""; }
    });
  }
  renderCandidates(false);
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  updateAuthUI();
  renderFeatured();
  initListings();
  renderDetail();
  renderDashboard();
  initHomeSearch();
  initPostJob();
  renderEmployer();
  initUniversities();
  renderUniversityDetail();
  initCandidates();
});

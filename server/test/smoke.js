/* Minimal smoke test — verifies the API is up and serving data.
   Run with: npm test  (requires the API running on $PORT or :4000) */
const BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 4000}/api`;

let failed = 0;
const check = (name, cond) => {
  console.log(`${cond ? "✓" : "✗"} ${name}`);
  if (!cond) failed++;
};

async function main() {
  let health, jobs;
  try {
    health = await (await fetch(`${BASE}/health`)).json();
    jobs = await (await fetch(`${BASE}/jobs`)).json();
  } catch (e) {
    console.error(`✗ Could not reach API at ${BASE}: ${e.message}`);
    process.exit(1);
  }

  check("health endpoint reports db up", health && health.ok === true && health.db === "up");
  check("jobs endpoint returns a non-empty array", Array.isArray(jobs) && jobs.length > 0);
  check("jobs are sorted by match score (desc)", jobs.every((j, i) => i === 0 || jobs[i - 1].matchScore >= j.matchScore));
  check("every job exposes a salary range (no hidden pay)", jobs.every((j) => j.salaryMin > 0 && j.salaryMax >= j.salaryMin));

  console.log(failed ? `\n${failed} check(s) failed` : "\nAll smoke checks passed");
  process.exit(failed ? 1 : 0);
}

main();

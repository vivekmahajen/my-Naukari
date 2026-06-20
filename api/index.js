// Vercel serverless entry point. The Express app is a valid (req, res) handler,
// so we re-export it. Requests to /api/* are routed here by vercel.json, and the
// app's own /api/... routes handle them. `VERCEL` is set by the platform, which
// prevents server/src/index.js from starting a long-running listener.
import app from "../server/src/index.js";

export default app;

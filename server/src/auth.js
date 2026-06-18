import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret";

export const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, company: user.company || null },
    SECRET,
    { expiresIn: "7d" }
  );

// Attaches req.user if a valid Bearer token is present; otherwise leaves it null.
export function authOptional(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try { req.user = jwt.verify(token, SECRET); } catch { req.user = null; }
  }
  next();
}

// Requires a valid token, else 401.
export function authRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  next();
}

// Requires a specific role.
export const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role)
    return res.status(403).json({ error: `Requires ${role} role` });
  next();
};

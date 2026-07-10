import { verifyAccessToken } from "../utils/jwt.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing access token." } });
  }

  const token = header.slice(7);

  try {
    const decoded = verifyAccessToken(token);
    req.auth = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired access token." } });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const currentRole = req.auth?.role;

    if (!currentRole || !roles.includes(currentRole)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions." } });
    }

    return next();
  };
}

import { verifyAccessToken } from "../utils/jwt.js";
import { pool } from "../db/pool.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing access token." } });
  }

  const token = header.slice(7);

  try {
    const decoded = verifyAccessToken(token);

    // Single-session: the access token must carry the user's CURRENT
    // token_version. If it's stale (a newer login/password change happened),
    // treat the request as unauthenticated immediately.
    const [rows] = await pool.query(
      "SELECT token_version FROM users WHERE user_id = ? LIMIT 1",
      [Number(decoded.sub)],
    );

    if (
      rows.length === 0 ||
      Number(rows[0].token_version) !== Number(decoded.ver)
    ) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Session is no longer valid. Please sign in again.",
        },
      });
    }

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

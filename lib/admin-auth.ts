export const ADMIN_WWW_AUTHENTICATE = 'Basic realm="Nexus Vault Admin", charset="UTF-8"';

export type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; message: string };

export function decodeBasicAuthHeader(
  headerValue: string
): { username: string; password: string } | null {
  if (!headerValue.startsWith("Basic ")) return null;

  const encoded = headerValue.slice(6).trim();
  if (!encoded) return null;

  try {
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) return null;

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; ++i) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verifies HTTP Basic credentials against configured ADMIN_USERNAME/ADMIN_PASSWORD.
 * Fails closed (503) when credentials are not configured in the environment.
 */
export function verifyAdminAuthorization(
  authHeader: string | null,
  env: Record<string, string | undefined> = process.env
): AdminAuthResult {
  const expectedUsername = env.ADMIN_USERNAME;
  const expectedPassword = env.ADMIN_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return {
      ok: false,
      status: 503,
      message: "Admin credentials are not configured.",
    };
  }

  if (!authHeader) {
    return { ok: false, status: 401, message: "Authentication required." };
  }

  const credentials = decodeBasicAuthHeader(authHeader);
  if (!credentials) {
    return { ok: false, status: 401, message: "Authentication required." };
  }

  const isValidUser = secureCompare(credentials.username, expectedUsername);
  const isValidPassword = secureCompare(credentials.password, expectedPassword);
  if (!isValidUser || !isValidPassword) {
    return { ok: false, status: 401, message: "Authentication required." };
  }

  return { ok: true };
}

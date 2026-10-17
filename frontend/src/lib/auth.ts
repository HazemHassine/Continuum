const TOKEN_KEY = "continuum_auth_token";

export function postLoginPath(redirect: string | null): string {
  if (!redirect || !redirect.startsWith("/")) return "/dashboard";
  try {
    const origin = "https://continuum.invalid";
    const target = new URL(redirect, origin);
    if (target.origin === origin && target.pathname === "/dashboard") {
      return target.pathname + target.search + target.hash;
    }
  } catch {
    // Invalid or external redirects never leave the notebook.
  }
  return "/dashboard";
}

export interface AuthUser {
  id: string;
  email: string | null;
  role: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  // Also store in document.cookie so Next.js middleware can inspect it
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax${secure}`;
}

export function removeAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax${secure}`;
}

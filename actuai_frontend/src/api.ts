export const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('actuai_token');
}

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Use application/json by default if body is present and not FormData
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token might be expired or invalid
      localStorage.removeItem('actuai_token');
      window.dispatchEvent(new Event('auth-change'));
    }
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `API request failed with status ${response.status}`);
  }

  return response;
}

const API_BASE_URL = (process.env.REACT_APP_API_URL).replace(/\/$/, '');
export const AUTH_STORAGE_KEY = 'mk-tech-auth';

export function getStoredAuth() {
  try {
    const savedValue = localStorage.getItem(AUTH_STORAGE_KEY);
    return savedValue ? JSON.parse(savedValue) : null;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function saveStoredAuth(authPayload) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authPayload));
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function apiRequest(path, options = {}) {
  const auth = getStoredAuth();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (auth?.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const rawText = await response.text();
  let payload = {};

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { message: rawText };
    }
  }

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed.');
  }

  return payload;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}

export { API_BASE_URL };

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const getToken = (): string | null => {
  return localStorage.getItem('bufet_token');
};

const setToken = (token: string): void => {
  localStorage.setItem('bufet_token', token);
};

const removeToken = (): void => {
  localStorage.removeItem('bufet_token');
  localStorage.removeItem('bufet_user');
};

const getUser = (): { id: string; email: string; role: string } | null => {
  const user = localStorage.getItem('bufet_user');
  return user ? JSON.parse(user) : null;
};

const setUser = (user: { id: string; email: string; role: string }): void => {
  localStorage.setItem('bufet_user', JSON.stringify(user));
};

interface ApiOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

const api = async <T>(endpoint: string, options: ApiOptions = {}): Promise<T> => {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};

export { api, getToken, setToken, removeToken, getUser, setUser, API_URL };

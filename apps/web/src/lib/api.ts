export const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
        throw new Error(data.error || 'Что-то пошло не так.');
    return data as T;
}

export const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');

export function createApi(token, onExpired = () => {}, fetcher = fetch) {
  return async function request(path, { method = 'GET', body } = {}) {
    let response;
    try {
      response = await fetcher(`${API_URL}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(12000)
      });
    } catch {
      throw new Error('Backend tidak dapat dijangkau. Periksa server dan konfigurasi API.');
    }
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && token) onExpired();
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Permintaan gagal (${response.status}).`);
    }
    return data;
  };
}

export const canNavigate = (role, page) => page === 'dashboard' || (role === 'admin' && ['cameras', 'accounts', 'password'].includes(page));
export const vehicleLabel = type => ({ bus: 'TransJakarta', ambulans: 'Ambulans', damkar: 'Damkar', mobil: 'Mobil', motor: 'Motor', truk: 'Truk' }[type] || type || '—');

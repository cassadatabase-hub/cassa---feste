// Generates a short, unambiguous alphanumeric code (6 chars)
// Excludes: 0, O, 1, I, L to avoid confusion
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}

export function formatPrice(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(value || 0);
}

export function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
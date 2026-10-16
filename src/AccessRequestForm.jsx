import { useState } from 'react';
import { createApi } from './api.js';
import './access.css';
export default function AccessRequestForm({ onBack }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError('');
    try {
      const result = await createApi()('/access-requests', { method: 'POST', body: {
        name: values.get('name').trim(), email: values.get('email').trim(), reason: values.get('reason').trim()
      } });
      setSuccess(result.message); form.reset();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="access-public">
    <button type="button" className="access-back" onClick={onBack} disabled={busy}>← Kembali ke login</button>
    <h2>Ajukan akses</h2><p>Isi data berikut agar admin dapat memeriksa permintaan akun Petugas.</p>
    {success ? <div role="status" className="access-success">{success}<p>Pengajuan ini belum menjadi akun. Tunggu informasi akses dari admin.</p></div> :
      <form className="access-form" onSubmit={submit}>
        <label>Nama lengkap<input name="name" autoComplete="name" required minLength={2} maxLength={100} disabled={busy}/></label>
        <label>Email aktif<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy}/></label>
        <label>Keperluan akses<textarea name="reason" required minLength={10} maxLength={1000} rows={3} placeholder="Contoh: bertugas memantau dan mengoperasikan portal busway." disabled={busy}/></label>
        <small>Admin menggunakan email ini untuk menghubungimu terkait pengajuan akses.</small>
        {error && <div className="access-error" role="alert">{error}</div>}
        <button className="lg-submit" type="submit" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim permintaan'}</button>
      </form>}
  </section>;
}

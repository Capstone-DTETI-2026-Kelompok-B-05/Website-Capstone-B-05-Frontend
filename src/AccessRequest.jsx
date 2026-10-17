import { useState } from 'react';
import { createApi } from './api.js';

export default function AccessRequest({ onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  return <div className="access-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}><section className="access-dialog" role="dialog" aria-modal="true" aria-labelledby="request-title"><h2 id="request-title">Ajukan akses petugas</h2><p>Admin akan memeriksa permintaan dan membuatkan akunmu.</p>
    {success ? <><p role="status">Permintaan berhasil dikirim. Tunggu admin menghubungi melalui email yang kamu cantumkan.</p><button className="primary-button" onClick={onClose}>Kembali ke login</button></> : <form className="manage-form" onSubmit={async e => {
      e.preventDefault(); const values = new FormData(e.currentTarget); setBusy(true); setError('');
      try { await createApi()('/access-requests', { method: 'POST', body: Object.fromEntries(values) }); setSuccess(true); }
      catch (err) { setError(err.message); } finally { setBusy(false); }
    }}>
      <label className="manage-field">Nama<input autoFocus name="name" minLength={2} maxLength={100} required disabled={busy}/></label>
      <label className="manage-field">Email<input name="email" type="email" required disabled={busy}/></label>
      <label className="manage-field">Alasan pengajuan<textarea name="reason" minLength={10} maxLength={1000} required disabled={busy}/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim permintaan'}</button><button className="secondary-button" type="button" disabled={busy} onClick={onClose}>Batal</button>
    </form>}
  </section></div>;
}

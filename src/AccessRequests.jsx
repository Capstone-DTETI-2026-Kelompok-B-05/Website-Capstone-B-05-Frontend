import { useCallback, useEffect, useState } from 'react';
import './access.css';
const statusText = { pending: 'Menunggu', processing: 'Diproses', approved: 'Disetujui', rejected: 'Ditolak' };
export default function AccessRequests({ api }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState('approve');
  const [filter, setFilter] = useState('pending');
  const [credentials, setCredentials] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await api('/access-requests'); setRequests(data.requests); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [api]);
  useEffect(() => { load(); }, [load]);
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const values = new FormData(event.currentTarget);
    const body = action === 'approve' ? { username: values.get('username').trim(), password: values.get('password') } : { rejectionReason: values.get('rejectionReason').trim() };
    setBusy(true); setError(''); setSuccess('');
    try {
      const data = await api(`/access-requests/${selected.id}/${action}`, { method: 'POST', body });
      setSuccess(data.message);
      if (action === 'approve' && !data.recovered) { setCredentials({ email: selected.email, username: data.account.username, password: body.password }); setShowPassword(false); }
      setSelected(null); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function recover(row) {
    setBusy(true); setError('');
    try { const data = await api(`/access-requests/${row.id}/approve`, { method: 'POST', body: {} }); setSuccess(data.message); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const rows = requests.filter(row => filter === 'all' || row.status === filter);
  return <div className="management-page">
    <div className="manage-heading"><div><h1>Permintaan Akun</h1><p>Periksa pengajuan dan buatkan akun Petugas bagi pemohon yang disetujui.</p></div></div>
    {error && <div role="alert" className="form-error">{error}</div>}
    {success && <div role="status" className="form-success">{success}</div>}
    {credentials && <section className="manage-card access-credentials">
      <h2>Informasi login untuk {credentials.email}</h2><p>Sampaikan secara pribadi. Informasi ini hanya ditampilkan pada sesi halaman ini.</p>
      <p>Username: <b>{credentials.username}</b></p>
      <p>Password awal: <b>{showPassword ? credentials.password : '••••••••'}</b></p>
      <div className="form-actions"><button className="secondary-button" onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Sembunyikan' : 'Lihat password'}</button>
        <button className="secondary-button" onClick={async () => {
          try { await navigator.clipboard.writeText(`Username: ${credentials.username}\nPassword awal: ${credentials.password}\nGanti password setelah login pertama.`); setSuccess('Informasi login disalin.'); }
          catch { setError('Tidak dapat menyalin otomatis. Salin username dan password secara manual.'); }
        }}>Salin informasi login</button>
        <button className="secondary-button" onClick={() => setCredentials(null)}>Tutup</button></div>
    </section>}
    <section className="manage-card"><div className="list-heading"><h2>Daftar pengajuan</h2><div className="form-actions">
      <select className="access-filter" aria-label="Filter status permintaan" value={filter} disabled={busy} onChange={event => setFilter(event.target.value)}>
        <option value="pending">Menunggu</option><option value="processing">Diproses</option><option value="approved">Disetujui</option><option value="rejected">Ditolak</option><option value="all">Semua</option>
      </select><button className="secondary-button" disabled={busy || loading} onClick={() => { setError(''); load(); }}>Refresh</button></div></div>
      {loading ? <p>Memuat permintaan…</p> : !rows.length ? <p>Belum ada permintaan pada kategori ini.</p> : <div className="record-list">{rows.map(row => <article className="record-item access-request" key={row.id}>
        <div><h3>{row.name}</h3><a href={`mailto:${encodeURIComponent(row.email)}`}>{row.email}</a><p className="access-reason">{row.reason}</p>
          <small>{new Date(row.createdAt).toLocaleString('id-ID')} · {statusText[row.status]}</small>
          {row.rejectionReason && <p>Alasan penolakan: {row.rejectionReason}</p>}</div>
        {row.status === 'pending' && <div className="record-actions"><button disabled={busy} onClick={() => { setSelected(row); setAction('approve'); setError(''); }}>Setujui & buat akun</button>
          <button className="danger-text" disabled={busy} onClick={() => { setSelected(row); setAction('reject'); setError(''); }}>Tolak</button></div>}
        {row.status === 'processing' && <button className="secondary-button" disabled={busy} onClick={() => recover(row)}>Periksa persetujuan</button>}
      </article>)}</div>}
    </section>
    {selected && <section className="manage-card password-card"><h2>{action === 'approve' ? 'Buat akun Petugas' : 'Tolak permintaan'}: {selected.name}</h2>
      <form className="manage-form" key={`${selected.id}-${action}`} onSubmit={submit}>
        {action === 'approve' ? <><label className="manage-field"><span>Username</span><input name="username" required minLength={3} maxLength={50} autoComplete="off" disabled={busy}/></label>
          <label className="manage-field"><span>Password awal</span><input name="password" type="password" required minLength={8} maxLength={128} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" autoComplete="new-password" disabled={busy}/></label>
          <small>Minimal 8 karakter dengan huruf dan angka. Pengguna wajib menggantinya pada login pertama. Role akun: Petugas.</small></> :
          <label className="manage-field"><span>Alasan penolakan (opsional)</span><textarea name="rejectionReason" rows={3} maxLength={500} disabled={busy}/></label>}
        <div className="form-actions"><button className={action === 'approve' ? 'primary-button' : 'danger-button'} disabled={busy}>{busy ? 'Memproses…' : action === 'approve' ? 'Setujui & buat akun' : 'Tolak permintaan'}</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => setSelected(null)}>Batal</button></div>
      </form>
    </section>}
  </div>;
}

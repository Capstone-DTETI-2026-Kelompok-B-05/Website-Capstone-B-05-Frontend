import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bus,
  Eye,
  EyeOff,
  LogIn,
} from 'lucide-react';

import { createApi } from './api.js';
import './login.css';

const SLIDE_INTERVAL = 5000;

const SLIDES = [
  {
    image: '/login1.jpg',
    title: 'Jalur tertib, perjalanan nyaman.',
    description: 'Pantau akses jalur TransJakarta dalam satu dashboard.',
  },
  {
    image: '/login2.jpg',
    title: 'Pantau kendaraan secara langsung.',
    description: 'Dukung pengawasan jalur busway melalui sistem monitoring.',
  },
  {
    image: '/login3.jpg',
    title: 'Kelola akses dengan mudah.',
    description: 'Satu sistem untuk membantu operasional admin dan petugas.',
  },
];

export default function Login({ onLogin, message = '' }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const slide = SLIDES[activeSlide];
  const feedback = error || message;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % SLIDES.length);
    }, SLIDE_INTERVAL);

    return () => window.clearInterval(timer);
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (busy) return;

    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') ?? '').trim();
    const password = String(form.get('password') ?? '');

    if (!username || !password) {
      setError('Isi username dan password terlebih dahulu.');
      return;
    }

    setError('');
    setBusy(true);

    try {
      const data = await createApi()('/auth/login', {
        method: 'POST',
        body: { username, password },
      });

      const validRole = ['admin', 'petugas'].includes(data.user?.role);

      if (!data.token || !validRole) {
        throw new Error('Respons login tidak valid.');
      }

      onLogin({
        token: data.token,
        user: data.user,
      });
    } catch (err) {
      setError(err.message || 'Login gagal. Silakan coba kembali.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="lg-screen">
      <section className="lg-shell" aria-label="Login Smart Busway">
        <section
          className="lg-gallery"
          aria-label="Slideshow TransJakarta"
        >
          <div className="lg-slides" aria-hidden="true">
            {SLIDES.map((item, index) => (
              <div
                key={item.image}
                className={`lg-slide ${
                  index === activeSlide ? 'is-active' : ''
                }`}
                style={{
                  backgroundImage: `url("${item.image}")`,
                }}
              />
            ))}
          </div>

          <div className="lg-gallery-shade" />

          <div className="lg-gallery-bottom">
            <h2>{slide.title}</h2>
            <p>{slide.description}</p>

            <div className="lg-dots">
              {SLIDES.map((item, index) => (
                <button
                  key={item.image}
                  type="button"
                  className={`lg-dot ${
                    index === activeSlide ? 'is-active' : ''
                  }`}
                  aria-label={`Tampilkan gambar ${index + 1}`}
                  aria-pressed={index === activeSlide}
                  onClick={() => setActiveSlide(index)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="lg-panel">
          <div className="lg-card">
            <div className="lg-login-brand">
              {logoFailed ? (
                <>
                  <Bus size={26} aria-hidden="true" />
                  <span>TransJakarta</span>
                </>
              ) : (
                <img
                  className="lg-login-logo"
                  src="/logo-tj.png"
                  alt="TransJakarta"
                  onError={() => setLogoFailed(true)}
                />
              )}
            </div>

            <h1>Selamat Datang</h1>

            <p className="lg-sub">
              Masuk menggunakan akun admin atau petugas kamu.
            </p>

            <form
              className="lg-form"
              onSubmit={handleSubmit}
              aria-busy={busy}
            >
              <div className="lg-field">
                <label htmlFor="login-username">Username</label>

                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Masukkan username"
                  required
                  disabled={busy}
                />
              </div>

              <div className="lg-field">
                <label htmlFor="login-password">Password</label>

                <div className="lg-password">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Masukkan password"
                    required
                    disabled={busy}
                  />

                  <button
                    type="button"
                    className="lg-eye"
                    aria-label={
                      showPassword
                        ? 'Sembunyikan password'
                        : 'Tampilkan password'
                    }
                    aria-pressed={showPassword}
                    disabled={busy}
                    onClick={() => {
                      setShowPassword((current) => !current);
                    }}
                  >
                    {showPassword ? (
                      <EyeOff size={19} aria-hidden="true" />
                    ) : (
                      <Eye size={19} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {feedback && (
                <div className="lg-alert" role="alert">
                  <AlertCircle size={17} aria-hidden="true" />
                  <span>{feedback}</span>
                </div>
              )}

              <button
                type="submit"
                className="lg-submit"
                disabled={busy}
              >
                <LogIn size={18} aria-hidden="true" />
                {busy ? 'Memproses…' : 'Masuk'}
              </button>
            </form>

            <p className="lg-help">
              Belum punya akun? <b>Hubungi admin.</b>
            </p>

            <div className="lg-divider" />

            <p className="lg-footer">
              Sistem monitoring dan pengelolaan akses jalur busway.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
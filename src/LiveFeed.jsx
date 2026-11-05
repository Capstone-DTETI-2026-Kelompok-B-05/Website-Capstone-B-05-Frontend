import { useEffect, useState } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { API_URL } from './api.js';
import { createFrameParser } from './mjpeg.js';

// Read JPEG frames with Authorization headers; never put JWTs into URLs.
export default function LiveFeed({ cameraId, token, detection, onExpired, onStatus }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [imageSize, setImageSize] = useState(null);
  useEffect(() => {
    if (!cameraId) { setSrc(''); onStatus('idle'); return; }
    const controller = new AbortController();
    let objectUrl, reader, timer;
    setSrc(''); setError(''); setImageSize(null); onStatus('connecting');
    const armTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { setError('Belum ada frame kamera. Periksa sumber kamera lalu coba lagi.'); onStatus('offline'); controller.abort(); }, 15000);
    };
    armTimeout();
    (async () => {
      try {
        const response = await fetch(`${API_URL}/stream/mjpeg/${encodeURIComponent(cameraId)}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
        });
        if (response.status === 401) { onExpired(); return; }
        if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || `Stream gagal (${response.status}).`); }
        if (!response.headers.get('content-type')?.includes('multipart/')) throw new Error('Respons kamera bukan MJPEG.');
        reader = response.body.getReader();
        const parse = createFrameParser(frame => {
          const url = URL.createObjectURL(new Blob([frame], { type: 'image/jpeg' }));
          const previous = objectUrl; objectUrl = url; setSrc(url); if (previous) URL.revokeObjectURL(previous);
          setError(''); onStatus('live'); armTimeout();
        });
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) throw new Error('Koneksi stream terputus.');
          parse(value);
        }
      } catch (err) { if (!controller.signal.aborted) { setError(err.message); onStatus('offline'); } }
      finally { clearTimeout(timer); await reader?.cancel().catch(() => {}); }
    })();
    return () => { controller.abort(); clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [cameraId, token, attempt, onExpired, onStatus]);
  const boxColor = {
    ambulans: '#ffffff',
    bus: '#347bf0',
    damkar: '#ff3b30'
  }[detection?.vehicleType] || '#ffffff';
  return <div className="sl-feed">
    {src && !error && <>
      <img
        src={src}
        alt="Live kamera jalur busway"
        onLoad={event => setImageSize({
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight
        })}
      />
      {imageSize && detection?.box && <svg
        className="sl-detection-overlay"
        viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label={`Deteksi ${detection.vehicleType || 'kendaraan'}`}
      >
        <rect
          x={detection.box.left * imageSize.width}
          y={detection.box.top * imageSize.height}
          width={(detection.box.right - detection.box.left) * imageSize.width}
          height={(detection.box.bottom - detection.box.top) * imageSize.height}
          className="sl-detection-box"
          style={{ stroke: boxColor }}
        />
        <text
          x={detection.box.left * imageSize.width}
          y={Math.max(imageSize.height * 0.05, detection.box.top * imageSize.height - imageSize.height * 0.01)}
          className="sl-detection-label"
          fontSize={Math.max(16, imageSize.width * 0.025)}
          style={{ fill: boxColor, stroke: '#172944' }}
        >
          {detection.vehicleType || 'kendaraan'} {Math.round((detection.confidence || 0) * 100)}%
        </text>
      </svg>}
    </>}
    {(!src || error) && <div className="sl-feed-empty"><Camera size={30}/><b>{!cameraId ? 'Belum ada kamera aktif' : error || 'Menghubungkan kamera…'}</b>
      {error && <button className="sl-retry" onClick={() => setAttempt(n => n + 1)}><RefreshCw size={14}/>Coba lagi</button>}</div>}
  </div>;
}

// Multipart frames from /stream/mjpeg/:cameraId include Content-Length.
// Respect it so JPEG thumbnails inside EXIF cannot terminate frames early.
export function createFrameParser(onFrame, maxBytes = 8 * 1024 * 1024) {
  let buffer = new Uint8Array();
  let length = null;
  return chunk => {
    const combined = new Uint8Array(buffer.length + chunk.length);
    combined.set(buffer); combined.set(chunk, buffer.length); buffer = combined;
    while (buffer.length) {
      if (length === null) {
        let headerEnd = -1;
        for (let i = 0; i <= buffer.length - 4; i++) {
          if (buffer[i] === 13 && buffer[i + 1] === 10 && buffer[i + 2] === 13 && buffer[i + 3] === 10) { headerEnd = i; break; }
        }
        if (headerEnd < 0) { if (buffer.length > 16384) throw new Error('Header stream kamera tidak valid.'); return; }
        const header = new TextDecoder().decode(buffer.slice(0, headerEnd));
        const match = /content-length:\s*(\d+)/i.exec(header);
        if (!match) throw new Error('Stream kamera tidak menyertakan ukuran frame.');
        length = Number(match[1]);
        if (!length || length > maxBytes) throw new Error('Frame kamera melebihi batas ukuran.');
        buffer = buffer.slice(headerEnd + 4);
      }
      if (buffer.length < length) return;
      const frame = buffer.slice(0, length);
      if (frame[0] !== 255 || frame[1] !== 216 || frame[length - 2] !== 255 || frame[length - 1] !== 217) throw new Error('Frame kamera bukan JPEG yang valid.');
      onFrame(frame); buffer = buffer.slice(length); length = null;
    }
  };
}

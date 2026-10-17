import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameParser } from '../src/mjpeg.js';
const jpeg = Buffer.from([255, 216, 1, 255, 217, 2, 255, 217]);
const part = Buffer.concat([Buffer.from(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`), jpeg, Buffer.from('\r\n')]);
test('MJPEG parser handles split headers and JPEG payloads, including embedded EOI', () => {
  const frames = []; const parse = createFrameParser(frame => frames.push(Buffer.from(frame)));
  const stream = Buffer.concat([part, part]);
  for (const byte of stream) parse(Uint8Array.of(byte));
  assert.deepEqual(frames, [jpeg, jpeg]);
});
test('MJPEG parser handles several frames in one network chunk', () => {
  const frames = []; createFrameParser(frame => frames.push(Buffer.from(frame)))(Buffer.concat([part, part]));
  assert.deepEqual(frames, [jpeg, jpeg]);
});
test('MJPEG parser rejects oversized frames before allocating their payload', () => {
  const parse = createFrameParser(() => {});
  assert.throws(() => parse(Buffer.from('--frame\r\nContent-Length: 999999999\r\n\r\n')), /batas ukuran/);
});

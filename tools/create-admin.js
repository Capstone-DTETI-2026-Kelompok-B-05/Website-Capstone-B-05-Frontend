// Salin file ini ke root backend (sejajar server.js), lalu: node create-admin.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import User from './models/User.js';

const prompt = createInterface({ input: stdin, output: stdout });
try {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI belum diatur di .env backend.');
  const username = (await prompt.question('Username admin pertama: ')).trim();
  const password = await prompt.question('Password (min. 8 karakter, huruf + angka): ');
  if (!username || !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) throw new Error('Username atau password tidak valid.');
  await mongoose.connect(process.env.MONGO_URI);
  if (await User.exists({ role: 'admin' })) throw new Error('Admin sudah ada. Gunakan menu Kelola Akun untuk menambah akun.');
  if (await User.exists({ username })) throw new Error('Username sudah digunakan.');
  await User.create({ username, password, role: 'admin' });
  console.log('Admin berhasil dibuat. Sekarang login melalui frontend.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  prompt.close();
  await mongoose.disconnect();
}

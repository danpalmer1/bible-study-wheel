import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { seedIfEmpty } from './seed.js';
import authRoutes from './routes/auth.js';
import attendeesRoutes from './routes/attendees.js';
import meetingsRoutes from './routes/meetings.js';
import statsRoutes from './routes/stats.js';
import usersRoutes from './routes/users.js';
import verseRoutes from './routes/verse.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/attendees', attendeesRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/verse', verseRoutes);

const PORT = Number(process.env.PORT ?? 4000);
const seeded = seedIfEmpty();
app.listen(PORT, () => {
  console.log(`Bible study backend listening on http://localhost:${PORT}`);
  if (seeded) {
    console.log('---');
    console.log('Seeded fresh database. Default admin:');
    console.log(`  Email:    ${process.env.ADMIN_EMAIL ?? 'admin@biblestudy.local'}`);
    console.log(`  Password: ${process.env.ADMIN_PASSWORD ?? 'admin1234'}`);
    console.log('---');
  }
});

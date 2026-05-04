import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { authRoutes } from './routes/authRoutes.js';
import { patientRoutes } from './routes/patientRoutes.js';
import { carePlanRoutes } from './routes/carePlanRoutes.js';
import { careLogRoutes } from './routes/careLogRoutes.js';
import { analyticsRoutes } from './routes/analyticsRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

app.set('trust proxy', 1);

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/care-plans', carePlanRoutes);
app.use('/api/care-logs', careLogRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(notFound);
app.use(errorHandler);

await connectDb();
app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`CareSyncAI server listening on http://localhost:${env.PORT}`);
});


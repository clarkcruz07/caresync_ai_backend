import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5050),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default('careai_assist'),
  GROQ_API_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(20),
});

export const env = EnvSchema.parse(process.env);


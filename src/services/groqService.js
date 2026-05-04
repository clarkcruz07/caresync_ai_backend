import Groq from 'groq-sdk';
import { env } from '../config/env.js';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export async function groqJsonChat({ system, user, schemaHint }) {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: JSON.stringify(
          {
            task: user,
            output_requirements: {
              format: 'json',
              schema_hint: schemaHint,
              deterministic: true
            }
          },
          null,
          2
        )
      }
    ]
  });

  const raw = completion.choices?.[0]?.message?.content ?? '';
  return JSON.parse(raw);
}


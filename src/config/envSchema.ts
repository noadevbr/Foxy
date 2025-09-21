import { z } from 'zod';

const envSchema = z.object({
	GOOGLE_GEMINI_APIKEY: z.string(),
	SPOTIFY: z.object({}),
});

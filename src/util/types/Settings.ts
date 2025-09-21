import { z } from 'zod';

const SettingsSchema = z.object({
	instrutor: z.enum(['chat_mode', 'normal'])
});

type SettingsT = z.infer<typeof SettingsSchema>;

export { SettingsSchema, type SettingsT };

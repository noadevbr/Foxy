import { GoogleGenAI, type Content } from '@google/genai';
import type { GGClientI } from './util/GGClientOptions.js';

class GGClient {
	private genAI: GoogleGenAI;
	private modelName: string;

	constructor(d: GGClientI, modelId: 'gemini-2.0-flash') {
		this.genAI = new GoogleGenAI({
			apiKey: d.GOOGLE_API_KEY,
		});
		this.modelName = modelId;
	}

	private async generateTextInternal(prompt: string): Promise<string> {
		try {
			const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
			const result = await this.genAI.models.generateContent({
				model: this.modelName,
				contents,
			});

			if (!result || typeof result.text !== 'string') {
				throw new Error('Resposta inválida da API');
			}

			return result.text;
		} catch (error) {
			throw new Error(
				`Failed to generate text: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	public async generate(prompt: string): Promise<string> {
		return this.generateTextInternal(prompt);
	}
}

export { GGClient };

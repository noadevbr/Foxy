// lib/gemini-agent/GGClient.ts
import { GoogleGenAI, type Content } from '@google/genai';
import type { GGClientI } from './util/GGClientOptions.js';

export class GGClient {
  private static genAI?: GoogleGenAI;
  private static modelName = 'gemini-2.0-flash';
  private static initialized = false;

  private constructor() {} // evita instanciar manualmente

  static init(config: GGClientI, modelId = 'gemini-2.0-flash') {
    if (GGClient.initialized) return;

    GGClient.genAI = new GoogleGenAI({ apiKey: config.GOOGLE_API_KEY });
    GGClient.modelName = modelId;
    GGClient.initialized = true;
  }

  static async generate(prompt: string): Promise<string> {
    if (!GGClient.genAI) {
      throw new Error('GGClient não foi inicializado. Chame GGClient.init() primeiro.');
    }

    const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
    const result = await GGClient.genAI.models.generateContent({
      model: GGClient.modelName,
      contents,
    });

    if (!result || typeof result.text !== 'string') {
      throw new Error('Resposta inválida da API');
    }

    return result.text;
  }
}

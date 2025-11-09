// util/FoxyClient.ts
import { PromptToGenerate } from '@fx';
import { GGClient } from '../lib/gemini-agent/GGClient.js';
import { CacheController } from './managers/CacheController.js';
import { SettingsSchema } from './types/Settings.js';
import { ApiKeyManager } from './ApiKeyManager.js';

export class FoxyClient {
  private CacheManager: CacheController<{ settings: typeof SettingsSchema }>;
  private apiKeyManager: ApiKeyManager;
  private isInitialized = false;

  constructor() {
    this.apiKeyManager = new ApiKeyManager();
    this.CacheManager = new CacheController({ settings: SettingsSchema }, '/tmp');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;

    let apiKey: string;

    if (this.apiKeyManager.hasApiKey()) {
      try {
        apiKey = this.apiKeyManager.loadApiKey();
      } catch {
        console.log('❌ API key corrompida. Solicitando nova...');
        apiKey = await this.apiKeyManager.setupApiKey();
      }
    } else {
      apiKey = await this.apiKeyManager.setupApiKey();
    }

    GGClient.init({ GOOGLE_API_KEY: apiKey });
    this.isInitialized = true;
  }

  async responder(text: string) {
    await this.ensureInitialized();

    if (!this.CacheManager.hasExistingCache('settings')) {
      this.CacheManager.createCache('settings', { instrutor: 'normal' });
    }

    const cache = this.CacheManager.loadCache('settings');
    const mode: 'chat_mode' | 'any' =
      cache.instrutor === 'chat_mode' ? 'chat_mode' : 'any';

    const prompt = await PromptToGenerate({ mode, question: text });
    const resp = await GGClient.generate(prompt);

    return { responded: resp, date: new Date() };
  }

  async resetApiKey() {
    this.apiKeyManager.deleteApiKey();
    this.isInitialized = false;
    console.log('🔄 Nova API key será pedida na próxima execução.');
  }

  isConfigured() {
    return this.apiKeyManager.hasApiKey();
  }
}

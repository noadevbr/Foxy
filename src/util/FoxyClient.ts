// util/FoxyClient.ts
import { PromptToGenerate } from '@fx';
import { GGClient } from '../lib/gemini-agent/GGClient.js';
import { CacheController } from './managers/CacheController.js';
import { SettingsSchema, SettingsT } from './types/Settings.js';
import { ApiKeyManager } from './ApiKeyManager.js';

export class FoxyClient {
  private GGProfile?: GGClient;
  private CacheManager: CacheController<{ settings: typeof SettingsSchema }>;
  private apiKeyManager: ApiKeyManager;
  private isInitialized: boolean = false;

  constructor() {
    this.apiKeyManager = new ApiKeyManager();
    this.CacheManager = new CacheController(
      {
        settings: SettingsSchema,
      },
      '/tmp',
    );
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized && this.GGProfile) {
      return;
    }

    let apiKey: string;

    // Verifica se já tem API key salva
    if (this.apiKeyManager.hasApiKey()) {
      try {
        apiKey = this.apiKeyManager.loadApiKey();
      } catch (error) {
        console.error('❌ | Erro ao carregar API key:', error);
        console.log('🔧 | Vamos configurar uma nova API key...\n');
        apiKey = await this.apiKeyManager.setupApiKey();
      }
    } else {
      // Primeira execução - pede a API key
      apiKey = await this.apiKeyManager.setupApiKey();
    }

    // Inicializa o cliente Gemini
    this.GGProfile = new GGClient(
      {
        GOOGLE_API_KEY: apiKey,
      },
      'gemini-2.0-flash',
    );

    this.isInitialized = true;
  }

  async responder(text: string) {
    // Garante que está inicializado antes de responder
    await this.ensureInitialized();

    if (!this.GGProfile) {
      throw new Error('Cliente não inicializado');
    }

    // Verifica se o cache 'settings' existe
    if (!this.CacheManager.hasExistingCache('settings')) {
      // Cria o cache com valor padrão
      this.CacheManager.createCache('settings', {
        instrutor: 'normal',
      });
    }

    // Carrega o cache com segurança
    const cache = this.CacheManager.loadCache('settings');

    // Define o modo com base no cache
    const mode: 'chat_mode' | 'any' =
      cache.instrutor === 'chat_mode' ? 'chat_mode' : 'any';

    const resp = this.GGProfile.generate(
      await PromptToGenerate({
        mode,
        question: text,
      }),
    );

    return {
      responded: resp,
      date: new Date(),
    };
  }

  // Método para resetar a API key (útil para debugging)
  public async resetApiKey(): Promise<void> {
    this.apiKeyManager.deleteApiKey();
    this.isInitialized = false;
    this.GGProfile = undefined;
    console.log('🔄 | API key resetada. Na próxima execução será solicitada uma nova.');
  }

  // Método para verificar se está configurado
  public isConfigured(): boolean {
    return this.apiKeyManager.hasApiKey();
  }
}
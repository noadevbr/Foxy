import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface FoxyConfig {
	language: 'pt' | 'en';
	conventionalCommits: boolean;
	commitStyle: 'conventional' | 'simple' | 'detailed';
	maxMessageLength: number;
	includeScope: boolean;
	includeBreakingChanges: boolean;
	emojis: boolean;
	git: {
		autoAdd: boolean;
		confirmBeforeCommit: boolean;
		includeStats: boolean;
		autoCommit: boolean;
	};
}

export const DEFAULT_CONFIG: FoxyConfig = {
	language: 'pt',
	conventionalCommits: true,
	commitStyle: 'conventional',
	maxMessageLength: 72,
	includeScope: true,
	includeBreakingChanges: true,
	emojis: true,
	git: {
		autoAdd: true,
		confirmBeforeCommit: false,
		includeStats: true,
		autoCommit: false,
	},
};

export class FoxyConfigManager {
	private configPath: string;

	constructor(baseDir: string) {
		this.configPath = join(baseDir, '.foxycfg');
	}

	loadConfig(): FoxyConfig {
		if (!existsSync(this.configPath)) {
			return DEFAULT_CONFIG;
		}

		try {
			const configContent = readFileSync(this.configPath, 'utf8');
			const userConfig = JSON.parse(configContent);
			
			// Merge profundo com configurações padrão
			const mergedConfig = { ...DEFAULT_CONFIG, ...userConfig };
			
			// Merge profundo para objetos aninhados (como git)
			if (userConfig.git) {
				mergedConfig.git = { ...DEFAULT_CONFIG.git, ...userConfig.git };
			}
			
			return mergedConfig;
		} catch (error) {
			console.warn('⚠️ | Erro ao carregar .foxycfg, usando configurações padrão');
			return DEFAULT_CONFIG;
		}
	}

	saveConfig(config: FoxyConfig): void {
		try {
			writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
		} catch (error) {
			console.error('❌ | Erro ao salvar configuração:', error);
		}
	}

	createDefaultConfig(): void {
		if (existsSync(this.configPath)) {
			console.log('⚠️ | .foxycfg já existe! Atualizando com novas configurações...');
			// Carrega configuração existente e mescla com padrões
			const existingConfig = this.loadConfig();
			const updatedConfig = { ...DEFAULT_CONFIG, ...existingConfig };
			this.saveConfig(updatedConfig);
			console.log('✅ | Arquivo .foxycfg atualizado com novas configurações!');
		} else {
			this.saveConfig(DEFAULT_CONFIG);
			console.log('✅ | Arquivo .foxycfg criado com configurações padrão!');
		}
	}

	updateConfig(updates: Partial<FoxyConfig>): void {
		const currentConfig = this.loadConfig();
		const newConfig = { ...currentConfig, ...updates };
		this.saveConfig(newConfig);
	}
}

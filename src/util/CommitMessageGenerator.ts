import { FoxyClient } from './FoxyClient.js';
import { FoxyConfig } from './config/FoxyConfig.js';

export interface GitChanges {
	added: string[];
	modified: string[];
	deleted: string[];
}

export class CommitMessageGenerator {
	private foxyClient: FoxyClient;
	private config: FoxyConfig;

	constructor(foxyClient: FoxyClient, config: FoxyConfig) {
		this.foxyClient = foxyClient;
		this.config = config;
	}

	async generateCommitMessage(changes: GitChanges): Promise<string> {
		const changeSummary = this.buildChangeSummary(changes);
		
		if (this.config.conventionalCommits) {
			return await this.generateConventionalCommit(changes, changeSummary);
		} else {
			return await this.generateSimpleCommit(changes, changeSummary);
		}
	}

	private buildChangeSummary(changes: GitChanges): string {
		const summary = [];
		
		if (changes.added.length > 0) {
			const files = changes.added.slice(0, 5).join(', ');
			const more = changes.added.length > 5 ? ` e mais ${changes.added.length - 5}` : '';
			summary.push(`Adicionados: ${files}${more}`);
		}
		
		if (changes.modified.length > 0) {
			const files = changes.modified.slice(0, 5).join(', ');
			const more = changes.modified.length > 5 ? ` e mais ${changes.modified.length - 5}` : '';
			summary.push(`Modificados: ${files}${more}`);
		}
		
		if (changes.deleted.length > 0) {
			const files = changes.deleted.slice(0, 5).join(', ');
			const more = changes.deleted.length > 5 ? ` e mais ${changes.deleted.length - 5}` : '';
			summary.push(`Removidos: ${files}${more}`);
		}

		return summary.join('\n');
	}

	private async generateConventionalCommit(changes: GitChanges, changeSummary: string): Promise<string> {
		const language = this.config.language === 'pt' ? 'português brasileiro' : 'english';
		const emojiInstruction = this.config.emojis ? 
			'- Inclua emoji no início da mensagem (ex: ✨ feat: nova funcionalidade)' : 
			'- NÃO inclua emojis na mensagem';
		
		
		const prompt = `Analise as seguintes mudanças no código e gere uma mensagem de commit seguindo Conventional Commits:

${changeSummary}

Gere uma mensagem no formato: tipo(escopo): descrição

Tipos disponíveis:
- feat: nova funcionalidade
- fix: correção de bug
- refactor: refatoração de código
- style: mudanças de formatação/estilo
- docs: documentação
- test: testes
- chore: tarefas de manutenção
- perf: melhorias de performance
- ci: integração contínua
- build: sistema de build
- revert: reverter commit

Regras:
- Use ${language}
- Seja conciso e claro
- Máximo ${this.config.maxMessageLength} caracteres
- Use imperativo (ex: "Adiciona", "Corrige", "Remove")
- Escopo é opcional, use apenas se relevante
- ${emojiInstruction}
- Não inclua aspas na resposta

Responda apenas com a mensagem do commit:`;

		try {
			const { responded } = await this.foxyClient.responder(prompt);
			const message = await responded;
			
			return this.cleanMessage(message);
		} catch (error) {
			return this.getFallbackMessage(changes);
		}
	}

	private async generateSimpleCommit(changes: GitChanges, changeSummary: string): Promise<string> {
		const language = this.config.language === 'pt' ? 'português brasileiro' : 'english';
		
		const prompt = `Com base nas seguintes mudanças no código, gere uma mensagem de commit concisa e descritiva em ${language}:

${changeSummary}

A mensagem deve:
- Ser clara e objetiva
- Descrever o que foi feito
- Usar imperativo (ex: "Adiciona", "Corrige", "Remove")
- Ter no máximo ${this.config.maxMessageLength} caracteres
- Não incluir aspas ou caracteres especiais

Responda apenas com a mensagem do commit:`;

		try {
			const { responded } = await this.foxyClient.responder(prompt);
			const message = await responded;
			
			return this.cleanMessage(message);
		} catch (error) {
			return this.getFallbackMessage(changes);
		}
	}

	private cleanMessage(message: string): string {
		return message
			.trim()
			.replace(/['"]/g, '')
			.replace(/\n/g, ' ')
			.substring(0, this.config.maxMessageLength);
	}

	private getFallbackMessage(changes: GitChanges): string {
		const totalChanges = changes.added.length + changes.modified.length + changes.deleted.length;
		const emoji = this.config.emojis ? '✨ ' : '';
		
		if (this.config.conventionalCommits) {
			if (changes.added.length > changes.modified.length) {
				return `${emoji}feat: adiciona ${totalChanges} arquivo(s)`;
			} else if (changes.modified.length > 0) {
				return `${emoji}fix: atualiza ${totalChanges} arquivo(s)`;
			} else {
				return `${emoji}chore: atualiza ${totalChanges} arquivo(s)`;
			}
		} else {
			return `${emoji}Atualiza ${totalChanges} arquivo(s)`;
		}
	}

	detectCommitType(changes: GitChanges): string {
		// Lógica para detectar o tipo de commit baseado nos arquivos
		const allFiles = [...changes.added, ...changes.modified, ...changes.deleted];
		
		// Detecção baseada em padrões de arquivos
		if (allFiles.some(f => f.includes('test') || f.includes('spec'))) {
			return 'test';
		}
		
		if (allFiles.some(f => f.includes('docs') || f.includes('README') || f.includes('.md'))) {
			return 'docs';
		}
		
		if (allFiles.some(f => f.includes('style') || f.includes('css') || f.includes('scss'))) {
			return 'style';
		}
		
		if (allFiles.some(f => f.includes('config') || f.includes('package.json') || f.includes('tsconfig'))) {
			return 'chore';
		}
		
		if (changes.added.length > changes.modified.length) {
			return 'feat';
		}
		
		if (changes.modified.length > 0) {
			return 'fix';
		}
		
		return 'chore';
	}
}

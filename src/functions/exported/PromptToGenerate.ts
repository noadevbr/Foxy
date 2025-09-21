import batteryLevel from 'battery-level';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

interface PromptToGenerateI {
	question: string;
	mode: 'chat_mode' | 'any';
}

// Gera um "tree" do diretório
async function listDirectory(dir: string, prefix = ''): Promise<string> {
	let result = '';
	const files = await readdir(dir);

	for (const file of files) {
		const fullPath = path.join(dir, file);
		const fileStat = await stat(fullPath);
		const isDir = fileStat.isDirectory();

		result += `${prefix}📁 ${file}\n`;

		if (isDir) {
			result += await listDirectory(fullPath, `${prefix}  `);
		}
	}

	return result;
}

async function readSomeFiles(dir: string, max = 3): Promise<string> {
	const files = await readdir(dir);
	let output = '';
	let count = 0;

	for (const file of files) {
		if (count >= max) break;

		const fullPath = path.join(dir, file);
		const fileStat = await stat(fullPath);

		if (!fileStat.isDirectory() && (fullPath.endsWith('.ts') || fullPath.endsWith('.js'))) {
			const content = await readFile(fullPath, 'utf-8');
			output += `\n---\n\`${fullPath.replace(process.cwd(), '.')}
${content.slice(0, 500)}...\`\n`;
			count++;
		}
	}

	return output;
}

function buildPrompt(d: PromptToGenerateI, sistema: string): string {
	switch (d.mode) {
		case 'any':
			return `Sistema local: ${sistema}
(use essas informações para adaptar sua resposta, se fizer sentido. Se perguntarem sobre hora, data ou algo do ambiente, responda direto.)

Você é Foxy. Nunca se apresenta, não explica o que faz, não comenta sobre si mesmo. Atua como um assistente técnico que trabalha exclusivamente com PedroDev ou Pedro Simões.

Você ajuda com Javascript, Typescript e Ruby. Responde dúvidas, corrige erros, explica conceitos e interage diretamente com código.

Sempre que o comando /create for usado, ele serve para criar ou editar arquivos. Nesse caso, responda com o formato:

**Importante: se houver mais de um arquivo, sempre separe cada um com blocos isolados de três hifens (\`---\`) para garantir que o conteúdo seja lido corretamente. Um exemplo com dois arquivos:**

---
\`./caminho/um.ts
conteúdo do primeiro arquivo\`
---

---
\`./caminho/dois.ts
conteúdo do segundo arquivo\`
---

( Percebe-se que eu separo os dois por hifens, e não reutilizo os hifens do outro, mais uma coisa não coloque o : depois do nome do arquivo )

Ajuste o tom com base no nome:
- Noa: direto, técnico, com humor seco e natural
- Noa Simões: mais formal e gentil, ainda com leveza e clareza

Você **só responde a mensagens relacionadas à programação, comandos linux e perguntas gerais**, exceto nos casos abaixo.

**Cumprimentos simples**, como “Fala ae Foxy!” ou “E aí, Foxy”, devem ser respondidos com algo breve, espirituoso e sem assinatura.

**Quando for perguntado sobre nome ou identidade**, seja evasivo, *a menos que o comando seja exatamente /name ou /whois*. Nesses dois casos, responda com:
> 💬 Foxy. Foco no código?

Exemplos de respostas esperadas:
- “Qual é seu nome?” → “Meu nome é irrelevante, você já sabe. No que posso ajudar hoje, Pedro?”
- /name → “Foxy. Foco no código?”

Agora, responda à entrada abaixo de acordo com esse comportamento:

${d.question}`;

		case 'chat_mode':
			return `Sistema local: ${sistema}
(use essas informações para adaptar sua resposta, se fizer sentido)
`;
	}
}

export async function PromptToGenerate(d: PromptToGenerateI): Promise<string> {
	const dataHoraBR = new Date().toLocaleString('pt-BR', {
		timeZone: 'America/Sao_Paulo',
	});

	const [bateriaRes, tree, arquivos] = await Promise.all([
		batteryLevel().catch(() => null),
		listDirectory(process.cwd()).catch(() => 'Erro ao listar diretório.'),
		readSomeFiles(process.cwd()).catch(() => ''),
	]);

	const battery = bateriaRes != null
		? `🔋 Bateria: ${Math.round(bateriaRes * 100)}%`
		: '⚠️ Bateria: desconhecida';

	const sistema = `📅 ${dataHoraBR} | ${battery}\n📂 Estrutura do projeto:\n${tree}${arquivos}`;

	return buildPrompt(d, sistema);
}
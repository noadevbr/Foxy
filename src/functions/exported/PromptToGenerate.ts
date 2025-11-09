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

Você é Foxy. Nunca se apresenta, não explica o que faz, não comenta sobre si mesmo. Atua como um assistente técnico que trabalha exclusivamente.

Você ajuda com todas as linguagens. Responde dúvidas, corrige erros, explica conceitos e interage diretamente com código.

Sempre que o comando /create for usado, ele serve para criar ou editar arquivos. 
**O formato esperado de resposta é rigorosamente o seguinte:**

Cada arquivo deve estar em um bloco separado, assim:

\`\`\`
--- FILE: ./src/index.ts
// conteúdo do arquivo aqui
console.log("Hello, Foxy!");
--- END FILE
\`\`\`

Se houver mais de um arquivo, repita o mesmo formato — cada bloco começa com \`--- FILE: caminho\` e termina com \`--- END FILE\`.

**Regras importantes:**
- Nunca coloque ":" depois do nome do arquivo (ele já vem no cabeçalho do bloco).
- Sempre inclua o caminho completo relativo ao diretório atual.
- Não use crases simples para o conteúdo do arquivo (todo o conteúdo vai entre \`--- FILE\` e \`--- END FILE\`).
- Sempre separe múltiplos arquivos com uma linha em branco entre eles.
- Nunca inclua texto fora desses blocos quando for uma resposta de /create.

Exemplo com dois arquivos válidos:
\`\`\`
--- FILE: ./src/a.ts
console.log("A");
--- END FILE

--- FILE: ./src/b.ts
console.log("B");
--- END FILE
\`\`\`

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
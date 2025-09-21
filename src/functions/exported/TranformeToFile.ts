import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer'; // Para a interface interativa
import readline from 'node:readline';

// Função para perguntar ao usuário (como no original)
function askUser(question: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.toLowerCase().trim());
		});
	});
}

// Função para exibir o conteúdo com cores (simulando um preview de código)
function displayContent(content: string) {
	console.log(chalk.greenBright('Conteúdo do arquivo:\n'));
	console.log(chalk.cyan(content));
}

export async function TrasformeToFile(
	script: string,
	baseDir: string = process.cwd(),
) {
	// Ajustando o regex para capturar o caminho do arquivo e o conteúdo corretamente
	const fileBlocks = [...script.matchAll(/---\n`(.*?)\n([\s\S]+?)`\n---/g)];

	if (!fileBlocks.length) {
		console.log('⚠️ | Nenhum bloco de arquivo válido encontrado.');
		return;
	}

	// Lista de arquivos identificados
	const identifiedFiles = fileBlocks.map(([, relativePath, content]) => {
		return {
			filePath: path.resolve(baseDir, relativePath.trim()),
			content: content.trim(),
			name: relativePath.trim(),
		};
	});

	// Mensagem de que a Foxy gerou arquivos
	console.log(chalk.cyan('Foxy gerou os seguintes arquivos:\n'));

	// Pergunta para salvar os arquivos
	const filesToSave = await askFileSelection(identifiedFiles);

	// Pergunta final sobre salvar os arquivos
	for (const file of filesToSave) {
		await handleFileCreation(file);
	}
}

// Função para perguntar ao usuário sobre os arquivos que ele deseja salvar
async function askFileSelection(
	files: { filePath: string; content: string; name: string }[],
) {
	// Mostra a lista de arquivos com checkboxes
	const filesWithCheckbox = files.map((file, idx) => ({
		...file,
		selected: false,
		idx: idx + 1,
	}));

	// Cria uma pergunta interativa para o usuário escolher os arquivos
	const responses = await inquirer.prompt([
		{
			type: 'checkbox',
			name: 'filesToSave',
			message: chalk.green('Selecione os arquivos que você deseja salvar:'),
			choices: filesWithCheckbox.map((file) => ({
				name: chalk.cyan(file.name), // Arquivo com cor
				value: file,
				checked: false, // Pode ser alterado se necessário
			})),
			pageSize: 10, // Definindo o número de itens por página
		},
	]);

	// Pergunta se o usuário quer visualizar o conteúdo
	if (responses.filesToSave.length === 0) {
		console.log(chalk.yellow('Nenhum arquivo foi selecionado.'));
		return [];
	}

	// Caso o usuário queira ver o conteúdo dos arquivos
	const viewContent = await askUser(
		'Você quer ver o conteúdo dos arquivos selecionados antes de salvar? (s/n): ',
	);
	if (viewContent === 's' || viewContent === 'sim') {
		for (const file of responses.filesToSave) {
			displayContent(file.content);
		}
	}

	// Retorna os arquivos selecionados para salvar
	return responses.filesToSave;
}

// Função para criar o arquivo
async function handleFileCreation(file: {
	filePath: string;
	content: string;
	name: string;
}) {
	if (fs.existsSync(file.filePath)) {
		const answer = await askUser(
			`🟡 | O arquivo "${file.filePath}" já existe. Deseja sobrescrever? (s/n): `,
		);

		if (answer !== 's' && answer !== 'sim') {
			console.log(`🚫 | Arquivo ignorado: ${file.filePath}`);
			return;
		}
	}

	// Cria os diretórios e escreve o arquivo
	const dir = path.dirname(file.filePath);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(file.filePath, file.content, 'utf8');
	console.log(`✅ | Arquivo salvo com sucesso em: ${file.filePath}`);
}

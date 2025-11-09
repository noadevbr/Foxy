// src/util/TrasformeToFile.ts
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora'; // spinner bonitinho

export async function TrasformeToFile(script: string, baseDir = process.cwd()) {
	// Novo regex pro formato "--- FILE: caminho" até "--- END FILE"
	const fileBlocks = [
		...script.matchAll(/--- FILE:\s*(.+?)\n([\s\S]*?)--- END FILE/g),
	];

	if (!fileBlocks.length) {
		console.log(chalk.yellow('⚠️  Nenhum bloco de arquivo válido encontrado.'));
		return;
	}

	const files = fileBlocks.map(([, relativePath, content]) => ({
		name: relativePath.trim(),
		filePath: path.resolve(baseDir, relativePath.trim()),
		content: content.trim(),
	}));

	console.log(chalk.cyan('\n🦊 | Foxy detectou os seguintes arquivos para criação:\n'));
	files.forEach((f, i) => {
		console.log(`  ${chalk.magenta(`${i + 1}.`)}) ${chalk.cyan(f.name)}`);
	});

	console.log('');

	// Interface interativa
	const { selected } = await inquirer.prompt([
		{
			type: 'checkbox',
			name: 'selected',
			message: chalk.green('Selecione os arquivos que deseja salvar:'),
			choices: files.map((f) => ({
				name: f.name,
				value: f,
				checked: true,
			})),
			pageSize: 10,
		},
	]);

	if (!selected.length) {
		console.log(chalk.yellow('⚠️  Nenhum arquivo selecionado. Nada foi criado.'));
		return;
	}

	// Pergunta se quer visualizar o conteúdo
	const { view } = await inquirer.prompt([
		{
			type: 'confirm',
			name: 'view',
			message: 'Deseja visualizar o conteúdo antes de salvar?',
			default: false,
		},
	]);

	if (view) {
		for (const file of selected) {
			console.log(`\n📄  ${chalk.bold(file.name)}:\n`);
			console.log(chalk.gray('──────────────────────────────'));
			console.log(chalk.cyan(file.content.slice(0, 800)));
			console.log(chalk.gray('\n──────────────────────────────\n'));
			if (file.content.length > 800) {
				console.log(chalk.yellow('⚠️  (Conteúdo truncado para visualização)\n'));
			}
		}
	}

	// Criação dos arquivos
	const spinner = ora('💾 Salvando arquivos...').start();

	try {
		for (const file of selected) {
			await saveFile(file);
		}
		spinner.succeed(chalk.greenBright('✅ Todos os arquivos foram salvos com sucesso!\n'));
	} catch (err) {
		spinner.fail(chalk.red('❌ Erro ao salvar arquivos.'));
		console.error(err);
	}
}

async function saveFile(file: { filePath: string; content: string; name: string }) {
	const dir = path.dirname(file.filePath);

	if (fs.existsSync(file.filePath)) {
		const { overwrite } = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'overwrite',
				message: chalk.yellow(`O arquivo "${file.name}" já existe. Deseja sobrescrever?`),
				default: false,
			},
		]);
		if (!overwrite) {
			console.log(chalk.gray(`🚫 Ignorado: ${file.name}`));
			return;
		}
	}

	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(file.filePath, file.content, 'utf8');
	console.log(chalk.green(`✅ Criado: ${file.name}`));
}

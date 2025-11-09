// index.ts (CLI principal estilizada)
import { Command } from 'commander';
import { FoxyClient } from './util/FoxyClient.js';
import { TrasformeToFile } from '@fx';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { FoxyConfigManager } from './util/config/FoxyConfig.js';
import { CommitMessageGenerator } from './util/CommitMessageGenerator.js';
import chalk from 'chalk';

const FoxyCL = new FoxyClient();
const CLI = new Command();

// 🎨 helpers visuais
const fox = chalk.hex('#ff8800')('🦊');
const ok = chalk.green('✅');
const err = chalk.red('❌');
const info = chalk.cyan('💡');
const gear = chalk.yellow('⚙️');
const commit = chalk.magenta('💾');
const sparkle = chalk.hex('#ff66cc')('✨');

CLI.name('foxy')
  .description(
    chalk.bold.hex('#ffa500')(
      'Uma inteligência artificial para ajudar não souber o que fazer.',
    ),
  )
  .option('--git [action]', 'Detecta mudanças no git e cria commit automático. Use "init" para configurar.')
  .option('--reset-key', 'Remove a API key salva e força uma nova configuração')
  .option('--setup', 'Força o setup inicial da API key')
  .argument('[pergunta...]', 'Uma pergunta ou comando para a Foxy')
  .action(async (pergunta, options) => {
    const baseDir = process.cwd();

    try {
      if (options.resetKey) {
        console.log(`${gear} ${chalk.yellow('Resetando API key...')}`);
        await FoxyCL.resetApiKey();
        return;
      }

      if (options.setup) {
        console.log(`${gear} ${chalk.yellow('Forçando nova configuração...')}\n`);
        await FoxyCL.resetApiKey();
      }

      if (options.git) {
        if (options.git === 'init') {
          await handleGitInit(baseDir);
        } else {
          await handleGitCommit(baseDir);
        }
        return;
      }

      if (!pergunta.length) {
        if (FoxyCL.isConfigured()) {
          const username = process.env.USER || process.env.LOGNAME || process.env.USERNAME;
          console.log(`${fox} ${chalk.greenBright(`Oi, ${username}! Como posso te ajudar hoje?`)}`);
        } else {
          console.log(`${fox} ${chalk.yellow('Olá! Parece que é sua primeira vez usando o Foxy.')}`);
          console.log(`${info} Use qualquer comando para começar a configuração!`);
        }
      } else {
        const perguntaCompleta = pergunta.join(' ');
        console.log(`${sparkle} ${chalk.cyan('Você perguntou:')} "${chalk.bold(perguntaCompleta)}"`);
        console.log(`${fox} ${chalk.gray('Foxy está pensando...')}`);

        const { responded, date } = await FoxyCL.responder(perguntaCompleta);
        const resposta = await responded;

        console.log(`${chalk.dim('📅')} ${chalk.gray(date.toLocaleString())}`);
        console.log(`${chalk.bold('💬')} ${chalk.white(resposta)}`);

        if (resposta.includes('---')) {
          await TrasformeToFile(resposta, baseDir);
        }
      }

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          console.error(`${err} ${chalk.red('Erro com a API key:')} ${error.message}`);
          console.log(`${info} Tente: ${chalk.cyan('foxy --reset-key')}`);
        } else {
          console.error(`${err} ${chalk.red('Erro:')} ${error.message}`);
        }
      } else {
        console.error(`${err} ${chalk.red('Erro desconhecido:')} ${error}`);
      }
      process.exit(1);
    }
  });

async function handleGitInit(baseDir: string) {
  console.log(`${fox} ${chalk.hex('#ffa500')('Inicializando configuração do Foxy...')}`);
  
  const configManager = new FoxyConfigManager(baseDir);
  configManager.createDefaultConfig();
  
  console.log(chalk.cyan('\n📋 | Configurações disponíveis no .foxycfg:'));
  console.log(chalk.gray(`
   • language: ${chalk.yellow('pt | en')}
   • conventionalCommits: ${chalk.yellow('true | false')}
   • commitStyle: ${chalk.yellow('conventional | simple | detailed')}
   • maxMessageLength: ${chalk.yellow('número')}
   • includeScope: ${chalk.yellow('true | false')}
   • emojis: ${chalk.yellow('true | false')}
   • git.autoAdd: ${chalk.yellow('true | false')}
   • git.autoCommit: ${chalk.yellow('true | false')}
   • git.confirmBeforeCommit: ${chalk.yellow('true | false')}
   • git.includeStats: ${chalk.yellow('true | false')}
  `));

  console.log(`${info} Edite o arquivo ${chalk.magenta('.foxycfg')} para personalizar as configurações!\n`);
}

async function handleGitCommit(baseDir: string) {
  console.log(`${fox} ${chalk.hex('#ff8800')('Analisando mudanças no git...')}`);
  
  if (!existsSync(`${baseDir}/.git`)) {
    console.log(`${err} ${chalk.red('Este diretório não é um repositório git!')}`);
    return;
  }

  const configManager = new FoxyConfigManager(baseDir);
  const config = configManager.loadConfig();

  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8', cwd: baseDir }).trim();

    if (!gitStatus) {
      console.log(`${ok} ${chalk.green('Não há mudanças para commitar!')}`);
      return;
    }

    const changes = parseGitStatus(gitStatus);
    
    if (config.git.includeStats) {
      console.log(chalk.cyan('\n📊 | Mudanças detectadas:'));
      console.log(`   • ${chalk.green(changes.added.length)} arquivo(s) adicionado(s)`);
      console.log(`   • ${chalk.yellow(changes.modified.length)} arquivo(s) modificado(s)`);
      console.log(`   • ${chalk.red(changes.deleted.length)} arquivo(s) deletado(s)\n`);
    }

    console.log(`${sparkle} ${chalk.magenta('Gerando descrição do commit...')}`);
    const messageGenerator = new CommitMessageGenerator(FoxyCL, config);
    const commitMessage = await messageGenerator.generateCommitMessage(changes);
    
    console.log(`${commit} ${chalk.white('Mensagem do commit:')} ${chalk.greenBright(`"${commitMessage}"`)}`);

    if (config.git.autoAdd) {
      console.log(`${gear} ${chalk.yellow('Adicionando arquivos ao staging...')}`);
      execSync('git add .', { cwd: baseDir });
    }

    if (config.git.autoCommit) {
      console.log(`${commit} ${chalk.yellow('Criando commit...')}`);
      execSync(`git commit -m "${commitMessage}"`, { cwd: baseDir });
      console.log(`${ok} ${chalk.green('Commit criado com sucesso!')}`);
    } else {
      console.log(`${info} Commit não foi criado automaticamente.`);
    }

  } catch (error) {
    console.error(`${err} ${chalk.red('Erro ao processar commit:')} ${error}`);
  }
}

function parseGitStatus(status: string) {
  const lines = status.split('\n').filter(line => line.trim());
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const line of lines) {
    const state = line.substring(0, 2);
    const file = line.substring(3);

    if (state.includes('A')) added.push(file);
    if (state.includes('M')) modified.push(file);
    if (state.includes('D')) deleted.push(file);
  }

  return { added, modified, deleted };
}

CLI.parse(process.argv);

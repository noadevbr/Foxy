// index.ts (CLI principal)
import { Command } from 'commander';
import { FoxyClient } from './util/FoxyClient.js';
import { TrasformeToFile } from '@fx';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { FoxyConfigManager } from './util/config/FoxyConfig.js';
import { CommitMessageGenerator } from './util/CommitMessageGenerator.js';

const FoxyCL = new FoxyClient();

const CLI = new Command();

CLI.name('foxy')
  .description(
    'Uma inteligência artificial para ajudar o PedroDev quando ele não souber o que fazer.',
  )
  .option('--git [action]', 'Detecta mudanças no git e cria commit automático. Use "init" para configurar.')
  .option('--reset-key', 'Remove a API key salva e força uma nova configuração')
  .option('--setup', 'Força o setup inicial da API key')
  .argument('[pergunta...]', 'Uma pergunta ou comando para a Foxy')
  .action(async (pergunta, options) => {
    const baseDir = process.cwd();

    try {
      // Opção para resetar API key
      if (options.resetKey) {
        await FoxyCL.resetApiKey();
        return;
      }

      // Opção para forçar setup
      if (options.setup) {
        await FoxyCL.resetApiKey();
        console.log('🔧 | Forçando nova configuração...\n');
      }

      // Se a opção --git foi usada
      if (options.git) {
        if (options.git === 'init') {
          await handleGitInit(baseDir);
        } else {
          await handleGitCommit(baseDir);
        }
        return;
      }

      if (!pergunta.length) {
        // Verifica se está configurado para mostrar mensagem apropriada
        if (FoxyCL.isConfigured()) {
          console.log('Oi, PedroDev! Como posso te ajudar hoje? 🦊');
        } else {
          console.log('🦊 | Olá! Parece que é sua primeira vez usando o Foxy.');
          console.log('💡 | Use qualquer comando para começar a configuração!');
        }
      } else {
        const perguntaCompleta = pergunta.join(' ');

        console.log(`🔍 | Você perguntou: "${perguntaCompleta}"`);
        console.log('🦊 | Foxy está pensando...');

        const { responded, date } = await FoxyCL.responder(perguntaCompleta);
        const resposta = await responded;

        console.log(`📅 | ${date.toLocaleString()}`);
        console.log(`💬 | ${resposta}`);

        if (resposta.includes('---')) {
          await TrasformeToFile(resposta, baseDir);
        }
      }

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          console.error('❌ | Erro com a API key:', error.message);
          console.log('💡 | Tente: foxy --reset-key');
        } else {
          console.error('❌ | Erro:', error.message);
        }
      } else {
        console.error('❌ | Erro desconhecido:', error);
      }
      process.exit(1);
    }
  });

async function handleGitInit(baseDir: string) {
  console.log('🦊 | Inicializando configuração do Foxy...');
  
  const configManager = new FoxyConfigManager(baseDir);
  configManager.createDefaultConfig();
  
  console.log('📋 | Configurações disponíveis no .foxycfg:');
  console.log('   • language: pt | en');
  console.log('   • conventionalCommits: true | false');
  console.log('   • commitStyle: conventional | simple | detailed');
  console.log('   • maxMessageLength: número');
  console.log('   • includeScope: true | false');
  console.log('   • emojis: true | false');
  console.log('   • git.autoAdd: true | false');
  console.log('   • git.autoCommit: true | false (NOVO!)');
  console.log('   • git.confirmBeforeCommit: true | false');
  console.log('   • git.includeStats: true | false');
  console.log('');
  console.log('💡 | Edite o arquivo .foxycfg para personalizar as configurações!');
}

async function handleGitCommit(baseDir: string) {
  console.log('🦊 | Foxy está analisando as mudanças no git...');
  
  // Verifica se estamos em um repositório git
  if (!existsSync(`${baseDir}/.git`)) {
    console.log('❌ | Este diretório não é um repositório git!');
    return;
  }

  // Carrega configurações
  const configManager = new FoxyConfigManager(baseDir);
  const config = configManager.loadConfig();

  try {
    // Obtém o status do git
    const gitStatus = execSync('git status --porcelain', { 
      encoding: 'utf8',
      cwd: baseDir 
    }).trim();

    if (!gitStatus) {
      console.log('✅ | Não há mudanças para commitar!');
      return;
    }

    // Analisa as mudanças
    const changes = parseGitStatus(gitStatus);
    
    if (config.git.includeStats) {
      console.log('📊 | Mudanças detectadas:');
      console.log(`   • ${changes.added.length} arquivo(s) adicionado(s)`);
      console.log(`   • ${changes.modified.length} arquivo(s) modificado(s)`);
      console.log(`   • ${changes.deleted.length} arquivo(s) deletado(s)`);
    }

    // Gera descrição do commit usando IA
    console.log('🤖 | Gerando descrição do commit...');
    const messageGenerator = new CommitMessageGenerator(FoxyCL, config);
    const commitMessage = await messageGenerator.generateCommitMessage(changes);
    
    console.log(`💬 | Mensagem do commit: "${commitMessage}"`);

    // Executa git add . (se habilitado)
    if (config.git.autoAdd) {
      console.log('📝 | Adicionando arquivos ao staging...');
      execSync('git add .', { cwd: baseDir });
    }

    // Verifica se deve fazer commit automaticamente
    if (config.git.autoCommit) {
      // Faz o commit automaticamente
      console.log('💾 | Criando commit...');
      execSync(`git commit -m "${commitMessage}"`, { cwd: baseDir });
      console.log('✅ | Commit criado com sucesso!');
    } else {
      // Apenas mostra a mensagem e instruções
      console.log('📋 | Commit não foi criado automaticamente.');
    }

  } catch (error) {
    console.error('❌ | Erro ao processar commit:', error);
  }
}

function parseGitStatus(status: string) {
  const lines = status.split('\n').filter(line => line.trim());
  
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const line of lines) {
    const status = line.substring(0, 2);
    const file = line.substring(3);

    if (status.includes('A')) {
      added.push(file);
    }
    if (status.includes('M')) {
      modified.push(file);
    }
    if (status.includes('D')) {
      deleted.push(file);
    }
  }

  return { added, modified, deleted };
}

CLI.parse(process.argv);
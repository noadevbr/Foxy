// util/ApiKeyManager.ts
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import * as readline from 'node:readline/promises';

export class ApiKeyManager {
  private configPath: string;
  private encryptionKey: string;

  constructor() {
    // Define o caminho do arquivo de config na home do usuário
    this.configPath = join(homedir(), '.foxy-config.enc');
    this.encryptionKey = this.getSystemKey();
  }

  private getSystemKey(): string {
    try {
      let systemInfo = '';
      const platformType = platform();
      
      switch (platformType) {
        case 'win32':
          // Windows - usa informações do sistema
          try {
            const computerName = process.env.COMPUTERNAME || 'unknown';
            const userName = process.env.USERNAME || 'unknown';
            systemInfo = `${computerName}-${userName}-${platformType}`;
          } catch {
            systemInfo = `windows-${process.env.USERNAME || 'user'}`;
          }
          break;
          
        case 'darwin':
          // macOS - usa serial number do hardware
          try {
            const serialNumber = execSync('system_profiler SPHardwareDataType | grep "Serial Number"', 
              { encoding: 'utf8' }).trim().split(':')[1]?.trim() || 'unknown';
            systemInfo = `${serialNumber}-${platformType}`;
          } catch {
            systemInfo = `macos-${process.env.USER || 'user'}`;
          }
          break;
          
        case 'linux':
          // Linux - usa machine-id se disponível
          try {
            if (existsSync('/etc/machine-id')) {
              const machineId = readFileSync('/etc/machine-id', 'utf8').trim();
              systemInfo = `${machineId}-${platformType}`;
            } else {
              systemInfo = `linux-${process.env.USER || 'user'}`;
            }
          } catch {
            systemInfo = `linux-${process.env.USER || 'user'}`;
          }
          break;
          
        default:
          systemInfo = `${platformType}-${process.env.USER || process.env.USERNAME || 'user'}`;
      }

      // Cria uma chave derivada usando hash
      return createHash('sha256').update(systemInfo).digest('hex').substring(0, 32);
    } catch (error) {
      // Fallback caso algo dê errado
      const fallback = `${platform()}-${process.env.USER || process.env.USERNAME || 'fallback'}`;
      return createHash('sha256').update(fallback).digest('hex').substring(0, 32);
    }
  }

  private encrypt(text: string): string {
    try {
      // Gera um IV aleatório de 16 bytes
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      // Retorna o IV em hex + ':' + texto criptografado
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new Error('Erro ao criptografar a API key');
    }
  }

  private decrypt(encryptedText: string): string {
    try {
      // O texto criptografado está no formato ivHex:encryptedHex
      const [ivHex, encryptedHex] = encryptedText.split(':');
      if (!ivHex || !encryptedHex) {
        throw new Error('Formato de texto criptografado inválido');
      }
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error('Erro ao descriptografar a API key - pode ter sido corrompida');
    }
  }

  public hasApiKey(): boolean {
    return existsSync(this.configPath);
  }

  public async promptForApiKey(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('\n🦊 | Bem-vindo ao Foxy!');
    console.log('📝 | Para começar, preciso da sua API key do Google Gemini.');
    console.log('💡 | Você pode obter uma em: https://makersuite.google.com/app/apikey\n');

    try {
      const apiKey = await rl.question('🔑 | Cole sua API key do Gemini aqui: ');
      
      if (!apiKey || apiKey.trim().length === 0) {
        throw new Error('API key não pode estar vazia');
      }

      // Validação básica da API key do Gemini (começam com AIza)
      if (!apiKey.trim().startsWith('AIza')) {
        console.log('⚠️  | A API key não parece válida (deve começar com "AIza")');
        const confirm = await rl.question('❓ | Deseja continuar mesmo assim? (y/N): ');
        
        if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
          throw new Error('Configuração cancelada pelo usuário');
        }
      }

      return apiKey.trim();
    } finally {
      rl.close();
    }
  }

  public saveApiKey(apiKey: string): void {
    try {
      const encrypted = this.encrypt(apiKey);
      writeFileSync(this.configPath, encrypted, 'utf8');
      console.log('✅ | API key salva com segurança!');
    } catch (error) {
      throw new Error(`Erro ao salvar API key: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public loadApiKey(): string {
    if (!this.hasApiKey()) {
      throw new Error('API key não encontrada. Execute o setup primeiro.');
    }

    try {
      const encrypted = readFileSync(this.configPath, 'utf8');
      return this.decrypt(encrypted);
    } catch (error) {
      throw new Error(`Erro ao carregar API key: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async setupApiKey(): Promise<string> {
    const apiKey = await this.promptForApiKey();
    this.saveApiKey(apiKey);
    return apiKey;
  }

  public deleteApiKey(): void {
    if (existsSync(this.configPath)) {
      try {
        const fs = require('fs');
        fs.unlinkSync(this.configPath);
        console.log('🗑️  | API key removida com sucesso!');
      } catch (error) {
        console.error('❌ | Erro ao remover API key:', error);
      }
    }
  }
}
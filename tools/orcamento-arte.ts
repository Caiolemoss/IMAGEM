// createTool: função do SDK do Runflow que registra esta função como uma "ferramenta"
// que o agente de IA pode chamar durante uma conversa.
import { createTool, log } from '@runflow-ai/sdk';
// log: registra eventos de negócio na execução ativa (thread/execution já
// identificados pelo Agent) sem precisar receber o "exec" como parâmetro.
// zod: biblioteca de validação de esquemas. Usada aqui para descrever e validar
// os parâmetros de entrada que o agente deve fornecer ao chamar a ferramenta.
import { z } from 'zod';
// readFileSync/writeFileSync/existsSync: leitura, escrita e checagem de existência de arquivos.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
// randomUUID: gera um identificador único (UUID v4) para cada pedido de orçamento.
import { randomUUID } from 'node:crypto';
// fileURLToPath: converte a URL do módulo atual (import.meta.url) em um caminho de arquivo normal.
import { fileURLToPath } from 'node:url';
// dirname/join: utilitários para manipular caminhos de pastas/arquivos de forma multiplataforma.
import { dirname, join } from 'node:path';

// Resolvido dentro de uma função (não como const de nível de módulo) para que
// import.meta.url só seja lido quando a tool for de fato executada, e não a
// cada import de './tools' — evita derrubar toda mensagem caso o runtime não
// exponha import.meta.url no momento em que o módulo é carregado.
function getOrcamentosPath(): string {
  // Em módulos ES (import/export) não existe a variável global "__dirname" como no CommonJS,
  // então ela precisa ser recriada manualmente a partir da URL do próprio arquivo.
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // Monta o caminho absoluto até o arquivo orcamentos.json, que fica na raiz do projeto
  // (join(__dirname, '..', ...) sobe um nível a partir da pasta "tools").
  return join(__dirname, '..', 'orcamentos.json');
}

// Formato de cada pedido de orçamento de arte salvo no arquivo.
interface OrcamentoArte {
  id: string;
  produtoInteresse: string;
  descricaoArte: string;
  contatoCliente: string;
  criadoEm: string;
}

/**
 * Reads the existing orcamentos.json file, returning an empty array
 * if the file doesn't exist yet or is empty/corrupted.
 */
function loadOrcamentos(): OrcamentoArte[] {
  const orcamentosPath = getOrcamentosPath();
  if (!existsSync(orcamentosPath)) {
    return [];
  }

  const content = readFileSync(orcamentosPath, 'utf-8').trim();
  if (!content) {
    return [];
  }

  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Orçamento de Arte Tool - Registers a new custom art/design request
 *
 * Appends each request to orcamentos.json (array), without overwriting previous entries.
 */
// createTool monta o objeto de ferramenta que o agente de IA consegue "ver" e invocar.
export const criarOrcamentoArte = createTool({
  // Identificador único da ferramenta — é assim que o agente a referencia internamente.
  id: 'criar_orcamento_arte',
  // Descrição em linguagem natural. É isso que o modelo de IA lê para decidir
  // QUANDO e POR QUE usar esta ferramenta durante a conversa com o cliente.
  description:
    'Register a new art/design request when the customer needs a new art created or an existing one readjusted. Use this after collecting what the customer imagines for the art and a contact for follow-up.',

  // Define o formato esperado dos parâmetros de entrada, usando zod.
  inputSchema: z.object({
    produtoInteresse: z.string().describe('Product the customer is interested in (e.g., "banner", "adesivo", "placa luminosa")'),
    descricaoArte: z.string().describe('What the customer imagines or needs for the art — description, references, ideas'),
    contatoCliente: z.string().describe('Contact for follow-up (phone number or e-mail)'),
  }),

  // Função que roda de fato quando o agente decide usar a ferramenta.
  // "context" contém os parâmetros validados pelo inputSchema acima.
  execute: async ({ context }) => {
    const { produtoInteresse, descricaoArte, contatoCliente } = context;

    try {
      // Carrega os pedidos já salvos para adicionar o novo sem perder os anteriores.
      const orcamentos = loadOrcamentos();

      const novoOrcamento: OrcamentoArte = {
        id: randomUUID(),
        produtoInteresse,
        descricaoArte,
        contatoCliente,
        criadoEm: new Date().toISOString(),
      };

      orcamentos.push(novoOrcamento);

      // Salva a lista completa de volta no arquivo, formatada para leitura humana.
      writeFileSync(getOrcamentosPath(), JSON.stringify(orcamentos, null, 2), 'utf-8');

      log('orcamento_arte_solicitado', { produtoInteresse });

      return {
        success: true,
        message: 'Pedido de orçamento de arte registrado com sucesso. A equipe de design vai avaliar e retornar com o valor.',
        orcamento: novoOrcamento,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error saving art request',
      };
    }
  },
});

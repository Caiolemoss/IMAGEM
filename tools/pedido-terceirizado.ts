// createTool: função do SDK do Runflow que registra esta função como uma "ferramenta"
// que o agente de IA pode chamar durante uma conversa.
import { createTool } from '@runflow-ai/sdk';
// zod: biblioteca de validação de esquemas. Usada aqui para descrever e validar
// os parâmetros de entrada que o agente deve fornecer ao chamar a ferramenta.
import { z } from 'zod';
// readFileSync/writeFileSync/existsSync: leitura, escrita e checagem de existência de arquivos.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
// randomUUID: gera um identificador único (UUID v4) para cada pedido terceirizado.
import { randomUUID } from 'node:crypto';
// fileURLToPath: converte a URL do módulo atual (import.meta.url) em um caminho de arquivo normal.
import { fileURLToPath } from 'node:url';
// dirname/join: utilitários para manipular caminhos de pastas/arquivos de forma multiplataforma.
import { dirname, join } from 'node:path';

// Em módulos ES (import/export) não existe a variável global "__dirname" como no CommonJS,
// então ela precisa ser recriada manualmente a partir da URL do próprio arquivo.
const __dirname = dirname(fileURLToPath(import.meta.url));
// Monta o caminho absoluto até o arquivo pedidos-terceirizados.json, que fica na raiz do projeto
// (join(__dirname, '..', ...) sobe um nível a partir da pasta "tools").
const PEDIDOS_PATH = join(__dirname, '..', 'pedidos-terceirizados.json');

// Formato de cada pedido terceirizado salvo no arquivo.
interface PedidoTerceirizado {
  id: string;
  item: string;
  especificacoes: string;
  contatoCliente: string;
  criadoEm: string;
}

/**
 * Reads the existing pedidos-terceirizados.json file, returning an empty array
 * if the file doesn't exist yet or is empty/corrupted.
 */
function loadPedidos(): PedidoTerceirizado[] {
  if (!existsSync(PEDIDOS_PATH)) {
    return [];
  }

  const content = readFileSync(PEDIDOS_PATH, 'utf-8').trim();
  if (!content) {
    return [];
  }

  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Pedido Terceirizado Tool - Registers a new request for an item that is
 * quoted with a partner supplier (ex: Folder) rather than priced in the catalog.
 *
 * Appends each request to pedidos-terceirizados.json (array), without overwriting previous entries.
 */
// createTool monta o objeto de ferramenta que o agente de IA consegue "ver" e invocar.
export const registrarPedidoTerceirizado = createTool({
  // Identificador único da ferramenta — é assim que o agente a referencia internamente.
  id: 'registrar_pedido_terceirizado',
  // Descrição em linguagem natural. É isso que o modelo de IA lê para decidir
  // QUANDO e POR QUE usar esta ferramenta durante a conversa com o cliente.
  description:
    'Register a request for a graphic item that is fulfilled by a partner supplier (terceirizado), such as Folder, which has no fixed catalog price. Use this after collecting the item, its specifications (size/paper/quantity) and a contact for follow-up. Never calculate or inform a price for these items — the value is returned later by the team.',

  // Define o formato esperado dos parâmetros de entrada, usando zod.
  inputSchema: z.object({
    item: z.string().describe('Item requested by the customer (e.g., "Folder")'),
    especificacoes: z.string().describe('Specifications for the item — size/paper/quantity (e.g., "A5, papel couché brilho, 500 unidades")'),
    contatoCliente: z.string().describe('Contact for follow-up (phone number or e-mail)'),
  }),

  // Função que roda de fato quando o agente decide usar a ferramenta.
  // "context" contém os parâmetros validados pelo inputSchema acima.
  execute: async ({ context }) => {
    const { item, especificacoes, contatoCliente } = context;

    try {
      // Carrega os pedidos já salvos para adicionar o novo sem perder os anteriores.
      const pedidos = loadPedidos();

      const novoPedido: PedidoTerceirizado = {
        id: randomUUID(),
        item,
        especificacoes,
        contatoCliente,
        criadoEm: new Date().toISOString(),
      };

      pedidos.push(novoPedido);

      // Salva a lista completa de volta no arquivo, formatada para leitura humana.
      writeFileSync(PEDIDOS_PATH, JSON.stringify(pedidos, null, 2), 'utf-8');

      return {
        success: true,
        message: 'Pedido registrado com sucesso. É um item cotado com fornecedor parceiro — a equipe vai retornar com o valor.',
        pedido: novoPedido,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error saving terceirizado request',
      };
    }
  },
});

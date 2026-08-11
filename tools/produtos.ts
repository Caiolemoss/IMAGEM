// createTool: função do SDK do Runflow que registra esta função como uma "ferramenta"
// que o agente de IA pode chamar durante uma conversa.
import { createTool, log } from '@runflow-ai/sdk';
// log: registra eventos de negócio na execução ativa (thread/execution já
// identificados pelo Agent) sem precisar receber o "exec" como parâmetro.
// zod: biblioteca de validação de esquemas. Usada aqui para descrever e validar
// os parâmetros de entrada que o agente deve fornecer ao chamar a ferramenta.
import { z } from 'zod';
// readFileSync: lê o conteúdo de um arquivo de forma síncrona (bloqueia até terminar).
import { readFileSync } from 'node:fs';
// fileURLToPath: converte a URL do módulo atual (import.meta.url) em um caminho de arquivo normal.
import { fileURLToPath } from 'node:url';
// dirname/join: utilitários para manipular caminhos de pastas/arquivos de forma multiplataforma.
import { dirname, join } from 'node:path';

// Em módulos ES (import/export) não existe a variável global "__dirname" como no CommonJS,
// então ela precisa ser recriada manualmente a partir da URL do próprio arquivo.
const __dirname = dirname(fileURLToPath(import.meta.url));
// Monta o caminho absoluto até o arquivo produtos.csv, que fica uma pasta acima
// (join(__dirname, '..', ...) sobe um nível a partir da pasta "tools").
const CSV_PATH = join(__dirname, '..', 'produtos.csv');

// Formato de cada linha do CSV depois de convertida em objeto.
// Todos os campos são strings porque vêm direto do texto do CSV, sem conversão de tipo.
interface Produto {
  id: string;
  nome: string;
  categoria: string;
  material: string;               // ex: "Acrílico", "ACM", "MDF", "Vinil"
  acabamento_iluminacao: string;  // acabamento e/ou tipo de iluminação da peça
  unidade_venda: string; // ex: "m²", "unidade", "caixa"
  preco: string;         // valor em texto (ex: "25.90"), não é number
  prazo_dias: string;    // prazo de entrega em dias, também como texto
  terceirizado: string;  // "sim" ou "nao" - indica se o item é cotado com fornecedor parceiro
  observacoes: string;   // notas internas (ex: recomendações de uso, regras de orçamento)
}

/**
 * Parses the products CSV file into an array of records.
 * The catalog has no quoted/escaped fields, so a plain split is sufficient.
 */
function loadProdutos(): Produto[] {
  // Lê o arquivo inteiro como texto (utf-8) e remove espaços/quebras de linha nas pontas.
  const content = readFileSync(CSV_PATH, 'utf-8').trim();
  // Quebra o texto em linhas (aceita tanto "\n" quanto "\r\n", padrão Windows).
  // A primeira linha é o cabeçalho (nomes das colunas); o resto (...lines) são os dados.
  const [headerLine, ...lines] = content.split(/\r?\n/);
  // Separa o cabeçalho em uma lista de nomes de coluna, ex: ["id", "nome", "categoria", ...]
  const headers = headerLine.split(',');

  // Para cada linha de dados, transforma o texto separado por vírgula em um objeto.
  return lines.map((line) => {
    // Separa a linha atual em valores individuais, na mesma ordem das colunas.
    const values = line.split(',');
    const record: Record<string, string> = {};
    // Junta cada cabeçalho com o valor correspondente pela posição (índice).
    // Ex: headers[0]="id", values[0]="123" -> record["id"] = "123"
    headers.forEach((header, index) => {
      // "?." evita erro se faltar valor na coluna; "?? ''" garante string vazia em vez de undefined.
      record[header.trim()] = values[index]?.trim() ?? '';
    });
    // O objeto genérico é convertido para o tipo Produto (o "as unknown as" força essa conversão,
    // já que o TypeScript não consegue garantir sozinho que as chaves batem com a interface).
    return record as unknown as Produto;
  });
}

/**
 * Products Tool - Search the product catalog by name, category or description
 *
 * Reads from produtos.csv (columns: id, nome, categoria, material, acabamento_iluminacao,
 * unidade_venda, preco, prazo_dias, terceirizado, observacoes)
 */
// createTool monta o objeto de ferramenta que o agente de IA consegue "ver" e invocar.
export const buscarProdutos = createTool({
  // Identificador único da ferramenta — é assim que o agente a referencia internamente.
  id: 'buscar_produtos',
  // Descrição em linguagem natural. É isso que o modelo de IA lê para decidir
  // QUANDO e POR QUE usar esta ferramenta durante a conversa com o cliente.
  description:
    'Search the product catalog for items whose name, category or description match a search term. Use this when the customer asks about product prices, delivery times (prazos) or availability.',

  // Define o formato esperado dos parâmetros de entrada, usando zod.
  // O agente é obrigado a enviar um objeto com um campo "termo" do tipo string.
  inputSchema: z.object({
    termo: z.string().describe('Search term to match against product name, category or description (e.g., "banner", "acrílico", "letra caixa")'),
  }),

  // Função que roda de fato quando o agente decide usar a ferramenta.
  // "context" contém os parâmetros validados pelo inputSchema acima.
  execute: async ({ context }) => {
    // Extrai o termo de busca enviado pelo agente.
    const { termo } = context;

    try {
      // Carrega todo o catálogo de produtos a partir do CSV.
      const produtos = loadProdutos();
      // Deixa o termo em minúsculas para fazer uma busca "case-insensitive"
      // (não diferenciar maiúsculas de minúsculas).
      const termoLower = termo.toLowerCase();

      // Filtra os produtos cujo nome, categoria, material ou acabamento/iluminação contenham o termo buscado.
      const encontrados = produtos.filter((produto) =>
        produto.nome.toLowerCase().includes(termoLower) ||
        produto.categoria.toLowerCase().includes(termoLower) ||
        produto.material.toLowerCase().includes(termoLower) ||
        produto.acabamento_iluminacao.toLowerCase().includes(termoLower)
      );

      if (encontrados.length > 0) {
        log('produto_buscado', { termo, encontrados: encontrados.length });
      } else {
        log('busca_sem_resultado', { termo });
      }

      // Retorno de sucesso: inclui o termo pesquisado, quantos resultados foram
      // encontrados e a lista completa dos produtos encontrados.
      return {
        success: true,
        termo,
        total: encontrados.length,
        produtos: encontrados,
      };
    } catch (error) {
      // Se algo der errado (ex: arquivo CSV não encontrado ou ilegível),
      // retorna um objeto de erro em vez de deixar a exceção "estourar".
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error reading product catalog',
      };
    }
  },
});

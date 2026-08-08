import { buscarProdutos } from './produtos';
import { criarOrcamentoArte } from './orcamento-arte';
import { registrarPedidoTerceirizado } from './pedido-terceirizado';

/**
 * Agent Tools Registry
 *
 * Register your tools here. The key should match the tool's 'id'.
 */
export const tools = {
  buscar_produtos: buscarProdutos,
  criar_orcamento_arte: criarOrcamentoArte,
  registrar_pedido_terceirizado: registrarPedidoTerceirizado,
};

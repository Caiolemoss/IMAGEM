import { Agent, anthropic, identify, log, track } from '@runflow-ai/sdk';
import type { AgentInput } from '@runflow-ai/sdk';
// import { connector } from '@runflow-ai/sdk';
import { tools } from './tools';
import { systemPrompt } from './prompts';

/**
 * teste-credencial - AI Agent powered by Runflow SDK
 */
const agent = new Agent({
  name: 'teste-credencial',
  model: anthropic('claude-sonnet-4-6'),
  instructions: systemPrompt,
  tools,

  // Memory - stores conversation history per session
  memory: {
    maxTurns: 10,
  },

  // Observability - traces every LLM call, tool execution and memory access
  // 'full' is the default; change to 'standard' (truncated) or 'minimal' (off)
  observability: 'full',

  // Uncomment to enable RAG (Retrieval Augmented Generation)
  // rag: {
  //   vectorStore: 'my-knowledge-base',
  //   k: 5,
  //   threshold: 0.7,
  // },
});

// ---------------------------------------------------------------------------
// Main entry point - called by Runflow runtime.
//
// Fields the caller typically sends:
//   input.message      - User's message (required)
//   input.sessionId    - Conversation id (same value = same memory thread)
//   input.userId       - User id (auto-generated if omitted)
//   input.channel      - Channel hint: 'whatsapp' | 'widget' | 'api' | 'webhook' | ...
//   input.file         - Media file (audio/image/video) for auto-processing
//   input.messages     - Additional context messages (not persisted)
//
// Auto-enriched by the platform (shape varies by invocation source):
//   input.metadata     - Additional context (ip, userAgent, triggerId,
//                        originalPayload, customHeaders, ...)
//   input.request      - Raw HTTP request { body, headers, cookies, query, params }.
//                        Only populated on direct HTTP Agent API calls; use
//                        optional chaining: input.request?.body
// ---------------------------------------------------------------------------
export async function main(input: AgentInput) {
  const { message, sessionId } = input;

  // Identify groups all logs, traces and memory under this user
  identify(input.metadata?.email || input.metadata?.phone || 'anonymous');

  // --- More identify examples ---
  // identify('+5511999999999');                              // phone
  // identify({ type: 'hubspot_contact', value: 'cid_123' });// CRM

  log('Processing message', { sessionId, messageLength: message.length });

  const result = await agent.process({ message, sessionId });

  // --- Connector example (uncomment to call an external service) ---
  // const lead = await connector('hubspot', 'create-contact', {
  //   body: { email: 'user@email.com', firstname: 'John' },
  // });

  track('message_processed', {
    model: 'claude-sonnet-4-6',
    hasSession: !!sessionId,
  });

  return result;
}

export default main;
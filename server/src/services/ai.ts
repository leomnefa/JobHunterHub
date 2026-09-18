import { config } from "../config.ts";
import { getSetting, setSetting } from "../db/index.ts";
import { decryptSecret, encryptSecret } from "../util/crypto.ts";

/**
 * Capa de IA intercambiable.
 *
 * - heuristic : sin API key. El sistema funciona completo usando solo los
 *               algoritmos deterministicos locales.
 * - anthropic / openai / ollama : enriquecen el analisis con un LLM.
 *
 * Regla del proyecto: la IA nunca inventa datos del candidato. El prompt del
 * sistema lo prohibe explicitamente y obliga a responder UNKNOWN cuando la
 * informacion no esta en el perfil.
 */

export type AiProvider = "heuristic" | "anthropic" | "openai" | "ollama";

export interface AiSettings {
  provider: AiProvider;
  anthropicApiKey: string;
  anthropicModel: string;
  openaiApiKey: string;
  openaiModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

const SETTING_KEYS = {
  provider: "ai.provider",
  anthropicApiKey: "ai.anthropic.apiKey",
  anthropicModel: "ai.anthropic.model",
  openaiApiKey: "ai.openai.apiKey",
  openaiModel: "ai.openai.model",
  ollamaBaseUrl: "ai.ollama.baseUrl",
  ollamaModel: "ai.ollama.model",
} as const;

export function getAiSettings(): AiSettings {
  const secret = (key: string, fallback: string): string => {
    const stored = getSetting(key);
    if (!stored) return fallback;
    const plain = decryptSecret(stored);
    return plain || fallback;
  };

  return {
    provider: (getSetting(SETTING_KEYS.provider) ?? config.ai.provider) as AiProvider,
    anthropicApiKey: secret(SETTING_KEYS.anthropicApiKey, config.ai.anthropicApiKey),
    anthropicModel: getSetting(SETTING_KEYS.anthropicModel) ?? config.ai.anthropicModel,
    openaiApiKey: secret(SETTING_KEYS.openaiApiKey, config.ai.openaiApiKey),
    openaiModel: getSetting(SETTING_KEYS.openaiModel) ?? config.ai.openaiModel,
    ollamaBaseUrl: getSetting(SETTING_KEYS.ollamaBaseUrl) ?? config.ai.ollamaBaseUrl,
    ollamaModel: getSetting(SETTING_KEYS.ollamaModel) ?? config.ai.ollamaModel,
  };
}

export function saveAiSettings(input: Partial<AiSettings>): void {
  if (input.provider) setSetting(SETTING_KEYS.provider, input.provider);
  if (input.anthropicModel) setSetting(SETTING_KEYS.anthropicModel, input.anthropicModel);
  if (input.openaiModel) setSetting(SETTING_KEYS.openaiModel, input.openaiModel);
  if (input.ollamaBaseUrl) setSetting(SETTING_KEYS.ollamaBaseUrl, input.ollamaBaseUrl);
  if (input.ollamaModel) setSetting(SETTING_KEYS.ollamaModel, input.ollamaModel);
  // Las API keys se guardan cifradas; una cadena vacia significa "no cambiar".
  if (input.anthropicApiKey) {
    setSetting(SETTING_KEYS.anthropicApiKey, encryptSecret(input.anthropicApiKey), true);
  }
  if (input.openaiApiKey) {
    setSetting(SETTING_KEYS.openaiApiKey, encryptSecret(input.openaiApiKey), true);
  }
}

export function aiStatus(): { provider: AiProvider; ready: boolean; detail: string } {
  const settings = getAiSettings();
  switch (settings.provider) {
    case "anthropic":
      return {
        provider: "anthropic",
        ready: Boolean(settings.anthropicApiKey),
        detail: settings.anthropicApiKey
          ? `Modelo ${settings.anthropicModel}`
          : "Falta la API key de Anthropic",
      };
    case "openai":
      return {
        provider: "openai",
        ready: Boolean(settings.openaiApiKey),
        detail: settings.openaiApiKey
          ? `Modelo ${settings.openaiModel}`
          : "Falta la API key de OpenAI",
      };
    case "ollama":
      return {
        provider: "ollama",
        ready: true,
        detail: `${settings.ollamaModel} en ${settings.ollamaBaseUrl}`,
      };
    default:
      return {
        provider: "heuristic",
        ready: true,
        detail: "Analisis deterministico local, sin proveedor externo",
      };
  }
}

export const SYSTEM_PROMPT = `Sos un asistente de busqueda laboral que analiza ofertas de trabajo contra el perfil real de un candidato.

REGLAS ABSOLUTAS:
1. Usa UNICAMENTE la informacion del perfil entregado.
2. Nunca inventes experiencia, empresas, tecnologias, titulos, certificaciones, idiomas, anios de experiencia ni proyectos.
3. Si un dato no existe en el perfil, responde exactamente UNKNOWN.
4. No exageres ni reformules una habilidad ausente como presente.
5. Responde siempre en espanol rioplatense neutro y en el formato solicitado.`;

export class AiError extends Error {
  readonly provider: AiProvider;

  constructor(message: string, provider: AiProvider) {
    super(message);
    this.name = "AiError";
    this.provider = provider;
  }
}

export interface CompletionOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** Pide al modelo responder unicamente con JSON. */
  json?: boolean;
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

interface OpenAiResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

interface OllamaResponse {
  message?: { content?: string };
  error?: string;
}

async function post<T>(url: string, headers: Record<string, string>, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Ejecuta un prompt contra el proveedor configurado. Lanza AiError si no hay LLM. */
export async function complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
  const settings = getAiSettings();
  const system = options.system ?? SYSTEM_PROMPT;
  const maxTokens = options.maxTokens ?? 2000;

  switch (settings.provider) {
    case "anthropic": {
      if (!settings.anthropicApiKey) {
        throw new AiError("Falta la API key de Anthropic.", "anthropic");
      }
      const response = await post<AnthropicResponse>(
        "https://api.anthropic.com/v1/messages",
        {
          "x-api-key": settings.anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        {
          model: settings.anthropicModel,
          max_tokens: maxTokens,
          temperature: options.temperature ?? 0.2,
          system,
          messages: [{ role: "user", content: prompt }],
        },
      );
      if (response.error) throw new AiError(response.error.message ?? "Error de Anthropic", "anthropic");
      return (response.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("\n")
        .trim();
    }

    case "openai": {
      if (!settings.openaiApiKey) throw new AiError("Falta la API key de OpenAI.", "openai");
      const response = await post<OpenAiResponse>(
        "https://api.openai.com/v1/chat/completions",
        { Authorization: `Bearer ${settings.openaiApiKey}` },
        {
          model: settings.openaiModel,
          max_completion_tokens: maxTokens,
          temperature: options.temperature ?? 0.2,
          response_format: options.json ? { type: "json_object" } : undefined,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        },
      );
      if (response.error) throw new AiError(response.error.message ?? "Error de OpenAI", "openai");
      return response.choices?.[0]?.message?.content?.trim() ?? "";
    }

    case "ollama": {
      const response = await post<OllamaResponse>(
        `${settings.ollamaBaseUrl.replace(/\/$/, "")}/api/chat`,
        {},
        {
          model: settings.ollamaModel,
          stream: false,
          format: options.json ? "json" : undefined,
          options: { temperature: options.temperature ?? 0.2 },
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        },
      );
      if (response.error) throw new AiError(response.error, "ollama");
      return response.message?.content?.trim() ?? "";
    }

    default:
      throw new AiError(
        "No hay proveedor de IA configurado (modo heuristico).",
        "heuristic",
      );
  }
}

export function isLlmEnabled(): boolean {
  return aiStatus().provider !== "heuristic" && aiStatus().ready;
}

/** Extrae el primer objeto JSON de una respuesta que puede venir con texto extra. */
export function parseJsonResponse<T>(raw: string): T | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

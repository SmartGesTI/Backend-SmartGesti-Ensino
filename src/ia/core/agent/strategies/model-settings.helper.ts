/**
 * Helper para filtrar modelSettings baseado no modelo
 * Modelos GPT-5 não suportam o parâmetro temperature
 */

export interface ModelSettings {
  temperature?: number;
  maxTokens?: number;
  parallelToolCalls?: boolean;
  toolChoice?: 'auto' | 'required' | 'none' | string;
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
}

/**
 * Verifica se o modelo é GPT-5
 */
export function isGPT5Model(model?: string): boolean {
  if (!model) return false;
  return model.startsWith('gpt-5');
}

/**
 * Filtra modelSettings removendo parâmetros não suportados pelo modelo
 * Modelos GPT-5 não suportam temperature customizada
 */
export function filterModelSettings(
  model: string | undefined,
  modelSettings?: ModelSettings,
): ModelSettings | undefined {
  if (!modelSettings) return undefined;

  const filtered: ModelSettings = { ...modelSettings };

  // Remover temperature para modelos GPT-5
  if (isGPT5Model(model)) {
    delete filtered.temperature;
  }

  return filtered;
}

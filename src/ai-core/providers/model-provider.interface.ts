import { LanguageModel } from 'ai';

export interface IModelProvider {
  getModel(modelName?: string): LanguageModel;
  getProviderName(): 'openai' | 'anthropic' | 'google';
  isAvailable(): boolean;
}

export interface ModelProviderOptions {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

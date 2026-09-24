/**
 * Cliente REST isolado para comunicação com o Agente de IA.
 * Permite plugar facilmente um backend FastAPI, Cloud Functions, Ollama ou Gemini API.
 */

const AI_ENDPOINT_URL = process.env.EXPO_PUBLIC_AI_ENDPOINT_URL || 'https://api.asa-ai.fecap.br/v1/chat';
const AI_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY || '';

export const isAIExtConfigured = Boolean(
  process.env.EXPO_PUBLIC_AI_ENDPOINT_URL && !process.env.EXPO_PUBLIC_AI_ENDPOINT_URL.includes('mock')
);

export const aiClient = {
  async post<T = any>(endpoint: string, payload: any): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${AI_ENDPOINT_URL}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Erro na chamada da IA (${response.status}): ${response.statusText}`);
    }

    return response.json();
  },
};

export interface MensajeChat {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  mensaje: string;
  historial: MensajeChat[];
}

export interface ChatResponse {
  respuesta: string;
}
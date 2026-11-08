# 🚀 Como Integrar o Agente de IA no seu Front-end

Este backend FastAPI foi projetado para ser **extremamente simples de integrar** com qualquer framework (React, Vue, Next.js, Angular, React Native, Flutter, ou HTML puro).

---

## 📡 1. Endpoints Disponíveis

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| **POST** | `/api/chat` | Envia mensagem e recebe a resposta completa em JSON |
| **POST** | `/api/chat/stream` | Envia mensagem e recebe resposta com **Streaming em tempo real** (SSE) |
| **GET** | `/api/requerimentos` | Retorna catálogo de requerimentos (com suporte a busca `?q=passe`) |
| **GET** | `/api/sugestoes` | Retorna lista de perguntas frequentes para chips/botões |
| **GET** | `/api/health` | Status da API e modelo em execução |
| **GET** | `/docs` | Documentação interativa Swagger |

---

## 💻 2. Exemplo Simples com JavaScript / Fetch (Sem Streaming)

```javascript
async function perguntarAoAgente(mensagem, historico = []) {
  const response = await fetch('http://localhost:8000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: mensagem,
      history: historico // Ex: [{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }]
    })
  });

  const data = await response.json();
  console.log('Resposta:', data.response);
  return data.response;
}
```

---

## ⚡ 3. Exemplo com Streaming (Efeito de digitação suave)

```javascript
async function perguntarComStreaming(mensagem, onChunkReceived) {
  const response = await fetch('http://localhost:8000/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: mensagem })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.chunk) {
            onChunkReceived(parsed.chunk);
          }
        } catch (e) {}
      }
    }
  }
}

// Exemplo de uso:
let textoAcumulado = "";
perguntarComStreaming("Como peço passe escolar?", (chunk) => {
  textoAcumulado += chunk;
  document.getElementById("meu-chat").innerText = textoAcumulado;
});
```

---

## ⚛️ 4. Exemplo em React / Next.js

Confira o arquivo pronto [ReactChat.jsx](./ReactChat.jsx). Você pode simplesmente importá-lo no seu projeto:

```jsx
import ReactChat from './ReactChat';

export default function PaginaAtendimento() {
  return (
    <div>
      <h1>Atendimento Acadêmico</h1>
      <ReactChat />
    </div>
  );
}
```

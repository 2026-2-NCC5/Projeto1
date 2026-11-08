// static/app.js

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const suggestionsContainer = document.getElementById("suggestionsContainer");

// Elementos do Menu Hamburguer Drawer
const menuOverlay = document.getElementById("menuOverlay");
const menuDrawer = document.getElementById("menuDrawer");
const openDrawerBtn = document.getElementById("openDrawerBtn");
const openDrawerPillBtn = document.getElementById("openDrawerPillBtn");
const closeDrawerBtn = document.getElementById("closeDrawerBtn");

// Histórico de conversas local
let conversationHistory = [];
let isGenerating = false;

// Inicializa a aplicação
document.addEventListener("DOMContentLoaded", () => {
  carregarSugestoes();
  configurarDrawer();
  chatInput.focus();

  // Auto-resize do textarea
  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
    sendBtn.disabled = !chatInput.value.trim() || isGenerating;
  });

  // Enviar com Enter (sem Shift)
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) {
        enviarMensagem();
      }
    }
  });

  sendBtn.addEventListener("click", () => enviarMensagem());
});

// Configuração do Drawer (Menu Hamburguer)
function configurarDrawer() {
  const abrirMenu = () => {
    menuDrawer.classList.add("active");
    menuOverlay.classList.add("active");
  };

  const fecharMenu = () => {
    menuDrawer.classList.remove("active");
    menuOverlay.classList.remove("active");
  };

  if (openDrawerBtn) openDrawerBtn.addEventListener("click", abrirMenu);
  if (openDrawerPillBtn) openDrawerPillBtn.addEventListener("click", abrirMenu);
  if (closeDrawerBtn) closeDrawerBtn.addEventListener("click", fecharMenu);
  if (menuOverlay) menuOverlay.addEventListener("click", fecharMenu);

  // Ações nos botões de dentro do menu
  document.querySelectorAll(".drawer-item").forEach((item) => {
    item.addEventListener("click", () => {
      const query = item.getAttribute("data-query") || item.textContent.trim();
      fecharMenu();
      chatInput.value = query;
      chatInput.style.height = "auto";
      sendBtn.disabled = false;
      enviarMensagem(query);
    });
  });
}

// Busca sugestões de perguntas frequentes do backend para a barra horizontal
async function carregarSugestoes() {
  try {
    const res = await fetch("/api/sugestoes");
    const data = await res.json();
    if (data.sugestoes && data.sugestoes.length > 0) {
      suggestionsContainer.innerHTML = "";
      
      // Botão atalho para abrir o menu completo
      const menuTrigger = document.createElement("button");
      menuTrigger.className = "chip-btn";
      menuTrigger.style.background = "#005a36";
      menuTrigger.style.color = "#ffffff";
      menuTrigger.innerHTML = "☰ Ver Categorias";
      menuTrigger.onclick = () => {
        menuDrawer.classList.add("active");
        menuOverlay.classList.add("active");
      };
      suggestionsContainer.appendChild(menuTrigger);

      data.sugestoes.forEach((sugestao) => {
        const btn = document.createElement("button");
        btn.className = "chip-btn";
        btn.textContent = sugestao;
        btn.onclick = () => {
          chatInput.value = sugestao;
          chatInput.style.height = "auto";
          sendBtn.disabled = false;
          enviarMensagem(sugestao);
        };
        suggestionsContainer.appendChild(btn);
      });
    }
  } catch (err) {
    console.warn("Não foi possível carregar sugestões:", err);
  }
}

// Cria elemento de mensagem no DOM
function adicionarMensagemDOM(role, textoInicial = "") {
  const row = document.createElement("div");
  row.className = `message-row ${role === "user" ? "user" : "bot"}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "👤" : "🎓";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  if (role === "user") {
    bubble.textContent = textoInicial;
  } else {
    bubble.innerHTML = renderMarkdown(textoInicial);
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatMessages.appendChild(row);
  scrollToBottom();

  return bubble;
}

// Renderiza Markdown simples caso marked não esteja disponível
function renderMarkdown(text) {
  if (window.marked && typeof window.marked.parse === "function") {
    return window.marked.parse(text);
  }
  return text.replace(/\n/g, "<br>");
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Envia mensagem usando Streaming SSE
async function enviarMensagem(textoDireto = null) {
  const texto = (textoDireto || chatInput.value).trim();
  if (!texto || isGenerating) return;

  isGenerating = true;
  chatInput.value = "";
  chatInput.style.height = "auto";
  sendBtn.disabled = true;

  // Adiciona a mensagem do usuário
  adicionarMensagemDOM("user", texto);
  conversationHistory.push({ role: "user", content: texto });

  // Cria bolha de resposta do bot vazia com indicador de loading
  const botBubble = adicionarMensagemDOM("bot", "");
  botBubble.innerHTML = `
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
  `;

  let respostaCompleta = "";
  let iniciouRecebimento = false;

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: texto,
        history: conversationHistory.slice(0, -1), // histórico anterior
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na API (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") {
            break;
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.chunk) {
              if (!iniciouRecebimento) {
                botBubble.innerHTML = "";
                iniciouRecebimento = true;
              }
              respostaCompleta += parsed.chunk;
              botBubble.innerHTML = renderMarkdown(respostaCompleta);
              scrollToBottom();
            } else if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            // Ignora JSON incompleto
          }
        }
      }
    }

    if (!respostaCompleta && !iniciouRecebimento) {
      botBubble.innerHTML = "Não obtive resposta. Tente novamente.";
    }

    conversationHistory.push({ role: "assistant", content: respostaCompleta });
  } catch (error) {
    console.error("Erro na requisição:", error);
    botBubble.innerHTML = `<span style="color: #e53e3e;">⚠️ Desculpe, ocorreu um erro ao conectar ao assistente: ${error.message}</span>`;
  } finally {
    isGenerating = false;
    sendBtn.disabled = !chatInput.value.trim();
    chatInput.focus();
  }
}

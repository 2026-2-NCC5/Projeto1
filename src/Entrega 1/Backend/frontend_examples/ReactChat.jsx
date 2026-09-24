import React, { useState, useRef, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:8000';

const CATEGORIAS_PERGUNTAS = {
  requerimentos: [
    { label: '🎫 Passe Escolar / SPTrans', query: 'Como solicitar o Passe Escolar / SPTrans?' },
    { label: '⏸️ Trancamento de Curso', query: 'Como pedir trancamento de curso e qual o prazo?' },
    { label: '📄 2ª Via do Histórico', query: 'Como emitir a 2ª via do histórico escolar?' },
    { label: '📝 Revisão de Nota (PEDP)', query: 'Como solicitar a revisão de nota/prova (PEDP)?' },
    { label: '🎓 Certificado de Conclusão', query: 'Como obter o certificado de conclusão de curso?' },
    { label: '🔄 Transferência de Curso', query: 'Como abrir requerimento de transferência de curso?' },
    { label: '💳 Solicitação de Boleto', query: 'Como solicitar boleto no portal?' }
  ],
  ccomp: [
    { label: '🖥️ CCOMP 2º Semestre (2NA)', query: 'Quero os horários de CCOMP 2NA' },
    { label: '🖥️ CCOMP 3º Semestre (3NA)', query: 'Quero os horários de CCOMP 3NA' },
    { label: '🖥️ CCOMP 4º Semestre (4NA)', query: 'Quero os horários de CCOMP 4' },
    { label: '🖥️ CCOMP 5º Semestre (5NA)', query: 'Quero os horários de CCOMP 5NA' },
    { label: '🖥️ CCOMP 6º Semestre (6NA)', query: 'Quero os horários de CCOMP 6NA' },
    { label: '🖥️ CCOMP 7º Semestre (7NA)', query: 'Quero os horários de CCOMP 7NA' },
    { label: '🖥️ CCOMP 8º Semestre (8NA)', query: 'Quero os horários de CCOMP 8NA' }
  ],
  ads: [
    { label: '📱 ADS 1º Semestre (1NA)', query: 'Quero os horários de ADS 1NA' },
    { label: '📱 ADS 2º Semestre (2NA)', query: 'Quero os horários de ADS 2NA' },
    { label: '📱 ADS 3º Semestre (3NA)', query: 'Quero os horários de ADS 3NA' },
    { label: '📱 ADS 4º Semestre (4NA)', query: 'Quero os horários de ADS 4NA' }
  ],
  adm: [
    { label: '📊 ADM 1º Semestre (1NA)', query: 'Quais os horários de 1NA de Administração?' },
    { label: '📊 ADM 2º Semestre (2NA)', query: 'Quais os horários de 2NA de Administração?' },
    { label: '📊 ADM 3º Semestre (3NA)', query: 'Quais os horários de 3NA de Administração?' },
    { label: '📊 ADM 4º Semestre (4NA)', query: 'Quais os horários de 4NA de Administração?' },
    { label: '📊 ADM 5º Semestre (5NA)', query: 'Quais os horários de 5NA de Administração?' },
    { label: '📊 ADM 6º Semestre (6NA)', query: 'Quais os horários de 6NA de Administração?' }
  ]
};

export default function ChatAcademico() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Olá! Sou o assistente SISA da FECAP. Posso te orientar sobre requerimentos acadêmicos e grades de horários. Como posso te ajudar?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/sugestoes`)
      .then((res) => res.json())
      .then((data) => setSugestoes(data.sugestoes || []))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    setInput('');
    setLoading(true);
    setDrawerOpen(false);

    const userMessage = { role: 'user', content: text };
    const historyPayload = messages;

    setMessages((prev) => [
      ...prev,
      userMessage,
      { role: 'assistant', content: '' }
    ]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload
        })
      });

      if (!response.ok) throw new Error('Erro no servidor');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';

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
              const data = JSON.parse(dataStr);
              if (data.chunk) {
                accumulatedText += data.chunk;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: accumulatedText
                  };
                  return updated;
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: '⚠️ Ocorreu um erro ao buscar resposta.'
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Menu Drawer Lateral */}
      {drawerOpen && (
        <div style={styles.overlay} onClick={() => setDrawerOpen(false)}>
          <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.drawerHeader}>
              <h4>⚡ Perguntas Rápidas</h4>
              <button style={styles.closeBtn} onClick={() => setDrawerOpen(false)}>✕</button>
            </div>
            <div style={styles.drawerBody}>
              <h5>📋 Requerimentos</h5>
              {CATEGORIAS_PERGUNTAS.requerimentos.map((item, i) => (
                <button key={i} style={styles.drawerItem} onClick={() => handleSendMessage(item.query)}>
                  {item.label}
                </button>
              ))}

              <h5 style={{ marginTop: '14px' }}>💻 Ciência da Computação (CCOMP)</h5>
              {CATEGORIAS_PERGUNTAS.ccomp.map((item, i) => (
                <button key={i} style={styles.drawerItem} onClick={() => handleSendMessage(item.query)}>
                  {item.label}
                </button>
              ))}

              <h5 style={{ marginTop: '14px' }}>⚙️ ADS</h5>
              {CATEGORIAS_PERGUNTAS.ads.map((item, i) => (
                <button key={i} style={styles.drawerItem} onClick={() => handleSendMessage(item.query)}>
                  {item.label}
                </button>
              ))}

              <h5 style={{ marginTop: '14px' }}>📈 Administração</h5>
              {CATEGORIAS_PERGUNTAS.adm.map((item, i) => (
                <button key={i} style={styles.drawerItem} onClick={() => handleSendMessage(item.query)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <button style={styles.menuBtn} onClick={() => setDrawerOpen(true)} title="Menu de Perguntas">
          ☰
        </button>
        <h3 style={{ margin: 0 }}>🎓 SISA - FECAP</h3>
        <button style={styles.pillBtn} onClick={() => setDrawerOpen(true)}>
          ⚡ Perguntas Rápidas
        </button>
      </div>

      {/* Mensagens */}
      <div style={styles.messagesContainer}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              ...styles.messageBubble,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: msg.role === 'user' ? '#005a36' : '#f0f4f2',
              color: msg.role === 'user' ? '#fff' : '#222'
            }}
          >
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Sugestões Bar */}
      {sugestoes.length > 0 && (
        <div style={styles.suggestionsContainer}>
          <button style={{ ...styles.chip, background: '#005a36', color: '#fff' }} onClick={() => setDrawerOpen(true)}>
            ☰ Ver Categorias
          </button>
          {sugestoes.map((sug, idx) => (
            <button key={idx} style={styles.chip} onClick={() => handleSendMessage(sug)} disabled={loading}>
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={styles.inputContainer}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Digite sua dúvida sobre horários ou requerimentos..."
          style={styles.input}
          disabled={loading}
        />
        <button onClick={() => handleSendMessage()} style={styles.sendButton} disabled={loading || !input.trim()}>
          {loading ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '750px',
    margin: '20px auto',
    height: '650px',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    fontFamily: 'sans-serif',
    position: 'relative'
  },
  header: {
    backgroundColor: '#005a36',
    color: '#fff',
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  menuBtn: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '18px',
    cursor: 'pointer'
  },
  pillBtn: {
    background: 'rgba(255,255,255,0.25)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    padding: '5px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 50
  },
  drawer: {
    width: '280px',
    height: '100%',
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '2px 0 10px rgba(0,0,0,0.2)'
  },
  drawerHeader: {
    backgroundColor: '#005a36',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer'
  },
  drawerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  drawerItem: {
    textAlign: 'left',
    padding: '8px 10px',
    backgroundColor: '#f8faf9',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  messagesContainer: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  messageBubble: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: '16px',
    lineHeight: '1.5'
  },
  suggestionsContainer: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    padding: '8px 16px',
    borderTop: '1px solid #eee'
  },
  chip: {
    backgroundColor: '#e8f5ed',
    color: '#005a36',
    border: '1px solid #005a36',
    borderRadius: '16px',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  inputContainer: {
    display: 'flex',
    padding: '12px 16px',
    borderTop: '1px solid #eee',
    gap: '8px'
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    outline: 'none',
    fontSize: '14px'
  },
  sendButton: {
    backgroundColor: '#005a36',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0 18px',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
};

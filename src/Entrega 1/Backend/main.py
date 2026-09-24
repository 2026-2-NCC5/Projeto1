# main.py
import sys
import uvicorn
from agent import agente_academico

def iniciar_chat_cli():
    print("[SISA - FECAP] Assistente Iniciado (Modo Terminal)")
    print("Digite sua duvida sobre requerimentos (ou 'sair' para encerrar):\n")
    
    historico = []
    while True:
        try:
            duvida = input("Aluno: ")
        except (KeyboardInterrupt, EOFError):
            break
            
        if duvida.lower() in ["sair", "exit", "quit"]:
            break
        
        historico.append({"role": "user", "content": duvida})
        resposta = agente_academico.run(historico)
        historico.append({"role": "assistant", "content": resposta})
        print(f"\nAssistente:\n{resposta}\n" + "-"*50)

def iniciar_servidor_web():
    print("=" * 60)
    print("Servidor do Agente SISA FECAP Iniciado!")
    print("Interface Web:        http://localhost:8000")
    print("Documentacao Swagger: http://localhost:8000/docs")
    print("=" * 60)
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    if "--cli" in sys.argv:
        iniciar_chat_cli()
    else:
        iniciar_servidor_web()
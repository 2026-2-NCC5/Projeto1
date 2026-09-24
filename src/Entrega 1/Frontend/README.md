# 📱 ASA Mobile - Frontend (React Native & Expo)

Aplicativo móvel institucional desenvolvido com React Native e Expo SDK 57 para discentes, docentes, pais e funcionários da FECAP.

## 📁 Estrutura de Arquivos

* `App.tsx`: Componente raiz da aplicação com provedores de contexto (`AuthContext`, `AppContext`).
* `index.ts`: Ponto de entrada do Expo.
* `app.json`: Configuração central do aplicativo Expo (ícones, splash, esquemas).
* `eas.json`: Configuração de builds e compilações Expo Application Services.
* `tsconfig.json`: Configuração do TypeScript.
* `assets/`: Ícones e imagens do aplicativo (ícone adaptativo, splash, favicon).
* `src/`: Código-fonte da aplicação React Native:
  * `components/`: Componentes modulares (cards, botões, modais, tabBar, feedback).
  * `navigation/`: Navegação por abas e pilhas (`AppNavigator`, `MainTabNavigator`).
  * `screens/`: Telas organizadas por domínio (auth, home, ai, education, documents, profile).
  * `services/`: Serviços de integração (Supabase, IA/Groq, RAG local e remoto).
  * `store/`: Gerenciamento de estado global via React Context API.
  * `theme/`: Paleta de cores, tipografia e espaçamentos institucionais.
  * `utils/`: Utilitários, constantes, validadores e armazenamento seguro.

## 🚀 Como Executar

### 1. Instalar Dependências (se necessário)
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie `.env.example` para `.env` e defina suas chaves:
```bash
cp .env.example .env
```

### 3. Executar o Projeto
```bash
# Iniciar servidor de desenvolvimento Expo
npm start

# Abrir no navegador web
npm run web

# Abrir no emulador Android
npm run android

# Conectar e rodar servidor do backend
npm run backend:server
```

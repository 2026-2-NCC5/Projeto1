# 📱 ASA Mobile - Frontend (React Native & Expo)

Aplicativo móvel institucional desenvolvido com React Native e ecossistema Expo para Alunos e Funcionários da Área do Sucesso Alvarista (ASA) da FECAP.

## 📁 Estrutura de Arquivos

* `App.tsx`: Componente raiz com provedores de contexto (`AuthContext`, `AppContext`).
* `index.ts`: Ponto de entrada do runtime Expo.
* `app.json` & `app.config.js`: Configurações do Expo (identidade visual, splash, permissões Android/iOS e push notifications).
* `eas.json`: Perfis de compilação EAS (Expo Application Services) para builds em nuvem e APKs.
* `metro.config.js`: Configuração do bundler Metro com suporte a SVG (`react-native-svg-transformer`).
* `tsconfig.json`: Configuração do compilador TypeScript com tipagem estrita.
* `assets/`: Ícones e splash screen adaptativos.
* `src/`: Código-fonte da aplicação React Native:
  * `components/`: Componentes modulares reutilizáveis (cards, botões, modais, tabBar, feedback).
  * `navigation/`: Navegação tipada por rotas (Stack Navigator e Bottom Tabs).
  * `screens/`: Telas organizadas por domínio:
    * `ai/`: Chat conversacional com o Agente SISA (Groq + RAG + Intenções).
    * `auth/`: Login, cadastro, recuperação de senha e seleção de papéis.
    * `documents/`: Consulta ao acervo de regulamentos e upload de comprovantes.
    * `home/`: Dashboards dinâmicos conforme o perfil (`Aluno` e `Funcionário`).
    * `onboarding/`: Telas introdutórias e apresentação da plataforma.
    * `profile/`: Perfil do usuário, cálculo de distância até o Campus Liberdade e tema (Dark/Light).
    * `staff/`: Gestão de atendimento da Central CAA, triagem e busca de discentes.
    * `student/`: Timeline e acompanhamento detalhado de requerimentos acadêmicos.
  * `services/`: Serviços de integração:
    * `ai-agent/`: Clientes Groq, RAG local e sintetizador da base de conhecimento.
    * `supabase/`: Autenticação, banco de dados relacional, chamadas Realtime e Storage.
    * `notifications/`: Registro de push tokens e recebimento de notificações móveis.
  * `store/`: Gerenciamento de estado global via React Context API (`AuthContext`, `AppContext`).
  * `theme/`: Paleta de cores oficial FECAP (Dark/Light), tipografia e escalonamento.
  * `utils/`: Utilitários, validadores, formatadores e persistência segura.
* `supabase/`: Infraestrutura de banco de dados e backend em nuvem:
  * `migrations/`: Histórico cronológico de migrações SQL (tabelas, índices, RLS e Realtime).
  * `functions/`: Edge Functions em Deno (despacho de notificações push e registro validado).
  * `schema.sql`: Estrutura consolidada do banco PostgreSQL.

## 🚀 Como Executar

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie `.env.example` para `.env` e defina suas chaves:
```bash
cp .env.example .env
```

### 3. Executar a Aplicação
```bash
# Iniciar o servidor de desenvolvimento Expo
npm start

# Executar na Web
npm run web

# Executar no Android (emulador ou dispositivo)
npm run android

# Executar o Backend em paralelo
npm run backend:server
```

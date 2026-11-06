# **Grupo 1 - SISA (Sistema Inteligente do Sucesso Alvarista)**
## Aplicação de Álgebra Linear Avançada no Agente de IA
- Aplicação de conceitos avançados de Álgebra Linear para analisar ou melhorar o agente com base na Entraga 1.
---

### 1. Onde esse conceito aparece no projeto?
No projeto SISA (Sistema Inteligente do Sucesso Alvarista), o agente de IA opera com um mecanismo de **RAG (Retrieval-Augmented Generation)** com um objetivo principal de negócio: **aumentar a Taxa de Deflexão de Atendimento**.

> **O que é Taxa de Deflexão?**  
> É o percentual de dúvidas acadêmicas, financeiras e regulatórias que o agente resolve de forma autônoma e precisa, evitando que o aluno precise abrir requerimento ou enfrentar filas no ASA ou na Secretaria.

Na etapa anterior (Entrega 1), dividimos os documentos oficiais da FECAP em chunks e geramos embeddings para cada um. Cada um dos **257 chunks de documentos oficiais** está indexado como um vetor, onde cada dimensão representa um eixo temático institucional (*Bolsas, Rematrícula, Provas, Horários, etc.*).

---

### 2. O Problema Identificado: A Anisotropia ("O Efeito Cone")
No espaço original de embeddings, os vetores sofrem de um defeito geométrico conhecido como **Anisotropia**. Os textos ficam espremidos num cone estreito com média deslocada da origem, fazendo com que o cosseno entre tópicos completamente diferentes (ex.: *"Rematrícula"* vs *"Horário de Aula"*) chegue a **0.92**.

O sistema enxergava esses dois textos como quase idênticos, mesmo que na realidade tratem de assuntos completamente distintos. Por esse motivo, o agente ficava matematicamente inseguro, recorrendo a mensagens genéricas de fallback (*"Procure a secretaria..."*) ou alucinando regras, **o que derrubava a taxa de deflexão e manteria as filas do ASA cheias**.

---

### 3. O Conceito Avançado de Álgebra Linear Escolhido
Para restaurar a confiança matemática do agente e elevar a taxa de deflexão, aplicamos:

- **Matriz de Covariância**: Mede a dispersão de cada um dos 12 eixos temáticos e avalia como eles variam conjuntamente no espaço vetorial.
- **Autovalores e Autovetores**: Os autovetores definem as direções fundamentais de dispersão da informação, enquanto os autovalores quantificam o volume dessa variância em cada direção.
- **Transformação Linear de Isotropização Espectral (ZCA Whitening)**: Transformação linear que centraliza e equaliza a distribuição dos dados, "esfericizando" a nuvem de pontos para eliminar o cone de redundância e descorrelacionar as dimensões.
- **Redução de Dimensionalidade por Projeção Ortogonal**: Projeção direta sobre o plano formado pelos dois primeiros autovetores, permitindo mapear visualmente a separação clara entre os temas.

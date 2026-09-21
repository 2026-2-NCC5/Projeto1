# **Grupo 1 - SISA (Sistema Inteligente do Sucesso Alvarista): RAG**
Nosso grupo optou por fazer uso de um RAG, Retrieval-Augmented Generation (Geração Aumentada por Recuperação), fazendo o upload e processamento de PDF's para treinamento de um agente de IA, gerando embeddings vetoriais com **FastEmbed** e calculando operações de Álgebra Linear para mostrar o quão precisa são as informações encontradas com base nas perguntas realizadas pelo usuário.

As bases de conhecimento (textos de manuais, editais ou guias) e as perguntas feitas pelos usuários foram transformadas em vetores numéricos de 384 dimensões.

Deixamos dois PDF's no GitHub acompanhado da entrega para que possa testar o funcionamento do agente de forma prática.

Quisemos trazer também uma demonstração visual de como isso funciona e se comporta em um gráfico:

* **Bolinhas Cinzas:** Representam todo o conhecimento disperso do seu PDF. Pontos muito próximos uns dos outros indicam frases que falam sobre temas similares.

* **Estrela Vermelha:** É a pergunta que você digitou.

* **Bolinhas Verdes:** É trechos que o algoritmo matemática identificou como a melhor resposta.

Para desenhar isso em um gráfico, aplicamos o PCA (Análise de Componentes Principais), um algoritmo que "esmaga" essas 384 dimensões em apenas 2 eixos (X e Y), preservando ao máximo a distância relativa entre os textos.


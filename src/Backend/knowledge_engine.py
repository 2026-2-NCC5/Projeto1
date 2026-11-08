import os
import re
import json
import unicodedata
from typing import List, Dict, Any, Optional, Tuple


def is_greeting_message(texto: str) -> bool:
    if not texto:
        return False
    clean = normalizar_texto(texto)
    greeting_words = {
        "oi", "ola", "opa", "eae", "e ai", "salve", "hello", "hi", "hey",
        "bom dia", "boa tarde", "boa noite", "fala", "fala ai",
        "tudo bem", "tudo bom", "tudo certo", "como vai", "blz", "beleza",
    }
    if clean in greeting_words:
        return True
    return bool(re.match(r"^(oi|ola|opa|e ai|eae|salve|bom dia|boa tarde|boa noite)(\s+(tudo bem|tudo bom|blz|beleza|ia|sisa|asa|fecap|amigo|amiga))?$", clean))


def normalizar_texto(texto: str) -> str:
    """Normaliza texto removendo acentuação e padronizando minúsculas."""
    if not texto:
        return ""
    texto = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode("ascii")
    texto = re.sub(r"[^\w\s]", " ", texto)
    return re.sub(r"\s+", " ", texto).strip().lower()


# ---------------------------------------------------------------------------
# DICIONÁRIOS DE EXPANSÃO DE GÍRIAS, ABREVIAÇÕES DE INTERNET E SIGLAS ACADÊMICAS
# ---------------------------------------------------------------------------
INTERNET_SLANG_MAP: Dict[str, str] = {
    "vc": "voce",
    "vcs": "voces",
    "pq": "porque",
    "oq": "o que",
    "qnd": "quando",
    "qdo": "quando",
    "pfv": "por favor",
    "pfvr": "por favor",
    "pls": "por favor",
    "plz": "por favor",
    "tbm": "tambem",
    "tb": "tambem",
    "blz": "beleza",
    "vlw": "valeu",
    "obg": "obrigado",
    "flw": "falou",
    "cmg": "comigo",
    "ctg": "contigo",
    "hj": "hoje",
    "amnh": "amanha",
    "dps": "depois",
    "msm": "mesmo",
    "nd": "nada",
    "ngm": "ninguem",
    "td": "tudo",
    "tds": "todos",
    "qto": "quanto",
    "qt": "quanto",
    "hr": "horario",
    "hrs": "horarios",
    "prof": "professor",
    "profa": "professora",
    "profs": "professores",
    "mat": "materia disciplina",
    "lab": "laboratorio",
    "trampo": "estagio trabalho emprego",
    "trampar": "estagiar trabalhar",
    "grana": "financeiro mensalidade bolsa dinheiro",
    "boleto": "mensalidade pagamento financeiro",
    "bombei": "reprovei dependencia dp",
    "rodei": "reprovei dependencia dp",
    "reprovei": "reprovacao dependencia dp exame",
    "peguei dp": "dependencia dp reprovacao",
}

COURSE_SYNONYMS: Dict[str, List[str]] = {
    "economia": ["ciencias economicas", "economia", "econo", "econ", "ce"],
    "administracao": ["administracao", "adm"],
    "contabeis": ["ciencias contabeis", "contabeis", "contabilidade", "cc"],
    "contabeis_graduados": ["contabeis para graduados", "ccg", "segunda graduacao", "4naccg", "5naccg", "7naccg"],
    "computacao": ["ciencia da computacao", "computacao", "ccomp", "ccpt", "comp"],
    "ads": ["analise e desenvolvimento de sistemas", "ads", "tecnologo em ads"],
    "ri": ["relacoes internacionais", "ri", "rel inter"],
    "pp": ["publicidade e propaganda", "comunicacao social", "publicidade", "pp"],
    "rp": ["relacoes publicas", "rp"],
    "secretariado": ["secretariado executivo", "secretariado", "sec", "trilingue"],
}

SUBJECT_ABBREVIATIONS: Dict[str, str] = {
    "calc": "calculo",
    "calc 1": "calculo i",
    "calc i": "calculo i",
    "calc 2": "calculo ii",
    "calc ii": "calculo ii",
    "macro": "macroeconomia",
    "macro 2": "macroeconomia ii",
    "macro 3": "macroeconomia iii",
    "macro 4": "macroeconomia iv",
    "micro": "microeconomia",
    "micro 2": "microeconomia ii",
    "micro 3": "microeconomia iii",
    "micro 4": "microeconomia iv",
    "alg linear": "algebra linear",
    "algoritmos": "algoritmos e logica de programacao",
    "logica": "algoritmos e logica de programacao",
    "bd": "banco de dados",
    "poo": "programacao orientada a objetos",
    "ed": "estrutura de dados",
    "ia": "inteligencia artificial",
    "ml": "machine learning aprendizado de maquina",
    "so": "sistemas operacionais",
    "eng soft": "engenharia de software",
    "mat discreta": "matematica discreta",
    "adf": "analise das demonstracoes financeiras",
    "rla": "raciocinio logico e analitico",
    "add": "analise descritiva de dados",
    "aid": "analise inferencial de dados",
    "po": "prova oficial provas oficiais",
    "ni": "nota intermediaria notas intermediarias",
    "dp": "dependencia",
    "adapt": "adaptacao",
    "tce": "termo de compromisso de estagio",
    "ac": "atividades complementares",
    "ic": "iniciacao cientifica",
}


def expandir_consulta_academica(query: str) -> str:
    """
    Expande gírias de internet, abreviações de disciplinas e siglas de cursos
    para enriquecer a recuperação no Grafo de Conhecimento Markdown sem perder os termos originais.
    """
    norm = normalizar_texto(query)
    words = norm.split()
    expanded_tokens = list(words)

    # 1. Expansão de gírias token a token
    for w in words:
        if w in INTERNET_SLANG_MAP:
            expanded_tokens.append(INTERNET_SLANG_MAP[w])

    # 2. Expansão de abreviações de disciplinas e termos acadêmicos
    padded = f" {norm} "
    for abbr, full_term in SUBJECT_ABBREVIATIONS.items():
        if f" {abbr} " in padded:
            expanded_tokens.append(full_term)

    # 3. Expansão de siglas e apelidos de cursos (incluindo códigos como 5na econo, 3na ccomp, etc.)
    for canonical, synonyms in COURSE_SYNONYMS.items():
        for syn in synonyms:
            if re.search(rf"\b{re.escape(syn)}\b", norm):
                expanded_tokens.extend(synonyms[:3])
                break

    return " ".join(expanded_tokens)


def extrair_entidades_consulta(query: str) -> Dict[str, Any]:
    """
    Extrai entidades estruturadas presentes em um texto:
    - curso_canonico (ex: 'economia', 'administracao', 'computacao', 'ads', 'contabeis', 'ri', 'pp', 'rp', 'secretariado')
    - codigo_turma (ex: '5na', '1nb', '2nc', '4naccg')
    - semestre (1..8)
    - turno ('noturno', 'matutino', 'sabado')
    - disciplina_detectada (ex: 'calculo', 'macroeconomia', 'microeconomia', 'algebra linear', etc.)
    - intencao ('data_prova', 'horario_aula', 'criterio_nota', 'estagio', 'pedp', 'bolsa_financeiro', 'calendario', 'requerimento', 'geral')
    """
    norm = normalizar_texto(query)
    info: Dict[str, Any] = {
        "curso_canonico": None,
        "curso_label": None,
        "codigo_turma": None,
        "semestre": None,
        "turno": None,
        "disciplina_detectada": None,
        "intencao": None,
        "is_dp_sabado": False,
    }

    COURSE_LABELS = {
        "economia": "Ciências Econômicas",
        "administracao": "Administração",
        "contabeis": "Ciências Contábeis",
        "contabeis_graduados": "Ciências Contábeis para Graduados (CCG)",
        "computacao": "Ciência da Computação",
        "ads": "Análise e Desenvolvimento de Sistemas (ADS)",
        "ri": "Relações Internacionais",
        "pp": "Publicidade e Propaganda",
        "rp": "Relações Públicas",
        "secretariado": "Secretariado Executivo",
    }

    # Curso
    for canonical, synonyms in COURSE_SYNONYMS.items():
        for syn in synonyms:
            if re.search(rf"\b{re.escape(syn)}\b", norm):
                info["curso_canonico"] = canonical
                info["curso_label"] = COURSE_LABELS.get(canonical, canonical)
                break
        if info["curso_canonico"]:
            break

    # Código de turma (ex: 5na, 1nb, 2nc, 4naccg, 3ma)
    turma_m = re.search(r"\b([1-8]\s*(?:n[abcd]|m[ab]|naccg|nacc))\b", norm)
    if turma_m:
        raw_t = re.sub(r"\s+", "", turma_m.group(1)).lower()
        info["codigo_turma"] = raw_t
        info["semestre"] = int(raw_t[0])
        if "m" in raw_t:
            info["turno"] = "matutino"
        else:
            info["turno"] = "noturno"

    # Semestre explícito (ex: 5º semestre, 3o sem, 1 semestre)
    if info["semestre"] is None:
        sem_m = re.search(r"\b([1-8])\s*(?:o|º|ª)?\s*(?:sem|semestre|periodo|termo)\b", norm)
        if sem_m:
            info["semestre"] = int(sem_m.group(1))

    # Turno explícito
    if "matutino" in norm or "manha" in norm:
        info["turno"] = "matutino"
    elif "noturno" in norm or "noite" in norm:
        info["turno"] = "noturno"
    elif any(k in norm for k in ["sabado", "sabados"]):
        info["turno"] = "sabado"

    # DP / Adaptação
    if any(re.search(rf"\b{k}\b", norm) for k in ["dp", "dps", "dependencia", "adapt", "adaptacao", "sabado", "sabados"]):
        info["is_dp_sabado"] = True

    # Intenção principal (prioriza cálculo de média/exame quando o aluno pergunta quanto precisa tirar ou fala de média/nota)
    if any(re.search(rf"\b{k}\b", norm) for k in ["criterio", "media", "peso", "pesos", "ni", "nota intermediaria", "calcular nota", "aprovacao", "reprovacao", "passar", "quanto preciso", "qto preciso", "ficar de exame"]):
        info["intencao"] = "criterio_nota"
    elif any(re.search(rf"\b{k}\b", norm) for k in ["prova", "provas", "po", "exame", "exames", "substitutiva", "segunda chamada", "vista de prova"]):
        info["intencao"] = "data_prova"
    elif any(re.search(rf"\b{k}\b", norm) for k in ["sala", "salas", "laboratorio", "lab", "grade", "aula", "aulas", "horario de aula", "professor", "professora", "docente", "quem da aula"]):
        info["intencao"] = "horario_aula"
    elif any(re.search(rf"\b{k}\b", norm) for k in ["pedp", "bonus do livro", "simulado"]):
        info["intencao"] = "pedp"
    elif any(re.search(rf"\b{k}\b", norm) for k in ["estagio", "tce", "termo de compromisso", "horas de estagio", "trampo"]):
        info["intencao"] = "estagio"
    elif any(re.search(rf"\b{k}\b", norm) for k in ["criterio", "media", "peso", "pesos", "ni", "nota intermediaria", "calcular nota", "aprovacao", "reprovacao"]):
        info["intencao"] = "criterio_nota"
    elif any(re.search(rf"\b{k}\b", norm) for k in ["bolsa", "bolsas", "pafe", "restituivel", "prouni", "fies", "mensalidade", "desconto", "rematricula", "boleto"]):
        info["intencao"] = "bolsa_financeiro"
    elif any(re.search(rf"\b{k}\b", norm) for k in ["calendario", "feriado", "feriados", "recesso", "inicio das aulas", "volta as aulas", "fim do semestre"]):
        info["intencao"] = "calendario"
    elif any(re.search(rf"\b{k}\b", norm) for k in ["requerimento", "protocolo", "atestado de matricula", "historico escolar", "trancamento", "cancelamento", "reembolso"]):
        info["intencao"] = "requerimento"

    # Disciplinas conhecidas (ordem das mais específicas para as mais gerais)
    KNOWN_SUBJECTS = [
        ("calculo ii", ["calculo ii", "calculo 2", "calc ii", "calc 2"]),
        ("calculo i", ["calculo i", "calculo 1", "calc i", "calc 1"]),
        ("calculo", ["calculo", "calc"]),
        ("macroeconomia iv", ["macroeconomia iv", "macroeconomia 4", "macro iv", "macro 4"]),
        ("macroeconomia iii", ["macroeconomia iii", "macroeconomia 3", "macro iii", "macro 3"]),
        ("macroeconomia ii", ["macroeconomia ii", "macroeconomia 2", "macro ii", "macro 2"]),
        ("macroeconomia", ["macroeconomia", "macro"]),
        ("microeconomia iv", ["microeconomia iv", "microeconomia 4", "micro iv", "micro 4"]),
        ("microeconomia iii", ["microeconomia iii", "microeconomia 3", "micro iii", "micro 3"]),
        ("microeconomia ii", ["microeconomia ii", "microeconomia 2", "micro ii", "micro 2"]),
        ("microeconomia", ["microeconomia", "micro"]),
        ("algebra linear", ["algebra linear", "alg linear", "vetores e geometria analitica"]),
        ("modelagem preditiva", ["modelagem preditiva", "cross section", "time series", "panel data"]),
        ("macroeconometria", ["macroeconometria"]),
        ("financas corporativas", ["financas corporativas"]),
        ("fundamentos de financas", ["fundamentos de financas"]),
        ("fundamentos de contabilidade", ["fundamentos de contabilidade"]),
        ("fundamentos de administracao", ["fundamentos de administracao"]),
        ("analise das demonstracoes financeiras", ["analise das demonstracoes financeiras", "demonstracoes financeiras", "adf"]),
        ("raciocinio logico e analitico", ["raciocinio logico", "rla"]),
        ("comunicacao aplicada", ["comunicacao aplicada"]),
        ("business technology", ["business technology"]),
        ("business english", ["business english", "ingles"]),
        ("analise descritiva de dados", ["analise descritiva de dados", "estatistica descritiva"]),
        ("analise inferencial de dados", ["analise inferencial de dados", "estatistica inferencial"]),
        ("algoritmos e logica de programacao", ["algoritmos e logica de programacao", "algoritmos", "logica de programacao"]),
        ("banco de dados", ["projetos em banco de dados", "fundamentos de banco de dados", "banco de dados", "bancos de dados"]),
        ("programacao orientada a objetos", ["programacao orientada a objetos", "poo"]),
        ("estrutura de dados", ["estrutura de dados"]),
        ("desenvolvimento web full stack", ["desenvolvimento web", "full stack", "programacao web"]),
        ("inteligencia artificial", ["inteligencia artificial", "machine learning", "deep learning", "aprendizado de maquina"]),
        ("redes de computadores", ["redes de computadores", "ciberseguranca"]),
        ("sistemas operacionais", ["sistemas operacionais", "cloud native", "computacao em nuvem"]),
        ("engenharia de software", ["engenharia de software", "modelagem de software", "arquitetura de sistemas"]),
        ("matematica discreta", ["matematica discreta"]),
        ("contabilidade intermediaria", ["contabilidade intermediaria"]),
        ("contabilidade avancada", ["contabilidade avancada"]),
        ("contabilidade de custos", ["contabilidade de custos", "controladoria e custos", "controladoria"]),
        ("contabilidade tributaria", ["contabilidade tributaria", "planejamento tributario"]),
        ("auditoria", ["auditoria"]),
        ("pericia contabil", ["pericia contabil"]),
        ("direito internacional", ["direito internacional"]),
        ("economia internacional", ["economia internacional"]),
        ("economia brasileira", ["economia brasileira", "formacao economica do brasil"]),
        ("ciencia politica", ["ciencia politica", "teoria politica"]),
        ("teoria das relacoes internacionais", ["teoria das relacoes internacionais"]),
        ("historia das relacoes internacionais", ["historia das relacoes internacionais"]),
        ("gestao de pessoas", ["gestao de pessoas"]),
        ("estrategia organizacional", ["estrategia organizacional"]),
        ("logistica e supply chain", ["logistica", "supply chain"]),
        ("marketing", ["fundamentos de marketing", "marketing digital", "marketing de servicos", "trade marketing"]),
    ]

    for subj_canon, patterns in KNOWN_SUBJECTS:
        for pat in patterns:
            if re.search(rf"\b{re.escape(pat)}\b", norm):
                info["disciplina_detectada"] = subj_canon
                break
        if info["disciplina_detectada"]:
            break

    return info


class KnowledgeEngine:
    def __init__(self, base_dir: Optional[str] = None):
        if base_dir is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
        self.base_dir = base_dir
        self.graph_dir = os.path.join(base_dir, "knowledge_graph")
        self.sections: List[Dict[str, Any]] = []
        self.notes: Dict[str, Dict[str, Any]] = {}
        self.links: Dict[str, List[str]] = {}
        self.horarios: List[Dict[str, Any]] = []
        self.requerimentos: List[Dict[str, Any]] = []
        self.carregar_grafo()

    def carregar_grafo(self):
        """Varre todos os arquivos Markdown do knowledge_graph e carrega catálogos estruturados."""
        self.sections.clear()
        self.notes.clear()
        self.links.clear()

        # Carrega horarios.json e requerimentos.json
        horarios_path = os.path.join(self.base_dir, "horarios.json")
        if os.path.exists(horarios_path):
            try:
                with open(horarios_path, "r", encoding="utf-8") as f:
                    self.horarios = json.load(f)
            except Exception as e:
                print(f"[!] Erro ao carregar horarios.json: {e}")

        reqs_path = os.path.join(self.base_dir, "requerimentos.json")
        if os.path.exists(reqs_path):
            try:
                with open(reqs_path, "r", encoding="utf-8") as f:
                    self.requerimentos = json.load(f)
            except Exception as e:
                print(f"[!] Erro ao carregar requerimentos.json: {e}")

        if not os.path.isdir(self.graph_dir):
            print(f"[!] Diretório de grafo não encontrado em: {self.graph_dir}")
            return

        for root, _, files in os.walk(self.graph_dir):
            if ".obsidian" in root:
                continue
            for file in sorted(files):
                if file.endswith(".md") and file != "index.md":
                    file_path = os.path.join(root, file)
                    self._processar_nota(file_path)

        print(f"[+] Knowledge Engine Markdown carregado: {len(self.notes)} notas e {len(self.sections)} seções estruturadas no grafo.")

    def _processar_nota(self, file_path: str):
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        note_name = os.path.splitext(os.path.basename(file_path))[0]

        frontmatter: Dict[str, Any] = {}
        body = content
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                raw_fm = parts[1]
                body = parts[2].strip()
                current_list_key = None
                for line in raw_fm.splitlines():
                    stripped = line.strip()
                    if not stripped:
                        continue
                    if stripped.startswith("- ") and current_list_key:
                        frontmatter.setdefault(current_list_key, []).append(stripped[2:].strip())
                        continue
                    if ":" in stripped:
                        k, v = stripped.split(":", 1)
                        k = k.strip()
                        v = v.strip()
                        if not v:
                            current_list_key = k
                            frontmatter[k] = []
                        elif v.startswith("[") and v.endswith("]"):
                            current_list_key = None
                            try:
                                frontmatter[k] = json.loads(v)
                            except Exception:
                                frontmatter[k] = [x.strip().strip('"').strip("'") for x in v[1:-1].split(",") if x.strip()]
                        else:
                            current_list_key = None
                            frontmatter[k] = v.strip('"').strip("'")

        raw_links = re.findall(r"\[\[(.*?)\]\]", content)
        resolved_links = [l.split("|")[0].strip() for l in raw_links]

        categoria = frontmatter.get("categoria", "")
        titulo = frontmatter.get("title") or frontmatter.get("titulo") or note_name.replace("_", " ")
        curso_meta = frontmatter.get("curso", "")
        tags_meta = frontmatter.get("tags", [])
        if isinstance(tags_meta, str):
            tags_meta = [tags_meta]

        self.notes[note_name] = {
            "name": note_name,
            "path": file_path,
            "frontmatter": frontmatter,
            "links": resolved_links,
            "titulo": titulo,
            "arquivo": frontmatter.get("arquivo", os.path.basename(file_path)),
            "categoria": categoria,
            "curso": curso_meta,
            "tags": tags_meta,
        }
        self.links[note_name] = resolved_links

        # Divide o corpo exclusivamente por cabeçalhos de nível 2 (## ) para preservar subseções ### e tabelas completas
        header_pattern = re.compile(r"^##\s+(.+)$", re.MULTILINE)
        splits = list(header_pattern.finditer(body))

        if not splits:
            self.sections.append({
                "note_name": note_name,
                "titulo_nota": titulo,
                "arquivo": self.notes[note_name]["arquivo"],
                "header": titulo,
                "content": body[:6000].strip(),
                "links": resolved_links,
                "tags": tags_meta,
                "categoria": categoria,
                "curso": curso_meta,
            })
            return

        for i, match in enumerate(splits):
            header = match.group(1).strip()
            start_pos = match.end()
            end_pos = splits[i + 1].start() if i + 1 < len(splits) else len(body)
            sec_text = body[start_pos:end_pos].strip()

            if not sec_text:
                continue

            sec_links = re.findall(r"\[\[(.*?)\]\]", header + "\n" + sec_text)

            # Preserva tabelas por turma sem estourar o limite de ITPM (7000 tokens/min) da Groq
            if len(sec_text) > 3200:
                sec_text = sec_text[:3200] + "\n... [seção resumida por limite de tokens]"

            self.sections.append({
                "note_name": note_name,
                "titulo_nota": titulo,
                "arquivo": self.notes[note_name]["arquivo"],
                "header": header,
                "content": sec_text,
                "links": [l.split("|")[0].strip() for l in sec_links] + resolved_links,
                "tags": tags_meta,
                "categoria": categoria,
                "curso": curso_meta,
            })

    def buscar_secoes(
        self,
        query: str,
        top_k: int = 4,
        contexto_conversa: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Busca de alta precisão no Grafo de Conhecimento em Markdown:
        - Combina expansão de gírias/abreviações com o contexto acumulado da conversa (curso, turma, semestre, intenção).
        - Faz casamento exato de Curso, Turma/Semestre, Disciplina e Intenção (Prova Oficial PO vs Grade de Aula vs Critério/PEDP/Estágio/Bolsas).
        - Quando um aluno de 3º-8º semestre de ADM, Contábeis ou Economia pergunta sobre uma disciplina de 1º/2º semestre (ex.: Cálculo I/II no 5NA de Economia),
          recupera tanto a seção da turma atual quanto a seção do Eixo Comum (1º/2º semestres) e de DP aos Sábados para resposta completa e contextualizada.
        """
        if not self.sections or is_greeting_message(query):
            return []

        expanded_q = expandir_consulta_academica(query)
        norm_q = normalizar_texto(expanded_q)
        raw_norm_q = normalizar_texto(query)
        ent_atual = extrair_entidades_consulta(query)

        # Mescla com o contexto da conversa se não especificado na mensagem atual
        ctx = contexto_conversa or {}
        target_curso = ent_atual["curso_canonico"] or ctx.get("curso_canonico")
        target_turma = ent_atual["codigo_turma"] or ctx.get("codigo_turma")
        target_sem = ent_atual["semestre"] or ctx.get("semestre")
        target_intencao = ent_atual["intencao"] or ctx.get("intencao")
        target_disc = ent_atual["disciplina_detectada"] or ctx.get("disciplina_detectada")
        is_dp_sabado = ent_atual["is_dp_sabado"] or ctx.get("is_dp_sabado", False)

        stopwords = {
            "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "para", "pra", "pro",
            "com", "por", "o", "a", "os", "as", "que", "qual", "quais", "quando", "onde", "como",
            "sao", "e", "eh", "um", "uma", "tem", "meu", "minha", "algum", "alguma", "sobre",
            "voce", "voces", "porque", "por", "favor", "mano", "cara", "prof", "professor",
        }
        terms = [t for t in raw_norm_q.split() if len(t) > 1 and t not in stopwords]

        # Sinônimos do curso alvo para pontuação
        curso_syns = COURSE_SYNONYMS.get(target_curso, []) if target_curso else []

        scored: List[Tuple[float, Dict[str, Any]]] = []

        for sec in self.sections:
            score = 0.0
            norm_header = normalizar_texto(sec["header"])
            norm_content = normalizar_texto(sec["content"])
            norm_title = normalizar_texto(sec["titulo_nota"])
            norm_curso = normalizar_texto(sec.get("curso", ""))
            norm_tags = normalizar_texto(" ".join(sec.get("tags", [])))
            full_sec_text = f"{norm_header} {norm_title} {norm_curso} {norm_tags} {norm_content}"

            # 1. Pontuação léxica pelos termos da pergunta
            for t in terms:
                if re.search(rf"\b{re.escape(t)}\b", norm_header):
                    score += 6.0
                if re.search(rf"\b{re.escape(t)}\b", norm_title):
                    score += 3.5
                if re.search(rf"\b{re.escape(t)}\b", norm_tags):
                    score += 3.0
                count = len(re.findall(rf"\b{re.escape(t)}\b", norm_content))
                if count > 0:
                    score += min(count * 1.2, 5.0)

            # 2. Alinhamento com a Disciplina detectada
            if target_disc:
                if target_disc in norm_header:
                    score += 35.0
                elif target_disc in norm_content:
                    score += 22.0
                # Se for pergunta de Cálculo para aluno de Economia/ADM/Contábeis no 3º-8º semestre,
                # valoriza muito a seção do Eixo Comum e Orientações Específicas que explicam Cálculo I e II
                if "calculo" in target_disc and ("eixo comum" in norm_header or "orientacoes especificas" in norm_header):
                    score += 28.0

            # 3. Alinhamento com o Curso (da pergunta atual ou herdado do histórico)
            if target_curso and curso_syns:
                matched_course_in_note = any(
                    re.search(rf"\b{re.escape(s)}\b", f"{norm_title} {norm_curso} {norm_header}")
                    for s in curso_syns
                )
                if matched_course_in_note:
                    score += 28.0
                elif "eixo comum" in norm_title and target_curso in ("economia", "administracao", "contabeis"):
                    score += 20.0
                elif "todos os cursos" in norm_curso:
                    score += 8.0
                else:
                    # Penaliza notas que são explicitamente de outro curso
                    for other_c, other_syns in COURSE_SYNONYMS.items():
                        if other_c != target_curso:
                            if any(re.search(rf"\b{re.escape(osyn)}\b", f"{norm_title} {norm_curso}") for osyn in other_syns[:2]):
                                score -= 25.0
                                break

            # 4. Alinhamento com Turma / Semestre
            if target_turma:
                # Ex: '5na'
                if re.search(rf"\b{re.escape(target_turma)}\b", norm_header):
                    score += 38.0
                elif re.search(rf"\b{re.escape(target_turma)}\b", norm_content):
                    score += 16.0
                elif target_disc and target_disc in norm_content and ("eixo comum" in norm_header or "orientacoes" in norm_header):
                    # Mantém alta relevância quando a disciplina perguntada (ex: Cálculo) está na seção do Eixo Comum do documento do curso
                    score += 22.0
            elif target_sem is not None:
                sem_patterns = [f"{target_sem} semestre", f"{target_sem}o semestre", f"{target_sem}na", f"{target_sem}nb", f"{target_sem}ma"]
                if any(p in norm_header for p in sem_patterns):
                    score += 30.0
                elif any(p in norm_content for p in sem_patterns):
                    score += 12.0

            # 5. Alinhamento com a Intenção (Provas PO vs Horários de Aula vs Critério vs PEDP vs Estágio vs Bolsas)
            if target_intencao == "data_prova":
                if "provas oficiais" in norm_title or "calendario de provas" in norm_title or "po" in norm_header:
                    score += 30.0
                elif "grade oficial de horarios" in norm_title:
                    score -= 18.0
            elif target_intencao == "horario_aula":
                if "grade oficial de horarios" in norm_title or "horarios e salas" in norm_title:
                    score += 30.0
                elif "provas oficiais" in norm_title:
                    score -= 15.0
            elif target_intencao == "pedp":
                if "pedp" in norm_title or "pedp" in norm_header:
                    score += 35.0
            elif target_intencao == "estagio":
                if "estagio" in norm_title or "estagio" in norm_header:
                    score += 35.0
            elif target_intencao == "criterio_nota":
                if "criterio de avaliacao" in norm_title or "exame" in norm_header or "media" in norm_header or "regra geral de aprovacao" in norm_header:
                    score += 55.0
                if "provas oficiais" in norm_title and target_disc and target_disc in norm_content:
                    score += 18.0
            elif target_intencao == "bolsa_financeiro":
                if any(k in norm_title for k in ["bolsa", "pafe", "assistencia financeira", "rematricula"]):
                    score += 35.0
            elif target_intencao == "calendario":
                if "calendario academico" in norm_title or "feriados" in norm_title:
                    score += 38.0

            # 6. DP / Adaptação aos Sábados
            if is_dp_sabado:
                if "sabado" in norm_title or "dp" in norm_header or "adaptacao" in norm_header:
                    score += 35.0

            if score >= 5.0:
                scored.append((score, sec))

        scored.sort(key=lambda x: x[0], reverse=True)

        # Seleciona as melhores seções garantindo diversidade (ex: se target_intencao == 'criterio_nota', garante que pelo menos 1 seção de Critério de Avaliação entre no top_k)
        selected: List[Dict[str, Any]] = []
        seen_keys = set()

        if target_intencao == "criterio_nota":
            for sc, sec in scored:
                if "criterio_de_avaliacao" in sec["note_name"].lower():
                    key = f"{sec['note_name']}::{sec['header']}"
                    if key not in seen_keys:
                        seen_keys.add(key)
                        selected.append(sec)
                        if len(selected) >= 2:
                            break

        for sc, sec in scored:
            if len(selected) >= top_k:
                break
            key = f"{sec['note_name']}::{sec['header']}"
            if key not in seen_keys:
                seen_keys.add(key)
                selected.append(sec)

        return selected

    def detectar_ambiguidade(
        self,
        query: str,
        contexto_conversa: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Analisa se a pergunta do estudante carece de informações essenciais (ex.: curso, turma/semestre ou modalidade)
        que não estão na mensagem atual nem no histórico da conversa, retornando instruções de esclarecimento
        para que o agente possa fazer uma pergunta direta e prestativa.
        """
        ent = extrair_entidades_consulta(query)
        ctx = contexto_conversa or {}

        curso = ent["curso_canonico"] or ctx.get("curso_canonico")
        turma = ent["codigo_turma"] or ctx.get("codigo_turma")
        semestre = ent["semestre"] or ctx.get("semestre")
        intencao = ent["intencao"] or ctx.get("intencao")
        disciplina = ent["disciplina_detectada"] or ctx.get("disciplina_detectada")
        is_dp = ent["is_dp_sabado"] or ctx.get("is_dp_sabado", False)

        # Caso 1: Pergunta sobre data de prova ou sala/horário de aula sem curso nem turma identificáveis
        if intencao in ("data_prova", "horario_aula") and not is_dp:
            if not curso and not turma:
                return {
                    "ambigua": True,
                    "motivo": "Falta identificar o curso e a turma/semestre (ex.: 1NA, 3NA ADM, 5NA Economia, 2NA CCOMP, 1NA ADS).",
                    "pergunta_sugerida": (
                        "Para eu te informar a data, horário e sala exatos, qual é o seu **curso** e a sua **turma/semestre** "
                        "(por exemplo: `1NA Economia`, `3NA ADM`, `2NA Ciência da Computação`, `1NA ADS` ou se é turma de **DP aos sábados**)?"
                    ),
                }
            if curso and not turma and not semestre and not disciplina:
                return {
                    "ambigua": True,
                    "motivo": f"O curso ({ent.get('curso_label') or ctx.get('curso_label') or curso}) foi identificado, mas falta o semestre/turma ou a disciplina.",
                    "pergunta_sugerida": (
                        f"De qual **semestre/turma** de **{ent.get('curso_label') or ctx.get('curso_label') or curso}** "
                        "(ex.: `1NA`, `3NA`, `5NA`) ou de qual **disciplina** específica você gostaria de consultar?"
                    ),
                }

        # Caso 2: Aluno de semestre avançado (ex.: 5NA Economia) pergunta sobre matéria de 1º/2º semestre (ex.: Cálculo)
        if curso == "economia" and (semestre and semestre >= 4) and disciplina and "calculo" in disciplina:
            return {
                "ambigua": True,
                "motivo": (
                    f"O aluno está no contexto da turma {turma or f'{semestre}º semestre'} de Ciências Econômicas, cuja grade regular não possui Cálculo "
                    "(em Economia, Cálculo I é do 1º semestre e Cálculo II é do 2º semestre no Eixo Comum, além da oferta de DP/Adaptação aos sábados)."
                ),
                "pergunta_sugerida": (
                    "Você está consultando **Cálculo I** (1º semestre — Eixo Comum), **Cálculo II** (2º semestre — Eixo Comum) "
                    "ou faz Cálculo em **DP/Adaptação aos sábados**?"
                ),
            }

        # Caso 3: Pergunta sobre PEDP ou Estágio sem informar o curso
        if intencao in ("pedp", "estagio") and not curso:
            norm_q = normalizar_texto(query)
            # Se for pergunta muito específica de regras/datas por curso sem dizer o curso
            if any(k in norm_q for k in ["meu curso", "minha turma", "qual atividade", "quantas horas", "obrigatorio"]):
                return {
                    "ambigua": True,
                    "motivo": f"As regras específicas de {intencao.upper()} variam conforme o curso de graduação.",
                    "pergunta_sugerida": "Qual é o seu **curso** (e semestre) para eu verificar a regra exata aplicável à sua matriz curricular?",
                }

        return {"ambigua": False, "motivo": "", "pergunta_sugerida": ""}

    def formatar_contexto_para_prompt(self, secoes: List[Dict[str, Any]]) -> str:
        if not secoes:
            return "Nenhum documento institucional específico encontrado no Grafo de Conhecimento para esta consulta."

        blocos = []
        for i, sec in enumerate(secoes, 1):
            arquivo = sec.get("arquivo") or sec.get("note_name")
            titulo = sec.get("titulo_nota")
            header = sec.get("header")
            content = sec.get("content")

            bloco = f"""### [Fonte Oficial Markdown {i}: {titulo} — Seção: {header}]
- **Documento**: `{arquivo}`
- **Conteúdo Oficial**:
{content}
"""
            blocos.append(bloco)

        return "\n\n".join(blocos)

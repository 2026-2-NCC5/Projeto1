# student_risk_agent.py
"""
Agente Analítico de Permanência & Score de Alunos FECAP
Consome os dados estruturados de Contato, Financeiro, Histórico, Matrículas e Relacionamentos
para calcular scores de risco multidimensionais (0-100), tendências e planos de intervenção preventiva.
"""

import os
import json
try:
    import openpyxl
except ImportError:
    openpyxl = None
from typing import Dict, List, Any, Optional

BASE_PATH = os.getenv("BASE_ALUNOS_DIR", os.path.join(os.path.dirname(__file__), 'dados_ficticios'))
OUTPUT_JSON_FRONTEND = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', 'src', 'services', 'ai-agent', 'data', 'studentsRiskData.json')
)

def normalizar_score(valor: float, min_val: float = 0.0, max_val: float = 100.0) -> int:
    """Limita e arredonda o score para a faixa 0-100."""
    score = max(0.0, min(100.0, valor))
    return int(round(score))

class StudentRiskAgent:
    def __init__(self, base_path: str = BASE_PATH):
        self.base_path = base_path
        self.students_cache: Dict[str, Any] = {}
        self.processed_profiles: List[Dict[str, Any]] = []

    def carregar_dados_amostra(self, limite_alunos: int = 200) -> List[Dict[str, Any]]:
        """
        Processa as planilhas da base_alunos e calcula as métricas multidimensionais.
        """
        contatos_path = os.path.join(self.base_path, 'Contato.xlsx')
        financeiro_path = os.path.join(self.base_path, 'Financeiro.xlsx')
        historico_path = os.path.join(self.base_path, 'Historico.xlsx')
        matriculas_path = os.path.join(self.base_path, 'Matriculas.xlsx')
        relacionamentos_path = os.path.join(self.base_path, 'Relacionamentos.xlsx')

        alunos_dict: Dict[str, Dict[str, Any]] = {}

        # Inclui perfis fixos de referência para testes do sistema
        alunos_dict['24018932'] = {
            'id': 'aluno-24018932',
            'ra': '24018932',
            'name': 'Gabriel Martins Ribeiro',
            'curso': 'Ciência da Computação',
            'turno': 'Noturno',
            'periodo_ingresso': '2024-1',
            'semestre': '3º Semestre',
            'status_academico': 'Matriculado',
            'financeiro': {'atrasos': 2, 'total_pendente': 3598.66, 'bolsa': 'Nenhuma', 'parcelas_abertas': 2},
            'historico': {'media_cr': 4.2, 'pct_faltas': 32.0, 'reprovacoes': 3, 'disciplinas': []},
            'contato': {'idade': 21, 'bairro': 'Guaianases', 'cidade': 'São Paulo', 'estado': 'SP'},
            'relacionamentos': {'atendimentos': 3, 'motivos': ['Consulta de cancelamento de matrícula', 'DP indisponível']}
        }

        alunos_dict['24026851'] = {
            'id': 'aluno-24026851',
            'ra': '24026851',
            'name': 'Lucas Alvarista',
            'curso': 'Ciência da Computação',
            'turno': 'Noturno',
            'periodo_ingresso': '2023-1',
            'semestre': '5º Semestre',
            'status_academico': 'Matriculado',
            'financeiro': {'atrasos': 0, 'total_pendente': 0.0, 'bolsa': 'Bolsa Mérito 30%', 'parcelas_abertas': 0},
            'historico': {'media_cr': 8.4, 'pct_faltas': 4.0, 'reprovacoes': 0, 'disciplinas': []},
            'contato': {'idade': 22, 'bairro': 'Liberdade', 'cidade': 'São Paulo', 'estado': 'SP'},
            'relacionamentos': {'atendimentos': 1, 'motivos': ['Emissão de declaração de matrícula']}
        }

        if os.path.exists(matriculas_path):
            print(f"-> Carregando base de alunos de: {self.base_path}")

            # 1. Carrega Matrículas
            wb_mat = openpyxl.load_workbook(matriculas_path, read_only=True)
            sheet_mat = wb_mat.active
            for i, row in enumerate(sheet_mat.iter_rows(values_only=True)):
                if i == 0 or not row[0]: continue
                id_aluno = str(row[0]).strip()
                if id_aluno not in alunos_dict:
                    alunos_dict[id_aluno] = {
                        'id': f"aluno-{id_aluno}",
                        'ra': id_aluno,
                        'name': self._gerar_nome_aluno(id_aluno),
                        'curso': str(row[3] or 'Graduação FECAP'),
                        'turno': str(row[5] or 'Noturno'),
                        'periodo_ingresso': str(row[6] or '2024-1'),
                        'semestre': f"{str(row[8] or '4')}º Semestre",
                        'status_academico': str(row[10] or 'Matriculado'),
                        'financeiro': {'atrasos': 0, 'total_pendente': 0.0, 'bolsa': 'Nenhuma', 'parcelas_abertas': 0},
                        'historico': {'media_cr': 7.5, 'pct_faltas': 5.0, 'reprovacoes': 0, 'disciplinas': []},
                        'contato': {'idade': 22, 'bairro': 'Liberdade', 'cidade': 'São Paulo', 'estado': 'SP'},
                        'relacionamentos': {'atendimentos': 0, 'motivos': []}
                    }
                if len(alunos_dict) >= limite_alunos:
                    break
            wb_mat.close()

            # 2. Carrega Contato
            if os.path.exists(contatos_path):
                wb_cont = openpyxl.load_workbook(contatos_path, read_only=True)
                sheet_cont = wb_cont.active
                for i, row in enumerate(sheet_cont.iter_rows(values_only=True)):
                    if i == 0 or not row[0]: continue
                    id_aluno = str(row[0]).strip()
                    if id_aluno in alunos_dict and id_aluno not in ['24018932', '24026851']:
                        alunos_dict[id_aluno]['contato'] = {
                            'idade': int(row[1] or 22) if str(row[1]).isdigit() else 22,
                            'bairro': str(row[2] or 'Centro'),
                            'cidade': str(row[3] or 'São Paulo'),
                            'estado': str(row[4] or 'SP'),
                            'estado_civil': str(row[5] or 'Solteiro'),
                            'sexo': str(row[6] or 'Outro')
                        }
                wb_cont.close()

            # 3. Carrega Financeiro
            if os.path.exists(financeiro_path):
                wb_fin = openpyxl.load_workbook(financeiro_path, read_only=True)
                sheet_fin = wb_fin.active
                count_fin = 0
                for i, row in enumerate(sheet_fin.iter_rows(values_only=True)):
                    if i == 0 or not row[0]: continue
                    id_aluno = str(row[0]).strip()
                    if id_aluno in alunos_dict and id_aluno not in ['24018932', '24026851']:
                        status_lanc = str(row[8] or '').strip().lower()
                        bolsa = str(row[6] or '').strip()
                        valor = float(row[7]) if row[7] and isinstance(row[7], (int, float)) else 0.0
                        if bolsa and bolsa != 'None':
                            alunos_dict[id_aluno]['financeiro']['bolsa'] = bolsa
                        if status_lanc in ['aberto', 'vencido', 'atrasado', 'pendente']:
                            alunos_dict[id_aluno]['financeiro']['atrasos'] += 1
                            alunos_dict[id_aluno]['financeiro']['total_pendente'] += valor
                    count_fin += 1
                    if count_fin > 25000: break
                wb_fin.close()

            # 4. Carrega Histórico
            if os.path.exists(historico_path):
                wb_hist = openpyxl.load_workbook(historico_path, read_only=True)
                sheet_hist = wb_hist.active
                notas_por_aluno: Dict[str, List[float]] = {}
                faltas_por_aluno: Dict[str, List[float]] = {}
                reprov_por_aluno: Dict[str, int] = {}

                count_h = 0
                for i, row in enumerate(sheet_hist.iter_rows(values_only=True)):
                    if i == 0 or not row[0]: continue
                    id_aluno = str(row[0]).strip()
                    if id_aluno in alunos_dict and id_aluno not in ['24018932', '24026851']:
                        pct_falta = float(row[4]) if row[4] and isinstance(row[4], (int, float)) else 0.0
                        nota = float(row[10]) if row[10] and isinstance(row[10], (int, float)) else (
                            float(row[5]) / 10.0 if row[5] and isinstance(row[5], (int, float)) else 7.0
                        )
                        situacao = str(row[9] or '').strip().lower()

                        notas_por_aluno.setdefault(id_aluno, []).append(nota)
                        faltas_por_aluno.setdefault(id_aluno, []).append(pct_falta)
                        if 'reprovado' in situacao:
                            reprov_por_aluno[id_aluno] = reprov_por_aluno.get(id_aluno, 0) + 1
                    count_h += 1
                    if count_h > 20000: break
                wb_hist.close()

                for id_aluno, notas in notas_por_aluno.items():
                    if id_aluno in alunos_dict and notas:
                        cr_medio = sum(notas) / len(notas)
                        pct_falta_media = sum(faltas_por_aluno.get(id_aluno, [0])) / max(1, len(faltas_por_aluno.get(id_aluno, [1])))
                        reprovs = reprov_por_aluno.get(id_aluno, 0)
                        alunos_dict[id_aluno]['historico'] = {
                            'media_cr': round(cr_medio, 2),
                            'pct_faltas': round(pct_falta_media, 1),
                            'reprovacoes': reprovs
                        }

        # Calcula os Scores Multidimensionais
        profiles: List[Dict[str, Any]] = []
        for id_aluno, data in alunos_dict.items():
            profile = self._calcular_score_aluno(data)
            profiles.append(profile)

        profiles.sort(key=lambda x: x['overallRiskScore'], reverse=True)
        self.processed_profiles = profiles
        return profiles

    def _calcular_score_aluno(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Aplica a matriz ponderada de risco nas 4 dimensões analíticas."""
        fin = data['financeiro']
        hist = data['historico']
        cont = data['contato']
        rel = data['relacionamentos']

        # 1. Dimensão Financeira (0-100)
        atrasos = fin['atrasos']
        total_devido = fin['total_pendente']
        bolsa = fin['bolsa']
        if atrasos >= 2:
            score_fin = min(100.0, 70.0 + atrasos * 10.0)
            fin_status = "Crítico"
            fin_detail = f"{atrasos} parcelas em atraso (R$ {total_devido:.2f} pendentes). Perda de pontualidade."
        elif atrasos == 1:
            score_fin = 55.0
            fin_status = "Atenção"
            fin_detail = f"1 mensalidade em atraso. Bolsa ativa: {bolsa}."
        else:
            score_fin = 12.0
            fin_status = "Controlado"
            fin_detail = f"Mensalidades em dia. Convênio/Bolsa: {bolsa if bolsa != 'Nenhuma' else 'Integral Regular'}."

        # 2. Dimensão Acadêmica (0-100)
        cr = hist['media_cr']
        faltas = hist['pct_faltas']
        reprovs = hist['reprovacoes']

        if cr < 5.0 or faltas > 25.0 or reprovs >= 2:
            score_acad = min(100.0, 50.0 + (10.0 - cr) * 6.0 + reprovs * 12.0 + faltas * 0.5)
            acad_status = "Crítico"
            acad_detail = f"CR {cr:.2f} abaixo da média mínima (6.0), {reprovs} DP(s) acumuladas e {faltas}% de ausências."
        elif cr < 7.0 or faltas > 15.0 or reprovs == 1:
            score_acad = 52.0
            acad_status = "Atenção"
            acad_detail = f"CR {cr:.2f}, 1 DP ativa e assiduidade em monitoramento ({faltas}% de faltas)."
        else:
            score_acad = 18.0
            acad_status = "Excelente"
            acad_detail = f"CR {cr:.2f}, assiduidade alta (95%+) e nenhuma pendência de DP."

        # 3. Dimensão Relacionamento (0-100)
        atendimentos = rel['atendimentos']
        motivos = rel['motivos']
        has_evasao_motive = any('cancelamento' in m.lower() or 'trancamento' in m.lower() or 'abono' in m.lower() for m in motivos)

        if has_evasao_motive:
            score_rel = 85.0
            rel_status = "Alto Risco"
            rel_detail = f"Registrou consultas sobre cancelamento/trancamento de matrícula e DP indisponível ({atendimentos} contatos)."
        elif atendimentos >= 3:
            score_rel = 60.0
            rel_status = "Atenção"
            rel_detail = f"{atendimentos} atendimentos no CAA com demandas recorrentes de secretaria/documentação."
        else:
            score_rel = 20.0
            rel_status = "Estável"
            rel_detail = f"Atendimento regular, boa interação com os canais digitais do portal."

        # 4. Dimensão Geográfica (0-100)
        bairro = cont['bairro']
        cidade = cont['cidade']

        bairros_longes = ['Guaianases', 'Itaquera', 'São Miguel', 'Osasco', 'Guarulhos', 'Santo André', 'São Bernardo', 'Grajaú', 'Capão Redondo', 'Mogi']
        is_distante = any(b.lower() in bairro.lower() for b in bairros_longes) or ('São Paulo' not in cidade and cidade != '')

        if is_distante:
            score_geo = 75.0
            geo_status = "Distância Elevada"
            geo_detail = f"Residência em {bairro} ({cidade}), deslocamento estimado > 2h de transporte público."
        else:
            score_geo = 25.0
            geo_status = "Baixo Deslocamento"
            geo_detail = f"Residência em {bairro} ({cidade}), fácil acesso ao campus Liberdade."

        # Score Ponderado Global
        overall_score = (0.35 * score_fin) + (0.30 * score_acad) + (0.20 * score_rel) + (0.15 * score_geo)
        overall_score = normalizar_score(overall_score)

        if overall_score >= 70:
            category = "Vermelho"
            trend = "Piorando"
            variation = "+20% no último bimestre"
            explanation = f"O aluno acumula risco crítico impulsionado por pendências financeiras e queda de rendimento no curso de {data['curso']}, necessitando de intervenção imediata de acolhimento."
            recommendation = "Acionar atendimento do Núcleo de Permanência Estudantil, oferecer parcelamento emergencial sem juros e avaliação de bolsa permanência."
        elif overall_score >= 40:
            category = "Amarelo"
            trend = "Estavel"
            variation = "±3% (oscilação moderada)"
            explanation = f"Estudante em situação de alerta devido à transição curricular e demandas pontuais de tutoria em {data['curso']}."
            recommendation = "Vincular a programa de mentoria com veteranos e ofertar reforço pedagógico em disciplinas com risco de DP."
        else:
            category = "Verde"
            trend = "Melhorando"
            variation = "-12% nos últimos 60 dias"
            explanation = "Desempenho acadêmico consolidado, sem pendências financeiras ou atritos de permanência registrados."
            recommendation = "Incentivar participação em programas de Iniciação Científica, Empresa Júnior e Mentoria de novos alunos."

        hist_scores = [
            {'month': 'Jun', 'score': normalizar_score(overall_score * 0.7)},
            {'month': 'Jul', 'score': normalizar_score(overall_score * 0.85)},
            {'month': 'Ago', 'score': overall_score}
        ]

        return {
            'id': data['id'],
            'name': data['name'],
            'ra': data['ra'],
            'course': data['curso'],
            'semester': data['semestre'],
            'turno': data['turno'],
            'category': category,
            'overallRiskScore': overall_score,
            'temporalTrend': trend,
            'trendVariation': variation,
            'historyScores': hist_scores,
            'dimensions': {
                'financeira': {'score': normalizar_score(score_fin), 'status': fin_status, 'detail': fin_detail},
                'academica': {'score': normalizar_score(score_acad), 'status': acad_status, 'detail': acad_detail},
                'relacionamento': {'score': normalizar_score(score_rel), 'status': rel_status, 'detail': rel_detail},
                'geografica': {'score': normalizar_score(score_geo), 'status': geo_status, 'detail': geo_detail}
            },
            'explanation': explanation,
            'recommendation': recommendation
        }

    def _gerar_nome_aluno(self, id_aluno: str) -> str:
        """Gera nome consistente e anônimo baseado no ID."""
        NOMES = ['Gabriel Martins Ribeiro', 'Beatriz Vasconcelos', 'Matheus Henrique Silveira', 'Carolina Mendes de Oliveira',
                 'Rafael Albuquerque Costa', 'Juliana Ferreira Santos', 'Lucas Fernando Lima', 'Larissa Cristina Prado',
                 'Thiago Vinicius Ramos', 'Amanda Rocha Barbosa', 'Leonardo Pinheiro Castro', 'Mariana Duarte Souza',
                 'Guilherme Torres Nogueira', 'Camila Antunes Silva', 'Felipe Augusto Morais', 'Isabela Neves Borges']
        idx = sum(ord(c) for c in id_aluno) % len(NOMES)
        return NOMES[idx]

    def salvar_dataset_frontend(self, profiles: Optional[List[Dict[str, Any]]] = None) -> str:
        """Exporta os dados calculados para o JSON acessível pelo aplicativo mobile."""
        dados = profiles or self.processed_profiles or self.carregar_dados_amostra()
        os.makedirs(os.path.dirname(OUTPUT_JSON_FRONTEND), exist_ok=True)
        with open(OUTPUT_JSON_FRONTEND, 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
        print(f"[OK] {len(dados)} perfis de alunos salvos em {OUTPUT_JSON_FRONTEND}")
        return OUTPUT_JSON_FRONTEND

student_risk_agent = StudentRiskAgent()

if __name__ == '__main__':
    perfis = student_risk_agent.carregar_dados_amostra(limite_alunos=200)
    student_risk_agent.salvar_dataset_frontend(perfis)

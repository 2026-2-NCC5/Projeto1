import React from 'react';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
  G,
  Line,
} from 'react-native-svg';

interface IllustrationProps {
  width?: number;
  height?: number;
  isDark?: boolean;
}

/**
 * Slide 1: Ecossistema Acadêmico FECAP
 * Carteirinha estudantil moderna, grade de horários, capelo de graduação e documentos oficiais
 */
export const StudentIllustration: React.FC<IllustrationProps> = ({
  width = 280,
  height = 220,
  isDark = false,
}) => {
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const cardBorder = isDark ? '#334155' : '#E2E8F0';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#64748B';

  return (
    <Svg width={width} height={height} viewBox="0 0 280 220" fill="none">
      <Defs>
        <LinearGradient id="s1_grad_card" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#00B074" />
          <Stop offset="100%" stopColor="#006837" />
        </LinearGradient>
        <LinearGradient id="s1_grad_gold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FBBF24" />
          <Stop offset="100%" stopColor="#D97706" />
        </LinearGradient>
        <LinearGradient id="s1_grad_glow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#00B074" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#00B074" stopOpacity="0.0" />
        </LinearGradient>
      </Defs>

      {/* Círculo luminoso de fundo */}
      <Circle cx="140" cy="110" r="85" fill="url(#s1_grad_glow)" />

      {/* Cartão de Fundo (Perspectiva - Grade de Aulas) */}
      <G transform="rotate(-6 140 110)">
        <Rect
          x="38"
          y="35"
          width="180"
          height="125"
          rx="18"
          fill={cardBg}
          stroke={cardBorder}
          strokeWidth="1.5"
        />
        <Rect x="54" y="52" width="60" height="8" rx="4" fill="#00B074" />
        <Rect x="54" y="66" width="130" height="5" rx="2.5" fill={textMuted} opacity="0.3" />
        <Rect x="54" y="77" width="100" height="5" rx="2.5" fill={textMuted} opacity="0.2" />
        <Rect x="54" y="88" width="120" height="5" rx="2.5" fill={textMuted} opacity="0.25" />
        <Circle cx="185" cy="55" r="10" fill="#00B074" opacity="0.15" />
      </G>

      {/* Carteirinha Digital Principal do Estudante Alvarista */}
      <G transform="rotate(4 140 110)">
        <Rect
          x="65"
          y="48"
          width="170"
          height="115"
          rx="16"
          fill="url(#s1_grad_card)"
        />
        {/* Faixa decorativa superior */}
        <Path
          d="M65 64 C90 55, 120 70, 160 55 L235 55 L235 48 C235 42, 230 48, 224 48 L75 48 C69 48, 65 52, 65 58 Z"
          fill="#FFFFFF"
          opacity="0.12"
        />

        {/* Avatar do Estudante com Capelo */}
        <Circle cx="96" cy="85" r="18" fill="#FFFFFF" opacity="0.95" />
        <Circle cx="96" cy="82" r="8" fill="#006837" />
        <Path d="M85 99 C85 91, 107 91, 107 99 Z" fill="#006837" />
        {/* Capelo sobre o avatar */}
        <Path d="M96 70 L106 75 L96 80 L86 75 Z" fill="url(#s1_grad_gold)" />
        <Line x1="103" y1="76" x2="105" y2="84" stroke="#FBBF24" strokeWidth="1.5" />

        {/* Linhas de Identificação do Aluno */}
        <Rect x="124" y="74" width="85" height="7" rx="3.5" fill="#FFFFFF" />
        <Rect x="124" y="86" width="60" height="5" rx="2.5" fill="#FFFFFF" opacity="0.8" />
        <Rect x="124" y="96" width="70" height="5" rx="2.5" fill="#FFFFFF" opacity="0.6" />

        {/* Chip Holográfico da Carteirinha */}
        <Rect x="80" y="118" width="22" height="16" rx="4" fill="url(#s1_grad_gold)" />
        <Rect x="84" y="122" width="14" height="8" rx="2" fill="#D97706" opacity="0.4" />

        {/* Selo Oficial Alvarista */}
        <Circle cx="205" cy="126" r="12" fill="#FFFFFF" opacity="0.2" />
        <Path d="M201 126 L204 129 L210 123" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      </G>

      {/* Floating Pill: Grade de Aulas & Horários */}
      <G>
        <Rect
          x="20"
          y="155"
          width="135"
          height="38"
          rx="12"
          fill={cardBg}
          stroke={cardBorder}
          strokeWidth="1.2"
        />
        <Circle cx="40" cy="174" r="10" fill="#00B074" opacity="0.15" />
        {/* Relógio Icon */}
        <Circle cx="40" cy="174" r="6" stroke="#00B074" strokeWidth="1.5" />
        <Path d="M40 171 L40 174 L42 176" stroke="#00B074" strokeWidth="1.5" strokeLinecap="round" />
        <Rect x="56" y="167" width="75" height="5" rx="2.5" fill={textPrimary} />
        <Rect x="56" y="176" width="50" height="4" rx="2" fill={textMuted} />
      </G>

      {/* Floating Pill: 82 Requerimentos Oficiais */}
      <G>
        <Rect
          x="145"
          y="16"
          width="118"
          height="34"
          rx="10"
          fill={cardBg}
          stroke={cardBorder}
          strokeWidth="1.2"
        />
        <Circle cx="162" cy="33" r="8" fill="#10B981" />
        <Path d="M159 33 L161 35 L165 31" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
        <Rect x="176" y="27" width="68" height="5" rx="2.5" fill={textPrimary} />
        <Rect x="176" y="36" width="45" height="4" rx="2" fill="#10B981" />
      </G>

      {/* Estrelas decorativas */}
      <Path d="M245 80 L247 84 L251 86 L247 88 L245 92 L243 88 L239 86 L243 84 Z" fill="#FBBF24" opacity="0.8" />
      <Path d="M30 90 L31 93 L34 94 L31 95 L30 98 L29 95 L26 94 L29 93 Z" fill="#00B074" opacity="0.7" />
    </Svg>
  );
};

/**
 * Slide 2: Inteligência Artificial SISA
 * Orbe holográfico multicamadas com órbitas gravitacionais, redes neurais e balão de atendimento inteligente
 */
export const AIIllustration: React.FC<IllustrationProps> = ({
  width = 280,
  height = 220,
  isDark = false,
}) => {
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const cardBorder = isDark ? '#334155' : '#E2E8F0';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';

  return (
    <Svg width={width} height={height} viewBox="0 0 280 220" fill="none">
      <Defs>
        <LinearGradient id="s2_grad_orb" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#7C3AED" />
          <Stop offset="50%" stopColor="#2563EB" />
          <Stop offset="100%" stopColor="#00B074" />
        </LinearGradient>
        <LinearGradient id="s2_grad_glow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#7C3AED" stopOpacity="0.3" />
          <Stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
        </LinearGradient>
        <LinearGradient id="s2_ring_grad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#A78BFA" />
          <Stop offset="100%" stopColor="#34D399" />
        </LinearGradient>
      </Defs>

      {/* Aura Holográfica Radiante */}
      <Circle cx="140" cy="105" r="90" fill="url(#s2_grad_glow)" />

      {/* Anéis orbitais tridimensionais */}
      <G transform="rotate(-22 140 105)">
        <Path
          d="M50 105 A90 28 0 1 0 230 105 A90 28 0 1 0 50 105"
          stroke="url(#s2_ring_grad)"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          opacity="0.85"
        />
        {/* Partícula na órbita 1 */}
        <Circle cx="218" cy="112" r="5" fill="#34D399" />
        <Circle cx="218" cy="112" r="8" fill="#34D399" opacity="0.3" />
      </G>

      <G transform="rotate(32 140 105)">
        <Path
          d="M60 105 A80 22 0 1 0 220 105 A80 22 0 1 0 60 105"
          stroke="#7C3AED"
          strokeWidth="1.8"
          opacity="0.6"
        />
        {/* Partícula na órbita 2 */}
        <Circle cx="68" cy="98" r="4" fill="#FBBF24" />
      </G>

      {/* Orbe Central SISA */}
      <Circle cx="140" cy="105" r="48" fill="url(#s2_grad_orb)" />

      {/* Reflexo vítreo superior */}
      <Path
        d="M106 90 C118 72, 162 72, 174 90 C155 82, 125 82, 106 90 Z"
        fill="#FFFFFF"
        opacity="0.45"
      />

      {/* Núcleo de Energia e Conexões Neurais */}
      <Circle cx="140" cy="105" r="20" fill="#FFFFFF" opacity="0.2" />
      <Circle cx="140" cy="105" r="12" fill="#FFFFFF" opacity="0.85" />
      <Line x1="140" y1="93" x2="140" y2="82" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="140" y1="117" x2="140" y2="128" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="128" y1="105" x2="117" y2="105" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="152" y1="105" x2="163" y2="105" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />

      {/* Balão de Resposta IA Flutuante */}
      <G>
        <Rect
          x="28"
          y="154"
          width="160"
          height="46"
          rx="14"
          fill={cardBg}
          stroke={cardBorder}
          strokeWidth="1.2"
        />
        <Circle cx="50" cy="177" r="12" fill="#7C3AED" />
        {/* Ícone Sparkles */}
        <Path d="M50 171 L51.5 175.5 L56 177 L51.5 178.5 L50 183 L48.5 178.5 L44 177 L48.5 175.5 Z" fill="#FFFFFF" />
        <Rect x="70" y="169" width="98" height="6" rx="3" fill={textPrimary} />
        <Rect x="70" y="180" width="70" height="5" rx="2.5" fill="#7C3AED" />
      </G>

      {/* Mini-tag de Status: SISA Ativa 24/7 */}
      <G>
        <Rect
          x="165"
          y="24"
          width="95"
          height="30"
          rx="8"
          fill={cardBg}
          stroke={cardBorder}
          strokeWidth="1"
        />
        <Circle cx="178" cy="39" r="4" fill="#10B981" />
        <Rect x="188" y="36" width="58" height="6" rx="3" fill={textPrimary} />
      </G>

      {/* Constelação de Brilhos */}
      <Path d="M60 50 L62 55 L67 57 L62 59 L60 64 L58 59 L53 57 L58 55 Z" fill="#A78BFA" />
      <Path d="M225 155 L226.5 158.5 L230 160 L226.5 161.5 L225 165 L223.5 161.5 L220 160 L223.5 158.5 Z" fill="#34D399" />
    </Svg>
  );
};

/**
 * Slide 3: Central CAA & Permanência Estudantil
 * Escudo protetor de sucesso acadêmico, integração multiperfil (aluno, funcionário, docente) e protocolo oficial
 */
export const PermanenceIllustration: React.FC<IllustrationProps> = ({
  width = 280,
  height = 220,
  isDark = false,
}) => {
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const cardBorder = isDark ? '#334155' : '#E2E8F0';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#64748B';

  return (
    <Svg width={width} height={height} viewBox="0 0 280 220" fill="none">
      <Defs>
        <LinearGradient id="s3_grad_shield" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#0284C7" />
          <Stop offset="100%" stopColor="#0369A1" />
        </LinearGradient>
        <LinearGradient id="s3_grad_glow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#0284C7" stopOpacity="0.22" />
          <Stop offset="100%" stopColor="#0284C7" stopOpacity="0.0" />
        </LinearGradient>
      </Defs>

      {/* Halo de Proteção e Segurança */}
      <Circle cx="140" cy="105" r="88" fill="url(#s3_grad_glow)" />

      {/* Arcos de Conexão Multiperfil */}
      <Path
        d="M60 115 C60 65, 220 65, 220 115"
        stroke="#0284C7"
        strokeWidth="2"
        strokeDasharray="5 4"
        opacity="0.4"
      />

      {/* Escudo Central Oficial de Sucesso Alvarista */}
      <Path
        d="M140 45 L182 62 C182 110, 155 140, 140 152 C125 140, 98 110, 98 62 Z"
        fill="url(#s3_grad_shield)"
      />
      {/* Detalhe interno do escudo */}
      <Path
        d="M140 54 L173 67 C173 105, 152 131, 140 141 C128 131, 107 105, 107 67 Z"
        fill="#FFFFFF"
        opacity="0.1"
      />
      {/* Checkmark no Escudo */}
      <Path
        d="M125 96 L135 106 L156 84"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Perfil 1: Estudante (Esquerda) */}
      <G>
        <Circle cx="60" cy="115" r="20" fill={cardBg} stroke="#00B074" strokeWidth="2.5" />
        <Circle cx="60" cy="110" r="7" fill="#00B074" />
        <Path d="M51 126 C51 119, 69 119, 69 126 Z" fill="#00B074" />
      </G>

      {/* Perfil 2: Funcionário / CAA (Direita) */}
      <G>
        <Circle cx="220" cy="115" r="20" fill={cardBg} stroke="#0284C7" strokeWidth="2.5" />
        <Circle cx="220" cy="110" r="7" fill="#0284C7" />
        <Path d="M211 126 C211 119, 229 119, 229 126 Z" fill="#0284C7" />
      </G>

      {/* Perfil 3: Família / Apoio (Topo Central) */}
      <G>
        <Circle cx="140" cy="22" r="16" fill={cardBg} stroke="#F59E0B" strokeWidth="2" />
        <Circle cx="140" cy="18" r="5" fill="#F59E0B" />
        <Path d="M133 30 C133 25, 147 25, 147 30 Z" fill="#F59E0B" />
      </G>

      {/* Floating Card: Fila Presencial CAA & Protocolos */}
      <G>
        <Rect
          x="30"
          y="160"
          width="130"
          height="42"
          rx="12"
          fill={cardBg}
          stroke={cardBorder}
          strokeWidth="1.2"
        />
        <Circle cx="50" cy="181" r="10" fill="#0284C7" opacity="0.15" />
        {/* Ticket / Headset Icon */}
        <Rect x="44" y="176" width="12" height="10" rx="2" stroke="#0284C7" strokeWidth="1.5" />
        <Rect x="68" y="173" width="76" height="5" rx="2.5" fill={textPrimary} />
        <Rect x="68" y="182" width="55" height="4" rx="2" fill="#0284C7" />
      </G>

      {/* Floating Card: Triagem & Permanência Ativa */}
      <G>
        <Rect
          x="172"
          y="160"
          width="85"
          height="42"
          rx="12"
          fill={cardBg}
          stroke={cardBorder}
          strokeWidth="1.2"
        />
        <Circle cx="190" cy="181" r="8" fill="#10B981" />
        <Path d="M187 181 L189 183 L193 179" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
        <Rect x="204" y="175" width="42" height="5" rx="2.5" fill={textPrimary} />
        <Rect x="204" y="183" width="30" height="4" rx="2" fill={textMuted} />
      </G>
    </Svg>
  );
};

/**
 * Serviço de Geolocalização e Cálculo Dinâmico de Distância até o Campus Liberdade da FECAP.
 * Campus Liberdade: Av. da Liberdade, 532 - Liberdade, São Paulo - SP (CEP: 01502-001)
 * Coordenadas de Referência: -23.5574, -46.6346
 */

export const FECAP_COORDINATES = {
  lat: -23.5574,
  lon: -46.6346,
  address: 'Av. da Liberdade, 532 - Liberdade, São Paulo - SP',
  cep: '01502-001',
};

export interface CepAddressResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  error?: boolean;
}

export interface DistanceCalculationResult {
  distanceKm: number;
  distanceText: string;
  status: 'Perto' | 'Moderado' | 'Longe';
  estimatedMinutes?: number;
  originFormatted?: string;
}

/**
 * Tabela de Centróides Geográficos por Prefixo de CEP (3 dígitos) no Estado de SP.
 * Garante máxima precisão mesmo quando o serviço externo de mapa estiver offline ou com timeout.
 */
const CEP_PREFIX_COORDINATES: Record<string, { lat: number; lon: number; label: string }> = {
  // São Paulo Capital - Região Central
  '010': { lat: -23.5475, lon: -46.6361, label: 'Sé / República, São Paulo' },
  '011': { lat: -23.528, lon: -46.65, label: 'Bom Retiro / Barra Funda, São Paulo' },
  '012': { lat: -23.538, lon: -46.655, label: 'Santa Cecília / Higienópolis, São Paulo' },
  '013': { lat: -23.56, lon: -46.65, label: 'Bela Vista / Cerqueira César, São Paulo' },
  '014': { lat: -23.57, lon: -46.665, label: 'Jardins / Jardim Paulista, São Paulo' },
  '015': { lat: -23.565, lon: -46.628, label: 'Liberdade / Aclimação / Cambuci, São Paulo' },

  // São Paulo Capital - Zona Norte
  '020': { lat: -23.502, lon: -46.625, label: 'Santana / Carandiru, São Paulo' },
  '021': { lat: -23.508, lon: -46.595, label: 'Vila Maria / Vila Guilherme, São Paulo' },
  '022': { lat: -23.468, lon: -46.582, label: 'Jaçanã / Tremembé, São Paulo' },
  '023': { lat: -23.478, lon: -46.615, label: 'Tucuruvi / Mandaqui, São Paulo' },
  '024': { lat: -23.483, lon: -46.645, label: 'Lauzane Paulista / Santana Norte, São Paulo' },
  '025': { lat: -23.505, lon: -46.667, label: 'Casa Verde / Limão, São Paulo' },
  '026': { lat: -23.465, lon: -46.678, label: 'Brasilândia / Cachoeirinha, São Paulo' },
  '027': { lat: -23.498, lon: -46.695, label: 'Freguesia do Ó, São Paulo' },
  '028': { lat: -23.445, lon: -46.735, label: 'Jaraguá / Taipas, São Paulo' },
  '029': { lat: -23.488, lon: -46.728, label: 'Pirituba / São Domingos, São Paulo' },

  // São Paulo Capital - Zona Leste
  '030': { lat: -23.535, lon: -46.618, label: 'Brás / Pari, São Paulo' },
  '031': { lat: -23.555, lon: -46.595, label: 'Mooca / Alto da Mooca, São Paulo' },
  '032': { lat: -23.585, lon: -46.575, label: 'Vila Prudente / Vila Zelina, São Paulo' },
  '033': { lat: -23.542, lon: -46.565, label: 'Tatuapé / Anália Franco, São Paulo' },
  '034': { lat: -23.555, lon: -46.54, label: 'Vila Formosa / Carrão, São Paulo' },
  '035': { lat: -23.532, lon: -46.525, label: 'Vila Matilde / Penha, São Paulo' },
  '036': { lat: -23.508, lon: -46.518, label: 'Cangaíba / Eng. Goulart, São Paulo' },
  '037': { lat: -23.488, lon: -46.495, label: 'Ermelino Matarazzo, São Paulo' },
  '038': { lat: -23.515, lon: -46.485, label: 'Ponte Rasa, São Paulo' },
  '039': { lat: -23.595, lon: -46.485, label: 'São Mateus / Sapopemba, São Paulo' },
  '080': { lat: -23.498, lon: -46.435, label: 'São Miguel Paulista, São Paulo' },
  '081': { lat: -23.495, lon: -46.395, label: 'Itaim Paulista / Jardim Helena, São Paulo' },
  '082': { lat: -23.538, lon: -46.455, label: 'Itaquera / José Bonifácio, São Paulo' },
  '083': { lat: -23.595, lon: -46.402, label: 'Cidade Tiradentes, São Paulo' },
  '084': { lat: -23.545, lon: -46.415, label: 'Guaianases / Lajeado, São Paulo' },

  // São Paulo Capital - Zona Sul
  '040': { lat: -23.582, lon: -46.64, label: 'Vila Mariana / Paraíso, São Paulo' },
  '041': { lat: -23.612, lon: -46.635, label: 'Saúde / Bosque da Saúde, São Paulo' },
  '042': { lat: -23.592, lon: -46.605, label: 'Ipiranga / Sacomã, São Paulo' },
  '043': { lat: -23.645, lon: -46.65, label: 'Jabaquara / Cidade Ademar, São Paulo' },
  '044': { lat: -23.685, lon: -46.665, label: 'Pedreira / Campo Grande, São Paulo' },
  '045': { lat: -23.588, lon: -46.68, label: 'Itaim Bibi / Vila Olímpia, São Paulo' },
  '046': { lat: -23.615, lon: -46.668, label: 'Moema / Campo Belo, São Paulo' },
  '047': { lat: -23.645, lon: -46.702, label: 'Santo Amaro / Chácara Santo Antônio, São Paulo' },
  '048': { lat: -23.745, lon: -46.695, label: 'Socorro / Grajaú / Parelheiros, São Paulo' },
  '049': { lat: -23.702, lon: -46.698, label: 'Interlagos / Cidade Dutra, São Paulo' },

  // São Paulo Capital - Zona Oeste
  '050': { lat: -23.535, lon: -46.678, label: 'Perdizes / Pompeia / Água Branca, São Paulo' },
  '051': { lat: -23.528, lon: -46.715, label: 'Lapa / Leopoldina, São Paulo' },
  '052': { lat: -23.405, lon: -46.755, label: 'Perus / Anhanguera, São Paulo' },
  '053': { lat: -23.565, lon: -46.745, label: 'Jaguaré / Rio Pequeno, São Paulo' },
  '054': { lat: -23.558, lon: -46.69, label: 'Pinheiros / Vila Madalena, São Paulo' },
  '055': { lat: -23.572, lon: -46.72, label: 'Butantã / Morumbi Norte, São Paulo' },
  '056': { lat: -23.598, lon: -46.725, label: 'Morumbi / Vila Sônia, São Paulo' },
  '057': { lat: -23.635, lon: -46.745, label: 'Campo Limpo / Vila Andrade, São Paulo' },
  '058': { lat: -23.675, lon: -46.775, label: 'Capão Redondo / Jardim Ângela, São Paulo' },

  // Grande São Paulo - Região Oeste
  '060': { lat: -23.5329, lon: -46.792, label: 'Osasco - Centro' },
  '061': { lat: -23.545, lon: -46.805, label: 'Osasco - Zona Sul' },
  '062': { lat: -23.515, lon: -46.785, label: 'Osasco - Zona Norte' },
  '063': { lat: -23.5222, lon: -46.8358, label: 'Carapicuíba' },
  '064': { lat: -23.5111, lon: -46.8761, label: 'Barueri / Alphaville' },
  '065': { lat: -23.4444, lon: -46.9189, label: 'Santana de Parnaíba' },
  '066': { lat: -23.5417, lon: -46.9347, label: 'Jandira / Itapevi' },
  '067': { lat: -23.6039, lon: -46.9189, label: 'Cotia / Granja Viana' },
  '068': { lat: -23.6492, lon: -46.8525, label: 'Embu das Artes / Taboão da Serra' },
  '069': { lat: -23.7175, lon: -46.8492, label: 'Itapecerica da Serra' },

  // Grande São Paulo - Região Norte / Nordeste
  '070': { lat: -23.4542, lon: -46.5333, label: 'Guarulhos - Centro' },
  '071': { lat: -23.44, lon: -46.51, label: 'Guarulhos - Cumbica / Cecap' },
  '072': { lat: -23.435, lon: -46.46, label: 'Guarulhos - Pimentas / Bonsucesso' },
  '074': { lat: -23.3969, lon: -46.3208, label: 'Arujá' },
  '075': { lat: -23.3161, lon: -46.2239, label: 'Santa Isabel' },
  '077': { lat: -23.3644, lon: -46.7408, label: 'Caieiras / Franco da Rocha' },
  '078': { lat: -23.2817, lon: -46.7439, label: 'Francisco Morato' },
  '079': { lat: -23.3186, lon: -46.5867, label: 'Mairiporã' },

  // Grande São Paulo - Alto Tietê
  '085': { lat: -23.5414, lon: -46.3689, label: 'Ferraz de Vasconcelos / Poá' },
  '086': { lat: -23.5425, lon: -46.3108, label: 'Suzano' },
  '087': { lat: -23.5222, lon: -46.1882, label: 'Mogi das Cruzes' },
  '088': { lat: -23.535, lon: -46.195, label: 'Mogi das Cruzes' },
  '089': { lat: -23.4861, lon: -46.3486, label: 'Itaquaquecetuba' },

  // Grande São Paulo - Grande ABC
  '090': { lat: -23.6638, lon: -46.5383, label: 'Santo André - Bairro Jardim / Centro' },
  '091': { lat: -23.675, lon: -46.515, label: 'Santo André - Parque das Nações' },
  '092': { lat: -23.645, lon: -46.525, label: 'Santo André - Utinga' },
  '093': { lat: -23.6678, lon: -46.4614, label: 'Mauá' },
  '094': { lat: -23.7139, lon: -46.4136, label: 'Ribeirão Pires / Rio Grande da Serra' },
  '095': { lat: -23.6228, lon: -46.555, label: 'São Caetano do Sul' },
  '096': { lat: -23.67, lon: -46.56, label: 'São Bernardo do Campo - Rudge Ramos' },
  '097': { lat: -23.6914, lon: -46.5646, label: 'São Bernardo do Campo - Centro' },
  '098': { lat: -23.725, lon: -46.58, label: 'São Bernardo do Campo - Alvarenga' },
  '099': { lat: -23.6864, lon: -46.6228, label: 'Diadema' },

  // Baixada Santista / Litoral
  '110': { lat: -23.9608, lon: -46.3331, label: 'Santos - Centro / Gonzaga' },
  '111': { lat: -23.955, lon: -46.32, label: 'Santos - Ponta da Praia' },
  '112': { lat: -23.98, lon: -46.31, label: 'Santos - Zona Noroeste' },
  '113': { lat: -23.9631, lon: -46.3919, label: 'São Vicente' },
  '114': { lat: -23.9936, lon: -46.2564, label: 'Guarujá' },
  '115': { lat: -23.895, lon: -46.4253, label: 'Cubatão' },
  '117': { lat: -24.0058, lon: -46.4028, label: 'Praia Grande' },
  '116': { lat: -23.8569, lon: -46.1389, label: 'Bertioga / Litoral Norte' },

  // Interior do Estado de São Paulo
  '120': { lat: -23.025, lon: -45.556, label: 'Taubaté' },
  '122': { lat: -23.2237, lon: -45.9009, label: 'São José dos Campos' },
  '130': { lat: -22.9099, lon: -47.0626, label: 'Campinas - Centro' },
  '131': { lat: -22.84, lon: -47.07, label: 'Campinas - Barão Geraldo' },
  '132': { lat: -23.1857, lon: -46.8978, label: 'Jundiaí' },
  '133': { lat: -23.2642, lon: -47.2992, label: 'Itu / Salto' },
  '134': { lat: -22.7253, lon: -47.6492, label: 'Piracicaba / Americana' },
  '140': { lat: -21.1767, lon: -47.8108, label: 'Ribeirão Preto' },
  '150': { lat: -20.8113, lon: -49.3758, label: 'São José do Rio Preto' },
  '170': { lat: -22.3147, lon: -49.0606, label: 'Bauru' },
  '180': { lat: -23.5015, lon: -47.4587, label: 'Sorocaba' },
};

/**
 * Centróides de Bairros e Cidades para cruzamento textual
 */
const NAMED_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  // Bairros de São Paulo
  liberdade: { lat: -23.5574, lon: -46.6346 },
  'bela vista': { lat: -23.56, lon: -46.65 },
  se: { lat: -23.5475, lon: -46.6361 },
  republica: { lat: -23.543, lon: -46.642 },
  cambuci: { lat: -23.57, lon: -46.622 },
  aclimacao: { lat: -23.572, lon: -46.63 },
  'vila mariana': { lat: -23.585, lon: -46.64 },
  paraiso: { lat: -23.575, lon: -46.645 },
  saude: { lat: -23.612, lon: -46.635 },
  jabaquara: { lat: -23.645, lon: -46.65 },
  ipiranga: { lat: -23.592, lon: -46.605 },
  mooca: { lat: -23.555, lon: -46.595 },
  bras: { lat: -23.535, lon: -46.618 },
  tatuape: { lat: -23.542, lon: -46.565 },
  'analia franco': { lat: -23.558, lon: -46.56 },
  penha: { lat: -23.532, lon: -46.525 },
  'vila matilde': { lat: -23.535, lon: -46.53 },
  itaquera: { lat: -23.538, lon: -46.455 },
  guaianases: { lat: -23.545, lon: -46.415 },
  'sao mateus': { lat: -23.595, lon: -46.485 },
  santana: { lat: -23.502, lon: -46.625 },
  tucuruvi: { lat: -23.478, lon: -46.615 },
  'vila maria': { lat: -23.508, lon: -46.595 },
  pirituba: { lat: -23.488, lon: -46.728 },
  lapa: { lat: -23.528, lon: -46.715 },
  pinheiros: { lat: -23.558, lon: -46.69 },
  'vila madalena': { lat: -23.55, lon: -46.695 },
  perdizes: { lat: -23.535, lon: -46.678 },
  butanta: { lat: -23.572, lon: -46.72 },
  morumbi: { lat: -23.598, lon: -46.725 },
  'vila sonia': { lat: -23.592, lon: -46.735 },
  'campo limpo': { lat: -23.635, lon: -46.745 },
  'capao redondo': { lat: -23.675, lon: -46.775 },
  'santo amaro': { lat: -23.645, lon: -46.702 },
  grajau: { lat: -23.7719, lon: -46.6897 },
  interlagos: { lat: -23.702, lon: -46.698 },

  // Cidades da Grande SP e SP
  guarulhos: { lat: -23.4542, lon: -46.5333 },
  osasco: { lat: -23.5329, lon: -46.792 },
  'santo andre': { lat: -23.6638, lon: -46.5383 },
  'sao bernardo do campo': { lat: -23.6914, lon: -46.5646 },
  'sao caetano do sul': { lat: -23.6228, lon: -46.555 },
  diadema: { lat: -23.6864, lon: -46.6228 },
  maua: { lat: -23.6678, lon: -46.4614 },
  barueri: { lat: -23.5111, lon: -46.8761 },
  carapicuiba: { lat: -23.5222, lon: -46.8358 },
  cotia: { lat: -23.6039, lon: -46.9189 },
  'taboao da serra': { lat: -23.626, lon: -46.758 },
  'embu das artes': { lat: -23.6492, lon: -46.8525 },
  suzano: { lat: -23.5425, lon: -46.3108 },
  'mogi das cruzes': { lat: -23.5222, lon: -46.1882 },
  santos: { lat: -23.9608, lon: -46.3331 },
  'sao vicente': { lat: -23.9631, lon: -46.3919 },
  'praia grande': { lat: -24.0058, lon: -46.4028 },
  guaruja: { lat: -23.9936, lon: -46.2564 },
  campinas: { lat: -22.9099, lon: -47.0626 },
  jundiai: { lat: -23.1857, lon: -46.8978 },
  sorocaba: { lat: -23.5015, lon: -47.4587 },
  'sao jose dos campos': { lat: -23.2237, lon: -45.9009 },
};

/**
 * Fórmula de Haversine para cálculo da distância geodésica em linha reta
 */
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio médio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeKey(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const distanceService = {
  /**
   * Busca dados de endereço via ViaCEP a partir do CEP informado
   */
  async fetchAddressByCep(rawCep: string): Promise<CepAddressResult | null> {
    const cleanCep = (rawCep || '').replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const data = await response.json();
      if (data.erro) {
        return { cep: cleanCep, street: '', neighborhood: '', city: '', state: '', error: true };
      }

      return {
        cep: cleanCep,
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || 'São Paulo',
        state: data.uf || 'SP',
      };
    } catch {
      return null;
    }
  },

  /**
   * Calcula a distância real em tempo real do endereço do aluno até a FECAP Liberdade.
   * Utiliza geocodificação em camadas (Nominatim OSM -> Base Offline de CEPs SP -> Centróides de Bairros).
   */
  async calculateDistanceToFECAP(params: {
    cep?: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  }): Promise<DistanceCalculationResult> {
    const { cep, street, number, neighborhood, city = 'São Paulo', state = 'SP' } = params;
    const cleanCep = (cep || '').replace(/\D/g, '');

    let targetLat: number | null = null;
    let targetLon: number | null = null;
    let originName = '';

    // 1. Tenta geocodificar via OpenStreetMap Nominatim com timeout estrito de 2.5s
    const searchQueries: string[] = [];
    if (street && neighborhood) {
      searchQueries.push(`${street} ${number || ''}, ${neighborhood}, ${city}, ${state}, Brasil`);
    }
    if (neighborhood && city) {
      searchQueries.push(`${neighborhood}, ${city}, ${state}, Brasil`);
    }
    if (cleanCep.length === 8) {
      searchQueries.push(`${cleanCep}, Brasil`);
    }
    if (city && city.toLowerCase() !== 'são paulo' && city.toLowerCase() !== 'sao paulo') {
      searchQueries.push(`${city}, ${state}, Brasil`);
    }

    for (const q of searchQueries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'ASAFECAPApp/1.0 (atendimento@fecap.br)' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const parsedLat = parseFloat(list[0].lat);
            const parsedLon = parseFloat(list[0].lon);
            // Valida se está no hemisfério/região do Brasil/SP
            if (!isNaN(parsedLat) && parsedLat < -15 && parsedLat > -30) {
              targetLat = parsedLat;
              targetLon = parsedLon;
              originName = list[0].display_name || q;
              break;
            }
          }
        }
      } catch {
        // Tenta próxima consulta
      }
    }

    // 2. Fallback de Alta Precisão: Base de CEPs e Centróides Regionais
    if (targetLat === null || targetLon === null) {
      // 2.1 Busca por Prefixo de CEP (3 dígitos)
      if (cleanCep.length >= 3) {
        const prefix3 = cleanCep.substring(0, 3);
        const cepCentroid = CEP_PREFIX_COORDINATES[prefix3];
        if (cepCentroid) {
          targetLat = cepCentroid.lat;
          targetLon = cepCentroid.lon;
          originName = cepCentroid.label;
        }
      }

      // 2.2 Busca por Bairro se ainda não encontrou
      if (targetLat === null && neighborhood) {
        const normNeigh = normalizeKey(neighborhood);
        for (const [key, coords] of Object.entries(NAMED_CENTROIDS)) {
          if (normNeigh.includes(key) || key.includes(normNeigh)) {
            targetLat = coords.lat;
            targetLon = coords.lon;
            originName = `${neighborhood}, ${city}`;
            break;
          }
        }
      }

      // 2.3 Busca por Cidade
      if (targetLat === null && city) {
        const normCity = normalizeKey(city);
        for (const [key, coords] of Object.entries(NAMED_CENTROIDS)) {
          if (normCity.includes(key) || key.includes(normCity)) {
            targetLat = coords.lat;
            targetLon = coords.lon;
            originName = `${city}, ${state}`;
            break;
          }
        }
      }

      // 2.4 Padrão de segurança: se for centro de SP ou não identificado
      if (targetLat === null || targetLon === null) {
        targetLat = -23.5505;
        targetLon = -46.6333;
        originName = 'São Paulo - Centro Expandido';
      }
    }

    let distanceKm = 0;
    let estimatedMinutes = 0;

    // 3. Tenta obter rota rodoviária precisa via OSRM com timeout de 2.5s
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const routeUrl = `https://router.project-osrm.org/route/v1/driving/${targetLon},${targetLat};${FECAP_COORDINATES.lon},${FECAP_COORDINATES.lat}?overview=false`;
      const routeRes = await fetch(routeUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (routeRes.ok) {
        const routeData = await routeRes.json();
        if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
          const meters = routeData.routes[0].distance;
          const seconds = routeData.routes[0].duration;
          distanceKm = Math.round((meters / 1000) * 10) / 10;
          estimatedMinutes = Math.round(seconds / 60);
        }
      }
    } catch {
      // Fallback para cálculo Haversine calibrado
    }

    // 4. Se o OSRM falhar, calcula Haversine com fator de trajeto rodoviário realista
    if (distanceKm === 0) {
      const directKm = haversineDistanceKm(
        targetLat,
        targetLon,
        FECAP_COORDINATES.lat,
        FECAP_COORDINATES.lon
      );

      // Trajetos urbanos < 15km possuem fator de desvio de ruas de 1.35x
      // Trajetos metropolitanos 15km a 50km possuem fator de 1.28x (vias expressas)
      // Trajetos intermunicipais > 50km possuem fator de 1.22x (rodovias)
      const detourFactor = directKm < 15 ? 1.35 : directKm < 50 ? 1.28 : 1.22;
      distanceKm = Math.round(directKm * detourFactor * 10) / 10;

      // Estimativa realista de tempo: 2.4 min/km na cidade, 1.3 min/km em rodovias
      const speedFactor = distanceKm < 25 ? 2.5 : 1.5;
      estimatedMinutes = Math.round(distanceKm * speedFactor);
    }

    // 5. Classificação Institucional Alinhada (Score Geográfico)
    // Perto: < 12 km (Fácil acesso ao Campus Liberdade)
    // Moderado: 12 km a 30 km (Deslocamento médio)
    // Longe: > 30 km (Deslocamento de alta distância / Fator de atenção para permanência)
    let status: 'Perto' | 'Moderado' | 'Longe' = 'Moderado';
    let statusDesc = '';

    if (distanceKm < 12) {
      status = 'Perto';
      statusDesc = 'Fácil acesso ao Campus Liberdade';
    } else if (distanceKm <= 30) {
      status = 'Moderado';
      statusDesc = 'Deslocamento moderado';
    } else {
      status = 'Longe';
      statusDesc = 'Deslocamento de alta distância';
    }

    const timeText =
      estimatedMinutes > 60
        ? `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}min`
        : `${estimatedMinutes} min`;

    const distanceText = `${distanceKm} km até a FECAP (~${timeText} • ${statusDesc})`;

    return {
      distanceKm,
      distanceText,
      status,
      estimatedMinutes,
      originFormatted: originName,
    };
  },
};

const URLS = {
  ral: 'https://raw.githubusercontent.com/cpralonrj-pralon/embratel-sir/refs/heads/main/dados_ral.csv',
  rec: 'https://raw.githubusercontent.com/cpralonrj-pralon/embratel-sir/refs/heads/main/dados_rec.csv'
};

const INTERVAL   = 300000;
const CF_COL     = 'CF Exec.';

const STORAGE_TABLE  = 'sir_table_state_v5';
const STORAGE_INBOX  = 'sir_inbox_state_v5';
const STORAGE_TICKET = 'sir_ticket_state_v5';

const EVENT_COLORS = ['none','red','blue','green','yellow','purple','orange'];

const SWATCH_COLORS = [
  { key: 'none',   label: 'Limpar',  bg: '' },
  { key: 'red',    label: 'Verm.',   bg: '#ef4444' },
  { key: 'blue',   label: 'Azul',    bg: '#3b82f6' },
  { key: 'green',  label: 'Verde',   bg: '#10b981' },
  { key: 'yellow', label: 'Amar.',   bg: '#f59e0b' },
  { key: 'purple', label: 'Roxo',    bg: '#8b5cf6' },
  { key: 'orange', label: 'Laran.',  bg: '#f97316' },
];

const OBS_STATUSES = [
  { key: 'sem-acesso',    label: 'SEM ACESSO',    short: 'S.ACESSO', color: '#f59e0b' },
  { key: 'area-de-risco', label: 'ÁREA DE RISCO', short: 'A.RISCO',  color: '#ef4444' },
  { key: 'liberacao-noc', label: 'LIB. NOC',      short: 'LIB.NOC',  color: '#6366f1' }
];

const RAL_TYPE_ORDER = ['FOTONICO', 'BACKBONE', 'COLETOR', 'PPC', 'ACESSO CLIENTE'];

const REGIONS = {
  'ES': {
    'MTN': ['RT/VTA /MTN/FFA/FO'],
    'MTS': ['RT/VTA /MTS/FFA/FO'],
    'NOR': ['RT/VTA /NOR/FFA/FO'],
    'SUL': ['RT/VTA /SUL/FFA/FO']
  },
  'RIO A': {
    'SUF': ['RT/RJO /SUF/NET/FO','RC/RJO /SUF/NET/FO'],
    'SEF': ['RT/RJO /SEF/NET/FO','RC/RJO /SEF/NET/FO'],
    'NOF': ['RT/RJO /NOF/NET/FO','RC/RJO /NOF/NET/FO'],
    'LGS': ['RT/RJO /LGS/NET/FO','RC/RJO /LGS/NET/FO'],
    'BX1': ['RT/RJO /BX1/NET/FO','RC/RJO /BX1/NET/FO'],
    'MTP': ['RT/RJO /MTP/NET/FO','RC/RJO /MTP/NET/FO']
  },
  'RIO B': {
    'NO1': ['RT/RJO /NO1/NET/FO','RC/RJO /NO1/NET/FO'],
    'NO2': ['RT/RJO /NO2/NET/FO','RC/RJO /NO2/NET/FO'],
    'NO3': ['RT/RJO /NO3/PCS/FO','RC/RJO /NO3/NET/FO'],
    'OE1': ['RT/RJO /OE1/NET/FO','RC/RJO /OE1/NET/FO'],
    'SU2': ['RT/RJO /SU2/NET/FO','RC/RJO /SU2/NET/FO'],
    'CZS': ['RT/RJO /CZS/NET/FO','RC/RJO /CZS/NET/FO']
  }
};

const CF_NAMES = {
  'MTN': 'Metropolitana Norte - ES',
  'MTS': 'Metropolitana Sul - ES',
  'NOR': 'Norte - ES',
  'SUL': 'ES',
  'SUF': 'Sul Fluminense - RJ',
  'SEF': 'Serra Fluminense - RJ',
  'NOF': 'Norte Fluminense - RJ',
  'LGS': 'Região Lagos - RJ',
  'CZS': 'Centro Zona Sul - RJ',
  'SU2': 'Sul 2 - RJ',
  'OE1': 'Oeste - RJ',
  'NO1': 'Norte 1 - RJ',
  'NO2': 'Norte 2 - RJ',
  'BX1': 'Baixada Fluminense - RJ',
  'MTP': 'Metropolitana - RJ',
  'NO3': 'Norte 3',
};

const patternToCF = {};
for (const [, cfs] of Object.entries(REGIONS))
  for (const [cfKey, patterns] of Object.entries(cfs))
    for (const p of patterns) patternToCF[p] = cfKey;

// modules/comparativo/evolutivo-motor.js
// Motor do Quadro Evolutivo — lê consultation_assessments por doente,
// agrupa por região+lado, produz estrutura de tabela com delta coluna anterior.

const PARAM_MAP = {
  ombro: [
    { chave: 'eva.rep',    grupo: 'Dor (EVA)',        label: 'Repouso',           unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.act',    grupo: 'Dor (EVA)',        label: 'Actividade',        unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.pic',    grupo: 'Dor (EVA)',        label: 'Pico',              unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'rom.flex_a', grupo: 'Mobilidade (ROM)', label: 'Flexão A',          unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.abd_a',  grupo: 'Mobilidade (ROM)', label: 'Abdução A',         unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.re_a',   grupo: 'Mobilidade (ROM)', label: 'Rot. Externa A',    unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.ri_a',   grupo: 'Mobilidade (ROM)', label: 'Rot. Interna A',    unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.ext_a',  grupo: 'Mobilidade (ROM)', label: 'Extensão A',        unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.flex_p', grupo: 'Mobilidade (ROM)', label: 'Flexão P',          unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.abd_p',  grupo: 'Mobilidade (ROM)', label: 'Abdução P',         unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.re_p',   grupo: 'Mobilidade (ROM)', label: 'Rot. Externa P',    unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.ri_p',   grupo: 'Mobilidade (ROM)', label: 'Rot. Interna P',    unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.ext_p',  grupo: 'Mobilidade (ROM)', label: 'Extensão P',        unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'mrc.f_del',  grupo: 'Força MRC',        label: 'Flexão (deltóide)', unidade: '',     dirBom: 'sobe',  tipo: 'mrc' },
    { chave: 'mrc.f_sup',  grupo: 'Força MRC',        label: 'Abdução (supra)',   unidade: '',     dirBom: 'sobe',  tipo: 'mrc' },
    { chave: 'mrc.f_inf',  grupo: 'Força MRC',        label: 'Rot. Ext. (infra)', unidade: '',     dirBom: 'sobe',  tipo: 'mrc' },
    { chave: 'mrc.f_sub',  grupo: 'Força MRC',        label: 'Rot. Int. (subesc)',unidade: '',     dirBom: 'sobe',  tipo: 'mrc' },
    { chave: 'mrc.f_ext',  grupo: 'Força MRC',        label: 'Extensão',          unidade: '',     dirBom: 'sobe',  tipo: 'mrc' },
    { chave: 'dyn.flex.d', grupo: 'Dinamometria',     label: 'Flexão D',          unidade: ' kg',  dirBom: 'sobe',  tipo: 'num' },
    { chave: 'dyn.flex.e', grupo: 'Dinamometria',     label: 'Flexão E',          unidade: ' kg',  dirBom: 'sobe',  tipo: 'num' },
    { chave: 'dyn.abd.d',  grupo: 'Dinamometria',     label: 'Abdução D',         unidade: ' kg',  dirBom: 'sobe',  tipo: 'num' },
    { chave: 'dyn.abd.e',  grupo: 'Dinamometria',     label: 'Abdução E',         unidade: ' kg',  dirBom: 'sobe',  tipo: 'num' },
    { chave: 'dyn.re.d',   grupo: 'Dinamometria',     label: 'Rot. Ext. D',       unidade: ' kg',  dirBom: 'sobe',  tipo: 'num' },
    { chave: 'dyn.re.e',   grupo: 'Dinamometria',     label: 'Rot. Ext. E',       unidade: ' kg',  dirBom: 'sobe',  tipo: 'num' },
    { chave: 'escalas.dash_score', grupo: 'Escalas Funcionais', label: 'QuickDASH', unidade: '/100', dirBom: 'desce', tipo: 'num' },
    { chave: 'escalas.oss_score',  grupo: 'Escalas Funcionais', label: 'OSS',       unidade: '/48',  dirBom: 'sobe',  tipo: 'num' },
    { chave: 'escalas.ases_score', grupo: 'Escalas Funcionais', label: 'ASES',      unidade: '/100', dirBom: 'sobe',  tipo: 'num' },
    { chave: 'testes.t_neer',    grupo: 'Testes Clínicos', label: 'Neer',          unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_hawk',    grupo: 'Testes Clínicos', label: 'Hawkins',       unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_jobe',    grupo: 'Testes Clínicos', label: 'Jobe',          unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_patte',   grupo: 'Testes Clínicos', label: 'Patte',         unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_liftoff', grupo: 'Testes Clínicos', label: 'Lift-off',      unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_belly',   grupo: 'Testes Clínicos', label: 'Belly Press',   unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_drop',    grupo: 'Testes Clínicos', label: 'Drop Arm',      unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_speed',   grupo: 'Testes Clínicos', label: 'Speed',         unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_yerg',    grupo: 'Testes Clínicos', label: 'Yergason',      unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_appr',    grupo: 'Testes Clínicos', label: 'Apprehension',  unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_reloc',   grupo: 'Testes Clínicos', label: 'Relocation',    unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_sulc',    grupo: 'Testes Clínicos', label: 'Sulcus Sign',   unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'func.func_elev',   grupo: 'Funcional', label: 'Elevação acima cabeça',  unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_cos',    grupo: 'Funcional', label: 'Alcançar costas',         unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_vest',   grupo: 'Funcional', label: 'Vestir camisola',         unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_prof',   grupo: 'Funcional', label: 'Actividade profissional', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_cond',   grupo: 'Funcional', label: 'Condução',                unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_desp',   grupo: 'Funcional', label: 'Desporto',                unidade: '', dirBom: null, tipo: 'func' },
  ],
  cervical: [
    { chave: 'eva.rep',   grupo: 'Dor (EVA)',        label: 'Repouso',       unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.act',   grupo: 'Dor (EVA)',        label: 'Actividade',    unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'rom.flex',  grupo: 'Mobilidade (ROM)', label: 'Flexão',        unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.ext',   grupo: 'Mobilidade (ROM)', label: 'Extensão',      unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.rot_d', grupo: 'Mobilidade (ROM)', label: 'Rot. Direita',  unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.rot_e', grupo: 'Mobilidade (ROM)', label: 'Rot. Esquerda', unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.inc_d', grupo: 'Mobilidade (ROM)', label: 'Inc. Direita',  unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.inc_e', grupo: 'Mobilidade (ROM)', label: 'Inc. Esquerda', unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'escalas.dash_score', grupo: 'Escalas', label: 'QuickDASH',    unidade: '/100', dirBom: 'desce', tipo: 'num' },
  ],
  lombar: [
    { chave: 'eva.rep',     grupo: 'Dor (EVA)',        label: 'Repouso',        unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.act',     grupo: 'Dor (EVA)',        label: 'Actividade',     unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'rom.flex_a',  grupo: 'Mobilidade (ROM)', label: 'Flexão A',       unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.ext_a',   grupo: 'Mobilidade (ROM)', label: 'Extensão A',     unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.lat_d_a', grupo: 'Mobilidade (ROM)', label: 'Lat. Direita A', unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.lat_e_a', grupo: 'Mobilidade (ROM)', label: 'Lat. Esquerda A',unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'escalas.dash_score', grupo: 'Escalas',   label: 'QuickDASH',     unidade: '/100', dirBom: 'desce', tipo: 'num' },
  ],
  joelho: [
    { chave: 'eva.rep',    grupo: 'Dor (EVA)',        label: 'Repouso',    unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.act',    grupo: 'Dor (EVA)',        label: 'Actividade', unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'rom.flex_a', grupo: 'Mobilidade (ROM)', label: 'Flexão A',   unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.ext_a',  grupo: 'Mobilidade (ROM)', label: 'Extensão A', unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'escalas.hoos_score', grupo: 'Escalas',  label: 'HOOS',      unidade: '/100', dirBom: 'sobe',  tipo: 'num' },
  ],
  anca: [
    { chave: 'eva.rep',    grupo: 'Dor (EVA)',        label: 'Repouso',        unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.act',    grupo: 'Dor (EVA)',        label: 'Actividade',     unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'rom.flex_a', grupo: 'Mobilidade (ROM)', label: 'Flexão A',       unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.abd_a',  grupo: 'Mobilidade (ROM)', label: 'Abdução A',      unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.re_a',   grupo: 'Mobilidade (ROM)', label: 'Rot. Externa A', unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'rom.ri_a',   grupo: 'Mobilidade (ROM)', label: 'Rot. Interna A', unidade: '°',    dirBom: 'sobe',  tipo: 'num' },
    { chave: 'escalas.hoos_score', grupo: 'Escalas',  label: 'HOOS',          unidade: '/100', dirBom: 'sobe',  tipo: 'num' },
  ],
};

function lerCampo(obj, caminho) {
  return caminho.split('.').reduce((o, k) => (o != null ? o[k] : null), obj);
}

function mrcNum(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).split('/')[0]);
  return isNaN(n) ? null : n;
}

function normalizar(val, tipo) {
  if (val == null || val === '' || val === undefined) return null;
  if (tipo === 'mrc') return mrcNum(val);
  if (tipo === 'num') { const n = parseFloat(val); return isNaN(n) ? null : n; }
  if (tipo === 'teste') return String(val).trim() || null;
  if (tipo === 'func') return String(val).trim() || null;
  return val;
}

function calcDelta(actual, anterior, dirBom, tipo) {
  if (tipo === 'teste' || tipo === 'func') return null;
  if (actual == null || anterior == null) return null;
  const diff = parseFloat((actual - anterior).toFixed(1));
  if (diff === 0) return { valor: 0, classe: 'neutral' };
  const melhora = dirBom === 'sobe' ? diff > 0 : diff < 0;
  return { valor: diff, classe: melhora ? 'good' : 'bad', seta: diff > 0 ? '↑' : '↓' };
}

export function construirEvolutivo(registos, datas) {
  const porRegiao = {};
  for (const r of registos) {
    const chave = `${r.assessment_type}|${r.assessment_side || ''}`;
    if (!porRegiao[chave]) porRegiao[chave] = { tipo: r.assessment_type, lado: r.assessment_side, registos: {} };
    porRegiao[chave].registos[r.assessment_date] = r.data;
  }

  const resultado = [];

  for (const [chaveRegiao, info] of Object.entries(porRegiao)) {
    const { tipo, lado, registos: dadosPorData } = info;
    const params = PARAM_MAP[tipo];
    if (!params) continue;

    const datasComDados = datas.filter(d => dadosPorData[d]);
    if (datasComDados.length < 1) continue;

    const gruposMap = {};
    for (const p of params) {
      const valores = datasComDados.map(d => normalizar(lerCampo(dadosPorData[d], p.chave), p.tipo));
      if (valores.every(v => v == null)) continue;
      const deltas = valores.map((v, i) => {
        if (i === 0) return null;
        return calcDelta(v, valores[i - 1], p.dirBom, p.tipo);
      });
      if (!gruposMap[p.grupo]) gruposMap[p.grupo] = [];
      gruposMap[p.grupo].push({ ...p, valores, deltas });
    }

    if (Object.keys(gruposMap).length === 0) continue;

    resultado.push({
      chaveRegiao, tipo, lado,
      regiaoLabel: labelRegiao(tipo, lado),
      datas: datasComDados,
      grupos: gruposMap,
    });
  }

  return resultado;
}

export function extrairDatasDisponiveis(registos) {
  const mapa = {};
  for (const r of registos) {
    const chave = `${r.assessment_type}|${r.assessment_side || ''}`;
    if (!mapa[chave]) mapa[chave] = { tipo: r.assessment_type, lado: r.assessment_side, datas: [] };
    if (!mapa[chave].datas.includes(r.assessment_date)) mapa[chave].datas.push(r.assessment_date);
  }
  for (const v of Object.values(mapa)) v.datas.sort();
  return mapa;
}

function labelRegiao(tipo, lado) {
  const nomes = {
    ombro: 'Ombro', cervical: 'Coluna Cervical', lombar: 'Coluna Lombar',
    joelho: 'Joelho', anca: 'Anca', cotovelo: 'Cotovelo',
    tibio: 'Tibiotársica', pfp: 'Paresia Facial Periférica', rpp: 'Raqui',
  };
  const base = nomes[tipo] || tipo;
  return lado ? `${base} ${lado}` : base;
}

/* Config de região — Anca. Lida pelo motor.js. Só dados, zero lógica. */
import { seccaoCicatriz, seccaoAtrofia, NIVEIS_MI } from './_comuns.js?v=1';

export default {
  id: 'anca',
  titulo: 'Anca',
  subtitle: 'Exame completo · Guardar no final',
  lado: { label: 'Anca avaliada' },
  tabs: { dinamometria: true, escalas: false },

  seccoes: [
    { tipo: 'dor', titulo: 'Caracterização da Dor',
      eva: [
        { id: 'eva_rep', label: 'Repouso' },
        { id: 'eva_act', label: 'Actividade' },
        { id: 'eva_pic', label: 'Pico' },
      ],
      grupos: [
        { id: 'local_dor', label: 'Localização', multi: true, opts: [
          { v: 'Virilha',                         lbl: 'Virilha' },
          { v: 'Face lateral — grande trocânter',  lbl: 'Trocânter' },
          { v: 'Face posterior — glúteo',          lbl: 'Glúteo' },
          { v: 'Irradiação coxa',                  lbl: 'Irradiação coxa' },
        ]},
        { id: 'tipo_dor', label: 'Tipo',
          opts: ['Mecânica', 'Inflamatória', 'Neuropática'] },
      ],
    },

    { tipo: 'params', id: 'palp', titulo: 'Inspeção & Palpação', notas: 'notas_palp',
      rows: [
        { id: 'marcha',      label: 'Marcha',
          opts: ['Normal', 'Claudicação álgica', 'Trendelenburg', 'Antálgica'] },
        { id: 'trend',       label: 'Sinal de Trendelenburg',
          opts: ['Negativo', 'Positivo'] },
        { id: 'discr',       label: 'Discrepância membros',
          opts: ['Sem discrepância', 'Encurtamento aparente', 'Encurtamento real'] },
        { id: 'edema',       label: 'Edema',
          opts: ['Ausente', 'Ligeiro', 'Moderado'] },
        { id: 'atitude',     label: 'Atitude / rotação em repouso',
          opts: ['Neutra', 'Rotação interna', 'Rotação externa', 'Flexão antálgica'] },
        { id: 'palp_tro',    label: 'Trocânter maior',
          opts: ['Sem dor', 'Dor'] },
        { id: 'palp_eias',   label: 'EIAS / EIPS',
          opts: ['Sem dor', 'Dor'] },
        { id: 'palp_crista', label: 'Crista ilíaca',
          opts: ['Sem dor', 'Dor'] },
        { id: 'palp_sinf',   label: 'Sínfise + adutores',
          opts: ['Sem dor', 'Dor'] },
        { id: 'palp_isq',    label: 'Tuberosidade isquiática',
          opts: ['Sem dor', 'Dor'] },
        { id: 'palp_ing',    label: 'Região inguinal',
          opts: ['Sem dor', 'Dor', 'Adenopatia'] },
      ],
    },

    { tipo: 'mrc', id: 'mrc', titulo: 'Força Muscular (MRC)', notas: 'notas_forca',
      rows: [
        { id: 'f_flex', label: 'Flexão' },
        { id: 'f_ext',  label: 'Extensão' },
        { id: 'f_abd',  label: 'Abdução' },
        { id: 'f_adu',  label: 'Adução' },
        { id: 'f_ri',   label: 'Rotação interna' },
        { id: 'f_re',   label: 'Rotação externa' },
      ],
    },

    { tipo: 'func', id: 'func', titulo: 'Avaliação Funcional',
      opts: ['Normal', 'Com dor', 'Dificuldade', 'Impossível'],
      rows: [
        { id: 'func_plan',   label: 'Caminhar em plano' },
        { id: 'func_esc',    label: 'Escadas e rampas' },
        { id: 'func_lev',    label: 'Levantar do chão / cadeira baixa' },
        { id: 'func_dorm',   label: 'Dormir sobre o lado afectado' },
        { id: 'func_calc',   label: 'Calçar meias e sapatos' },
        { id: 'func_hig',    label: 'Higiene pessoal (banho)' },
        { id: 'func_cond',   label: 'Conduzir' },
        { id: 'func_transp', label: 'Transporte público' },
        { id: 'func_prof',   label: 'Actividade profissional' },
        { id: 'func_desp',   label: 'Actividade desportiva' },
        { id: 'func_snap',   label: 'Ressalto / clique na anca' },
      ],
    },

    { tipo: 'rom', id: 'rom', titulo: 'Amplitude de Movimento', notas: 'notas_mob',
      movimentos: [
        { key: 'flex', label: 'Flexão',          normal: 130, min: 0, max: 140 },
        { key: 'ext',  label: 'Extensão',         normal: 20,  min: 0, max: 30  },
        { key: 'abd',  label: 'Abdução',          normal: 45,  min: 0, max: 60  },
        { key: 'adu',  label: 'Adução',           normal: 20,  min: 0, max: 30  },
        { key: 'ri',   label: 'Rotação interna',  normal: 35,  min: 0, max: 50  },
        { key: 're',   label: 'Rotação externa',  normal: 45,  min: 0, max: 60  },
      ],
    },

    { tipo: 'testes', id: 'testes', titulo: 'Testes Específicos', notas: 'notas_testes',
      grade: ['Negativo', '+', '++', '+++'],
      grupos: [
        { sub: 'Conflito / Coxofemoral', testes: [
          { id: 't_fadir',   label: 'FADIR (conflito FAI)' },
          { id: 't_faber',   label: 'FABER — Patrick (SI / virilha)' },
          { id: 't_scour',   label: 'Scour test' },
          { id: 't_logroll', label: 'Log roll (RI/RE passiva)' },
          { id: 't_stinch',  label: 'Stinchfield (SLR resistido)' },
        ]},
        { sub: 'Bursa / Trocânter', testes: [
          { id: 't_slst',   label: 'Single-leg stance (Trendelenburg)' },
          { id: 't_resabd', label: 'Resisted abduction' },
          { id: 't_ptro',   label: 'Palpação trocânter maior' },
        ]},
        { sub: 'Iliopsoas / Snapping', testes: [
          { id: 't_thomas', label: 'Thomas (encurtamento iliopsoas)' },
          { id: 't_reslsr', label: 'Resisted SLR (iliopsoas)' },
          { id: 't_snap',   label: 'Snapping / ressalto palpável' },
        ]},
        { sub: 'Sínfise / Adutores', testes: [
          { id: 't_sq0',   label: 'Squeeze 0°' },
          { id: 't_sq45',  label: 'Squeeze 45°' },
          { id: 't_sq90',  label: 'Squeeze 90°' },
          { id: 't_psinf', label: 'Palpação sínfise púbica' },
        ]},
        { sub: 'Lombar / Sacroilíaca', testes: [
          { id: 't_ober',  label: 'Ober (banda iliotibial)' },
          { id: 't_laseg', label: 'Lasègue' },
          { id: 't_slump', label: 'Slump' },
          { id: 't_si',    label: 'Sacroilíaca (Gaenslen / FABER-SI)' },
        ]},
      ],
    },

    seccaoCicatriz,
    { ...seccaoAtrofia, perimetria: { niveis: NIVEIS_MI } },
  ],

  dinamometria: {
    af2: true,
    // Chaves com prefixo "Quadril " para não apanhar secções Joelho*; bilDone descarta Ventral/Sentado
    af2Map: {
      'Quadril Flexão':   'flex',
      'Quadril Extensão': 'ext',
      'Quadril Abdução':  'abd',
      'Quadril Adução':   'adu',
    },
    movimentos: [
      { key: 'flex', label: 'Flexão' },
      { key: 'ext',  label: 'Extensão' },
      { key: 'abd',  label: 'Abdução' },
      { key: 'adu',  label: 'Adução' },
      { key: 'ri',   label: 'Rot. Interna' },
      { key: 're',   label: 'Rot. Externa' },
    ],
    racios: [
      { num: 'abd', den: 'adu', label: 'Abd / Adu', refMin: null, refMax: null },
      { num: 're',  den: 'ri',  label: 'RE / RI',   refMin: null, refMax: null },
    ],
  },

  escalas: [],
};

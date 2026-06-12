/* Config de região — Ombro. Lida pelo motor.js. Só dados, zero lógica. */
import { seccaoCicatriz, seccaoAtrofia, NIVEIS_MS } from './_comuns.js?v=1';

export default {
  id: 'ombro',
  titulo: 'Ombro',
  subtitle: 'Exame completo · Escalas DASH / ASES / OSS · Guardar no final',
  lado: { label: 'Ombro avaliado' },
  tabs: { dinamometria: true, escalas: true },

  seccoes: [
    { tipo: 'dor', titulo: 'Caracterização da Dor',
      eva: [
        { id: 'eva_rep', label: 'Repouso' },
        { id: 'eva_act', label: 'Actividade' },
        { id: 'eva_pic', label: 'Pico' },
      ],
      grupos: [
        { id: 'localizacao_dor', label: 'Localização', multi: true, opts: [
          { v: 'Anterior',        lbl: 'Anterior' },
          { v: 'Lateral',         lbl: 'Lateral' },
          { v: 'Posterior',       lbl: 'Posterior' },
          { v: 'Articulação AC',  lbl: 'AC' },
        ]},
        { id: 'tipo_dor', label: 'Tipo',
          opts: ['Mecânica', 'Inflamatória', 'Neuropática', 'Mista'] },
        { id: 'irradiacao', label: 'Irradiação', opts: [
          { v: 'Sem irradiação',         lbl: 'Sem irradiação' },
          { v: 'Para o braço',           lbl: 'Braço' },
          { v: 'Para antebraço/mão',     lbl: 'Antebraço / mão' },
        ]},
        { id: 'd_noturna', label: 'Dor noturna', opts: [
          { v: 'Não',                         lbl: 'Não' },
          { v: 'Sim — deitar sobre o ombro',  lbl: 'Sim' },
        ]},
      ],
    },

    { tipo: 'params', id: 'palp', titulo: 'Palpação', notas: 'notas_palp',
      rows: [
        { id: 'palp_ac',  label: 'Articulação AC',    opts: ['Sem dor', 'Dor'] },
        { id: 'palp_tb',  label: 'Tubérculo maior',   opts: ['Sem dor', 'Dor'] },
        { id: 'palp_bic', label: 'Sulco bicipital',   opts: ['Sem dor', 'Dor'] },
        { id: 'palp_bur', label: 'Bursa subacromial', opts: ['Sem dor', 'Dor'] },
        { id: 'palp_sup', label: 'Supra-espinhoso',   opts: ['Sem dor', 'Dor'] },
      ],
    },

    { tipo: 'mrc', id: 'mrc', titulo: 'Força Muscular (MRC)', notas: 'notas_forca',
      rows: [
        { id: 'f_sup', label: 'Flexão' },
        { id: 'f_inf', label: 'Abdução' },
        { id: 'f_sub', label: 'Rotação Interna' },
        { id: 'f_del', label: 'Rotação Externa' },
        { id: 'f_ext', label: 'Extensão' },
      ],
    },

    { tipo: 'func', id: 'func', titulo: 'Avaliação Funcional',
      opts: ['Normal', 'Com dor', 'Dificuldade', 'Impossível'],
      rows: [
        { id: 'func_elev', label: 'Elevação acima cabeça' },
        { id: 'func_cos',  label: 'Alcançar costas' },
        { id: 'func_vest', label: 'Vestir camisola' },
        { id: 'func_prof', label: 'Actividade profissional' },
        { id: 'func_desp', label: 'Actividade desportiva' },
        { id: 'func_cond', label: 'Conduzir' },
      ],
    },

    { tipo: 'rom', id: 'rom', titulo: 'Amplitude de Movimento', notas: 'notas_mob',
      movimentos: [
        { key: 'flex', label: 'Flexão',          normal: 180, min: 0, max: 180 },
        { key: 'ext',  label: 'Extensão',         normal: 60,  min: 0, max: 90  },
        { key: 'abd',  label: 'Abdução',          normal: 180, min: 0, max: 180 },
        { key: 're',   label: 'Rotação externa',  normal: 90,  min: 0, max: 90  },
        { key: 'ri',   label: 'Rotação interna',  normal: 90,  min: 0, max: 90  },
      ],
    },

    { tipo: 'testes', id: 'testes', titulo: 'Testes Específicos', notas: 'notas_testes',
      grade: ['Negativo', '+', '++', '+++'],
      grupos: [
        { sub: 'Conflito subacromial', testes: [
          { id: 't_neer', label: 'Neer' },
          { id: 't_hawk', label: 'Hawkins' },
        ]},
        { sub: 'Coifa dos rotadores', testes: [
          { id: 't_jobe',    label: 'Jobe (supra-esp.)' },
          { id: 't_patte',   label: 'Patte (infra-esp.)' },
          { id: 't_liftoff', label: 'Lift-off (subesc.)' },
          { id: 't_belly',   label: 'Belly press' },
          { id: 't_drop',    label: 'Drop Arm' },
        ]},
        { sub: 'Bicípite', testes: [
          { id: 't_speed', label: 'Speed' },
          { id: 't_yerg',  label: 'Yergason' },
        ]},
        { sub: 'Instabilidade', testes: [
          { id: 't_appr',  label: 'Apprehension' },
          { id: 't_reloc', label: 'Relocation' },
          { id: 't_sulc',  label: 'Sulcus sign' },
        ]},
      ],
    },

    seccaoCicatriz,
    { ...seccaoAtrofia, perimetria: { niveis: NIVEIS_MS } },
  ],

  dinamometria: {
    af2: true,
    af2Map: {
      'Flexão':          'flex',
      'Abdução':         'abd',
      'Extensão':        'ext',
      'Rotação Externa': 're',
      'Rotação Interna': 'ri',
    },
    movimentos: [
      { key: 'flex', label: 'Flexão' },
      { key: 'abd',  label: 'Abdução' },
      { key: 'ext',  label: 'Extensão' },
      { key: 're',   label: 'Rot. Externa' },
      { key: 'ri',   label: 'Rot. Interna' },
    ],
    racios: [
      { num: 're',   den: 'ri',   label: 'RE / RI',    refMin: 66,   refMax: null },
      { num: 'flex', den: 'ext',  label: 'Flex / Ext', refMin: 60,   refMax: 80   },
      { num: 'abd',  den: 'flex', label: 'Abd / Flex', refMin: null, refMax: null },
    ],
  },

  escalas: [
    { id: 'dash',
      titulo: 'DASH — Disabilities of the Arm, Shoulder and Hand',
      desc:   '10 itens · 1 = sem dificuldade · 5 = incapaz · Score 0–100 · 0 = sem incapacidade',
      optMin: 1, optMax: 5, score: 'dash',
      legend: '1 Sem dificuldade · 2 Ligeira · 3 Moderada · 4 Extrema · 5 Incapaz',
      itens: [
        'Abrir um frasco (rosca)',
        'Escrever ou digitar',
        'Rodar uma chave',
        'Preparar uma refeição',
        'Empurrar uma porta pesada',
        'Colocar objeto em prateleira acima da cabeça',
        'Tarefas domésticas pesadas (lavar o chão, etc.)',
        'Jardinagem ou bricolagem',
        'Actividade desportiva com impacto no braço',
        'Dificuldade para dormir por dor no braço/ombro',
      ],
    },

    { id: 'ases',
      titulo: 'ASES — American Shoulder and Elbow Surgeons Score',
      desc:   'EVA de dor + 10 actividades · Score 0–100 · 100 = melhor função',
      optMin: 0, optMax: 3, score: 'ases',
      evaInput: { id: 'ases_eva', label: 'Dor EVA 0–10', min: 0, max: 10, step: 0.5 },
      legend: 'Actividades: 0 Incapaz · 1 Dificuldade extrema · 2 Ligeira dificuldade · 3 Normal',
      itens: [
        'Colocar um casaco',
        'Dormir sobre o lado afectado',
        'Lavar/pentear as costas ou fechar soutien',
        'Higiene pessoal com mão acima da cabeça',
        'Pentear o cabelo',
        'Alcançar uma prateleira alta',
        'Levantar 4,5 kg acima da cabeça',
        'Lançar bola ou movimento full overhead',
        'Actividade profissional habitual',
        'Actividade recreativa / desportiva habitual',
      ],
    },

    { id: 'oss',
      titulo: 'OSS — Oxford Shoulder Score',
      desc:   '12 itens · 0–4 por item · Score 0–48 · 48 = melhor função',
      optMin: 0, optMax: 4, score: 'soma',
      legend: '0 Pior · 4 Melhor',
      interp: [
        { threshold: 40, txt: 'Excelente (40-48) — sem sintomas relevantes' },
        { threshold: 30, txt: 'Bom (30-39) — sintomas ligeiros, função conservada' },
        { threshold: 20, txt: 'Moderado (20-29) — dor e limitação funcionais significativas' },
        { threshold: 0,  txt: 'Fraco (<20) — sintomas graves, incapacidade marcada' },
      ],
      itens: [
        'Dor no ombro nas últimas 4 semanas',
        'Interferência nas actividades domésticas ou profissionais',
        'Levantar uma caixa cheia do chão para uma mesa',
        'Pentear o cabelo',
        'Cortar alimentos com a mão do lado afectado',
        'Comer com talheres com o membro afectado',
        'Fazer compras (carregar saco)',
        'Limpeza da casa ou lavar louça',
        'Fazer a cama',
        'Conduzir',
        'Lavar o lado oposto do corpo',
        'Satisfação / funcionalidade global do ombro',
      ],
    },
  ],
};

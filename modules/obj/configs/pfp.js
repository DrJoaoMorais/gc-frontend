import { seccaoCicatriz } from './_comuns.js';

export default {
  titulo: 'Paresia Facial Periférica',
  emoji: '🥴',
  subtitle: 'VII par craniano',
  lado: false,
  seccoes: [

    { tipo: 'params', id: 'pfp_inicial', titulo: 'Avaliação inicial', notas: 'notas_pfp_inicial',
      rows: [
        { id: 'pfp_lateralidade', label: 'Lateralidade',     opts: ['Direita','Esquerda'] },
        { id: 'pfp_instalacao',   label: 'Instalação',        opts: ['Súbita','Progressiva'] },
        { id: 'pfp_episodio',     label: 'Episódio',          opts: ['Único','Recorrente'] },
        { id: 'pfp_su',           label: 'Recorreu ao SU',    opts: ['Sim','Não'] },
        { id: 'pfp_cortico',      label: 'Corticoterapia',    opts: ['Sim','Não'] },
        { id: 'pfp_aciclovir',    label: 'Aciclovir',         opts: ['Sim','Não'] },
      ],
    },

    { tipo: 'params', id: 'pfp_repouso', titulo: 'Inspecção em repouso', notas: 'notas_pfp_repouso',
      rows: [
        { id: 'pfp_simetria',    label: 'Simetria facial',          opts: ['Simétrica','Assimétrica'] },
        { id: 'pfp_sulco_front', label: 'Sulco frontal',            opts: ['Normal','Apagado'] },
        { id: 'pfp_fenda_palp',  label: 'Fenda palpebral',          opts: ['Normal','Aumentada'] },
        { id: 'pfp_lagoft_rep',  label: 'Lagoftalmo em repouso',    opts: ['Ausente','Presente'] },
        { id: 'pfp_olho_seco',   label: 'Olho seco visível',        opts: ['Ausente','Presente'] },
        { id: 'pfp_sulco_nl',    label: 'Sulco nasolabial',         opts: ['Preservado','Apagado'] },
        { id: 'pfp_comissura',   label: 'Comissura labial',         opts: ['Simétrica','Desvio contralateral'] },
        { id: 'pfp_tonus',       label: 'Tónus facial',             opts: ['Normal','Hipotonia'] },
        { id: 'pfp_mov_inv',     label: 'Movimentos involuntários', opts: ['Ausentes','Sincinesias','Espasmos'] },
        { id: 'pfp_saliva_rep',  label: 'Escorrimento de saliva',   opts: ['Não','Sim'] },
      ],
    },

    { tipo: 'testes', id: 'pfp_motor', titulo: 'Motricidade — VII par', notas: 'notas_pfp_motor',
      grade: ['Normal','Diminuído','Ausente'],
      grupos: [
        { sub: 'Região frontal', testes: [
          { id: 'pfp_t_sobranc',   label: 'Elevação sobrancelhas' },
          { id: 'pfp_t_rugas',     label: 'Rugas frontais' },
          { id: 'pfp_t_franzir',   label: 'Franzir testa' },
        ]},
        { sub: 'Região palpebral', testes: [
          { id: 'pfp_t_fecho_s',   label: 'Fecho palpebral suave' },
          { id: 'pfp_t_fecho_f',   label: 'Fecho palpebral forçado' },
          { id: 'pfp_t_lagoft',    label: 'Lagoftalmo com esforço' },
          { id: 'pfp_t_bell',      label: 'Sinal de Bell' },
          { id: 'pfp_t_piscar',    label: 'Piscar espontâneo' },
        ]},
        { sub: 'Região nasal', testes: [
          { id: 'pfp_t_narinas',   label: 'Dilatação narinas' },
          { id: 'pfp_t_nariz',     label: 'Desvio ponta do nariz' },
        ]},
        { sub: 'Região oral', testes: [
          { id: 'pfp_t_dentes',    label: 'Mostrar dentes' },
          { id: 'pfp_t_sorriso',   label: 'Sorriso' },
          { id: 'pfp_t_assobiar',  label: 'Assobiar' },
          { id: 'pfp_t_bochechas', label: 'Insuflar bochechas' },
          { id: 'pfp_t_liquidos',  label: 'Reter líquidos na boca' },
        ]},
      ],
    },

    { tipo: 'params', id: 'pfp_func', titulo: 'Função orofacial e ocular', notas: 'notas_pfp_func',
      rows: [
        { id: 'pfp_articulacao',  label: 'Articulação da fala',      opts: ['Normal','Disartria ligeira','Disartria moderada'] },
        { id: 'pfp_selagem',      label: 'Selagem labial',           opts: ['Preservada','Diminuída'] },
        { id: 'pfp_ctrl_liq',     label: 'Controlo oral líquidos',   opts: ['Preservado','Escape'] },
        { id: 'pfp_mastigacao',   label: 'Mastigação',               opts: ['Normal','Alterada'] },
        { id: 'pfp_fecho_oc',     label: 'Fecho ocular',             opts: ['Completo','Incompleto'] },
        { id: 'pfp_lacrimejo',    label: 'Lacrimejo',                opts: ['Normal','Diminuído','Aumentado'] },
        { id: 'pfp_hiperemia',    label: 'Hiperemia conjuntival',    opts: ['Ausente','Presente'] },
        { id: 'pfp_queratite',    label: 'Risco de queratite',       opts: ['Não','Sim'] },
        { id: 'pfp_paladar',      label: 'Paladar (2/3 anteriores)', opts: ['Normal','Alterado','Ausente'] },
        { id: 'pfp_hiperacusia',  label: 'Hiperacusia',              opts: ['Não','Sim'] },
        { id: 'pfp_dor_retro',    label: 'Dor retroauricular',       opts: ['Não','Sim'] },
      ],
    },

    { tipo: 'testes', id: 'pfp_sincinesias', titulo: 'Sincinesias e sequelas', notas: 'notas_pfp_sinc',
      grade: ['Negativo','Sim'],
      grupos: [
        { sub: 'Sincinesias', testes: [
          { id: 'pfp_sinc_olho_boca', label: 'Sincinesia olho → boca' },
          { id: 'pfp_sinc_boca_olho', label: 'Sincinesia boca → olho' },
        ]},
        { sub: 'Sequelas', testes: [
          { id: 'pfp_espasmo',       label: 'Espasmo hemifacial' },
          { id: 'pfp_contratura',    label: 'Contratura facial' },
          { id: 'pfp_lagrimas_croc', label: 'Lágrimas de crocodilo' },
        ]},
      ],
    },

    { tipo: 'grading', id: 'pfp_hb', titulo: 'Escala de House-Brackmann',
      escalas: [{
        id: 'pfp_hb',
        titulo: 'House-Brackmann',
        score: 'hb',
        desc: 'Seleccionar o grau que melhor descreve a função facial global.',
        legend: 'I = Normal · II = Ligeiro · III = Moderado · IV = Mod–grave · V = Grave · VI = Paralisia total',
        optMin: 1, optMax: 6,
        itens: [
          'Grau I — Função normal em todos os territórios',
          'Grau II — Ligeira fraqueza à inspecção; movimentos simétricos em repouso',
          'Grau III — Assimetria visível; fecho ocular com esforço; pode mover testa',
          'Grau IV — Assimetria evidente; sem movimento da testa; fecho ocular incompleto',
          'Grau V — Mínimo movimento perceptível; assimetria severa em repouso',
          'Grau VI — Sem movimento',
        ],
      }],
    },

    { tipo: 'grading', id: 'pfp_sb_repouso', titulo: 'Sunnybrook — Simetria em repouso',
      escalas: [{
        id: 'pfp_repouso',
        titulo: 'Simetria em repouso (penalidade × 5)',
        score: 'sunnybrook',
        desc: '0 = simétrico · 1 = ligeira assimetria · 2 = moderada · 3 = severa · 4 = muito severa.',
        legend: '0 (simétrico) → 4 (muito assimétrico)',
        optMin: 0, optMax: 4,
        itens: ['Olho','Bochecha / nariz','Boca'],
      }],
    },

    { tipo: 'grading', id: 'pfp_sb_vol', titulo: 'Sunnybrook — Movimentos voluntários',
      escalas: [{
        id: 'pfp_voluntarios',
        titulo: 'Movimentos voluntários (pontuação × 4)',
        score: 'sunnybrook',
        desc: '1 = sem movimento · 2 = ligeiro · 3 = moderado · 4 = quase completo · 5 = simétrico ao lado são.',
        legend: '1 (sem movimento) → 5 (normal)',
        optMin: 1, optMax: 5,
        itens: ['Elevação da sobrancelha','Fecho ocular suave','Sorriso com dentes','Franzir lábios (pucker)','Mostrar dentes / snarl'],
      }],
    },

    { tipo: 'grading', id: 'pfp_sb_sinc', titulo: 'Sunnybrook — Sincinesias',
      escalas: [{
        id: 'pfp_sincinesias',
        titulo: 'Sincinesias (penalidade directa)',
        score: 'sunnybrook',
        desc: '0 = nenhuma · 1 = ligeira · 2 = moderada · 3 = severa.',
        legend: '0 (nenhuma) → 3 (severa)',
        optMin: 0, optMax: 3,
        itens: ['Elevação da sobrancelha','Fecho ocular','Sorriso','Franzir lábios','Mostrar dentes'],
      }],
    },

    { tipo: 'grading', id: 'pfp_sb_resultado', titulo: 'Sunnybrook — Score composto',
      escalas: [{
        id: 'pfp_sunnybrook',
        titulo: 'Score composto Sunnybrook',
        score: 'sunnybrook',
        desc: 'Calculado automaticamente: (Voluntários × 4) − (Repouso × 5) − Sincinesias.',
        legend: '0–30 Grave · 31–60 Mod–grave · 61–75 Moderado · 76–89 Ligeiro · 90–100 Normal',
        optMin: 0, optMax: 0,
        itens: [],
      }],
    },

    seccaoCicatriz,

  ]
};

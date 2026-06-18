import { seccaoCicatriz, seccaoAtrofia } from './_comuns.js';

export const config = {
  titulo: 'Paresia Facial Periférica',
  lado: false,
  seccoes: [

    {
      id: 'pfp_inicial',
      titulo: 'Avaliação inicial',
      tipo: 'params',
      campos: [
        { id: 'pfp_data_inicio',   label: 'Data/hora de início',  type: 'text', placeholder: 'dd/mm/aaaa hh:mm' },
        { id: 'pfp_lateralidade',  label: 'Lateralidade',         type: 'radio', options: ['Direita','Esquerda'] },
        { id: 'pfp_instalacao',    label: 'Instalação',           type: 'radio', options: ['Súbita','Progressiva'] },
        { id: 'pfp_episodio',      label: 'Episódio',             type: 'radio', options: ['Único','Recorrente'] },
        { id: 'pfp_su',            label: 'Recorreu ao SU',       type: 'radio', options: ['Sim','Não'] },
        { id: 'pfp_cortico',       label: 'Corticoterapia',       type: 'radio', options: ['Sim','Não'] },
        { id: 'pfp_aciclovir',     label: 'Aciclovir',            type: 'radio', options: ['Sim','Não'] },
        { id: 'pfp_evolucao',      label: 'Evolução até hoje',    type: 'textarea' },
      ]
    },

    {
      id: 'pfp_repouso',
      titulo: 'Inspecção em repouso',
      tipo: 'func',
      grupos: [
        { key: 'pfp_simetria',    label: 'Simetria facial',       tipo: 'sg', options: ['Simétrica','Assimétrica'] },
        { key: 'pfp_sulco_front', label: 'Sulco frontal',         tipo: 'sg', options: ['Normal','Apagado'] },
        { key: 'pfp_fenda_palp',  label: 'Fenda palpebral',       tipo: 'sg', options: ['Normal','Aumentada'] },
        { key: 'pfp_lagoft_rep',  label: 'Lagoftalmo em repouso', tipo: 'sg', options: ['Ausente','Presente'] },
        { key: 'pfp_olho_seco',   label: 'Olho seco visível',     tipo: 'sg', options: ['Ausente','Presente'] },
        { key: 'pfp_sulco_nl',    label: 'Sulco nasolabial',      tipo: 'sg', options: ['Preservado','Apagado'] },
        { key: 'pfp_comissura',   label: 'Comissura labial',      tipo: 'sg', options: ['Simétrica','Desvio contralateral'] },
        { key: 'pfp_tonus',       label: 'Tónus facial',          tipo: 'sg', options: ['Normal','Hipotonia'] },
        { key: 'pfp_mov_inv',     label: 'Movimentos involuntários', tipo: 'sg', options: ['Ausentes','Sincinesias','Espasmos'] },
        { key: 'pfp_saliva_rep',  label: 'Escorrimento de saliva',tipo: 'sg', options: ['Não','Sim'] },
      ]
    },

    {
      id: 'pfp_motor',
      titulo: 'Motricidade — VII par',
      tipo: 'testes',
      grade: ['Normal','Diminuído','Ausente'],
      grupos: [
        {
          sub: 'Região frontal',
          testes: [
            { id: 'pfp_t_sobranc',  label: 'Elevação sobrancelhas' },
            { id: 'pfp_t_rugas',    label: 'Rugas frontais' },
            { id: 'pfp_t_franzir',  label: 'Franzir testa' },
          ]
        },
        {
          sub: 'Região palpebral',
          testes: [
            { id: 'pfp_t_fecho_s',  label: 'Fecho palpebral suave' },
            { id: 'pfp_t_fecho_f',  label: 'Fecho palpebral forçado' },
            { id: 'pfp_t_lagoft',   label: 'Lagoftalmo com esforço' },
            { id: 'pfp_t_bell',     label: 'Sinal de Bell' },
            { id: 'pfp_t_piscar',   label: 'Piscar espontâneo' },
          ]
        },
        {
          sub: 'Região nasal',
          testes: [
            { id: 'pfp_t_narinas',  label: 'Dilatação narinas' },
            { id: 'pfp_t_nariz',    label: 'Desvio ponta do nariz' },
          ]
        },
        {
          sub: 'Região oral',
          testes: [
            { id: 'pfp_t_dentes',   label: 'Mostrar dentes' },
            { id: 'pfp_t_sorriso',  label: 'Sorriso' },
            { id: 'pfp_t_assobiar', label: 'Assobiar' },
            { id: 'pfp_t_bochechas',label: 'Insuflar bochechas' },
            { id: 'pfp_t_liquidos', label: 'Reter líquidos na boca' },
          ]
        },
      ]
    },

    {
      id: 'pfp_func',
      titulo: 'Função orofacial e ocular',
      tipo: 'func',
      grupos: [
        { key: 'pfp_articulacao',  label: 'Articulação da fala',      tipo: 'sg', options: ['Normal','Disartria ligeira','Disartria moderada'] },
        { key: 'pfp_selagem',      label: 'Selagem labial',           tipo: 'sg', options: ['Preservada','Diminuída'] },
        { key: 'pfp_ctrl_liq',     label: 'Controlo oral líquidos',   tipo: 'sg', options: ['Preservado','Escape'] },
        { key: 'pfp_mastigacao',   label: 'Mastigação',               tipo: 'sg', options: ['Normal','Alterada'] },
        { key: 'pfp_fecho_oc',     label: 'Fecho ocular',             tipo: 'sg', options: ['Completo','Incompleto'] },
        { key: 'pfp_lacrimejo',    label: 'Lacrimejo',                tipo: 'sg', options: ['Normal','Diminuído','Aumentado'] },
        { key: 'pfp_hiperemia',    label: 'Hiperemia conjuntival',    tipo: 'sg', options: ['Ausente','Presente'] },
        { key: 'pfp_queratite',    label: 'Risco de queratite',       tipo: 'sg', options: ['Não','Sim'] },
        { key: 'pfp_paladar',      label: 'Paladar (2/3 anteriores)', tipo: 'sg', options: ['Normal','Alterado','Ausente'] },
        { key: 'pfp_hiperacusia',  label: 'Hiperacusia',              tipo: 'sg', options: ['Não','Sim'] },
        { key: 'pfp_dor_retro',    label: 'Dor retroauricular',       tipo: 'sg', options: ['Não','Sim'] },
      ]
    },

    {
      id: 'pfp_sincinesias',
      titulo: 'Sincinesias e sequelas',
      tipo: 'testes',
      grade: ['Negativo','Sim'],
      grupos: [
        {
          sub: 'Sincinesias',
          testes: [
            { id: 'pfp_sinc_olho_boca', label: 'Sincinesia olho → boca' },
            { id: 'pfp_sinc_boca_olho', label: 'Sincinesia boca → olho' },
          ]
        },
        {
          sub: 'Sequelas',
          testes: [
            { id: 'pfp_espasmo',        label: 'Espasmo hemifacial' },
            { id: 'pfp_contratura',     label: 'Contratura facial' },
            { id: 'pfp_lagrimas_croc',  label: 'Lágrimas de crocodilo' },
          ]
        },
      ]
    },

    {
      id: 'pfp_hb',
      titulo: 'Escala de House-Brackmann',
      tipo: 'grading',
      escalas: [
        {
          id: 'pfp_hb',
          titulo: 'House-Brackmann',
          score: 'hb',
          desc: 'Seleccionar o grau que melhor descreve a função facial global.',
          legend: 'I = Normal · II = Ligeiro · III = Moderado · IV = Mod–grave · V = Grave · VI = Paralisia total',
          optMin: 1,
          optMax: 6,
          itens: [
            'Grau I — Função normal em todos os territórios',
            'Grau II — Ligeira fraqueza à inspecção; movimentos simétricos em repouso',
            'Grau III — Assimetria visível; fecho ocular com esforço; pode mover testa',
            'Grau IV — Assimetria evidente; sem movimento da testa; fecho ocular incompleto',
            'Grau V — Mínimo movimento perceptível; assimetria severa em repouso',
            'Grau VI — Sem movimento',
          ],
        }
      ]
    },

    {
      id: 'pfp_sb_repouso',
      titulo: 'Sunnybrook — Simetria em repouso',
      tipo: 'grading',
      escalas: [
        {
          id: 'pfp_repouso',
          titulo: 'Simetria em repouso (penalidade × 5)',
          score: 'sunnybrook',
          desc: '0 = simétrico · 1 = ligeira assimetria · 2 = moderada · 3 = severa · 4 = muito severa. Comparar com lado são.',
          legend: '0 (simétrico) → 4 (muito assimétrico)',
          optMin: 0,
          optMax: 4,
          itens: ['Olho', 'Bochecha / nariz', 'Boca'],
        }
      ]
    },

    {
      id: 'pfp_sb_vol',
      titulo: 'Sunnybrook — Movimentos voluntários',
      tipo: 'grading',
      escalas: [
        {
          id: 'pfp_voluntarios',
          titulo: 'Movimentos voluntários (pontuação × 4)',
          score: 'sunnybrook',
          desc: '1 = sem movimento · 2 = ligeiro · 3 = moderado · 4 = quase completo · 5 = simétrico ao lado são.',
          legend: '1 (sem movimento) → 5 (normal)',
          optMin: 1,
          optMax: 5,
          itens: ['Elevação da sobrancelha', 'Fecho ocular suave', 'Sorriso com dentes', 'Franzir lábios (pucker)', 'Mostrar dentes / snarl'],
        }
      ]
    },

    {
      id: 'pfp_sb_sinc',
      titulo: 'Sunnybrook — Sincinesias',
      tipo: 'grading',
      escalas: [
        {
          id: 'pfp_sincinesias',
          titulo: 'Sincinesias (penalidade directa)',
          score: 'sunnybrook',
          desc: '0 = nenhuma · 1 = ligeira · 2 = moderada (distrai do movimento) · 3 = severa (desfigura).',
          legend: '0 (nenhuma) → 3 (severa)',
          optMin: 0,
          optMax: 3,
          itens: ['Elevação da sobrancelha', 'Fecho ocular', 'Sorriso', 'Franzir lábios', 'Mostrar dentes'],
        }
      ]
    },

    {
      id: 'pfp_sb_resultado',
      titulo: 'Sunnybrook — Score composto',
      tipo: 'grading',
      escalas: [
        {
          id: 'pfp_sunnybrook',
          titulo: 'Score composto Sunnybrook',
          score: 'sunnybrook',
          desc: 'Calculado automaticamente: (Voluntários × 4) − (Repouso × 5) − Sincinesias. Preencher os três blocos acima.',
          legend: '0–30 Grave · 31–60 Mod–grave · 61–75 Moderado · 76–89 Ligeiro · 90–100 Normal',
          optMin: 0,
          optMax: 0,
          itens: [],
        }
      ]
    },

    seccaoCicatriz,

  ]
};

/* Config de região — Punho / Mão. Lida pelo motor.js. Só dados, zero lógica. */
import { seccaoCicatriz, seccaoAtrofia, NIVEIS_MS } from './_comuns.js?v=1';

export default {
  id: 'punho-mao',
  titulo: 'Punho / Mão',
  emoji: '✋',
  subtitle: 'Exame completo · Escalas QuickDASH · Guardar no final',
  lado: { label: 'Punho / Mão avaliado' },
  tabs: { dinamometria: true, escalas: true },

  seccoes: [
    { tipo: 'dor', titulo: 'Caracterização da Dor',
      eva: [ {id:'eva_rep',label:'Repouso'}, {id:'eva_act',label:'Actividade'}, {id:'eva_pic',label:'Pico'} ],
      grupos: [
        { id:'localizacao_dor', label:'Localização', multi:true, opts:[
          {v:'Face dorsal do punho',         lbl:'Dorsal'},
          {v:'Face palmar do punho',         lbl:'Palmar'},
          {v:'Radial (tabaqueira anatómica)', lbl:'Tabaqueira'},
          {v:'Cubital',                       lbl:'Cubital'},
          {v:'Dedos',                         lbl:'Dedos'} ]},
        { id:'tipo_dor', label:'Tipo', opts:['Mecânica','Inflamatória','Neuropática','Mista'] },
        { id:'irradiacao', label:'Irradiação', opts:[
          {v:'Sem irradiação',     lbl:'Sem irradiação'},
          {v:'Para o antebraço',   lbl:'Antebraço'},
          {v:'Para os dedos',      lbl:'Dedos'} ]},
        { id:'d_noturna', label:'Dor noturna', opts:['Não','Sim'] }
      ]},

    { tipo: 'params', id:'palp', titulo: 'Inspeção & Palpação', notas:'notas_palp',
      rows: [
        { id:'insp_edema', label:'Edema / tumefacção',
          opts:['Ausente','Ligeiro','Moderado'] },
        { id:'insp_def',   label:'Deformidade',
          opts:['Sem deformidade','Desvio cubital dedos','Nódulos Heberden/Bouchard','Rizartrose polegar','Múltiplas'] },
        { id:'palp_tab',   label:'Tabaqueira anatómica',
          opts:['Indolor','Dolorosa — suspeita escafoide'] },
        { id:'palp_puls',  label:'Pulso radial',
          opts:['Presente e simétrico','Assimétrico'] }
      ]},

    { tipo: 'mrc', id:'mrc', titulo: 'Força Muscular (MRC)', notas:'notas_forca',
      rows: [
        { id:'ext_pun',  label:'Extensores do punho' },
        { id:'flex_pun', label:'Flexores do punho' },
        { id:'ext_ded',  label:'Extensores dos dedos' },
        { id:'flex_ded', label:'Flexores dos dedos' },
        { id:'opol',     label:'Oponente do polegar' }
      ]},

    { tipo: 'func', id:'func', titulo: 'Avaliação Funcional',
      opts:['Normal','Com dor','Dificuldade','Impossível'],
      rows: [
        { id:'grip',    label:'Preensão palmar (grip)' },
        { id:'pinc',    label:'Pinça polegar-índice' },
        { id:'chave',   label:'Rodar chave / maçaneta' },
        { id:'esc',     label:'Escrita / uso de utensílios' },
        { id:'vest',    label:'Abotoar / apertar (vestuário)' },
        { id:'prof',    label:'Actividade profissional' }
      ]},

    { tipo:'rom', id:'rom_punho', titulo:'Punho — Amplitudes', notas:'notas_rom_punho',
      movimentos:[
        { key:'pun_flex_p', label:'Flexão palmar',         normal:80, min:0, max:90 },
        { key:'pun_flex_d', label:'Extensão (fl. dorsal)', normal:70, min:0, max:90 },
        { key:'pun_dev_r',  label:'Desvio radial',         normal:20, min:0, max:35 },
        { key:'pun_dev_c',  label:'Desvio cubital',        normal:30, min:0, max:45 },
        { key:'pun_pron',   label:'Pronação',              normal:85, min:0, max:90 },
        { key:'pun_sup',    label:'Supinação',             normal:85, min:0, max:90 }
      ]},

    { tipo:'rom', id:'rom_dedos', titulo:'Dedos 2.º–5.º — Amplitudes', notas:'notas_rom_dedos',
      movimentos:[
        { key:'ind_mcf_flex', label:'Indicador MCF — Flexão',   normal:90,  min:0, max:100 },
        { key:'ind_mcf_ext',  label:'Indicador MCF — Extensão', normal:0,   min:0, max:30  },
        { key:'ind_ifp_flex', label:'Indicador IFP — Flexão',   normal:100, min:0, max:120 },
        { key:'ind_ifp_ext',  label:'Indicador IFP — Extensão', normal:0,   min:0, max:10  },
        { key:'ind_ifd_flex', label:'Indicador IFD — Flexão',   normal:70,  min:0, max:90  },
        { key:'ind_ifd_ext',  label:'Indicador IFD — Extensão', normal:0,   min:0, max:10  },
        { key:'med_mcf_flex', label:'Médio MCF — Flexão',       normal:90,  min:0, max:100 },
        { key:'med_mcf_ext',  label:'Médio MCF — Extensão',     normal:0,   min:0, max:30  },
        { key:'med_ifp_flex', label:'Médio IFP — Flexão',       normal:100, min:0, max:120 },
        { key:'med_ifp_ext',  label:'Médio IFP — Extensão',     normal:0,   min:0, max:10  },
        { key:'med_ifd_flex', label:'Médio IFD — Flexão',       normal:70,  min:0, max:90  },
        { key:'med_ifd_ext',  label:'Médio IFD — Extensão',     normal:0,   min:0, max:10  },
        { key:'an_mcf_flex',  label:'Anelar MCF — Flexão',      normal:90,  min:0, max:100 },
        { key:'an_mcf_ext',   label:'Anelar MCF — Extensão',    normal:0,   min:0, max:30  },
        { key:'an_ifp_flex',  label:'Anelar IFP — Flexão',      normal:100, min:0, max:120 },
        { key:'an_ifp_ext',   label:'Anelar IFP — Extensão',    normal:0,   min:0, max:10  },
        { key:'an_ifd_flex',  label:'Anelar IFD — Flexão',      normal:70,  min:0, max:90  },
        { key:'an_ifd_ext',   label:'Anelar IFD — Extensão',    normal:0,   min:0, max:10  },
        { key:'min_mcf_flex', label:'Mínimo MCF — Flexão',      normal:90,  min:0, max:100 },
        { key:'min_mcf_ext',  label:'Mínimo MCF — Extensão',    normal:0,   min:0, max:30  },
        { key:'min_ifp_flex', label:'Mínimo IFP — Flexão',      normal:100, min:0, max:120 },
        { key:'min_ifp_ext',  label:'Mínimo IFP — Extensão',    normal:0,   min:0, max:10  },
        { key:'min_ifd_flex', label:'Mínimo IFD — Flexão',      normal:70,  min:0, max:90  },
        { key:'min_ifd_ext',  label:'Mínimo IFD — Extensão',    normal:0,   min:0, max:10  },
        { key:'ponta_palma',  label:'Ponta–palma (cm)',          normal:0,   min:0, max:20  }
      ]},

    { tipo:'rom', id:'rom_polegar', titulo:'Polegar — Amplitudes', notas:'notas_rom_pol',
      movimentos:[
        { key:'pol_mcp_flex', label:'MCP — Flexão', normal:50, min:0, max:70 },
        { key:'pol_ip_flex',  label:'IP — Flexão',  normal:80, min:0, max:90 }
      ]},

    { tipo:'kapandji', id:'kapandji', titulo:'Kapandji — Oposição do Polegar', notas:'notas_kapandji',
      niveis:[
        'Sem oposição',
        'Borda lateral do 2.º dedo',
        'Polpa do 2.º dedo',
        'Base do 3.º dedo',
        'Polpa do 3.º dedo',
        'Base do 4.º dedo',
        'Polpa do 4.º dedo',
        'Base do 5.º dedo',
        'Polpa do 5.º dedo',
        'Prega palmar distal',
        'Alcance máximo na palma'
      ]},

    { tipo: 'testes', id:'testes', titulo: 'Testes Específicos', notas:'notas_testes',
      grade: ['Negativo','+','++','+++'],
      grupos: [
        { sub:'Canal cárpico', testes:[
          {id:'tinel',  label:'Tinel (punho)'},
          {id:'phalen', label:'Phalen'},
          {id:'durkan', label:'Durkan'} ]},
        { sub:'De Quervain (1.º compartimento)', testes:[
          {id:'fink', label:'Finkelstein'} ]},
        { sub:'Instabilidade escafoide', testes:[
          {id:'watson', label:'Watson (shunt test)'} ]},
        { sub:'Rizartrose (TMC)', testes:[
          {id:'grind', label:'Grind test'} ]}
      ]},

    seccaoCicatriz,
    { ...seccaoAtrofia, perimetria: { niveis: NIVEIS_MS } },
  ],

  dinamometria: {
    af2Import: true,
    movimentos: [
      { key:'pega',     label:'Preensão palmar (Pega)' },
      { key:'pinc',     label:'Pinça (Pega de Pinça)' },
      { key:'tenaz',    label:'Tenaz (Pega de Tenaz)' },
      { key:'pun_flex', label:'Flexão do punho (Pulso)' },
      { key:'pun_ext',  label:'Extensão do punho (Pulso)' }
    ],
    racios: []
  },

  escalas: [
    { id:'prwe', titulo:'PRWE — Patient-Rated Wrist Evaluation', optMin:0, optMax:10,
      desc:   '15 itens · 0 = sem dificuldade/dor · 10 = máximo · Score 0–100 · menor = melhor',
      legend: '0 Sem dor/limitação → 10 Dor máxima/Impossível',
      score:  'prwe',
      itens: [
        'Dor em repouso',
        'Dor com actividade repetitiva',
        'Dor ao levantar objecto pesado',
        'Pior dor nas últimas semanas',
        'Dor habitual nas últimas semanas',
        'Virar uma maçaneta de porta',
        'Cortar carne (faca e garfo)',
        'Abotoar/desabotoar roupa',
        'Puxar (abrir gaveta, porta)',
        'Apoiar-se sobre a palma da mão',
        'Carregar objecto pesado (>5 kg)',
        'Cuidado pessoal (higiene, vestir)',
        'Tarefas domésticas ligeiras',
        'Actividade laboral habitual',
        'Actividades recreativas/desportivas'
      ]
    },
    { id:'dash', titulo:'QuickDASH (membro superior)', optMin:1, optMax:5,
      desc:   '11 itens · 1 = sem dificuldade · 5 = incapaz · Score 0–100 · 0 = sem incapacidade',
      legend: '1 Sem dificuldade · 2 Ligeira · 3 Moderada · 4 Extrema · 5 Incapaz',
      score:  'dash',
      itens: [
        'Abrir um frasco novo ou bem apertado',
        'Tarefas domésticas pesadas (lavar paredes, limpar o chão)',
        'Lavar as costas',
        'Usar uma faca para cortar alimentos',
        'Actividades recreativas com força ou impacto pelo braço (golfe, martelar, ténis)',
        'Interferência nas actividades sociais normais (família, amigos, vizinhos)',
        'Limitação no trabalho ou actividades diárias habituais',
        'Dor no braço, ombro ou mão',
        'Formigueiro no braço, ombro ou mão',
        'Dificuldade em dormir por causa da dor',
        'Dificuldade em realizar o trabalho habitual por causa do problema'
      ]
    }
  ]
};

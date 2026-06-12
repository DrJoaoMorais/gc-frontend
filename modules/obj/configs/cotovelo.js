/* Config de região — Cotovelo. Lida pelo motor.js. Só dados, zero lógica. */
import { seccaoCicatriz, seccaoAtrofia, NIVEIS_MS } from './_comuns.js?v=1';

export default {
  id: 'cotovelo',
  titulo: 'Cotovelo',
  emoji: '🦾',
  subtitle: 'Exame completo · Escalas DASH / OES · Guardar no final',
  lado: { label: 'Cotovelo avaliado' },
  tabs: { dinamometria: true, escalas: true },

  seccoes: [
    { tipo: 'dor', titulo: 'Caracterização da Dor',
      eva: [ {id:'eva_rep',label:'Repouso'}, {id:'eva_act',label:'Actividade'}, {id:'eva_pic',label:'Pico'} ],
      grupos: [
        { id:'localizacao_dor', label:'Localização', multi:true, opts:[
          {v:'Epicôndilo lateral',lbl:'Epicôndilo lat.'},
          {v:'Epicôndilo medial',lbl:'Epicôndilo med.'},
          {v:'Olécrano',lbl:'Olécrano'},
          {v:'Face anterior',lbl:'Anterior'} ]},
        { id:'tipo_dor', label:'Tipo', opts:['Mecânica','Inflamatória','Neuropática','Mista'] },
        { id:'irradiacao', label:'Irradiação', opts:[
          {v:'Sem irradiação',lbl:'Sem irradiação'},
          {v:'Para o antebraço',lbl:'Antebraço'},
          {v:'Para a mão (território cubital)',lbl:'Mão'} ]},
        { id:'d_noturna', label:'Dor noturna', opts:['Não','Sim'] }
      ]},

    { tipo: 'params', id:'palp', titulo: 'Inspeção & Palpação', notas:'notas_palp',
      rows: [
        { id:'insp_edema', label:'Edema / tumefacção', opts:['Ausente','Ligeiro','Moderado'] },
        { id:'insp_ang',  label:'Ângulo de carregamento', opts:['Normal','Varo','Valgo'] },
        { id:'palp_ecl',  label:'Epicôndilo lateral', opts:['Sem dor','Dor'] },
        { id:'palp_ecm',  label:'Epicôndilo medial', opts:['Sem dor','Dor'] },
        { id:'palp_olec', label:'Olécrano', opts:['Sem dor','Dor','Bursite'] },
        { id:'palp_cub',  label:'Goteira cubital', opts:['Sem dor','Dor'] }
      ]},

    { tipo: 'mrc', id:'mrc', titulo: 'Força Muscular (MRC)', notas:'notas_forca',
      rows: [
        { id:'flexc', label:'Flexão do cotovelo' },
        { id:'extc',  label:'Extensão do cotovelo' },
        { id:'extp',  label:'Extensores do punho' },
        { id:'flxp',  label:'Flexores do punho' }
      ]},

    { tipo: 'func', id:'func', titulo: 'Avaliação Funcional',
      opts:['Normal','Com dor','Dificuldade','Impossível'],
      rows: [
        { id:'boca',  label:'Mão à boca (alimentação)' },
        { id:'hig',   label:'Higiene pessoal / pentear' },
        { id:'peso',  label:'Transportar pesos (saco)' },
        { id:'chave', label:'Rodar chave / maçaneta' },
        { id:'prof',  label:'Actividade profissional' },
        { id:'desp',  label:'Actividade desportiva' }
      ]},

    { tipo: 'rom', id:'rom', titulo: 'Amplitude de Movimento', notas:'notas_mob',
      movimentos: [
        { key:'flex', label:'Flexão',    normal:145, min:0,   max:160 },
        { key:'ext',  label:'Extensão',  normal:0,   min:-45, max:15, nota:'défice = negativo' },
        { key:'pro',  label:'Pronação',  normal:80,  min:0,   max:90 },
        { key:'sup',  label:'Supinação', normal:80,  min:0,   max:90 }
      ]},

    { tipo: 'testes', id:'testes', titulo: 'Testes Específicos', notas:'notas_testes',
      grade: ['Negativo','+','++','+++'],
      grupos: [
        { sub:'Epicondilite lateral', testes:[
          {id:'cozen',label:'Cozen'}, {id:'mills',label:"Mill's"}, {id:'chair',label:'Chair test'} ]},
        { sub:'Epicondilite medial', testes:[
          {id:'golf',label:'Resist. flexão punho'} ]},
        { sub:'Instabilidade ligamentar', testes:[
          {id:'valgo',label:'Stress em valgo (LCM)'}, {id:'varo',label:'Stress em varo (LCL)'} ]},
        { sub:'Nervo cubital', testes:[
          {id:'tinel',label:'Tinel (goteira cubital)'}, {id:'flexsus',label:'Flexão sustentada cotovelo'} ]},
        { sub:'Bicípite distal', testes:[
          {id:'hook',label:'Hook test'} ]}
      ]},
    seccaoCicatriz,
    { ...seccaoAtrofia, perimetria: { niveis: NIVEIS_MS } },
  ],

  dinamometria: {
    af2Import: false,
    movimentos: [
      { key:'flexc', label:'Flexão do cotovelo' },
      { key:'extc',  label:'Extensão do cotovelo' },
      { key:'pro',   label:'Pronação' },
      { key:'sup',   label:'Supinação' },
      { key:'preens',label:'Preensão (Jamar/AF2)' }
    ],
    racios: [
      { num:'flexc', den:'extc', label:'Flexão/Extensão', ref:null }
    ]
  },

  escalas: [
    { id:'dash', titulo:'DASH (membro superior)', optMin:1, optMax:5,
      legend:'1 (sem dificuldade) → 5 (incapaz) · Score 0–100 (maior = pior)',
      score:'dash',
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
        'Dificuldade para dormir por dor no braço/ombro'
      ]
    },
    { id:'oes', titulo:'OES — Oxford Elbow Score', optMin:0, optMax:4,
      legend:'12 itens · 0–4 por item · Score 0–48 (maior = melhor)',
      score:'soma',
      /* RASCUNHO de tradução do Claude — Morais valida contra a versão oficial antes de uso clínico */
      itens: [
        'Dificuldade em levantar objectos em casa',
        'Dificuldade em transportar sacos de compras',
        'Dificuldade em lavar-se (todo o corpo)',
        'Dificuldade em vestir-se',
        'Intensidade da pior dor no cotovelo',
        'Dor no cotovelo a interferir com o sono',
        'Frequência de dor no cotovelo',
        'Dor no cotovelo em repouso',
        'Sensação de que o problema do cotovelo controla a vida',
        'Preocupação com o cotovelo no dia-a-dia',
        'Limitação nas actividades habituais',
        'Incómodo / constrangimento com o problema'
      ]
    }
  ]
};

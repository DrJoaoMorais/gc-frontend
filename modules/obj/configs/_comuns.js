// modules/obj/configs/_comuns.js
// Secções transversais reutilizáveis em qualquer região.
// Importar com: import { seccaoCicatriz, seccaoAtrofia } from './_comuns.js';

export const seccaoCicatriz = {
  id: 'cicatriz',
  label: 'Cicatriz',
  tipo: 'grupos',
  notasKey: 'notas_cicatriz',
  notasPlaceholder: 'Notas sobre a cicatriz...',
  grupos: [
    {
      label: 'Aspeto geral',
      key: 'aspeto_geral',
      tipo: 'sg',
      opcoes: ['Fechada', 'Parcialmente aberta', 'Deiscente']
    },
    {
      label: 'Tipo de cicatriz',
      key: 'tipo',
      tipo: 'sg',
      opcoes: ['Plana', 'Hipertrófica', 'Queloide', 'Atrófica']
    },
    {
      label: 'Bordas',
      key: 'bordas',
      tipo: 'sg',
      opcoes: ['Coaptadas', 'Separadas', 'Maceradas']
    },
    {
      label: 'Secreção',
      key: 'secrecao',
      tipo: 'sg',
      opcoes: ['Ausente', 'Serosa', 'Serossanguinolenta', 'Sanguinolenta', 'Purulenta']
    },
    {
      label: 'Sinais locais presentes',
      key: 'sinais_locais',
      tipo: 'mg',
      opcoes: ['Eritema', 'Calor', 'Edema', 'Induração', 'Flutuação', 'Necrose', 'Crosta', 'Odor']
    },
    {
      label: 'Aderência',
      key: 'aderencia',
      tipo: 'sg',
      opcoes: ['Ausente', 'Discreta', 'Importante']
    },
    {
      label: 'Mobilidade da cicatriz',
      key: 'mobilidade',
      tipo: 'sg',
      opcoes: ['Preservada', 'Reduzida']
    },
    {
      label: 'Dor à palpação',
      key: 'dor_palpacao',
      tipo: 'sg',
      opcoes: ['Ausente', 'Leve', 'Moderada', 'Intensa']
    },
    {
      label: 'Dor presente',
      key: 'dor_presente',
      tipo: 'mg',
      opcoes: ['Espontânea', 'Em repouso', 'Ao movimento/tração']
    },
    {
      label: 'Sensibilidade tátil',
      key: 'sensibilidade_tatil',
      tipo: 'sg',
      opcoes: ['Preservada', 'Reduzida', 'Abolida']
    },
    {
      label: 'Fenómenos sensitivos',
      key: 'fenomenos_sensitivos',
      tipo: 'mg',
      opcoes: ['Alodinia', 'Hiperalgesia', 'Disestesia', 'Parestesias', 'Queimadura/choque/formigueiro']
    },
    {
      label: 'Repuxamento/tensão com movimento',
      key: 'repuxamento',
      tipo: 'sg',
      opcoes: ['Não', 'Sim']
    },
    {
      label: 'Impacto funcional',
      key: 'impacto_funcional',
      tipo: 'sg',
      opcoes: ['Sem limitação', 'Ligeira', 'Moderada', 'Importante']
    },
    {
      label: 'Impressão clínica',
      key: 'impressao_clinica',
      tipo: 'mg',
      opcoes: [
        'Cicatrização sem complicações',
        'Suspeita de infeção',
        'Suspeita de seroma/hematoma',
        'Suspeita de deiscência',
        'Hipertrófica',
        'Queloide',
        'Dolorosa com componente neuropático',
        'Suspeita de neuroma/ramo cutâneo'
      ]
    }
  ]
};

export const seccaoAtrofia = {
  id: 'atrofia',
  label: 'Atrofia Muscular',
  tipo: 'grupos',
  notasKey: 'notas_atrofia',
  notasPlaceholder: 'Perimetria — ex.: 10 cm acima do olécrano: D 32 cm / E 34 cm',
  grupos: [
    { label: 'Atrofia muscular', key: 'atrofia_muscular', tipo: 'sg',
      opcoes: ['Ausente', 'Presente'] }
  ]
};

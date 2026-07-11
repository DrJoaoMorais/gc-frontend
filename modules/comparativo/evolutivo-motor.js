// modules/comparativo/evolutivo-motor.js
// Motor do Quadro Evolutivo — lê consultation_assessments por doente,
// agrupa por região+lado, produz estrutura de tabela com delta coluna anterior.

const PARAM_MAP = {
  ombro: [
    { chave: 'eva.rep',    grupo: 'Dor (EVA)',        label: 'Repouso',           unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.act',    grupo: 'Dor (EVA)',        label: 'Actividade',        unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.pic',    grupo: 'Dor (EVA)',        label: 'Pico',              unidade: '/10',  dirBom: 'desce', tipo: 'num' },
    { chaveA: 'rom.flex_a', chaveP: 'rom.flex_p', grupo: 'Mobilidade (ROM)', label: 'Flexão',      unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.abd_a',  chaveP: 'rom.abd_p',  grupo: 'Mobilidade (ROM)', label: 'Abdução',     unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.re_a',   chaveP: 'rom.re_p',   grupo: 'Mobilidade (ROM)', label: 'Rot. Externa', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.ri_a',   chaveP: 'rom.ri_p',   grupo: 'Mobilidade (ROM)', label: 'Rot. Interna', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.ext_a',  chaveP: 'rom.ext_p',  grupo: 'Mobilidade (ROM)', label: 'Extensão',     unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
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
    { chave: 'eva.rep', grupo: 'Dor (EVA)', label: 'Repouso', unidade: '/10', dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.act', grupo: 'Dor (EVA)', label: 'Actividade', unidade: '/10', dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.pic', grupo: 'Dor (EVA)', label: 'Pico', unidade: '/10', dirBom: 'desce', tipo: 'num' },
    { chaveA: 'rom.cerv_flex_a', chaveP: 'rom.cerv_flex_p', grupo: 'Mobilidade (ROM)', label: 'Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.cerv_ext_a', chaveP: 'rom.cerv_ext_p', grupo: 'Mobilidade (ROM)', label: 'Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.cerv_inc_d_a', chaveP: 'rom.cerv_inc_d_p', grupo: 'Mobilidade (ROM)', label: 'Inclinação lateral D', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.cerv_inc_e_a', chaveP: 'rom.cerv_inc_e_p', grupo: 'Mobilidade (ROM)', label: 'Inclinação lateral E', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.cerv_rot_d_a', chaveP: 'rom.cerv_rot_d_p', grupo: 'Mobilidade (ROM)', label: 'Rotação D', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.cerv_rot_e_a', chaveP: 'rom.cerv_rot_e_p', grupo: 'Mobilidade (ROM)', label: 'Rotação E', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chave: 'mrc.f_flex_cerv', grupo: 'Força MRC', label: 'Flexores cervicais', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.f_ext_cerv', grupo: 'Força MRC', label: 'Extensores cervicais', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.f_abd_ombro', grupo: 'Força MRC', label: 'Abdução ombro (C5)', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.f_flex_cot', grupo: 'Força MRC', label: 'Flexão cotovelo (C6)', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.f_ext_cot', grupo: 'Força MRC', label: 'Extensão cotovelo (C7)', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.f_flex_ded', grupo: 'Força MRC', label: 'Flexão dedos (C8)', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.f_inteross', grupo: 'Força MRC', label: 'Interósseos (T1)', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'dyn.flex.val', grupo: 'Dinamometria', label: 'Flexão', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.ext.val', grupo: 'Dinamometria', label: 'Extensão', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.rot_d.val', grupo: 'Dinamometria', label: 'Rotação D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.rot_e.val', grupo: 'Dinamometria', label: 'Rotação E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.inc_d.val', grupo: 'Dinamometria', label: 'Inclinação D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.inc_e.val', grupo: 'Dinamometria', label: 'Inclinação E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'escalas.ndi_score', grupo: 'Escalas Funcionais', label: 'NDI', unidade: '%', dirBom: 'desce', tipo: 'num' },
    { chave: 'testes.t_spurling', grupo: 'Testes Clínicos', label: 'Spurling', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_comp_for', grupo: 'Testes Clínicos', label: 'Compressão foraminal', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_bakody', grupo: 'Testes Clínicos', label: 'Bakody', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_distr', grupo: 'Testes Clínicos', label: 'Distração cervical', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_lhermitte', grupo: 'Testes Clínicos', label: 'Lhermitte', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_hoffmann', grupo: 'Testes Clínicos', label: 'Hoffmann', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_babinski', grupo: 'Testes Clínicos', label: 'Babinski', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_clonus', grupo: 'Testes Clínicos', label: 'Clónus', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_ultt', grupo: 'Testes Clínicos', label: 'ULTT MS', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'func.func_cond', grupo: 'Funcional', label: 'Rodar cabeça (conduzir)', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_comp', grupo: 'Funcional', label: 'Trabalho ao computador', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_dorm', grupo: 'Funcional', label: 'Dormir de lado', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_vest', grupo: 'Funcional', label: 'Vestir / despir', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_brac', grupo: 'Funcional', label: 'Levantar braços acima cabeça', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_transp', grupo: 'Funcional', label: 'Transportar objectos', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_prof', grupo: 'Funcional', label: 'Actividade profissional', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_desp', grupo: 'Funcional', label: 'Actividade desportiva', unidade: '', dirBom: null, tipo: 'func' },
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
  cotovelo: [
    { chave: 'eva.rep', grupo: 'Dor (EVA)', label: 'Repouso', unidade: '/10', dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.act', grupo: 'Dor (EVA)', label: 'Actividade', unidade: '/10', dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.pic', grupo: 'Dor (EVA)', label: 'Pico', unidade: '/10', dirBom: 'desce', tipo: 'num' },
    { chaveA: 'rom.flex_a', chaveP: 'rom.flex_p', grupo: 'Mobilidade (ROM)', label: 'Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.ext_a', chaveP: 'rom.ext_p', grupo: 'Mobilidade (ROM)', label: 'Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.pro_a', chaveP: 'rom.pro_p', grupo: 'Mobilidade (ROM)', label: 'Pronação', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.sup_a', chaveP: 'rom.sup_p', grupo: 'Mobilidade (ROM)', label: 'Supinação', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chave: 'mrc.flexc', grupo: 'Força MRC', label: 'Flexão cotovelo', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.extc', grupo: 'Força MRC', label: 'Extensão cotovelo', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.extp', grupo: 'Força MRC', label: 'Extensores punho', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.flxp', grupo: 'Força MRC', label: 'Flexores punho', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'dyn.flexc.d', grupo: 'Dinamometria', label: 'Flexão D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.flexc.e', grupo: 'Dinamometria', label: 'Flexão E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.extc.d', grupo: 'Dinamometria', label: 'Extensão D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.extc.e', grupo: 'Dinamometria', label: 'Extensão E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pro.d', grupo: 'Dinamometria', label: 'Pronação D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pro.e', grupo: 'Dinamometria', label: 'Pronação E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.sup.d', grupo: 'Dinamometria', label: 'Supinação D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.sup.e', grupo: 'Dinamometria', label: 'Supinação E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'escalas.dash_score', grupo: 'Escalas Funcionais', label: 'QuickDASH', unidade: '/100', dirBom: 'desce', tipo: 'num' },
    { chave: 'escalas.oes_score', grupo: 'Escalas Funcionais', label: 'OES', unidade: '/48', dirBom: 'sobe', tipo: 'num' },
    { chave: 'testes.cozen', grupo: 'Testes Clínicos', label: 'Cozen', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.mills', grupo: 'Testes Clínicos', label: "Mill's", unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.chair', grupo: 'Testes Clínicos', label: 'Chair test', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.golf', grupo: 'Testes Clínicos', label: 'Resist. flexão punho', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.valgo', grupo: 'Testes Clínicos', label: 'Stress valgo (LCM)', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.varo', grupo: 'Testes Clínicos', label: 'Stress varo (LCL)', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.tinel', grupo: 'Testes Clínicos', label: 'Tinel (cubital)', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.flexsus', grupo: 'Testes Clínicos', label: 'Flexão sustentada', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.hook', grupo: 'Testes Clínicos', label: 'Hook test', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'func.boca', grupo: 'Funcional', label: 'Mão à boca', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.hig', grupo: 'Funcional', label: 'Higiene / pentear', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.peso', grupo: 'Funcional', label: 'Transportar pesos', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.chave', grupo: 'Funcional', label: 'Rodar chave/maçaneta', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.prof', grupo: 'Funcional', label: 'Actividade profissional', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.desp', grupo: 'Funcional', label: 'Actividade desportiva', unidade: '', dirBom: null, tipo: 'func' },
  ],
  tibio: [
    { chave: 'eva.rep', grupo: 'Dor (EVA)', label: 'Repouso', unidade: '/10', dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.act', grupo: 'Dor (EVA)', label: 'Actividade', unidade: '/10', dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.pic', grupo: 'Dor (EVA)', label: 'Pico', unidade: '/10', dirBom: 'desce', tipo: 'num' },
    { chaveA: 'rom.dorsiflex_a', chaveP: 'rom.dorsiflex_p', grupo: 'Mobilidade (ROM)', label: 'Dorsiflexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.plantiflex_a', chaveP: 'rom.plantiflex_p', grupo: 'Mobilidade (ROM)', label: 'Flexão plantar', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.inversao_a', chaveP: 'rom.inversao_p', grupo: 'Mobilidade (ROM)', label: 'Inversão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom.eversao_a', chaveP: 'rom.eversao_p', grupo: 'Mobilidade (ROM)', label: 'Eversão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chave: 'mrc.f_dorsiflex', grupo: 'Força MRC', label: 'Dorsiflexores', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.f_plantiflex', grupo: 'Força MRC', label: 'Flexores plantares', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.f_inversao', grupo: 'Força MRC', label: 'Inversores', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.f_eversao', grupo: 'Força MRC', label: 'Eversores', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.f_flexdedos', grupo: 'Força MRC', label: 'Flexores dos dedos', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.f_extdedos', grupo: 'Força MRC', label: 'Extensores dos dedos', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.f_exthalux', grupo: 'Força MRC', label: 'Extensor longo do hálux', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'dyn.dorsiflex.d', grupo: 'Dinamometria', label: 'Dorsiflexão D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.dorsiflex.e', grupo: 'Dinamometria', label: 'Dorsiflexão E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.plantiflex.d', grupo: 'Dinamometria', label: 'Flexão plantar D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.plantiflex.e', grupo: 'Dinamometria', label: 'Flexão plantar E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.inversao.d', grupo: 'Dinamometria', label: 'Inversão D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.inversao.e', grupo: 'Dinamometria', label: 'Inversão E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.eversao.d', grupo: 'Dinamometria', label: 'Eversão D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.eversao.e', grupo: 'Dinamometria', label: 'Eversão E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'escalas.faam_adl_score', grupo: 'Escalas Funcionais', label: 'FAAM-ADL', unidade: '', dirBom: 'sobe', tipo: 'num' },
    { chave: 'escalas.faam_sport_score', grupo: 'Escalas Funcionais', label: 'FAAM-Sport', unidade: '', dirBom: 'sobe', tipo: 'num' },
    { chave: 'testes.t_drawerant', grupo: 'Testes Clínicos', label: 'Drawer anterior tornozelo', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_talartilt', grupo: 'Testes Clínicos', label: 'Talar tilt', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_squeezefib', grupo: 'Testes Clínicos', label: 'Squeeze test fíbula', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_palpltfa', grupo: 'Testes Clínicos', label: 'Palpação LTFA/calcaneofibular', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_thompson', grupo: 'Testes Clínicos', label: 'Thompson', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_palpaquiles', grupo: 'Testes Clínicos', label: 'Palpação gap Aquiles', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_heelraise1', grupo: 'Testes Clínicos', label: 'Single heel raise', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_squeezesind', grupo: 'Testes Clínicos', label: 'Squeeze test sindesmose', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_erstress', grupo: 'Testes Clínicos', label: 'External rotation stress', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_drawersind', grupo: 'Testes Clínicos', label: 'Drawer anterior sindesmose', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_palpfascia', grupo: 'Testes Clínicos', label: 'Palpação fáscia plantar', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_windlass', grupo: 'Testes Clínicos', label: 'Windlass test', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_passmatinal', grupo: 'Testes Clínicos', label: 'Primeiros passos matinais', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_palpperon', grupo: 'Testes Clínicos', label: 'Palpação peroneais', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_eversresist', grupo: 'Testes Clínicos', label: 'Eversão resistida', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_subluxperon', grupo: 'Testes Clínicos', label: 'Subluxação peroneais', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_marchapontas', grupo: 'Testes Clínicos', label: 'Marcha pontas (S1)', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_marchacalcanh', grupo: 'Testes Clínicos', label: 'Marcha calcanhares (L4-L5)', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_heelraisesl', grupo: 'Testes Clínicos', label: 'Single leg heel rise', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.t_hoptest', grupo: 'Testes Clínicos', label: 'Hop test', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'func.func_plan', grupo: 'Funcional', label: 'Caminhar em plano', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_esc', grupo: 'Funcional', label: 'Escadas e rampas', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_lev', grupo: 'Funcional', label: 'Levantar do chão/cadeira', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_dorm', grupo: 'Funcional', label: 'Dormir sobre lado afectado', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_calc', grupo: 'Funcional', label: 'Calçar meias/sapatos', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_hig', grupo: 'Funcional', label: 'Higiene pessoal (banho)', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_cond', grupo: 'Funcional', label: 'Conduzir', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_transp', grupo: 'Funcional', label: 'Transporte público', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_prof', grupo: 'Funcional', label: 'Actividade profissional', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_desp', grupo: 'Funcional', label: 'Actividade desportiva', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_irreg', grupo: 'Funcional', label: 'Caminhar terreno irregular', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.func_inst', grupo: 'Funcional', label: 'Instabilidade/entorses', unidade: '', dirBom: null, tipo: 'func' },
  ],
  'punho-mao': [
    { chave: 'eva.rep', grupo: 'Dor (EVA)', label: 'Repouso', unidade: '/10', dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.act', grupo: 'Dor (EVA)', label: 'Actividade', unidade: '/10', dirBom: 'desce', tipo: 'num' },
    { chave: 'eva.pic', grupo: 'Dor (EVA)', label: 'Pico', unidade: '/10', dirBom: 'desce', tipo: 'num' },
    { chaveA: 'rom_punho.pun_flex_p_a', chaveP: 'rom_punho.pun_flex_p_p', grupo: 'Punho — ROM', label: 'Flexão palmar', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_punho.pun_flex_d_a', chaveP: 'rom_punho.pun_flex_d_p', grupo: 'Punho — ROM', label: 'Extensão (fl. dorsal)', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_punho.pun_dev_r_a', chaveP: 'rom_punho.pun_dev_r_p', grupo: 'Punho — ROM', label: 'Desvio radial', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_punho.pun_dev_c_a', chaveP: 'rom_punho.pun_dev_c_p', grupo: 'Punho — ROM', label: 'Desvio cubital', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_punho.pun_pron_a', chaveP: 'rom_punho.pun_pron_p', grupo: 'Punho — ROM', label: 'Pronação', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_punho.pun_sup_a', chaveP: 'rom_punho.pun_sup_p', grupo: 'Punho — ROM', label: 'Supinação', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_ind.ind_mcf_flex_a', chaveP: 'rom_ind.ind_mcf_flex_p', grupo: 'Indicador — ROM', label: 'MCF Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_ind.ind_mcf_ext_a', chaveP: 'rom_ind.ind_mcf_ext_p', grupo: 'Indicador — ROM', label: 'MCF Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_ind.ind_ifp_flex_a', chaveP: 'rom_ind.ind_ifp_flex_p', grupo: 'Indicador — ROM', label: 'IFP Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_ind.ind_ifp_ext_a', chaveP: 'rom_ind.ind_ifp_ext_p', grupo: 'Indicador — ROM', label: 'IFP Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_ind.ind_ifd_flex_a', chaveP: 'rom_ind.ind_ifd_flex_p', grupo: 'Indicador — ROM', label: 'IFD Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_ind.ind_ifd_ext_a', chaveP: 'rom_ind.ind_ifd_ext_p', grupo: 'Indicador — ROM', label: 'IFD Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_med.med_mcf_flex_a', chaveP: 'rom_med.med_mcf_flex_p', grupo: 'Médio — ROM', label: 'MCF Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_med.med_mcf_ext_a', chaveP: 'rom_med.med_mcf_ext_p', grupo: 'Médio — ROM', label: 'MCF Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_med.med_ifp_flex_a', chaveP: 'rom_med.med_ifp_flex_p', grupo: 'Médio — ROM', label: 'IFP Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_med.med_ifp_ext_a', chaveP: 'rom_med.med_ifp_ext_p', grupo: 'Médio — ROM', label: 'IFP Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_med.med_ifd_flex_a', chaveP: 'rom_med.med_ifd_flex_p', grupo: 'Médio — ROM', label: 'IFD Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_med.med_ifd_ext_a', chaveP: 'rom_med.med_ifd_ext_p', grupo: 'Médio — ROM', label: 'IFD Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_an.an_mcf_flex_a', chaveP: 'rom_an.an_mcf_flex_p', grupo: 'Anelar — ROM', label: 'MCF Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_an.an_mcf_ext_a', chaveP: 'rom_an.an_mcf_ext_p', grupo: 'Anelar — ROM', label: 'MCF Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_an.an_ifp_flex_a', chaveP: 'rom_an.an_ifp_flex_p', grupo: 'Anelar — ROM', label: 'IFP Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_an.an_ifp_ext_a', chaveP: 'rom_an.an_ifp_ext_p', grupo: 'Anelar — ROM', label: 'IFP Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_an.an_ifd_flex_a', chaveP: 'rom_an.an_ifd_flex_p', grupo: 'Anelar — ROM', label: 'IFD Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_an.an_ifd_ext_a', chaveP: 'rom_an.an_ifd_ext_p', grupo: 'Anelar — ROM', label: 'IFD Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_min.min_mcf_flex_a', chaveP: 'rom_min.min_mcf_flex_p', grupo: 'Mínimo — ROM', label: 'MCF Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_min.min_mcf_ext_a', chaveP: 'rom_min.min_mcf_ext_p', grupo: 'Mínimo — ROM', label: 'MCF Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_min.min_ifp_flex_a', chaveP: 'rom_min.min_ifp_flex_p', grupo: 'Mínimo — ROM', label: 'IFP Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_min.min_ifp_ext_a', chaveP: 'rom_min.min_ifp_ext_p', grupo: 'Mínimo — ROM', label: 'IFP Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_min.min_ifd_flex_a', chaveP: 'rom_min.min_ifd_flex_p', grupo: 'Mínimo — ROM', label: 'IFD Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_min.min_ifd_ext_a', chaveP: 'rom_min.min_ifd_ext_p', grupo: 'Mínimo — ROM', label: 'IFD Extensão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_polegar.pol_mcp_flex_a', chaveP: 'rom_polegar.pol_mcp_flex_p', grupo: 'Polegar — ROM', label: 'MCP Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_polegar.pol_ip_flex_a', chaveP: 'rom_polegar.pol_ip_flex_p', grupo: 'Polegar — ROM', label: 'IP Flexão', unidade: '°', dirBom: 'sobe', tipo: 'rom_ap' },
    { chaveA: 'rom_mao.ponta_palma_a', chaveP: 'rom_mao.ponta_palma_p', grupo: 'Mão — Global', label: 'Ponta–palma', unidade: ' cm', dirBom: 'desce', tipo: 'rom_ap' },
    { chave: 'mrc.ext_pun', grupo: 'Força MRC', label: 'Extensores do punho', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.flex_pun', grupo: 'Força MRC', label: 'Flexores do punho', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.ext_ded', grupo: 'Força MRC', label: 'Extensores dos dedos', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.flex_ded', grupo: 'Força MRC', label: 'Flexores dos dedos', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'mrc.opol', grupo: 'Força MRC', label: 'Oponente do polegar', unidade: '', dirBom: 'sobe', tipo: 'mrc' },
    { chave: 'dyn.pega.d', grupo: 'Dinamometria', label: 'Preensão (pega) D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pega.e', grupo: 'Dinamometria', label: 'Preensão (pega) E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pinc.d', grupo: 'Dinamometria', label: 'Pinça D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pinc.e', grupo: 'Dinamometria', label: 'Pinça E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pun_flex.d', grupo: 'Dinamometria', label: 'Flexão punho D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pun_flex.e', grupo: 'Dinamometria', label: 'Flexão punho E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pun_ext.d', grupo: 'Dinamometria', label: 'Extensão punho D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pun_ext.e', grupo: 'Dinamometria', label: 'Extensão punho E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pun_abd.d', grupo: 'Dinamometria', label: 'Abdução punho D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pun_abd.e', grupo: 'Dinamometria', label: 'Abdução punho E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pun_adu.d', grupo: 'Dinamometria', label: 'Adução punho D', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'dyn.pun_adu.e', grupo: 'Dinamometria', label: 'Adução punho E', unidade: ' kg', dirBom: 'sobe', tipo: 'num' },
    { chave: 'escalas.prwe_score', grupo: 'Escalas Funcionais', label: 'PRWE', unidade: '/100', dirBom: 'desce', tipo: 'num' },
    { chave: 'escalas.dash_score', grupo: 'Escalas Funcionais', label: 'QuickDASH', unidade: '/100', dirBom: 'desce', tipo: 'num' },
    { chave: 'testes.tinel', grupo: 'Testes Clínicos', label: 'Tinel (punho)', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.phalen', grupo: 'Testes Clínicos', label: 'Phalen', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.durkan', grupo: 'Testes Clínicos', label: 'Durkan', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.fink', grupo: 'Testes Clínicos', label: 'Finkelstein', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.watson', grupo: 'Testes Clínicos', label: 'Watson (shunt)', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'testes.grind', grupo: 'Testes Clínicos', label: 'Grind test', unidade: '', dirBom: 'desce', tipo: 'teste' },
    { chave: 'func.grip', grupo: 'Funcional', label: 'Preensão palmar', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.pinc', grupo: 'Funcional', label: 'Pinça polegar-índice', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.chave', grupo: 'Funcional', label: 'Rodar chave/maçaneta', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.esc', grupo: 'Funcional', label: 'Escrita / utensílios', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.vest', grupo: 'Funcional', label: 'Abotoar / vestuário', unidade: '', dirBom: null, tipo: 'func' },
    { chave: 'func.prof', grupo: 'Funcional', label: 'Actividade profissional', unidade: '', dirBom: null, tipo: 'func' },
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
      let valores, deltas;

      if (p.tipo === 'rom_ap') {
        valores = datasComDados.map(d => ({
          a: normalizar(lerCampo(dadosPorData[d], p.chaveA), 'num'),
          p: normalizar(lerCampo(dadosPorData[d], p.chaveP), 'num'),
        }));
        if (valores.every(v => v.a == null && v.p == null)) continue;
        deltas = valores.map((v, i) => {
          if (i === 0) return null;
          const anterior = valores[i - 1];
          return {
            a: calcDelta(v.a, anterior.a, p.dirBom, 'num'),
            p: calcDelta(v.p, anterior.p, p.dirBom, 'num'),
          };
        });
      } else {
        valores = datasComDados.map(d => normalizar(lerCampo(dadosPorData[d], p.chave), p.tipo));
        if (valores.every(v => v == null)) continue;
        deltas = valores.map((v, i) => {
          if (i === 0) return null;
          return calcDelta(v, valores[i - 1], p.dirBom, p.tipo);
        });
      }

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

export function labelRegiao(tipo, lado) {
  const nomes = {
    ombro: 'Ombro', cervical: 'Coluna Cervical', lombar: 'Coluna Lombar',
    joelho: 'Joelho', anca: 'Anca', cotovelo: 'Cotovelo',
    tibio: 'Tibiotársica', pfp: 'Paresia Facial Periférica', rpp: 'Raqui',
    'punho-mao': 'Punho / Mão',
  };
  const base = nomes[tipo] || tipo;
  return lado ? `${base} ${lado}` : base;
}

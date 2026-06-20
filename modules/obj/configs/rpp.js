// modules/obj/configs/rpp.js
export default {
  id: 'rpp',
  titulo: 'Pavimento Pélvico',
  subtitle: 'Reabilitação — homem e mulher',
  tabs: { historia: true },
  seccoes: [

    // 1. DOR
    {
      titulo: 'Dor pélvica / perineal',
      tipo: 'dor',
      eva: [{ id: 'rpp_dor', label: 'Dor pélvica / perineal' }],
      grupos: [
        {
          id: 'rpp_dor_loc',
          label: 'Localização',
          opts: ['Suprapúbica','Perineal','Vaginal','Anal / anorretal','Lombossacra','Difusa'],
          multi: true,
        },
      ],
    },

    // 2. PARÂMETROS FUNCIONAIS
    {
      titulo: 'Parâmetros funcionais',
      tipo: 'params',
      notas: 'notas_mob',
      rows: [
        { id: 'rpp_rpm',      label: 'Resíduo pós-miccional',          opts: ['<50 ml','50–100 ml','100–200 ml','>200 ml'] },
        { id: 'rpp_nocturia', label: 'Noctúria (episódios/noite)',      opts: ['0','1','2','3+'] },
        { id: 'rpp_pad24',    label: 'Pensos / 24h',                    opts: ['0','1','2–3','4+'] },
        { id: 'rpp_freq',     label: 'Frequência miccional / dia',      opts: ['≤8','9–12','13–16','>16'] },
        { id: 'rpp_ingesta',  label: 'Ingesta hídrica estimada',        opts: ['<1 L','1–1,5 L','1,5–2 L','>2 L'] },
      ],
    },

    // 3. OXFORD MODIFICADO
    {
      titulo: 'Oxford modificado — Pavimento pélvico',
      tipo: 'mrc',
      notas: 'notas_forca',
      rows: [
        { id: 'rpp_oxford', label: 'Pavimento pélvico (global)' },
      ],
    },

    // 4. ENDURANCE E REFLEXOS
    {
      titulo: 'Endurance e reflexos',
      tipo: 'params',
      rows: [
        { id: 'rpp_endurance', label: 'Manutenção da contracção',        opts: ['<5 seg','5–10 seg','10–20 seg','>20 seg'] },
        { id: 'rpp_reps',      label: 'Repetições máximas',              opts: ['<5','5–10','10–15','>15'] },
        { id: 'rpp_ref_ano',   label: 'Reflexo anocutâneo (S2–S4)',      opts: ['Presente','Diminuído','Ausente'] },
        { id: 'rpp_ref_bulbo', label: 'Reflexo bulbocavernoso',          opts: ['Presente','Diminuído','Ausente'] },
        { id: 'rpp_tonus',     label: 'Tónus anal em repouso',           opts: ['Normal','Diminuído','Aumentado'] },
      ],
    },

    // 5. TESTES FUNCIONAIS
    {
      titulo: 'Testes funcionais',
      tipo: 'testes',
      grupos: [
        {
          sub: 'Testes de esforço',
          testes: [
            { id: 'rpp_cough_sup',   label: 'Cough test — supino' },
            { id: 'rpp_cough_ort',   label: 'Cough test — ortostatismo' },
            { id: 'rpp_valsalva',    label: 'Valsalva (descida perineal)' },
          ],
        },
        {
          sub: 'Pad test 1h (ICS)',
          testes: [
            { id: 'rpp_pad_test',    label: 'Pad test 1h' },
          ],
        },
      ],
      grade: ['Negativo','Leve','Moderado','Grave','N/A'],
    },

    // 6. EXAME PÉLVICO
    {
      titulo: 'Exame pélvico',
      tipo: 'testes',
      grupos: [
        {
          sub: 'Perineal (ambos)',
          testes: [
            { id: 'rpp_cicatriz',    label: 'Cicatriz perineal / episiotomia' },
            { id: 'rpp_lacerac',     label: 'Laceração visível' },
            { id: 'rpp_dor_palp',    label: 'Dor à palpação perineal' },
            { id: 'rpp_gatilho',     label: 'Pontos gatilho miofasciais' },
          ],
        },
        {
          sub: 'Mulher (N/A se homem)',
          testes: [
            { id: 'rpp_atrofia',     label: 'Atrofia urogenital' },
            { id: 'rpp_prolap_ant',  label: 'Prolapso anterior (cistocelo)' },
            { id: 'rpp_prolap_apex', label: 'Prolapso apical (histerocelo)' },
            { id: 'rpp_prolap_post', label: 'Prolapso posterior (rectocelo)' },
          ],
        },
        {
          sub: 'Homem (N/A se mulher)',
          testes: [
            { id: 'rpp_meato',       label: 'Meato uretral normal' },
            { id: 'rpp_cir_cicatriz',label: 'Cicatriz cirúrgica' },
            { id: 'rpp_prostata',    label: 'Avaliação prostática realizada' },
          ],
        },
        {
          sub: 'Anorretal (ambos)',
          testes: [
            { id: 'rpp_hemorr',      label: 'Hemorroidas externas' },
            { id: 'rpp_fissura',     label: 'Fissura anal' },
            { id: 'rpp_prolap_rec',  label: 'Prolapso rectal' },
          ],
        },
      ],
      grade: ['Normal','Presente','Ausente','N/A'],
    },

    // 7. NEUROLÓGICO DIRIGIDO
    {
      titulo: 'Neurológico dirigido',
      tipo: 'testes',
      grupos: [
        {
          sub: 'Sensitivo',
          testes: [
            { id: 'rpp_sela',        label: 'Sensibilidade em sela (S2–S4)' },
            { id: 'rpp_perin_sens',  label: 'Sensibilidade perineal' },
          ],
        },
        {
          sub: 'Motor e marcha',
          testes: [
            { id: 'rpp_forca_mmii',  label: 'Força membros inferiores' },
            { id: 'rpp_reflexos',    label: 'Reflexos osteotendinosos MMII' },
            { id: 'rpp_marcha',      label: 'Marcha' },
          ],
        },
      ],
      grade: ['Normal','Diminuído','Alterado','Ausente'],
    },

    // 8. SINAIS DE ALARME
    {
      titulo: 'Sinais de alarme',
      tipo: 'testes',
      grupos: [
        {
          sub: 'Urinários',
          testes: [
            { id: 'rpp_al_hematuria',  label: 'Hematúria macroscópica' },
            { id: 'rpp_al_retencao',   label: 'Retenção urinária / globo vesical' },
            { id: 'rpp_al_fistula',    label: 'Suspeita de fístula' },
            { id: 'rpp_al_itu',        label: 'ITU recorrentes ≥ 3/ano' },
          ],
        },
        {
          sub: 'Neurológicos e sistémicos',
          testes: [
            { id: 'rpp_al_neuro',      label: 'Défice neurológico novo' },
            { id: 'rpp_al_sela',       label: 'Dormência em sela' },
            { id: 'rpp_al_massa',      label: 'Massa pélvica / rectal' },
            { id: 'rpp_al_emagr',      label: 'Perda ponderal inexplicada' },
          ],
        },
      ],
      grade: ['Ausente','Presente'],
    },

    // 9. ICIQ-UI SF
    {
      titulo: 'ICIQ-UI SF — Incontinência Urinária',
      tipo: 'params',
      notas: 'notas_mob',
      rows: [
        { id: 'iciq_ui_q1', label: 'Q1 — Frequência de perda',          opts: ['0','1','2','3','4','5'] },
        { id: 'iciq_ui_q2', label: 'Q2 — Quantidade de perda',          opts: ['0','1','2','3','4','5','6'] },
        { id: 'iciq_ui_q3', label: 'Q3 — Impacto qualidade de vida',    opts: ['0','1','2','3','4','5','6','7','8','9','10'] },
        { id: 'iciq_ui_q4', label: 'Q4 — Quando perde (não score)',      opts: ['Esforço','Urgência','Sono','Sem razão','Sempre'] },
      ],
    },

    // 10. ICIQ-B
    {
      titulo: 'ICIQ-B — Incontinência Intestinal',
      tipo: 'params',
      notas: 'notas_mob',
      rows: [
        { id: 'iciq_b_freq',    label: 'Frequência de escape intestinal', opts: ['0','1','2','3','4'] },
        { id: 'iciq_b_urg',     label: 'Urgência fecal',                  opts: ['0','1','2','3','4'] },
        { id: 'iciq_b_qtd',     label: 'Quantidade de escape',            opts: ['0','1','2','3','4'] },
        { id: 'iciq_b_impacto', label: 'Impacto qualidade de vida',       opts: ['0','1','2','3','4','5','6','7','8','9','10'] },
      ],
    },

  ],
};

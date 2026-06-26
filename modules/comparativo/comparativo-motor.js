/* comparativo-motor.js — Motor de séries temporais para o Comparativo */

const CAMINHOS_OMBRO = [
  { param: 'rom.flex_a',         get: d => d?.rom?.flex_a         },
  { param: 'rom.flex_p',         get: d => d?.rom?.flex_p         },
  { param: 'rom.abd_a',          get: d => d?.rom?.abd_a          },
  { param: 'rom.abd_p',          get: d => d?.rom?.abd_p          },
  { param: 'rom.re_a',           get: d => d?.rom?.re_a           },
  { param: 'rom.re_p',           get: d => d?.rom?.re_p           },
  { param: 'rom.ri_a',           get: d => d?.rom?.ri_a           },
  { param: 'rom.ri_p',           get: d => d?.rom?.ri_p           },
  { param: 'eva.rep',            get: d => d?.eva?.rep            },
  { param: 'eva.act',            get: d => d?.eva?.act            },
  { param: 'eva.pic',            get: d => d?.eva?.pic            },
  { param: 'escalas.dash_score', get: d => d?.escalas?.dash_score },
  { param: 'escalas.ases_score', get: d => d?.escalas?.ases_score },
  { param: 'escalas.oss_score',  get: d => d?.escalas?.oss_score  },
  { param: 'mrc.f_sup', get: d => d?.mrc?.f_sup },
  { param: 'mrc.f_inf', get: d => d?.mrc?.f_inf },
  { param: 'mrc.f_sub', get: d => d?.mrc?.f_sub },
  { param: 'mrc.f_del', get: d => d?.mrc?.f_del },
  { param: 'mrc.f_ext', get: d => d?.mrc?.f_ext },
];

export async function lerSerieOmbro(patientId) {
  const sb = window.sb;
  if (!sb) throw new Error('Supabase (window.sb) não inicializado.');

  const { data: rows, error } = await sb
    .from('consultation_assessments')
    .select('assessment_date, data')
    .eq('patient_id', patientId)
    .eq('assessment_type', 'ombro')
    .order('assessment_date', { ascending: true });

  if (error) throw error;

  const series = Object.fromEntries(CAMINHOS_OMBRO.map(c => [c.param, []]));

  for (const row of (rows || [])) {
    const d = row.data || {};
    for (const caminho of CAMINHOS_OMBRO) {
      const valor = caminho.get(d);
      if (valor == null || valor === '') continue;
      series[caminho.param].push({ data: row.assessment_date, valor });
    }
  }

  for (const param of Object.keys(series)) {
    if (series[param].length === 0) delete series[param];
  }

  return series;
}

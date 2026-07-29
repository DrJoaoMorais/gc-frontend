/* Carrega o doente.js só quando é preciso abrir uma ficha.
   Antes disto, os 625 kB do doente.js carregavam no arranque da app. */
export async function abrirFichaDoente(patient) {
  const { openPatientViewModal } = await import("./doente.js");
  return openPatientViewModal(patient);
}

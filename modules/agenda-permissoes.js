// Visibilidade local; as permissoes no servidor exigem validacao independente.
export function canViewAgendaFinance(role) {
  return role === 'medico' || role === 'super_admin';
}

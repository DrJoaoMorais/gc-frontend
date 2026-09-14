import { G } from '../state.js';

// Acesso profissional temporariamente exclusivo do titular.
// A proteção dos dados é aplicada também na base de dados.
export function canAccessExercise(user = G.sessionUser) {
  return user?.id === '32a24abe-cd69-42d9-bf3a-3355f4f6e28c';
}

export function requireExerciseAccess() {
  if (!canAccessExercise()) throw new Error('Acesso ao Exercício reservado ao Dr. João Morais.');
}

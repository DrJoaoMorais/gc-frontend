# Imagens privadas dos treinos

Preparação local. Não aplicada nem publicada.

Antes da activação:

1. Criar o bucket `wo-session-images` como privado.
2. Limitar o bucket a 2 MB e aos tipos `image/jpeg`, `image/png`, `image/webp`.
3. Aplicar e rever a migração local.
4. Publicar a função `wo-session-image` apenas depois dos testes de segurança.
5. Confirmar que pedidos sem token, com sessão errada, quarta imagem e total acima de 50 MB são recusados.

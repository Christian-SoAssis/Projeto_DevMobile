# Comandos para a apresentação — Enlace

Todos os comandos rodam na raiz do projeto (`D:\Dev_mobile\Projeto_DevMobile`).

## 1. Antes de começar (preparação)

```bash
npm install                  # instala dependências (só na primeira vez)
npx expo install --fix       # corrige versões incompatíveis de pacotes Expo
npx expo-doctor              # valida a configuração do projeto
npm run typecheck            # checagem de tipos (tsc --noEmit)
```

Confira o `.env.local` (URL e chave do Supabase). Veja `.env.example` como modelo.

## 2. Subir o app

```bash
npm start                    # = npx expo start (QR code para o Expo Go)
npx expo start -c            # limpa o cache; use após mudar o .env.local
npx expo start --tunnel      # se o QR code não conectar (celular em outra rede)
npm run android              # emulador/dispositivo Android
npm run web                  # abre no navegador
npm run ios                  # simulador iOS (só macOS)
```

Atalhos no terminal do Expo: `r` recarrega, `a` abre no Android, `w` abre no web, `m` abre o menu, `Ctrl+C` encerra.

## 3. Demonstrar os testes

```bash
npm test                              # todos os testes (jest --runInBand)
npm run test:coverage                 # testes + relatório de cobertura (pasta coverage/)
npx jest --watch                      # modo observação (TDD ao vivo)
npx jest __tests__/e2e                # só os fluxos E2E
npx jest __tests__/e2e/MockFlows.test.ts          # E2E com mocks
npx jest __tests__/e2e/OfflineSyncFlows.real.test.ts  # E2E offline/sincronização
npx jest __tests__/domain             # só a camada de domínio
npx jest __tests__/application        # só os casos de uso
npx jest __tests__/screens            # só as telas
npx jest -t "nome do teste"           # filtra por nome do teste
```

## 4. Supabase (backend online)

1. Abrir o projeto no painel do Supabase → **SQL Editor**.
2. Colar e executar o conteúdo de `supabase/init.sql` (schema, RLS e Storage).
3. Em **Authentication → Providers → Email**, desativar "Confirm email" para testar o cadastro sem depender de e-mail.
4. Reiniciar o app com `npx expo start -c`.

## 5. Git (mostrar o histórico)

```bash
git status                   # estado do working tree
git log --oneline -10        # últimos commits
git log --oneline --graph    # histórico em formato de grafo
git diff HEAD~1              # o que mudou no último commit
```

## 6. Problemas comuns durante a demo

| Problema | Solução |
|---|---|
| QR code não conecta | `npx expo start --tunnel` ou conferir se PC e celular estão na mesma rede |
| Bundle desatualizado / variáveis antigas | `npx expo start -c` |
| Dependências quebradas | `rm -rf node_modules package-lock.json && npm install` |
| Pacotes Expo incompatíveis | `npx expo install --fix` |
| App sem dados online | Conferir `.env.local` e se o `init.sql` foi executado |

## 7. Roteiro sugerido (ordem da demo)

1. `npm run typecheck` e `npm test` — mostrar que tudo passa.
2. `npm run test:coverage` — mostrar a cobertura.
3. `npx expo start -c` — abrir no Expo Go.
4. Fluxos no app: buscar → detalhes → favoritar → criar animal → marcar como adotado.
5. Modo offline e sincronização (desligar a internet, criar algo, religar).
6. Mostrar os dados no painel do Supabase.

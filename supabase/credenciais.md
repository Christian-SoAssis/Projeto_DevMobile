# Copie para .env.local (ignorado pelo git) e preencha:
#   cp .env.example .env.local
# Depois reinicie o Expo: npx expo start -c
#
# Sem estas variáveis o app roda 100% offline (SQLite + dados de demonstração).
# Valores em: Supabase > Project Settings > API.

# Project URL
EXPO_PUBLIC_SUPABASE_URL=https://rmsvprwmrwprmtlsqndo.supabase.co

# Chave "anon / public". NUNCA use a service_role aqui: ela ignora a RLS
# e tudo com prefixo EXPO_PUBLIC_ vai para dentro do bundle do app.
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_KWYaB7uP_Myg2FXxgPhDuA_mEnxW9Sr
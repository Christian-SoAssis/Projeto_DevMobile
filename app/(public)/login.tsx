import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { EnlaceHeader } from '../../src/adapters/components/EnlaceHeader';
import {
  CLAY_CARD_STYLE,
  CLAY_INSET_INPUT_STYLE,
  CLAY_PRIMARY_BUTTON_STYLE,
  CLAY_SECONDARY_BUTTON_STYLE,
  COLORS,
} from '../../src/adapters/theme/tokens';

/**
 * V01 • Entrar (Prancha 01/02 — Descoberta e acesso)
 */
export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage('Preencha seu e-mail e sua senha para entrar.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Não foi possível entrar. Confira suas credenciais.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <EnlaceHeader largeLogo />

          <Text style={styles.welcomeTitle}>Que bom te ver!</Text>
          <Text style={styles.welcomeSubtitle}>Mais conexões para novas histórias.</Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>E-mail</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={COLORS.brown} />
              <TextInput
                style={styles.textInput}
                placeholder="Seu e-mail"
                placeholderTextColor={COLORS.brownMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>Senha</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.brown} />
              <TextInput
                style={styles.textInput}
                placeholder="Sua senha"
                placeholderTextColor={COLORS.brownMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Alternar visibilidade da senha"
                onPress={() => setShowPassword((v) => !v)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.brown}
                />
              </TouchableOpacity>
            </View>

            {errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <TouchableOpacity
              accessibilityRole="button"
              disabled={submitting}
              onPress={handleLogin}
              style={[CLAY_PRIMARY_BUTTON_STYLE, { marginTop: 20 }]}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Entrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => router.push('/(public)/cadastro')}
              style={[CLAY_SECONDARY_BUTTON_STYLE, { marginTop: 12 }]}
            >
              <Text style={styles.secondaryBtnText}>Criar conta</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => router.replace('/(tabs)')}
              style={styles.visitorLinkBtn}
            >
              <Text style={styles.visitorLinkText}>Continuar como visitante</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.espresso,
    textAlign: 'center',
    marginTop: 6,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: COLORS.brown,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  formCard: {
    ...CLAY_CARD_STYLE,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.espresso,
    marginBottom: 6,
  },
  inputRow: {
    ...CLAY_INSET_INPUT_STYLE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.espresso,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerBg,
    borderRadius: 12,
    padding: 10,
    marginTop: 14,
  },
  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '900',
  },
  secondaryBtnText: {
    color: COLORS.espresso,
    fontSize: 16,
    fontWeight: '800',
  },
  visitorLinkBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  visitorLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.brown,
  },
});

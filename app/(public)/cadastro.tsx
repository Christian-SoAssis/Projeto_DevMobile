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
  COLORS,
} from '../../src/adapters/theme/tokens';

/**
 * V02 • Criar conta (Prancha 01/02 — Descoberta e acesso)
 */
export default function CadastroScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    setErrorMessage(null);
    if (!name.trim()) {
      setErrorMessage('Informe seu nome completo.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Informe um e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('A senha precisa ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('As senhas digitadas não conferem.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        contactInfo: phone.trim(),
      });
      router.replace('/(tabs)');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao criar sua conta.');
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
          <EnlaceHeader showBack onBack={() => router.back()} />

          <Text style={styles.title}>Uma nova história começa aqui.</Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>Nome</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={COLORS.brown} />
              <TextInput
                style={styles.textInput}
                placeholder="Seu nome"
                placeholderTextColor={COLORS.brownMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

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

            <Text style={styles.label}>Telefone</Text>
            <View style={styles.inputRow}>
              <Ionicons name="call-outline" size={18} color={COLORS.brown} />
              <TextInput
                style={styles.textInput}
                placeholder="(35) 9 9999-9999"
                placeholderTextColor={COLORS.brownMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.brown} />
              <TextInput
                style={styles.textInput}
                placeholder="Sua senha (mín. 6 caracteres)"
                placeholderTextColor={COLORS.brownMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.brown}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirmar senha</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.brown} />
              <TextInput
                style={styles.textInput}
                placeholder="Confirme sua senha"
                placeholderTextColor={COLORS.brownMuted}
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
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
              onPress={handleRegister}
              style={[CLAY_PRIMARY_BUTTON_STYLE, { marginTop: 20 }]}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Criar conta</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => router.replace('/(public)/login')}
              style={styles.loginLinkBtn}
            >
              <Text style={styles.loginLinkText}>
                Já tem conta? <Text style={styles.loginLinkHighlight}>Entrar</Text>
              </Text>
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
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  title: {
    fontSize: 25,
    fontWeight: '900',
    color: COLORS.espresso,
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  formCard: {
    ...CLAY_CARD_STYLE,
    padding: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.espresso,
    marginTop: 10,
    marginBottom: 5,
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
  loginLinkBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  loginLinkText: {
    fontSize: 14,
    color: COLORS.brown,
    fontWeight: '700',
  },
  loginLinkHighlight: {
    color: COLORS.terracotta,
    textDecorationLine: 'underline',
    fontWeight: '900',
  },
});

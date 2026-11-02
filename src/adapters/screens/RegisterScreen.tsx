import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { User } from '../../domain/entities/User';
import { AuthGateway, RegisterInput, RegisterResult } from '../../domain/ports/AuthGateway';
import { AuthGatewayFake } from '../../application/fakes/AuthGatewayFake';
import { MIN_PASSWORD_LENGTH, validateRegistration } from '../../domain/services/CredentialPolicy';

export interface RegisterScreenProps {
  authGateway?: AuthGateway;
  /** Substitui `authGateway.register` (ex.: o `register` do AuthContext, que já entra na conta). */
  onRegister?: (input: RegisterInput) => Promise<RegisterResult & { loggedIn?: boolean }>;
  onSuccess?: (user: User, needsEmailConfirmation: boolean, loggedIn: boolean) => void;
  onGoToLogin?: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  authGateway = new AuthGatewayFake(),
  onRegister,
  onSuccess,
  onGoToLogin,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (submitting) return;
    setFeedback(null);
    const invalid = validateRegistration({ name, email, password: pass, confirmPassword: confirmPass });
    if (invalid) {
      setFeedback(invalid);
      return;
    }
    setSubmitting(true);
    try {
      const input = { name, email, phone, password: pass };
      const result = await (onRegister ? onRegister(input) : authGateway.register(input));
      const { user, needsEmailConfirmation } = result;
      const loggedIn = 'loggedIn' in result && result.loggedIn === true;
      setFeedback(
        needsEmailConfirmation
          ? 'Cadastro realizado! Confirme seu e-mail e depois faça login.'
          : loggedIn
            ? 'Conta criada! Você já está conectado.'
            : 'Cadastro realizado com sucesso! Faça login.'
      );
      if (onSuccess) onSuccess(user, needsEmailConfirmation, loggedIn);
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao cadastrar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} testID="register-screen">
      <Text style={styles.title}>Criar conta</Text>
      {feedback && (
        <View style={styles.feedbackBanner} testID="register-feedback">
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}
      <Text style={styles.label}>Nome *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex.: Maria Souza"
        value={name}
        onChangeText={setName}
        testID="input-name"
      />
      <Text style={styles.label}>E-mail *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex.: maria@exemplo.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        testID="input-email"
      />
      <Text style={styles.label}>Telefone</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex.: 11999998888"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        testID="input-phone"
      />
      <Text style={styles.label}>Senha *</Text>
      <TextInput
        style={styles.input}
        placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
        value={pass}
        onChangeText={setPass}
        secureTextEntry
        testID="input-pass"
      />
      <Text style={styles.label}>Confirmar senha *</Text>
      <TextInput
        style={styles.input}
        placeholder="Repita a senha"
        value={confirmPass}
        onChangeText={setConfirmPass}
        secureTextEntry
        testID="input-confirm-pass"
      />
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitDisabled]}
        onPress={handleRegister}
        disabled={submitting}
        testID="btn-register"
      >
        <Text style={styles.submitText}>{submitting ? 'Cadastrando...' : 'Cadastrar'}</Text>
      </TouchableOpacity>
      {onGoToLogin && (
        <TouchableOpacity style={styles.link} onPress={onGoToLogin} testID="link-login">
          <Text style={styles.linkText}>Já tem conta? Entrar</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1c1c1e',
  },
  feedbackBanner: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  feedbackText: {
    color: '#856404',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    height: 44,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
    marginBottom: 8,
  },
  submitBtn: {
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkText: {
    color: '#0066cc',
    fontWeight: 'bold',
  },
});

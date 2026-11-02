import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { User } from '../../domain/entities/User';
import { AuthGateway } from '../../domain/ports/AuthGateway';
import { SessionStorage } from '../../domain/ports/SessionStorage';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase';
import { AuthGatewayFake } from '../../application/fakes/AuthGatewayFake';
import { SessionStorageFake } from '../../application/fakes/SessionStorageFake';
import { validateLogin } from '../../domain/services/CredentialPolicy';

export interface LoginScreenProps {
  authGateway?: AuthGateway;
  sessionStorage?: SessionStorage;
  /** Quando informado, substitui o caso de uso (ex.: `login` do AuthContext, que atualiza a sessão do app). */
  onLogin?: (email: string, pass: string) => Promise<User>;
  onSuccess?: (user: User) => void;
  onGoToRegister?: () => void;
  onContinueAsVisitor?: () => void;
  /** Aviso exibido no modo demonstração (sem Supabase configurado). */
  demoHint?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  authGateway = new AuthGatewayFake(),
  sessionStorage = new SessionStorageFake(),
  onLogin,
  onSuccess,
  onGoToRegister,
  onContinueAsVisitor,
  demoHint,
}) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (submitting) return;
    setFeedback(null);
    const invalid = validateLogin(email, pass);
    if (invalid) {
      setFeedback(invalid);
      return;
    }
    setSubmitting(true);
    try {
      const user = onLogin
        ? await onLogin(email, pass)
        : (await new AuthenticateUserUseCase(authGateway, sessionStorage).execute(email, pass)).user;
      setFeedback('Login realizado com sucesso!');
      if (onSuccess) onSuccess(user);
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao autenticar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} testID="login-screen">
      <Text style={styles.title}>Entrar</Text>
      {demoHint && (
        <Text style={styles.hint} testID="login-demo-hint">{demoHint}</Text>
      )}
      {feedback && (
        <View style={styles.feedbackBanner} testID="login-feedback">
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}
      <Text style={styles.label}>E-mail *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex.: ana@exemplo.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        testID="input-email"
      />
      <Text style={styles.label}>Senha *</Text>
      <TextInput
        style={styles.input}
        placeholder="Sua senha"
        value={pass}
        onChangeText={setPass}
        secureTextEntry
        testID="input-pass"
      />
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitDisabled]}
        onPress={handleLogin}
        disabled={submitting}
        testID="btn-login"
      >
        <Text style={styles.submitText}>{submitting ? 'Entrando...' : 'Entrar'}</Text>
      </TouchableOpacity>
      {onGoToRegister && (
        <TouchableOpacity style={styles.link} onPress={onGoToRegister} testID="link-register">
          <Text style={styles.linkText}>Não tem conta? Criar conta</Text>
        </TouchableOpacity>
      )}
      {onContinueAsVisitor && (
        <TouchableOpacity style={styles.link} onPress={onContinueAsVisitor} testID="link-visitor">
          <Text style={styles.linkText}>Continuar como visitante</Text>
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
  hint: {
    color: '#48484a',
    backgroundColor: '#f2f2f7',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
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

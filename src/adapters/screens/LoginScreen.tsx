import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { User } from '../../domain/entities/User';
import { AuthGateway } from '../../domain/ports/AuthGateway';
import { SessionStorage } from '../../domain/ports/SessionStorage';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase';
import { AuthGatewayFake } from '../../application/fakes/AuthGatewayFake';
import { SessionStorageFake } from '../../application/fakes/SessionStorageFake';

export interface LoginScreenProps {
  authGateway?: AuthGateway;
  sessionStorage?: SessionStorage;
  onSuccess?: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  authGateway = new AuthGatewayFake(),
  sessionStorage = new SessionStorageFake(),
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleLogin = async () => {
    setFeedback(null);
    try {
      const useCase = new AuthenticateUserUseCase(authGateway, sessionStorage);
      const session = await useCase.execute(email, pass);
      setFeedback('Login realizado com sucesso!');
      if (onSuccess) onSuccess(session.user);
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao autenticar.');
    }
  };

  return (
    <View style={styles.container} testID="login-screen">
      <Text style={styles.title}>Entrar (mock)</Text>
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
      <TouchableOpacity style={styles.submitBtn} onPress={handleLogin} testID="btn-login">
        <Text style={styles.submitText}>Entrar</Text>
      </TouchableOpacity>
    </View>
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
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

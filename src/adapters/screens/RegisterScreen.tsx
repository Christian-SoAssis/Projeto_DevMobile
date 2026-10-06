import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { User } from '../../domain/entities/User';
import { ContactInfo } from '../../domain/value-objects/ContactInfo';
import { AuthGateway } from '../../domain/ports/AuthGateway';
import { AuthGatewayFake } from '../../application/fakes/AuthGatewayFake';

export interface RegisterScreenProps {
  authGateway?: AuthGateway;
  onSuccess?: (user: User) => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  authGateway = new AuthGatewayFake(),
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRegister = async () => {
    setFeedback(null);
    try {
      if (!name.trim()) throw new Error('Nome é obrigatório.');
      if (!email.trim()) throw new Error('E-mail é obrigatório.');
      if (!pass) throw new Error('Senha é obrigatória.');
      const fake = authGateway as AuthGatewayFake;
      const exists = Array.isArray((fake as any).mockUsers)
        ? (fake as any).mockUsers.find(
            (u: User) => u.contactInfo.email.toLowerCase() === email.trim().toLowerCase()
          )
        : null;
      if (exists) throw new Error('E-mail já cadastrado (mock).');
      const user = new User({
        id: `usr_${Date.now()}`,
        name: name.trim(),
        contactInfo: new ContactInfo(email.trim(), phone.trim() || '11900000000'),
        role: 'USER',
      });
      if (Array.isArray((fake as any).mockUsers)) {
        (fake as any).mockUsers.push(user);
      }
      setFeedback('Cadastro realizado com sucesso! Faça login.');
      if (onSuccess) onSuccess(user);
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao cadastrar.');
    }
  };

  return (
    <View style={styles.container} testID="register-screen">
      <Text style={styles.title}>Criar conta (mock)</Text>
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
        testID="input-email"
      />
      <Text style={styles.label}>Telefone</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex.: 11999998888"
        value={phone}
        onChangeText={setPhone}
        testID="input-phone"
      />
      <Text style={styles.label}>Senha *</Text>
      <TextInput
        style={styles.input}
        placeholder="Crie uma senha"
        value={pass}
        onChangeText={setPass}
        secureTextEntry
        testID="input-pass"
      />
      <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} testID="btn-register">
        <Text style={styles.submitText}>Cadastrar</Text>
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
    backgroundColor: '#28a745',
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

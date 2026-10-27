import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface LoginRequiredProps {
  message: string;
  onLogin: () => void;
  onRegister?: () => void;
}

export const LoginRequired: React.FC<LoginRequiredProps> = ({ message, onLogin, onRegister }) => (
  <View style={styles.container} testID="login-required">
    <Text style={styles.message}>{message}</Text>
    <TouchableOpacity style={styles.primaryBtn} onPress={onLogin} testID="login-required-login">
      <Text style={styles.primaryText}>Entrar</Text>
    </TouchableOpacity>
    {onRegister && (
      <TouchableOpacity style={styles.linkBtn} onPress={onRegister} testID="login-required-register">
        <Text style={styles.linkText}>Criar conta</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f5f7',
  },
  message: {
    fontSize: 16,
    color: '#48484a',
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkBtn: {
    marginTop: 12,
    padding: 8,
  },
  linkText: {
    color: '#0066cc',
    fontSize: 15,
  },
});

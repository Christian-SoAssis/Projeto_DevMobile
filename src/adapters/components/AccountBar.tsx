import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { User } from '../../domain/entities/User';

export interface AccountBarProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

export const AccountBar: React.FC<AccountBarProps> = ({ user, onLogin, onLogout }) => (
  <View style={styles.container} testID="account-bar">
    <Text style={styles.greeting} numberOfLines={1}>
      {user ? `Olá, ${user.name}` : 'Visitante'}
    </Text>
    <TouchableOpacity onPress={user ? onLogout : onLogin} testID={user ? 'account-logout' : 'account-login'}>
      <Text style={styles.action}>{user ? 'Sair' : 'Entrar'}</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e5ea',
    borderBottomWidth: 1,
  },
  greeting: {
    flex: 1,
    fontSize: 14,
    color: '#1c1c1e',
    marginRight: 12,
  },
  action: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066cc',
  },
});

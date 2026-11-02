import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { User } from '../../domain/entities/User';
import { AppArea, canAccess } from '../../domain/services/AccessPolicy';

export interface RequireAccessProps {
  area: AppArea;
  /** Render-prop: recebe o usuário já garantido pela política de acesso. */
  children: (user: User) => React.ReactNode;
}

/**
 * Guarda de rota (doc §15.3: a UI não é a barreira de segurança — RLS e
 * casos de uso continuam autoritativos; isto só impede navegar para telas
 * que o papel atual não pode usar).
 *
 * - sessão carregando → spinner (evita piscar o redirecionamento);
 * - visitante em área restrita → /login;
 * - autenticado sem papel suficiente → tela de acesso negado.
 */
export function RequireAccess({ area, children }: RequireAccessProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <View style={styles.center} testID="access-loading">
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!canAccess(user.role, area)) {
    return (
      <View style={styles.center} testID="access-denied">
        <Text style={styles.title}>Acesso restrito</Text>
        <Text style={styles.message}>Seu perfil não tem permissão para acessar esta área.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)')} testID="access-denied-back">
          <Text style={styles.btnText}>Voltar ao início</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return <>{children(user)}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f5f7',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 8 },
  message: { fontSize: 15, color: '#48484a', textAlign: 'center', marginBottom: 16 },
  btn: { backgroundColor: '#0066cc', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: 'bold' },
});

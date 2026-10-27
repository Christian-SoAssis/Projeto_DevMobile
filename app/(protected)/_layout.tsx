import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/adapters/context/AuthContext';

export default function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.center} testID="protected-loading">
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

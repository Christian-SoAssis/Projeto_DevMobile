import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { PeriodoAvaliacao } from '../../domain/entities/PeriodoAvaliacao';
import { PeriodoAvaliacaoRepository } from '../../domain/ports/PeriodoAvaliacaoRepository';
import { PeriodoAvaliacaoRepositoryFake } from '../../application/fakes/PeriodoAvaliacaoRepositoryFake';

export interface HistoricoRelatoriosScreenProps {
  estagioId?: string;
  periodoRepository?: PeriodoAvaliacaoRepository;
  onSelectPeriodo?: (periodo: PeriodoAvaliacao) => void;
}

export const HistoricoRelatoriosScreen: React.FC<HistoricoRelatoriosScreenProps> = ({
  estagioId = 'est_1',
  periodoRepository = new PeriodoAvaliacaoRepositoryFake(),
  onSelectPeriodo,
}) => {
  const [periodos, setPeriodos] = useState<PeriodoAvaliacao[]>([]);

  useEffect(() => {
    async function load() {
      const list = await periodoRepository.listByEstagio(estagioId);
      setPeriodos(list);
    }
    load();
  }, [estagioId]);

  return (
    <View style={styles.container} testID="historico-relatorios-screen">
      <Text style={styles.title}>Histórico de Relatórios e Períodos</Text>

      <FlatList
        data={periodos}
        keyExtractor={(item) => item.id}
        testID="periodos-list"
        ListEmptyComponent={
          <Text style={styles.emptyText} testID="empty-periodos">
            Nenhum relatório encontrado para este estágio.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onSelectPeriodo && onSelectPeriodo(item)}
            testID={`periodo-card-${item.id}`}
          >
            <Text style={styles.cardTitle}>Período ID: {item.id}</Text>
            <Text style={styles.cardDetail}>Status: {item.status.value}</Text>
            <Text style={styles.cardDetail}>Atividades: {item.atividades.length}</Text>
            <Text style={styles.cardDetail}>Assinaturas: {item.assinaturas.length}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#f5f5f7',
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1c1c1e',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderColor: '#e5e5ea',
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0066cc',
    marginBottom: 4,
  },
  cardDetail: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    color: '#8e8e93',
  },
});

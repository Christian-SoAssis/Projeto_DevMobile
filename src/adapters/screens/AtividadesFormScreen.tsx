import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { PeriodoAvaliacaoRepository } from '../../domain/ports/PeriodoAvaliacaoRepository';
import { RegistrarAtividadesUseCase } from '../../application/use-cases/RegistrarAtividadesUseCase';
import { PeriodoAvaliacaoRepositoryFake } from '../../application/fakes/PeriodoAvaliacaoRepositoryFake';

export interface AtividadesFormScreenProps {
  periodoId?: string;
  periodoRepository?: PeriodoAvaliacaoRepository;
  onSuccess?: () => void;
}

export const AtividadesFormScreen: React.FC<AtividadesFormScreenProps> = ({
  periodoId = 'per_1',
  periodoRepository = new PeriodoAvaliacaoRepositoryFake(),
  onSuccess,
}) => {
  const [descricao, setDescricao] = useState('');
  const [horas, setHoras] = useState('4');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAddAtividade = async () => {
    setFeedback(null);
    try {
      const horasNum = parseFloat(horas);
      if (isNaN(horasNum) || horasNum <= 0) {
        throw new Error('Horas informadas devem ser um valor positivo.');
      }
      if (!descricao || descricao.trim().length === 0) {
        throw new Error('Descrição da atividade é obrigatória.');
      }

      const useCase = new RegistrarAtividadesUseCase(periodoRepository);
      await useCase.execute(periodoId, [
        {
          id: `atv_${Date.now()}`,
          descricao,
          horas: horasNum,
        },
      ]);

      setFeedback('Atividade registrada com sucesso!');
      setDescricao('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao registrar atividade.');
    }
  };

  return (
    <ScrollView style={styles.container} testID="atividades-form-screen">
      <Text style={styles.title}>Registrar Atividades Desenvolvidas</Text>

      {feedback && (
        <View style={styles.banner} testID="atividades-feedback">
          <Text style={styles.bannerText}>{feedback}</Text>
        </View>
      )}

      <Text style={styles.label}>Descrição da Atividade *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex.: Desenvolvimento da camada de domínio com TDD"
        value={descricao}
        onChangeText={setDescricao}
        testID="input-descricao"
      />

      <Text style={styles.label}>Horas Dedicadas *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex.: 4"
        keyboardType="numeric"
        value={horas}
        onChangeText={setHoras}
        testID="input-horas"
      />

      <TouchableOpacity style={styles.button} onPress={handleAddAtividade} testID="btn-salvar-atividade">
        <Text style={styles.buttonText}>Adicionar Atividade</Text>
      </TouchableOpacity>
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1c1c1e',
  },
  banner: {
    backgroundColor: '#d4edda',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  bannerText: {
    color: '#155724',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    marginTop: 8,
    color: '#333',
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
  button: {
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

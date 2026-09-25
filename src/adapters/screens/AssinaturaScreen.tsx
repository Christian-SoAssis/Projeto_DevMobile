import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Assinatura } from '../../domain/value-objects/Assinatura';
import { PeriodoAvaliacaoRepository } from '../../domain/ports/PeriodoAvaliacaoRepository';
import { AssinarRelatorioUseCase } from '../../application/use-cases/AssinarRelatorioUseCase';
import { PeriodoAvaliacaoRepositoryFake } from '../../application/fakes/PeriodoAvaliacaoRepositoryFake';

export interface AssinaturaScreenProps {
  periodoId?: string;
  responsavelId?: string;
  periodoRepository?: PeriodoAvaliacaoRepository;
  onSignedSuccess?: () => void;
}

export const AssinaturaScreen: React.FC<AssinaturaScreenProps> = ({
  periodoId = 'per_1',
  responsavelId = 'resp_1',
  periodoRepository = new PeriodoAvaliacaoRepositoryFake(),
  onSignedSuccess,
}) => {
  const [base64Data, setBase64Data] = useState('data:image/png;base64,mockSignatureBase64StringData123456');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSign = async () => {
    setFeedback(null);
    try {
      const assinatura = new Assinatura(base64Data, responsavelId);
      const useCase = new AssinarRelatorioUseCase(periodoRepository);
      await useCase.execute(periodoId, assinatura);
      setFeedback('Assinatura registrada e sincronizada com sucesso!');
      if (onSignedSuccess) onSignedSuccess();
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao assinar.');
    }
  };

  return (
    <View style={styles.container} testID="signature-screen">
      <Text style={styles.title}>Assinatura Digital do Relatório</Text>

      {feedback && (
        <View style={styles.banner} testID="signature-feedback">
          <Text style={styles.bannerText}>{feedback}</Text>
        </View>
      )}

      <Text style={styles.label}>Dados da Assinatura (Base64 / Canvas)</Text>
      <TextInput
        style={styles.input}
        value={base64Data}
        onChangeText={setBase64Data}
        multiline
        testID="signature-input"
      />

      <TouchableOpacity style={styles.signButton} onPress={handleSign} testID="btn-submit-signature">
        <Text style={styles.signButtonText}>Confirmar Assinatura Digital</Text>
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
    marginBottom: 6,
    color: '#333',
  },
  input: {
    height: 80,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  signButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  signButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

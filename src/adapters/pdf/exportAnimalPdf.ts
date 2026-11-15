import { Alert } from 'react-native';
import { Animal } from '../../domain/entities/Animal';

/**
 * Gera e compartilha o PDF do anúncio de adoção (V06 e V16 — "Gerar PDF do anúncio").
 */
export async function exportAnimalPdf(animal: Animal): Promise<void> {
  const photoUrl = animal.photos[0]?.displayUri || '';
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: sans-serif;
            background: #FDF7F0;
            color: #3A1F14;
            padding: 32px;
          }
          .card {
            background: #FDF1E6;
            border: 2px solid #F6D3BC;
            border-radius: 24px;
            padding: 24px;
          }
          h1 { color: #C2512E; margin-bottom: 4px; }
          .badge {
            display: inline-block;
            background: #2F6B42;
            color: #fff;
            padding: 6px 14px;
            border-radius: 999px;
            font-weight: bold;
          }
          img {
            width: 100%;
            max-height: 320px;
            object-fit: cover;
            border-radius: 18px;
            margin: 16px 0;
          }
          .meta { font-size: 16px; margin: 8px 0; }
          .footer { margin-top: 24px; font-size: 13px; color: #5C4033; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Enlace • Adoção Responsável</h1>
          <h2>${animal.name}</h2>
          <span class="badge">${animal.status.isAvailable() ? 'Disponível para Adoção' : 'Adotado'}</span>
          ${photoUrl ? `<img src="${photoUrl}" alt="${animal.name}" />` : ''}
          <p class="meta"><strong>Espécie:</strong> ${animal.characteristics.species} • <strong>Porte:</strong> ${animal.characteristics.size}</p>
          <p class="meta"><strong>Sexo:</strong> ${animal.characteristics.sex} • <strong>Idade aproximada:</strong> ${animal.characteristics.approximateAge}</p>
          <p class="meta"><strong>Localização aproximada:</strong> ${animal.location.displayLabel} (${animal.location.region})</p>
          ${animal.characteristics.behavior ? `<p class="meta"><strong>Sobre / Comportamento:</strong> ${animal.characteristics.behavior}</p>` : ''}
          ${animal.characteristics.specialCare ? `<p class="meta"><strong>Cuidados especiais:</strong> ${animal.characteristics.specialCare}</p>` : ''}
          <p class="footer">Gerado pelo aplicativo Enlace — O endereço exato não é exibido publicamente (RNF05).</p>
        </div>
      </body>
    </html>
  `;

  try {
    const Print = require('expo-print');
    const Sharing = require('expo-sharing');
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Anúncio de adoção - ${animal.name}`,
      });
    } else {
      Alert.alert('PDF gerado', `Arquivo salvo em: ${uri}`);
    }
  } catch {
    Alert.alert(
      'Cartaz do anúncio',
      `${animal.name} (${animal.characteristics.species}, ${animal.characteristics.approximateAge}) — ${animal.location.displayLabel}`
    );
  }
}

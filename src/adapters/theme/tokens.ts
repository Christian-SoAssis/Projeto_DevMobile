import { Platform, ViewStyle } from 'react-native';

/**
 * Tokens visuais Claymorphism do Enlace (UI-03, UI-04, UI-05 de `instrucoes_iniciais.md`).
 */
export const COLORS = {
  ivory: '#FDF7F0', // Fundo principal (Marfim)
  cream: '#FDF1E6', // Superfícies e cartões (Creme)
  creamInset: '#F8E6D5', // Campos de formulário rebaixados
  peach: '#F6D3BC', // Apoio visual, bordas e sombras quentes (Pêssego)
  terracotta: '#C2512E', // Ação principal e identidade (Terracota)
  terracottaDark: '#9E3E20', // Borda inferior / estado pressionado
  orange: '#D9643A', // Destaques e gradientes quentes (Laranja)
  espresso: '#3A1F14', // Texto principal e títulos (Marrom escuro)
  brown: '#5C4033', // Texto secundário e ícones (Marrom)
  brownMuted: '#8B6B5B', // Placeholders e legendas
  green: '#2F6B42', // Sucesso e badge "Disponível" (Verde)
  greenBg: '#E3F2E7',
  amber: '#C87A19', // Aviso / "Adotado" / "Pendente"
  amberBg: '#FCECD2',
  danger: '#B6362C', // Erro / Exclusão
  dangerBg: '#FADBD8',
  white: '#FFFFFF',
};

export const RADII = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
};

export const SPACING = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
};

export const CLAY_CARD_STYLE: ViewStyle = {
  backgroundColor: COLORS.cream,
  borderRadius: RADII.lg,
  borderWidth: 1.5,
  borderColor: '#FCE8D5',
  ...Platform.select({
    ios: {
      shadowColor: '#8B4A2B',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),
};

export const CLAY_INSET_INPUT_STYLE: ViewStyle = {
  backgroundColor: '#FAF0E6',
  borderRadius: RADII.md,
  borderWidth: 1.5,
  borderColor: COLORS.peach,
  minHeight: 50,
  paddingHorizontal: 14,
  paddingVertical: 10,
};

export const CLAY_PRIMARY_BUTTON_STYLE: ViewStyle = {
  backgroundColor: COLORS.terracotta,
  borderRadius: RADII.pill,
  minHeight: 52,
  paddingHorizontal: 22,
  paddingVertical: 13,
  borderWidth: 1.5,
  borderColor: COLORS.orange,
  borderBottomWidth: 4,
  borderBottomColor: COLORS.terracottaDark,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  ...Platform.select({
    ios: {
      shadowColor: COLORS.terracotta,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
    },
    android: {
      elevation: 5,
    },
    default: {},
  }),
};

export const CLAY_SECONDARY_BUTTON_STYLE: ViewStyle = {
  backgroundColor: COLORS.cream,
  borderRadius: RADII.pill,
  minHeight: 50,
  paddingHorizontal: 20,
  paddingVertical: 12,
  borderWidth: 1.5,
  borderColor: COLORS.peach,
  borderBottomWidth: 3,
  borderBottomColor: '#E4B89B',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
};

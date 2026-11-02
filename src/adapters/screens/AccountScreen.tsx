import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { User } from '../../domain/entities/User';
import { CameraGateway } from '../../domain/ports/CameraGateway';
import { ROLE_LABELS, canAccess } from '../../domain/services/AccessPolicy';
import {
  MAX_BIO_LENGTH,
  PROFILE_INTERESTS,
  ProfilePatch,
} from '../../domain/value-objects/UserProfile';

export interface AccountScreenProps {
  user: User | null;
  isLoading?: boolean;
  cameraGateway?: CameraGateway;
  onLogin?: () => void;
  onRegister?: () => void;
  onLogout?: () => void | Promise<void>;
  /** Salva o perfil; `syncedRemotely: false` = ficou só no aparelho. */
  onSaveProfile?: (patch: ProfilePatch) => Promise<{ user: User; syncedRemotely: boolean }>;
}

const Avatar: React.FC<{ user: User; uri?: string | null }> = ({ user, uri }) =>
  uri ? (
    <Image source={{ uri }} style={styles.avatar} testID="account-avatar-image" />
  ) : (
    <View style={[styles.avatar, styles.avatarPlaceholder]} testID="account-avatar-placeholder">
      <Text style={styles.avatarInitial}>{user.name.charAt(0).toUpperCase()}</Text>
    </View>
  );

export const AccountScreen: React.FC<AccountScreenProps> = ({
  user,
  isLoading = false,
  cameraGateway,
  onLogin,
  onRegister,
  onLogout,
  onSaveProfile,
}) => {
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.contactInfo.phone ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUri ?? null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Troca de conta: o rascunho acompanha o usuário atual.
  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.contactInfo.phone ?? '');
    setBio(user?.bio ?? '');
    setInterests(user?.interests ?? []);
    setAvatarUri(user?.avatarUri ?? null);
    setFeedback(null);
  }, [user?.id]);

  if (isLoading) {
    return (
      <View style={styles.center} testID="account-loading">
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  if (!user) {
    return (
      <ScrollView style={styles.container} testID="account-visitor">
        <Text style={styles.title}>Você está como visitante</Text>
        <Text style={styles.text}>
          Visitantes podem pesquisar animais e ver os detalhes dos anúncios. Entre ou crie uma
          conta para favoritar, demonstrar interesse e anunciar animais para adoção.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onLogin} testID="account-login">
          <Text style={styles.primaryText}>Entrar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onRegister} testID="account-register">
          <Text style={styles.secondaryText}>Criar conta</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const toggleInterest = (interest: string) =>
    setInterests((prev) => (prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]));

  const pickPhoto = async (source: 'camera' | 'gallery') => {
    if (!cameraGateway) return;
    setFeedback(null);
    try {
      const photo =
        source === 'camera' ? await cameraGateway.capturePhoto() : await cameraGateway.pickImageFromGallery();
      if (photo) {
        setAvatarUri(photo.uri);
      } else if (source === 'camera') {
        setFeedback('Não foi possível usar a câmera. Escolha uma foto da galeria.');
      }
    } catch {
      setFeedback('Não foi possível acessar a foto. Tente novamente.');
    }
  };

  const handleSave = async () => {
    if (!onSaveProfile || saving) return;
    setFeedback(null);
    setSaving(true);
    try {
      const result = await onSaveProfile({ name, phone, bio, interests, avatarUri });
      setFeedback(
        result.syncedRemotely
          ? 'Perfil atualizado!'
          : 'Perfil salvo neste aparelho. Não foi possível enviar ao servidor agora.'
      );
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const abilities: Array<[string, boolean]> = [
    ['Pesquisar e ver detalhes de anúncios', canAccess(user.role, 'SEARCH')],
    ['Favoritar e demonstrar interesse', canAccess(user.role, 'FAVORITES')],
    ['Criar e gerir seus anúncios', canAccess(user.role, 'MANAGE_ANIMAL')],
    ['Moderar anúncios', canAccess(user.role, 'MODERATION')],
  ];

  return (
    <ScrollView style={styles.container} testID="account-user">
      <View style={styles.header}>
        <Avatar user={user} uri={user.avatarUri} />
        <View style={styles.headerText}>
          <Text style={styles.title} testID="account-name">{user.name}</Text>
          <Text style={styles.text} testID="account-email">{user.contactInfo.email}</Text>
          <Text style={styles.badge} testID="account-role">{ROLE_LABELS[user.role]}</Text>
        </View>
      </View>

      <Text style={styles.section}>Editar perfil</Text>
      {feedback && (
        <View style={styles.feedbackBanner} testID="profile-feedback">
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}

      <Text style={styles.label}>Foto de perfil</Text>
      <View style={styles.photoRow}>
        <Avatar user={user} uri={avatarUri} />
        <View style={styles.photoActions}>
          {cameraGateway && (
            <>
              <TouchableOpacity style={styles.smallBtn} onPress={() => pickPhoto('camera')} testID="avatar-camera">
                <Text style={styles.smallBtnText}>Tirar foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallBtn} onPress={() => pickPhoto('gallery')} testID="avatar-gallery">
                <Text style={styles.smallBtnText}>Escolher da galeria</Text>
              </TouchableOpacity>
            </>
          )}
          {avatarUri && (
            <TouchableOpacity style={styles.smallBtn} onPress={() => setAvatarUri(null)} testID="avatar-remove">
              <Text style={styles.smallBtnText}>Remover</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.label}>Nome *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} testID="profile-name" />

      <Text style={styles.label}>Telefone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        testID="profile-phone"
      />

      <Text style={styles.label}>Sobre você</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={MAX_BIO_LENGTH}
        placeholder="Conte um pouco sobre você e sua rotina com animais"
        testID="profile-bio"
      />
      <Text style={styles.counter} testID="profile-bio-counter">
        {bio.length}/{MAX_BIO_LENGTH}
      </Text>

      <Text style={styles.label}>Interesses de adoção</Text>
      <View style={styles.chips}>
        {PROFILE_INTERESTS.map((interest) => {
          const selected = interests.includes(interest);
          return (
            <TouchableOpacity
              key={interest}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleInterest(interest)}
              accessibilityState={{ selected }}
              testID={`interest-${interest}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{interest}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, saving && styles.disabled]}
        onPress={handleSave}
        disabled={saving}
        testID="profile-save"
      >
        <Text style={styles.primaryText}>{saving ? 'Salvando...' : 'Salvar alterações'}</Text>
      </TouchableOpacity>

      <Text style={[styles.section, styles.sectionSpaced]}>O que você pode fazer</Text>
      {abilities.map(([label, allowed]) => (
        <Text key={label} style={[styles.ability, !allowed && styles.abilityOff]}>
          {allowed ? '✓ ' : '✗ '}
          {label}
        </Text>
      ))}

      <TouchableOpacity style={styles.dangerBtn} onPress={onLogout} testID="account-logout">
        <Text style={styles.dangerText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'column', padding: 16, backgroundColor: '#f5f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f7' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerText: { flex: 1, marginLeft: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { backgroundColor: '#0066cc', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 4 },
  text: { fontSize: 15, color: '#48484a', marginBottom: 8 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5f0ff',
    color: '#0066cc',
    fontWeight: 'bold',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  section: { fontSize: 16, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 8 },
  sectionSpaced: { marginTop: 28 },
  feedbackBanner: { backgroundColor: '#fff3cd', padding: 10, borderRadius: 6, marginBottom: 12 },
  feedbackText: { color: '#856404', fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4, marginTop: 12 },
  input: {
    minHeight: 44,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  multiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: 10 },
  counter: { alignSelf: 'flex-end', fontSize: 12, color: '#8e8e93', marginTop: 4 },
  photoRow: { flexDirection: 'row', alignItems: 'center' },
  photoActions: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', marginLeft: 16 },
  smallBtn: {
    borderColor: '#0066cc',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  smallBtnText: { color: '#0066cc', fontWeight: 'bold', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    borderColor: '#c7c7cc',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#0066cc', borderColor: '#0066cc' },
  chipText: { color: '#1c1c1e', fontSize: 13 },
  chipTextSelected: { color: '#fff', fontWeight: 'bold' },
  ability: { fontSize: 15, color: '#1c1c1e', marginBottom: 6 },
  abilityOff: { color: '#8e8e93' },
  primaryBtn: { backgroundColor: '#0066cc', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  disabled: { opacity: 0.6 },
  secondaryBtn: {
    borderColor: '#0066cc',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryText: { color: '#0066cc', fontSize: 16, fontWeight: 'bold' },
  dangerBtn: { backgroundColor: '#ff3b30', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 24, marginBottom: 24 },
  dangerText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

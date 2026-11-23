import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useUseCases } from '../../src/adapters/hooks/useUseCases';
import { EnlaceHeader } from '../../src/adapters/components/EnlaceHeader';
import { VisitorAccountView } from '../../src/adapters/components/VisitorAccountView';
import {
  CLAY_CARD_STYLE,
  CLAY_INSET_INPUT_STYLE,
  CLAY_PRIMARY_BUTTON_STYLE,
  CLAY_SECONDARY_BUTTON_STYLE,
  COLORS,
  RADII,
} from '../../src/adapters/theme/tokens';

const INTEREST_TAG_OPTIONS = ['Cães', 'Gatos', 'Filhotes', 'Adultos'];

/**
 * V08 • Conta: Visitante (Prancha 01/02) | V12 • Conta: Perfil (Prancha 02/02)
 */
export default function ContaScreen() {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuth();
  const { pickAndUploadAvatar } = useUseCases();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Cães', 'Gatos']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.contactInfo);
      setBio(user.bio || 'Um lar cheio de carinho para os animais.');
      setAvatarUrl(user.avatarUrl);
      setSelectedTags(user.interestsTags.length > 0 ? user.interestsTags : ['Cães', 'Gatos']);
    }
  }, [user]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handlePickAvatar = async (source: 'CAMERA' | 'GALLERY') => {
    if (!user) return;
    const nextUri = await pickAndUploadAvatar(user.id, source);
    if (nextUri) {
      setAvatarUrl(nextUri);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('Atenção', 'Informe seu nome.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        contactInfo: phone.trim(),
        bio: bio.trim(),
        avatarUrl,
        interestsTags: selectedTags,
      });
      Alert.alert('Perfil atualizado', 'Suas alterações foram salvas com sucesso.');
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <VisitorAccountView
          onLoginPress={() => router.push('/(public)/login')}
          onRegisterPress={() => router.push('/(public)/cadastro')}
        />
      </SafeAreaView>
    );
  }

  const initialLetter = (user.name || 'A').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader />
      <ScrollView contentContainerStyle={styles.profileScroll}>
        <Text style={styles.profileHeaderTitle}>Meu perfil</Text>

        <View style={styles.avatarRow}>
          <View style={styles.avatarCircle}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>{initialLetter}</Text>
            )}
            <TouchableOpacity
              onPress={() => handlePickAvatar('CAMERA')}
              style={styles.avatarCameraSmallBadge}
            >
              <Ionicons name="camera" size={14} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userNameHeading}>{user.name}</Text>
            <Text style={styles.userEmailSub}>{user.email}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>
                {user.isAdmin() ? 'Administrador' : 'Responsável'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.photoPickerBtnsRow}>
          <TouchableOpacity
            onPress={() => handlePickAvatar('CAMERA')}
            style={styles.photoPickBtn}
          >
            <Ionicons name="camera-outline" size={16} color={COLORS.espresso} />
            <Text style={styles.photoPickBtnText}>Tirar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handlePickAvatar('GALLERY')}
            style={styles.photoPickBtn}
          >
            <Ionicons name="images-outline" size={16} color={COLORS.espresso} />
            <Text style={styles.photoPickBtnText}>Galeria</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Nome</Text>
          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={18} color={COLORS.brown} />
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
            />
          </View>

          <Text style={styles.fieldLabel}>Telefone</Text>
          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={18} color={COLORS.brown} />
            <TextInput
              style={styles.textInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="(35) 9 9999-9999"
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.fieldLabel}>Sobre você</Text>
          <View style={styles.inputRow}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.brown} />
            <TextInput
              style={styles.textInput}
              value={bio}
              onChangeText={setBio}
              placeholder="Conte um pouco sobre seu lar"
            />
          </View>

          <Text style={styles.fieldLabel}>Interesses de adoção</Text>
          <View style={styles.tagsRow}>
            {INTEREST_TAG_OPTIONS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={[styles.tagChip, active && styles.tagChipActive]}
                >
                  <Ionicons
                    name="paw"
                    size={13}
                    color={active ? COLORS.white : COLORS.terracotta}
                  />
                  <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            disabled={saving}
            onPress={handleSaveProfile}
            style={[CLAY_PRIMARY_BUTTON_STYLE, { marginTop: 18 }]}
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </Text>
          </TouchableOpacity>

          {user.isAdmin() && (
            <TouchableOpacity
              onPress={() => router.push('/(protected)/moderacao')}
              style={[CLAY_SECONDARY_BUTTON_STYLE, { marginTop: 12 }]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={COLORS.terracotta}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.secondaryBtnText}>Painel de Moderação (Admin)</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryBtnText: {
    color: COLORS.espresso,
    fontSize: 15,
    fontWeight: '800',
  },
  profileScroll: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  profileHeaderTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.espresso,
    marginBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#F3B69B',
    borderWidth: 2,
    borderColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  avatarCameraSmallBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userNameHeading: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  userEmailSub: {
    fontSize: 13,
    color: COLORS.brown,
    marginTop: 2,
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E3ECD6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    marginTop: 6,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.green,
  },
  photoPickerBtnsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  photoPickBtn: {
    ...CLAY_SECONDARY_BUTTON_STYLE,
    flex: 1,
    minHeight: 42,
    paddingVertical: 8,
    gap: 6,
  },
  photoPickBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  formCard: {
    ...CLAY_CARD_STYLE,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.espresso,
    marginTop: 8,
    marginBottom: 4,
  },
  inputRow: {
    ...CLAY_INSET_INPUT_STYLE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.espresso,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.ivory,
    borderWidth: 1.5,
    borderColor: COLORS.peach,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADII.pill,
  },
  tagChipActive: {
    backgroundColor: COLORS.terracotta,
    borderColor: COLORS.terracottaDark,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  tagChipTextActive: {
    color: COLORS.white,
  },
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.terracotta,
    textDecorationLine: 'underline',
  },
});

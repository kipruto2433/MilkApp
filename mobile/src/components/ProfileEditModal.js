import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function ProfileEditModal({ visible, user, onClose, onSave }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(user?.name || '');
      setPhone(user?.phone || '');
    }
  }, [visible, user]);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Missing details', 'Enter both your name and phone number.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), phone: phone.trim() });
      Alert.alert('Profile updated', 'Your name and phone number have been saved.');
      onClose();
    } catch (error) {
      Alert.alert('Could not update profile', error.response?.data?.error || error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit profile</Text>
            <Pressable onPress={onClose} hitSlop={10}><Text style={styles.close}>×</Text></Pressable>
          </View>
          <Text style={styles.label}>Full name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#9CA3AF" autoCapitalize="words" />
          <Text style={styles.label}>Phone number</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="07XXXXXXXX" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />
          <Pressable style={[styles.save, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save changes</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  content: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 34 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  title: { fontSize: 21, fontWeight: '800', color: '#1B432E' },
  close: { fontSize: 30, lineHeight: 30, color: '#4B5563' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 7 },
  input: { borderWidth: 1, borderColor: '#DDE7DF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#262626', marginBottom: 17 },
  save: { backgroundColor: '#1B432E', borderRadius: 12, alignItems: 'center', paddingVertical: 15, marginTop: 4 },
  disabled: { opacity: 0.65 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});

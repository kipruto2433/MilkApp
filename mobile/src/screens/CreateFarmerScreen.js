import React, { useState, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { AuthContext } from '../auth/AuthContext';
import { createFarmer } from '../api';
import Feather from '@expo/vector-icons/Feather';

export default function CreateFarmerScreen({ navigation }) {
  const { token } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [farmerCode, setFarmerCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedVillage = village.trim();
    const trimmedFarmerCode = farmerCode.trim();

    if (!trimmedName || !trimmedPhone || !trimmedVillage) {
      return Alert.alert('Validation Error', 'Please fill all required fields.');
    }

    setLoading(true);
    try {
      await createFarmer(token, {
        name: trimmedName,
        phone: trimmedPhone,
        village: trimmedVillage,
        farmer_code: trimmedFarmerCode || undefined,
        password: password || 'password123',
      });
      Alert.alert('Success', 'Farmer created successfully.');
      navigation.goBack();
    } catch (error) {
      const serverMessage = error.response?.data?.error || error.message || 'Unable to create farmer.';
      Alert.alert('Error', serverMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Register farmer</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        <Text style={styles.inputLabel}>Full Name *</Text>
        <View style={styles.inputContainer}>
          <Feather name="user" size={18} color="#737373" style={{ marginRight: 8 }} />
          <TextInput 
            value={name} 
            onChangeText={setName} 
            placeholder="e.g. Mary Wari" 
            placeholderTextColor="#A3A3A3"
            style={styles.textInput} 
          />
        </View>

        <Text style={styles.inputLabel}>Phone Number *</Text>
        <View style={styles.inputContainer}>
          <Feather name="phone" size={18} color="#737373" style={{ marginRight: 8 }} />
          <TextInput 
            value={phone} 
            onChangeText={setPhone} 
            placeholder="e.g. 0722222244" 
            placeholderTextColor="#A3A3A3"
            style={styles.textInput} 
            keyboardType="phone-pad" 
          />
        </View>

        <Text style={styles.inputLabel}>Village / Collection Zone *</Text>
        <View style={styles.inputContainer}>
          <Feather name="map-pin" size={18} color="#737373" style={{ marginRight: 8 }} />
          <TextInput 
            value={village} 
            onChangeText={setVillage} 
            placeholder="e.g. Zone A" 
            placeholderTextColor="#A3A3A3"
            style={styles.textInput} 
          />
        </View>

        <Text style={styles.inputLabel}>Farmer Code</Text>
        <View style={styles.inputContainer}>
          <Feather name="tag" size={18} color="#737373" style={{ marginRight: 8 }} />
          <TextInput 
            value={farmerCode} 
            onChangeText={setFarmerCode} 
            placeholder="e.g. 0042 (Optional)" 
            placeholderTextColor="#A3A3A3"
            style={styles.textInput} 
          />
        </View>

        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.inputContainer}>
          <Feather name="lock" size={18} color="#737373" style={{ marginRight: 8 }} />
          <TextInput 
            value={password} 
            onChangeText={setPassword} 
            placeholder="Optional password (default: password123)" 
            placeholderTextColor="#A3A3A3"
            style={styles.textInput} 
            secureTextEntry 
          />
        </View>

        <Pressable style={styles.button} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Register Farmer</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8F4',
  },
  header: {
    backgroundColor: '#1B432E',
    height: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 36,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  inputLabel: {
    color: '#1B432E',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 14,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  textInput: {
    color: '#262626',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    padding: 0,
  },
  button: {
    backgroundColor: '#1B432E',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#1B432E',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
});

import React, { useState, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { AuthContext } from '../auth/AuthContext';
import Feather from '@expo/vector-icons/Feather';

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { signUp } = useContext(AuthContext);
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const onSubmit = async () => {
    if (!name || !phone || !password || !confirmPassword) {
      return Alert.alert('Validation', 'Please fill in all required fields.');
    }

    if (password !== confirmPassword) {
      return Alert.alert('Validation', 'Passwords do not match.');
    }

    setLoading(true);
    setError('');
    
    try {
      await signUp({
        name: name.trim(),
        phone: phone.trim(),
        password,
        role: 'collector',
      });
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Unable to register.';
      setError(message);
      Alert.alert('Registration failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={[styles.scrollContainer, isWide && styles.scrollContainerWide]} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Create Account</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={[styles.formContainer, isWide && styles.formContainerWide]}>
          <Text style={styles.formHint}>Collector account signup only</Text>

          <Text style={styles.inputLabel}>Full Name</Text>
          <View style={styles.inputContainer}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. John Doe"
              placeholderTextColor="#A3A3A3"
              style={styles.textInput}
            />
          </View>

          <Text style={styles.inputLabel}>Phone Number</Text>
          <View style={styles.inputContainer}>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. +254 712 345 678"
              placeholderTextColor="#A3A3A3"
              style={styles.textInput}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#A3A3A3"
              style={styles.textInput}
              secureTextEntry
            />
          </View>

          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor="#A3A3A3"
              style={styles.textInput}
              secureTextEntry
            />
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          
          <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </Pressable>

          <Pressable style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLinkText}>Already have an account? <Text style={{ color: '#1B432E', fontWeight: '800' }}>Sign In</Text></Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8F4',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  scrollContainerWide: { paddingHorizontal: 24 },
  header: {
    backgroundColor: '#1B432E',
    height: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 36,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  formContainerWide: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  inputLabel: {
    color: '#1B432E',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#EAF0EB',
    borderRadius: 14,
    padding: 4,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#1B432E',
  },
  tabText: {
    color: '#737373',
    fontWeight: '700',
    fontSize: 13,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 4,
  },
  textInput: {
    color: '#262626',
    fontSize: 15,
    fontWeight: '500',
    padding: 0,
  },
  button: {
    backgroundColor: '#1B432E',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
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
  errorText: {
    color: '#EF4444',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  loginLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#737373',
    fontSize: 14,
    fontWeight: '500',
  },
});

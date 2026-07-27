
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { AuthContext } from '../auth/AuthContext';
import Feather from '@expo/vector-icons/Feather';
import { checkBackendHealth } from '../api';
import { isHostedWebWithoutApi } from '../config';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionState, setConnectionState] = useState('checking');
  const { signIn } = useContext(AuthContext);
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const checkConnection = async () => {
    if (isHostedWebWithoutApi) {
      setConnectionState('configuration');
      return;
    }
    setConnectionState('checking');
    try {
      await checkBackendHealth();
      setConnectionState('online');
    } catch {
      setConnectionState('offline');
    }
  };

  useEffect(() => { checkConnection(); }, []);

  const onSubmit = async () => {
    if (!phone || !password) {
      return Alert.alert('Validation', 'Please enter your phone number and password.');
    }

    setLoading(true);
    setError('');
    try {
      await signIn(phone.trim(), password);
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Unable to log in.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]} keyboardShouldPersistTaps="handled">
        {/* Figma green banner header */}
        <View style={styles.headerContainer}>
          <View style={styles.logoCircle}>
            <Feather name="droplet" size={32} color="#1B432E" />
          </View>
          <Text style={styles.brandTitle}>MilkTrack</Text>
          <Text style={styles.brandSubtitle}>Digital milk collection system</Text>
        </View>

        {/* Form Container */}
        <View style={[styles.formContainer, isWide && styles.formContainerWide]}>
          <Pressable style={[styles.connectionBadge, connectionState === 'online' && styles.connectionOnline, connectionState === 'offline' && styles.connectionOffline]} onPress={checkConnection}>
            <Feather name={connectionState === 'online' ? 'wifi' : connectionState === 'checking' ? 'loader' : 'wifi-off'} size={14} color={connectionState === 'online' ? '#107C41' : '#A16207'} />
            <Text style={[styles.connectionText, connectionState === 'online' && styles.connectionTextOnline]}>
              {connectionState === 'online' ? 'Server connected' : connectionState === 'checking' ? 'Checking server…' : connectionState === 'configuration' ? 'API URL needs configuration' : 'Server unavailable — tap to retry'}
            </Text>
          </Pressable>
          
          <Text style={styles.inputLabel}>Phone number</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. +254 712 345 678"
              placeholderTextColor="#A3A3A3"
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
          </View>

          {/* Password input */}
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#A3A3A3"
              secureTextEntry
            />
          </View>

          {/* Role selection label */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Sign In Button */}
          <Pressable style={styles.signInButton} onPress={onSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#1B432E" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        {/* Bottom Signup Link */}
        <Pressable style={[styles.signupLink, isWide && styles.signupLinkWide]} onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.signupText}>Are you a milk collector? <Text style={styles.signupLinkText}>Sign Up</Text></Text>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  scrollContentWide: { paddingHorizontal: 24 },
  headerContainer: {
    backgroundColor: '#1B432E',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingTop: 64,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#85B68C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: '#C5D9C8',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '500',
  },
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  formContainerWide: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  connectionBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: '#FEF3D6', borderRadius: 99, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 4 },
  connectionOnline: { backgroundColor: '#E6F7EB' },
  connectionOffline: { backgroundColor: '#FEE2E2' },
  connectionText: { color: '#A16207', fontSize: 12, fontWeight: '700' },
  connectionTextOnline: { color: '#107C41' },
  inputLabel: {
    color: '#1B432E',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputContainer: {
    backgroundColor: '#262626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3F3F3F',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    padding: 0, // Reset default Android paddings
  },
  roleGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  roleCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 5,
    justifyContent: 'center',
  },
  roleCardActive: {
    borderColor: '#1B432E',
    backgroundColor: '#E6F7EB',
  },
  roleCardInactive: {
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  roleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  roleIconCircleActive: {
    backgroundColor: '#C5D9C8',
  },
  roleIconCircleInactive: {
    backgroundColor: '#F5F5F5',
  },
  roleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  roleTextActive: {
    color: '#1B432E',
  },
  roleTextInactive: {
    color: '#737373',
  },
  signInButton: {
    marginTop: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1B432E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    shadowColor: '#1B432E',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  signInButtonText: {
    color: '#1B432E',
    fontSize: 16,
    fontWeight: '800',
  },
  errorText: {
    color: '#EF4444',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  signupLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  signupLinkWide: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  signupText: {
    color: '#737373',
    fontSize: 14,
    fontWeight: '500',
  },
  signupLinkText: {
    color: '#1B432E',
    fontWeight: '700',
  },
});

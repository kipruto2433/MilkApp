import React, { useContext } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, AuthContext } from './src/auth/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import CollectorHomeScreen from './src/screens/CollectorHomeScreen';
import CreateFarmerScreen from './src/screens/CreateFarmerScreen';
import RecordCollectionScreen from './src/screens/RecordCollectionScreen';
import RecordPaymentScreen from './src/screens/RecordPaymentScreen';
import FarmerHomeScreen from './src/screens/FarmerHomeScreen';
import AdminHomeScreen from './src/screens/AdminHomeScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
      <ActivityIndicator />
    </View>
  );

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Sign Up' }} />
          </>
        ) : user.role === 'collector' ? (
          <>
            <Stack.Screen name="CollectorDashboard" component={CollectorHomeScreen} options={{ title: 'Dashboard' }} />
            <Stack.Screen name="CreateFarmer" component={CreateFarmerScreen} options={{ title: 'Create Farmer' }} />
            <Stack.Screen name="RecordCollection" component={RecordCollectionScreen} options={{ title: 'Record Collection' }} />
            <Stack.Screen name="RecordPayment" component={RecordPaymentScreen} options={{ title: 'Record Payment' }} />
          </>
        ) : user.role === 'farmer' ? (
          <>
            <Stack.Screen name="FarmerDashboard" component={FarmerHomeScreen} options={{ title: 'Farmer Dashboard' }} />
          </>
        ) : user.role === 'admin' ? (
          <>
            <Stack.Screen name="AdminDashboard" component={AdminHomeScreen} options={{ title: 'Admin Dashboard' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const isLargeScreen = Platform.OS === 'web' && width >= 768;

  return (
    <View style={styles.page}>
      <View style={[styles.appFrame, isLargeScreen && styles.appFrameLarge]}>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    height: '100%',
    backgroundColor: '#E9F1EA',
  },
  appFrame: {
    flex: 1,
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
  appFrameLarge: {
    maxWidth: 1440,
    alignSelf: 'center',
    shadowColor: '#1B432E',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
});

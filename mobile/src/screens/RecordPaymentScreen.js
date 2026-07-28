import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, ActivityIndicator, Modal, FlatList } from 'react-native';
import { AuthContext } from '../auth/AuthContext';
import { createPayment, fetchFarmers } from '../api';
import Feather from '@expo/vector-icons/Feather';

export default function RecordPaymentScreen({ route, navigation }) {
  const { token } = useContext(AuthContext);
  const routeFarmerId = route?.params?.farmerId;

  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('mpesa'); // 'mpesa' | 'cash'
  const [paymentFlow, setPaymentFlow] = useState('payout');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [farmerModalVisible, setFarmerModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFarmers = farmers.filter(f => {
    const q = searchQuery.toLowerCase();
    return (
      (f.name || '').toLowerCase().includes(q) ||
      (f.phone || '').toLowerCase().includes(q) ||
      (f.village || '').toLowerCase().includes(q) ||
      (f.farmer_code || '').toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const loadFarmers = async () => {
      setFetching(true);
      try {
        const response = await fetchFarmers(token);
        const list = response.data.farmers || [];
        setFarmers(list);

        if (routeFarmerId) {
          const match = list.find(f => f.id === routeFarmerId);
          if (match) setSelectedFarmer(match);
        } else if (list.length > 0) {
          setSelectedFarmer(list[0]);
        }
      } catch (error) {
        Alert.alert('Error', 'Unable to load farmers.');
      } finally {
        setFetching(false);
      }
    };
    loadFarmers();
  }, [token, routeFarmerId]);

  const handleSave = async () => {
    if (!selectedFarmer || !amount || !paymentDate) {
      return Alert.alert('Validation Error', 'Please complete the payment form.');
    }

    setLoading(true);
    try {
      const response = await createPayment(token, {
        farmer_id: selectedFarmer.id,
        amount: parseFloat(amount),
        payment_date: paymentDate,
        method,
        payment_flow: paymentFlow,
        phone_number: phoneNumber || selectedFarmer.phone,
        notes,
      });

      Alert.alert('Success', paymentFlow === 'receive' && method === 'mpesa'
        ? 'STK push sent. Ask the farmer to approve it on their phone.'
        : response.data.payment.status === 'pending'
          ? 'M-Pesa payout submitted and awaiting confirmation.'
          : 'Payment recorded successfully.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Unable to record payment.');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'F';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <View style={styles.mainContainer}>
      {/* Custom Figma Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Record payment</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Selected Farmer Card */}
        {fetching ? (
          <ActivityIndicator size="small" color="#1B432E" style={{ marginVertical: 20 }} />
        ) : selectedFarmer ? (
          <Pressable 
            style={styles.farmerCard} 
            onPress={() => {
              setSearchQuery('');
              setFarmerModalVisible(true);
            }}
          >
            <View style={styles.farmerAvatarCircle}>
              <Text style={styles.farmerAvatarText}>{getInitials(selectedFarmer.name)}</Text>
            </View>
            <View style={styles.farmerMeta}>
              <Text style={styles.farmerName}>{selectedFarmer.name}</Text>
              <Text style={styles.farmerIdText}>Phone: {selectedFarmer.phone || 'N/A'} · {selectedFarmer.village || 'Zone A'}</Text>
            </View>
            <Feather name="chevron-down" size={20} color="#737373" />
          </Pressable>
        ) : (
          <View style={styles.farmerCard}>
            <Text style={styles.emptyText}>No farmers registered yet.</Text>
          </View>
        )}

        {/* Amount Input */}
        <Text style={styles.inputLabel}>Amount (KSh)</Text>
        <View style={styles.inputContainer}>
          <Feather name="dollar-sign" size={20} color="#737373" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.textInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 5000"
            placeholderTextColor="#A3A3A3"
            keyboardType="numeric"
          />
        </View>

        {/* Date Input */}
        <Text style={styles.inputLabel}>Payment Date</Text>
        <View style={styles.inputContainer}>
          <Feather name="calendar" size={20} color="#737373" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.textInput}
            value={paymentDate}
            onChangeText={setPaymentDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#A3A3A3"
          />
        </View>

        {/* Method Selector */}
        <Text style={styles.inputLabel}>Transaction</Text>
        <View style={styles.methodRow}>
          <Pressable style={[styles.methodButton, paymentFlow === 'payout' && styles.methodButtonActive]} onPress={() => setPaymentFlow('payout')}>
            <Text style={[styles.methodButtonText, paymentFlow === 'payout' && styles.methodButtonTextActive]}>Pay Farmer</Text>
          </Pressable>
          <Pressable style={[styles.methodButton, paymentFlow === 'receive' && styles.methodButtonActive]} onPress={() => setPaymentFlow('receive')}>
            <Text style={[styles.methodButtonText, paymentFlow === 'receive' && styles.methodButtonTextActive]}>Receive Payment</Text>
          </Pressable>
        </View>
        <Text style={styles.inputLabel}>Payment Method</Text>
        <View style={styles.methodRow}>
          <Pressable
            style={[styles.methodButton, method === 'mpesa' && styles.methodButtonActive]}
            onPress={() => setMethod('mpesa')}
          >
            <Text style={[styles.methodButtonText, method === 'mpesa' && styles.methodButtonTextActive]}>M-Pesa</Text>
          </Pressable>
          <Pressable
            style={[styles.methodButton, method === 'cash' && styles.methodButtonActive]}
            onPress={() => setMethod('cash')}
          >
            <Text style={[styles.methodButtonText, method === 'cash' && styles.methodButtonTextActive]}>Cash / Hand</Text>
          </Pressable>
        </View>

        {method === 'mpesa' && (
          <>
            <Text style={styles.inputLabel}>{paymentFlow === 'receive' ? 'Number to receive STK prompt' : 'Farmer M-Pesa number'}</Text>
            <View style={styles.inputContainer}>
              <Feather name="phone" size={20} color="#737373" style={{ marginRight: 8 }} />
              <TextInput style={styles.textInput} value={phoneNumber} onChangeText={setPhoneNumber} placeholder={selectedFarmer?.phone || '0712 345 678'} placeholderTextColor="#A3A3A3" keyboardType="phone-pad" />
            </View>
          </>
        )}

        {/* Notes Input */}
        <Text style={styles.inputLabel}>Notes</Text>
        <View style={styles.notesContainer}>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional payment notes..."
            placeholderTextColor="#A3A3A3"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Save button */}
        <Pressable 
          style={styles.saveButton} 
          onPress={handleSave}
          disabled={loading || !selectedFarmer}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>{paymentFlow === 'receive' && method === 'mpesa' ? 'Send STK Prompt' : 'Initiate Payment'}</Text>
          )}
        </Pressable>
      </ScrollView>

      {/* Farmer Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={farmerModalVisible}
        onRequestClose={() => setFarmerModalVisible(false)}
      >
        <View style={styles.modalCenteredOverlay}>
          <View style={styles.modalContentCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Select Farmer</Text>
              <Pressable onPress={() => setFarmerModalVisible(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={20} color="#737373" />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={styles.modalSearchContainer}>
              <Feather name="search" size={18} color="#737373" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name, phone or zone..."
                placeholderTextColor="#A3A3A3"
              />
            </View>

            {/* List */}
            <FlatList
              data={filteredFarmers}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const isSelected = selectedFarmer?.id === item.id;
                return (
                  <Pressable
                    style={[styles.modalFarmerItem, isSelected && styles.modalFarmerItemActive]}
                    onPress={() => {
                      setSelectedFarmer(item);
                      setFarmerModalVisible(false);
                    }}
                  >
                    <View style={[styles.farmerAvatarCircle, isSelected && styles.avatarCircleActive]}>
                      <Text style={[styles.farmerAvatarText, isSelected && styles.avatarTextActive]}>{getInitials(item.name)}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.modalFarmerName, isSelected && styles.modalFarmerNameActive]}>{item.name}</Text>
                      <Text style={styles.modalFarmerMeta}>Phone: {item.phone || 'N/A'} · {item.village || 'Zone A'}</Text>
                    </View>
                    {isSelected && <Feather name="check" size={20} color="#107C41" />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: '#737373', fontSize: 14 }}>No matching farmers found.</Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 16 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
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
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  farmerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  farmerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E6F7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmerAvatarText: {
    color: '#107C41',
    fontWeight: '700',
    fontSize: 15,
  },
  farmerMeta: {
    flex: 1,
    marginLeft: 12,
  },
  farmerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#262626',
  },
  farmerIdText: {
    fontSize: 12,
    color: '#737373',
    marginTop: 4,
  },
  emptyText: {
    flex: 1,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '600',
  },
  inputLabel: {
    color: '#1B432E',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
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
  },
  textInput: {
    color: '#262626',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    padding: 0,
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  methodButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  methodButtonActive: {
    borderColor: '#1B432E',
    backgroundColor: '#E6F7EB',
  },
  methodButtonText: {
    fontSize: 14,
    color: '#737373',
    fontWeight: '700',
  },
  methodButtonTextActive: {
    color: '#1B432E',
  },
  notesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notesInput: {
    color: '#262626',
    fontSize: 15,
    fontWeight: '500',
    minHeight: 60,
    textAlignVertical: 'top',
    padding: 0,
  },
  saveButton: {
    backgroundColor: '#1B432E',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    shadowColor: '#1B432E',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalCenteredOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '90%',
    height: '75%',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B432E',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSearchContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalSearchInput: {
    flex: 1,
    color: '#262626',
    fontSize: 14,
    padding: 0,
    fontWeight: '500',
  },
  modalFarmerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    marginBottom: 8,
  },
  modalFarmerItemActive: {
    backgroundColor: '#E6F7EB',
  },
  modalFarmerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#262626',
  },
  modalFarmerNameActive: {
    color: '#1B432E',
  },
  modalFarmerMeta: {
    fontSize: 12,
    color: '#737373',
    marginTop: 2,
  },
  avatarCircleActive: {
    backgroundColor: '#FFFFFF',
  },
  avatarTextActive: {
    color: '#107C41',
  },
});

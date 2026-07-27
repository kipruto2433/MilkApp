import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView, Modal, FlatList } from 'react-native';
import { AuthContext } from '../auth/AuthContext';
import { createCollection, fetchFarmers } from '../api';
import { Feather } from '@expo/vector-icons';
import { getCachedFarmers, savePendingCollection, getCollectorPrice } from '../utils/storage';

export default function RecordCollectionScreen({ route, navigation }) {
  const { token } = useContext(AuthContext);
  const routeFarmerId = route?.params?.farmerId;

  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [litersStr, setLitersStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [milkPrice, setMilkPrice] = useState(50);
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
        
        // Select farmer from navigation params, or default to the first active farmer
        if (routeFarmerId) {
          const match = list.find(f => f.id === routeFarmerId);
          if (match) setSelectedFarmer(match);
        } else if (list.length > 0) {
          setSelectedFarmer(list[0]);
        }
      } catch (error) {
        const cached = await getCachedFarmers();
        if (cached && cached.length > 0) {
          setFarmers(cached);
          if (routeFarmerId) {
            const match = cached.find(f => f.id === routeFarmerId);
            if (match) setSelectedFarmer(match);
          } else {
            setSelectedFarmer(cached[0]);
          }
        } else {
          Alert.alert('Error', 'Unable to load farmers.');
        }
      } finally {
        setFetching(false);
      }
    };

    const loadPrice = async () => {
      const price = await getCollectorPrice();
      setMilkPrice(price);
    };

    loadFarmers();
    loadPrice();
  }, [token, routeFarmerId]);

  const handleSave = async () => {
    if (!selectedFarmer) {
      return Alert.alert('Validation Error', 'Please select a farmer.');
    }

    const parsedLiters = parseFloat(litersStr);
    if (isNaN(parsedLiters) || parsedLiters <= 0) {
      return Alert.alert('Validation Error', 'Please enter a valid quantity.');
    }

    const totalAmount = parsedLiters * milkPrice; // Use dynamic rate instead of 50
    const collectedAt = new Date().toISOString().split('T')[0];

    setLoading(true);
    try {
      await createCollection(token, {
        farmer_id: selectedFarmer.id,
        collected_at: collectedAt,
        liters: parsedLiters,
        total_amount: totalAmount,
      });

      Alert.alert('Success', `Milk collection of ${parsedLiters}L recorded successfully.`);
      navigation.goBack();
    } catch (error) {
      const isNetworkError = !error.response || (error.response.status >= 500);
      if (isNetworkError) {
        Alert.alert(
          'Connection Offline',
          'Cannot reach server. Would you like to save this collection locally and sync later?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
            {
              text: 'Save Offline',
              onPress: async () => {
                setLoading(true);
                try {
                  await savePendingCollection({
                    farmer_id: selectedFarmer.id,
                    collected_at: collectedAt,
                    liters: parsedLiters,
                    total_amount: totalAmount,
                  });
                  Alert.alert('Saved Locally', 'Milk collection stored on device. Sync from home screen when online.');
                  navigation.goBack();
                } catch (e) {
                  Alert.alert('Error', 'Failed to save locally.');
                } finally {
                  setLoading(false);
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', error.response?.data?.error || 'Unable to record collection.');
        setLoading(false);
      }
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
        <Text style={styles.headerTitle}>Record collection</Text>
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
            <Text style={styles.emptyText}>No farmers available. Go back and register one first.</Text>
          </View>
        )}

        {/* Direct liters entry */}
        <View style={styles.stepperContainer}>
          <Text style={styles.sectionLabel}>Quantity collected (Litres)</Text>
          <TextInput
            style={styles.directInput}
            value={litersStr}
            onChangeText={setLitersStr}
            placeholder="Enter milk amount"
            placeholderTextColor="#A3A3A3"
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <Text style={styles.stepperUnit}>litres</Text>
          <Text style={styles.priceEstimateText}>
            Rate: KSh {milkPrice}/L · Est. Total: KSh {parseFloat(litersStr) ? ((parseFloat(litersStr) || 0) * milkPrice).toLocaleString() : '0'}
          </Text>
        </View>



        {/* Calculated Amount Details Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Estimated Payment Amount</Text>
          <Text style={styles.summaryValue}>KSh {((parseFloat(litersStr) || 0) * milkPrice).toLocaleString()}</Text>
          <Text style={styles.summarySub}>Calculated at KSh {milkPrice.toFixed(2)} per Litre</Text>
        </View>

        {/* Save Collection Button */}
        <Pressable 
          style={styles.saveButton} 
          onPress={handleSave}
          disabled={loading || !selectedFarmer}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Collection</Text>
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
  stepperContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionLabel: {
    color: '#1B432E',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 12,
  },
  directInput: {
    width: '100%',
    fontSize: 42,
    fontWeight: '800',
    color: '#262626',
    textAlign: 'center',
    paddingVertical: 8,
  },
  stepperUnit: {
    fontSize: 13,
    color: '#737373',
    fontWeight: '600',
    marginTop: 4,
  },
  selectorSection: {
    marginBottom: 24,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  sessionButtonActive: {
    borderColor: '#1B432E',
    backgroundColor: '#E6F7EB',
  },
  sessionButtonText: {
    fontSize: 14,
    color: '#737373',
    fontWeight: '700',
  },
  sessionButtonTextActive: {
    color: '#1B432E',
  },
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qualityButton: {
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
  qualityButtonActive: {
    borderColor: '#1B432E',
    backgroundColor: '#E6F7EB',
  },
  qualityButtonRejectedActive: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  qualityButtonText: {
    fontSize: 13,
    color: '#737373',
    fontWeight: '700',
  },
  qualityButtonTextActive: {
    color: '#1B432E',
  },
  qualityButtonTextRejectedActive: {
    color: '#EF4444',
  },
  summaryCard: {
    backgroundColor: '#E6F7EB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C5D9C8',
    padding: 18,
    alignItems: 'center',
    marginBottom: 32,
  },
  summaryLabel: {
    color: '#85B68C',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1B432E',
    marginBottom: 4,
  },
  summarySub: {
    color: '#1B432E',
    fontSize: 11,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#1B432E',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  priceEstimateText: {
    fontSize: 12,
    color: '#85B68C',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
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

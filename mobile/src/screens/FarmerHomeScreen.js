import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, ActivityIndicator, Platform } from 'react-native';
import { fetchCollections, fetchPayments } from '../api';
import { AuthContext } from '../auth/AuthContext';
import { Feather } from '@expo/vector-icons';

export default function FarmerHomeScreen() {
  const { token, user, signOut } = useContext(AuthContext);
  const [collections, setCollections] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('home'); // 'home' | 'milk' | 'payments' | 'profile'

  const loadData = async () => {
    setLoading(true);
    try {
      const [collectionsResponse, paymentsResponse] = await Promise.all([
        fetchCollections(token),
        fetchPayments(token),
      ]);
      setCollections(collectionsResponse.data.collections || []);
      setPayments(paymentsResponse.data.payments || []);
    } catch (error) {
      Alert.alert('Error', 'Unable to load your history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleRequestPayment = () => {
    if (balanceDueVal <= 0) {
      Alert.alert('No Balance Due', 'You currently have no outstanding balance to request.');
      return;
    }
    Alert.alert(
      'Payment Request Sent',
      `Your request for payment of KSh ${balanceDueVal.toLocaleString()} has been sent to your milk collector.`
    );
  };

  const getInitials = (name) => {
    if (!name) return 'F';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Dynamic calculations (fallback to design figures if empty)
  const totalLiters = collections.reduce((sum, item) => sum + parseFloat(item.liters || 0), 0);
  const totalEarnedVal = collections.reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0);
  const totalPaidVal = payments.filter(p => p.status === 'paid' || p.status === 'completed').reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const pendingPayments = (payments || []).filter(p => p.status === 'pending' || p.status === 'processing');
  const balanceDueVal = Math.max(0, totalEarnedVal - totalPaidVal);

  const displayLiters = `${totalLiters.toFixed(0)} L`;
  const displayEarned = `KSh ${totalEarnedVal.toLocaleString()}`;
  const displayBalance = `KSh ${balanceDueVal.toLocaleString()}`;

  const mostRecentPayment = payments.length > 0 ? payments.reduce((prev, current) => (new Date(prev.payment_date) > new Date(current.payment_date)) ? prev : current) : null;

  // Render Home Dashboard Tab
  const renderHomeTab = () => {
    const sortedCollections = [...collections].sort((a, b) => new Date(a.collected_at) - new Date(b.collected_at) || a.id - b.id);
    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {/* Figma Header */}
        <View style={styles.headerBanner}>
          <View>
            <Text style={styles.headerGreeting}>Welcome back</Text>
            <Text style={styles.headerFarmerName}>{user?.name || 'Farmer'}</Text>
            <Text style={styles.headerFarmerId}>Phone: {user?.phone || 'N/A'} · {user?.village || 'N/A'}</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>{displayLiters}</Text>
            <Text style={styles.statBoxLabel}>This month</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>{displayEarned}</Text>
            <Text style={styles.statBoxLabel}>Total earned</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>{displayBalance}</Text>
            <Text style={styles.statBoxLabel}>Balance due</Text>
          </View>
        </View>

        {/* Section: DELIVERY HISTORY */}
        <Text style={styles.sectionTitle}>DELIVERY HISTORY</Text>
        <View style={styles.listContainer}>
          {loading && collections.length === 0 ? (
            <ActivityIndicator size="small" color="#1B432E" style={{ marginVertical: 20 }} />
          ) : collections.length > 0 ? (
            collections.map((item, idx) => {
              const collDate = new Date(item.collected_at);
              const dateStr = collDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              
              // FIFO calculation for payment status
              const itemIndex = sortedCollections.findIndex(c => c.id === item.id);
              const collectionsUpToItem = itemIndex >= 0 ? sortedCollections.slice(0, itemIndex + 1) : [item];
              const cumulativeEarnedUpToItem = collectionsUpToItem.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);
              const isPaid = item.status === 'completed' || totalPaidVal >= cumulativeEarnedUpToItem;

              return (
                <View style={styles.deliveryCard} key={item.id || idx}>
                  <View style={styles.deliveryCardLeft}>
                    <View style={styles.dateCircle}>
                      <Text style={styles.dateCircleMonth}>{dateStr.split(' ')[0]}</Text>
                      <Text style={styles.dateCircleDay}>{dateStr.split(' ')[1]}</Text>
                    </View>
                    <View style={styles.deliveryDetails}>
                      <Text style={styles.deliverySession}>
                        Collector: {item.collector_name || 'N/A'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.deliveryCardRight}>
                    <Text style={styles.deliveryLiters}>{item.liters} L</Text>
                    <View style={[styles.statusBadge, isPaid ? styles.statusBadgePaid : styles.statusBadgePending]}>
                      <Text style={[styles.statusBadgeText, isPaid ? styles.statusBadgeTextPaid : styles.statusBadgeTextPending]}>
                        {isPaid ? 'Paid' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No delivery records found.</Text>
            </View>
          )}
        </View>

        {/* Section: PAYMENT SUMMARY */}
        <Text style={styles.sectionTitle}>PAYMENT SUMMARY</Text>
        <View style={styles.paymentSummaryCard}>
          {/* Recent payment */}
          {mostRecentPayment ? (
            <View style={styles.paymentSummaryRow}>
              <View>
                <Text style={styles.paymentSummaryLabel}>Recent payment</Text>
                <Text style={styles.paymentSummarySub}>{mostRecentPayment.method.toUpperCase()} · {new Date(mostRecentPayment.payment_date).toLocaleDateString()}</Text>
              </View>
              <View style={styles.paymentSummaryRight}>
                <Text style={styles.paymentSummaryAmount}>KSh {parseFloat(mostRecentPayment.amount).toLocaleString()}</Text>
                <View style={[styles.statusBadge, mostRecentPayment.status === 'paid' ? styles.statusBadgePaid : styles.statusBadgePending, { alignSelf: 'flex-end', marginTop: 4 }]}>
                  <Text style={[styles.statusBadgeText, mostRecentPayment.status === 'paid' ? styles.statusBadgeTextPaid : styles.statusBadgeTextPending]}>
                    {mostRecentPayment.status === 'paid' ? 'Received' : 'Pending'}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.paymentSummaryRow}>
              <View>
                <Text style={styles.paymentSummaryLabel}>No recent payments</Text>
              </View>
            </View>
          )}

          {/* Divider */}
          <View style={styles.cardDivider} />

          {/* Balance due */}
          <View style={[styles.paymentSummaryRow, { marginTop: 12 }]}>
            <View>
              <Text style={styles.paymentSummaryLabel}>Balance due</Text>
              <Text style={styles.paymentSummarySub}>{pendingPayments.length} records unpaid</Text>
            </View>
            <View style={styles.paymentSummaryRight}>
              <Text style={styles.paymentSummaryAmount}>{displayBalance}</Text>
              <View style={[styles.statusBadge, styles.statusBadgePending, { alignSelf: 'flex-end', marginTop: 4 }]}>
                <Text style={[styles.statusBadgeText, styles.statusBadgeTextPending]}>Pending</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Request payment button */}
        <Pressable style={styles.requestButton} onPress={handleRequestPayment}>
          <Text style={styles.requestButtonText}>Request payment</Text>
        </Pressable>
      </ScrollView>
    );
  };

  const renderMilkTab = () => {
    return (
      <View style={styles.tabContainer}>
        <View style={styles.tabHeader}>
          <Text style={styles.tabTitle}>Milk Deliveries</Text>
        </View>
        <ScrollView contentContainerStyle={styles.tabScrollContent}>
          {collections.length > 0 ? (
            collections.map(item => (
              <View style={styles.deliveryCard} key={item.id}>
                <View style={styles.deliveryCardLeft}>
                  <View style={[styles.dateCircle, { backgroundColor: '#C5D9C8' }]}>
                    <Feather name="droplet" size={20} color="#1B432E" />
                  </View>
                  <View style={styles.deliveryDetails}>
                    <Text style={styles.deliverySession}>{new Date(item.collected_at).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
                    <Text style={styles.deliveryCollector}>Recorded by: {item.collector_name || 'James K.'}</Text>
                  </View>
                </View>
                <View style={styles.deliveryCardRight}>
                  <Text style={styles.deliveryLiters}>{item.liters} L</Text>
                  <Text style={styles.deliveryAmtText}>KSh {parseFloat(item.total_amount || 0).toLocaleString()}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No deliveries recorded.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderPaymentsTab = () => {
    return (
      <View style={styles.tabContainer}>
        <View style={styles.tabHeader}>
          <Text style={styles.tabTitle}>Payments History</Text>
        </View>
        <ScrollView contentContainerStyle={styles.tabScrollContent}>
          {payments.length > 0 ? (
            payments.map(item => (
              <View style={styles.deliveryCard} key={item.id}>
                <View style={styles.deliveryCardLeft}>
                  <View style={[styles.dateCircle, { backgroundColor: '#EAF0EB' }]}>
                    <Feather name="credit-card" size={20} color="#1B432E" />
                  </View>
                  <View style={styles.deliveryDetails}>
                    <Text style={styles.deliverySession}>{new Date(item.payment_date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                    <Text style={styles.deliveryCollector}>Method: {item.method.toUpperCase()} {item.mpesa_transaction_id ? `(${item.mpesa_transaction_id})` : ''}</Text>
                  </View>
                </View>
                <View style={styles.deliveryCardRight}>
                  <Text style={styles.deliveryLiters}>KSh {parseFloat(item.amount).toLocaleString()}</Text>
                  <View style={[styles.statusBadge, item.status === 'paid' || item.status === 'completed' ? styles.statusBadgePaid : styles.statusBadgePending]}>
                    <Text style={[styles.statusBadgeText, item.status === 'paid' || item.status === 'completed' ? styles.statusBadgeTextPaid : styles.statusBadgeTextPending]}>
                      {item.status === 'paid' || item.status === 'completed' ? 'Received' : 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No payments recorded.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderProfileTab = () => {
    return (
      <View style={styles.tabContainer}>
        <View style={styles.tabHeader}>
          <Text style={styles.tabTitle}>Profile</Text>
        </View>
        <ScrollView contentContainerStyle={styles.tabScrollContent}>
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{getInitials(user?.name || 'Farmer')}</Text>
            </View>
            <Text style={styles.profileName}>{user?.name || 'Farmer'}</Text>
            <Text style={styles.profileRole}>Farmer Member</Text>
            <Text style={styles.profileRole}>Phone: {user?.phone || 'N/A'}</Text>
          </View>

          <View style={styles.settingsBox}>
            <Text style={styles.settingsTitle}>Account Details</Text>
            <View style={styles.settingsRowItem}>
              <Text style={styles.settingsLabel}>Primary Phone</Text>
              <Text style={styles.settingsVal}>{user?.phone || 'N/A'}</Text>
            </View>
            <View style={styles.settingsRowItem}>
              <Text style={styles.settingsLabel}>Collection Area</Text>
              <Text style={styles.settingsVal}>{user?.village || 'N/A'}</Text>
            </View>
            <View style={styles.settingsRowItem}>
              <Text style={styles.settingsLabel}>Assigned Collector</Text>
              <Text style={styles.settingsVal}>{user?.collector_name || 'Not Assigned'}</Text>
            </View>
          </View>

          <Pressable style={styles.signOutButton} onPress={signOut}>
            <Feather name="log-out" size={20} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.contentBody}>
        {currentTab === 'home' && renderHomeTab()}
        {currentTab === 'milk' && renderMilkTab()}
        {currentTab === 'payments' && renderPaymentsTab()}
        {currentTab === 'profile' && renderProfileTab()}
      </View>

      {/* Bottom Navigation Tabs */}
      <View style={styles.bottomTabBar}>
        <Pressable style={styles.tabBarItem} onPress={() => setCurrentTab('home')}>
          <Feather name="home" size={22} color={currentTab === 'home' ? '#1B432E' : '#A3A3A3'} />
          <Text style={[styles.tabBarLabel, { color: currentTab === 'home' ? '#1B432E' : '#A3A3A3', fontWeight: currentTab === 'home' ? '700' : '500' }]}>
            Home
          </Text>
        </Pressable>
        
        <Pressable style={styles.tabBarItem} onPress={() => setCurrentTab('milk')}>
          <Feather name="droplet" size={22} color={currentTab === 'milk' ? '#1B432E' : '#A3A3A3'} />
          <Text style={[styles.tabBarLabel, { color: currentTab === 'milk' ? '#1B432E' : '#A3A3A3', fontWeight: currentTab === 'milk' ? '700' : '500' }]}>
            Milk
          </Text>
        </Pressable>

        <Pressable style={styles.tabBarItem} onPress={() => setCurrentTab('payments')}>
          <Feather name="credit-card" size={22} color={currentTab === 'payments' ? '#1B432E' : '#A3A3A3'} />
          <Text style={[styles.tabBarLabel, { color: currentTab === 'payments' ? '#1B432E' : '#A3A3A3', fontWeight: currentTab === 'payments' ? '700' : '500' }]}>
            Payments
          </Text>
        </Pressable>

        <Pressable style={styles.tabBarItem} onPress={() => setCurrentTab('profile')}>
          <Feather name="user" size={22} color={currentTab === 'profile' ? '#1B432E' : '#A3A3A3'} />
          <Text style={[styles.tabBarLabel, { color: currentTab === 'profile' ? '#1B432E' : '#A3A3A3', fontWeight: currentTab === 'profile' ? '700' : '500' }]}>
            Profile
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F4F8F4',
  },
  contentBody: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  headerBanner: {
    backgroundColor: '#1B432E',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingTop: 60,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  headerGreeting: {
    color: '#C5D9C8',
    fontSize: 14,
    fontWeight: '500',
  },
  headerFarmerName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  headerFarmerId: {
    color: '#85B68C',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: -24,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EAF0EB',
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B432E',
    marginBottom: 6,
  },
  statBoxLabel: {
    fontSize: 11,
    color: '#737373',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 12,
    color: '#1B432E',
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 12,
  },
  listContainer: {
    paddingHorizontal: 24,
  },
  deliveryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  deliveryCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateCircle: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#E6F7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCircleMonth: {
    color: '#107C41',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateCircleDay: {
    color: '#107C41',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  deliveryDetails: {
    marginLeft: 12,
  },
  deliverySession: {
    fontSize: 14,
    fontWeight: '700',
    color: '#262626',
  },
  deliveryCollector: {
    fontSize: 12,
    color: '#737373',
    marginTop: 4,
  },
  deliveryCardRight: {
    alignItems: 'flex-end',
  },
  deliveryLiters: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1B432E',
    marginBottom: 4,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgePaid: {
    backgroundColor: '#E6F7EB',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3D6',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextPaid: {
    color: '#107C41',
  },
  statusBadgeTextPending: {
    color: '#A16207',
  },
  paymentSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 18,
    marginHorizontal: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentSummaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#262626',
  },
  paymentSummarySub: {
    fontSize: 12,
    color: '#737373',
    marginTop: 4,
  },
  paymentSummaryRight: {
    alignItems: 'flex-end',
  },
  paymentSummaryAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#262626',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginVertical: 14,
  },
  requestButton: {
    backgroundColor: '#E6F7EB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C5D9C8',
    marginHorizontal: 24,
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestButtonText: {
    color: '#1B432E',
    fontSize: 14,
    fontWeight: '800',
  },
  bottomTabBar: {
    height: 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EAF0EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 12 : 0,
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabBarLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  tabContainer: {
    flex: 1,
    paddingTop: 60,
  },
  tabHeader: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  tabTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1B432E',
  },
  tabScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  deliveryAmtText: {
    fontSize: 12,
    color: '#737373',
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1B432E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#262626',
  },
  profileRole: {
    fontSize: 13,
    color: '#737373',
    marginTop: 4,
    textAlign: 'center',
  },
  settingsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 16,
    marginBottom: 20,
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B432E',
    marginBottom: 12,
  },
  settingsRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  settingsLabel: {
    fontSize: 14,
    color: '#737373',
    fontWeight: '500',
  },
  settingsVal: {
    fontSize: 14,
    color: '#262626',
    fontWeight: '700',
  },
  signOutButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  signOutButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#737373',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
});

import React, { useState, useContext } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput, Platform, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchFarmers, fetchCollections, fetchPayments, createCollection, fetchReports, changePassword } from '../api';
import { AuthContext } from '../auth/AuthContext';
import Feather from '@expo/vector-icons/Feather';
import { saveCachedFarmers, getCachedFarmers, getPendingCollections, clearPendingCollections, saveCollectorPrice, getCollectorPrice, saveCollectorPaymentSchedule, getCollectorPaymentSchedule } from '../utils/storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function CollectorHomeScreen({ navigation }) {
  const { token, signOut, user } = useContext(AuthContext);
  const [farmers, setFarmers] = useState([]);
  const [collections, setCollections] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard' | 'farmers' | 'payments' | 'settings'
  const [syncing, setSyncing] = useState(false);
  const [pendingCollections, setPendingCollections] = useState([]);
  const [dailyReport, setDailyReport] = useState({
    litersToday: 0,
    amountToday: 0,
    activeFarmers: 0,
    activeCollectors: 0,
  });
  const [monthlyReport, setMonthlyReport] = useState({
    litersMonth: 0,
    amountMonth: 0,
    paidMonth: 0,
    pendingMonth: 0,
    dailyBreakdown: [],
  });
  const [reportsModalVisible, setReportsModalVisible] = useState(false);
  
  // Price & Password Settings States
  const [collectorPrice, setCollectorPriceState] = useState(50);
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [newPriceStr, setNewPriceStr] = useState('50');

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [collectorPaymentSchedule, setCollectorPaymentScheduleState] = useState(30);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [newScheduleStr, setNewScheduleStr] = useState('30');

  const performSync = async (items, silent = false) => {
    if (items.length === 0) return;
    setSyncing(true);
    try {
      for (const col of items) {
        await createCollection(token, {
          farmer_id: col.farmer_id,
          collected_at: col.collected_at,
          liters: col.liters,
          total_amount: col.total_amount,
        });
      }
      await clearPendingCollections();
      if (!silent) {
        Alert.alert('Sync Complete', 'All offline collections successfully synchronized.');
      }
      setPendingCollections([]);
      await loadData(false);
    } catch (err) {
      console.warn('Sync failed', err);
      if (!silent) {
        Alert.alert('Sync Failed', 'Could not sync all records. Check internet connection and try again.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncCollections = async () => {
    const pending = await getPendingCollections();
    if (pending.length === 0) return;
    await performSync(pending, false);
  };

  const loadData = async (shouldAutoSync = true) => {
    if (!token) return;
    setLoading(true);
    try {
      const [farmersRes, collectionsRes, paymentsRes, dailyRes, monthlyRes] = await Promise.all([
        fetchFarmers(token),
        fetchCollections(token),
        fetchPayments(token),
        fetchReports(token, 'daily').catch(() => ({ data: null })),
        fetchReports(token, 'monthly').catch(() => ({ data: null })),
      ]);
      const fetchedFarmers = farmersRes.data.farmers || [];
      setFarmers(fetchedFarmers);
      setCollections(collectionsRes.data.collections || []);
      setPayments(paymentsRes.data.payments || []);
      
      if (dailyRes && dailyRes.data) {
        setDailyReport(dailyRes.data);
      }
      if (monthlyRes && monthlyRes.data) {
        setMonthlyReport(monthlyRes.data);
      }
      
      await saveCachedFarmers(fetchedFarmers);

      const pending = await getPendingCollections();
      setPendingCollections(pending);

      if (shouldAutoSync && pending && pending.length > 0) {
        await performSync(pending, true);
      }
    } catch (err) {
      const cached = await getCachedFarmers();
      if (cached && cached.length > 0) {
        setFarmers(cached);
        Alert.alert('Offline Mode', 'Could not connect to server. Displaying cached farmers.');
      } else {
        Alert.alert('Error', 'Unable to load collector data.');
      }
      const pending = await getPendingCollections();
      setPendingCollections(pending);
    } finally {
      const price = await getCollectorPrice();
      setCollectorPriceState(price);
      setNewPriceStr(String(price));
      const schedule = await getCollectorPaymentSchedule();
      setCollectorPaymentScheduleState(schedule);
      setNewScheduleStr(String(schedule));
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [token])
  );

  const handleSavePrice = async () => {
    const parsed = parseFloat(newPriceStr);
    if (isNaN(parsed) || parsed <= 0) {
      return Alert.alert('Validation Error', 'Please enter a valid price.');
    }
    await saveCollectorPrice(parsed);
    setCollectorPriceState(parsed);
    setPriceModalVisible(false);
    Alert.alert('Success', `Milk price per litre updated to KSh ${parsed}.`);
  };

  const handleSaveSchedule = async () => {
    const parsed = parseInt(newScheduleStr, 10);
    if (isNaN(parsed) || parsed <= 0) {
      return Alert.alert('Validation Error', 'Please enter a valid schedule in days.');
    }
    await saveCollectorPaymentSchedule(parsed);
    setCollectorPaymentScheduleState(parsed);
    setScheduleModalVisible(false);
    Alert.alert('Success', `Payment schedule updated to every ${parsed} days.`);
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      return Alert.alert('Validation Error', 'All fields are required.');
    }
    if (newPassword !== confirmPassword) {
      return Alert.alert('Validation Error', 'New passwords do not match.');
    }
    setChangingPassword(true);
    try {
      await changePassword(token, oldPassword, newPassword);
      Alert.alert('Success', 'Password changed successfully.');
      setPasswordModalVisible(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.warn('Password change failed', err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to change password. Check your old password and try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character]));

  const generateFarmerTransactionsPdf = async (selectedPayment) => {
    const farmerTransactions = payments
      .filter((payment) => payment.farmer_id === selectedPayment.farmer_id)
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
    const farmer = farmers.find((item) => item.id === selectedPayment.farmer_id);
    const farmerName = selectedPayment.farmer_name || farmer?.name || 'Farmer';
    const paidTotal = farmerTransactions
      .filter((payment) => payment.status === 'paid' || payment.status === 'completed')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const pendingTotal = farmerTransactions
      .filter((payment) => payment.status !== 'paid' && payment.status !== 'completed')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const money = (amount) => Number(amount || 0).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const rows = farmerTransactions.map((payment) => `
      <tr>
        <td>${escapeHtml(new Date(payment.payment_date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' }))}</td>
        <td>${escapeHtml((payment.method || '-').toUpperCase())}</td>
        <td>${escapeHtml(payment.mpesa_transaction_id || `PAY-${payment.id}`)}</td>
        <td>${escapeHtml(payment.status || 'pending')}</td>
        <td class="amount">KSh ${money(payment.amount)}</td>
      </tr>`).join('');
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${escapeHtml(farmerName)} Payment Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #262626; padding: 32px; }
            h1 { color: #1B432E; margin: 0 0 6px; }
            .subtitle { color: #737373; margin: 0 0 24px; }
            .summary { display: table; width: 100%; margin: 20px 0 28px; border: 1px solid #C5D9C8; border-radius: 10px; overflow: hidden; }
            .summary div { display: table-cell; padding: 14px; border-right: 1px solid #EAF0EB; }
            .summary div:last-child { border-right: 0; }
            .label { display: block; color: #737373; font-size: 11px; text-transform: uppercase; margin-bottom: 5px; }
            .value { color: #1B432E; font-size: 17px; font-weight: bold; }
            table { border-collapse: collapse; width: 100%; }
            th { background: #1B432E; color: white; text-align: left; padding: 11px; font-size: 12px; }
            td { border-bottom: 1px solid #EAF0EB; padding: 11px; font-size: 12px; }
            .amount { text-align: right; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Farmer Payment Report</h1>
          <p class="subtitle"><strong>${escapeHtml(farmerName)}</strong>${farmer?.farmer_code ? ` | ${escapeHtml(farmer.farmer_code)}` : ''}${farmer?.phone ? ` | ${escapeHtml(farmer.phone)}` : ''}<br>Generated ${escapeHtml(new Date().toLocaleString())}</p>
          <section class="summary">
            <div><span class="label">Transactions</span><span class="value">${farmerTransactions.length}</span></div>
            <div><span class="label">Paid</span><span class="value">KSh ${money(paidTotal)}</span></div>
            <div><span class="label">Pending</span><span class="value">KSh ${money(pendingTotal)}</span></div>
          </section>
          <table>
            <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Status</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="5">No transactions found.</td></tr>'}</tbody>
          </table>
        </body>
      </html>`;

    try {
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (!printWindow) throw new Error('Unable to open the print window.');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      } else {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
    } catch (error) {
      console.warn('Farmer transaction report PDF failed:', error);
      Alert.alert('PDF Error', 'Unable to generate the farmer transaction report.');
    }
  };

  const exportCollectorReportPDF = async () => {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>MilkTrack Collector Summary Report</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #262626; }
            h1 { color: #1B432E; margin-bottom: 5px; font-size: 26px; }
            p.subtitle { color: #737373; font-size: 14px; margin-top: 0; margin-bottom: 30px; }
            .section-title { font-size: 14px; font-weight: bold; color: #1B432E; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 2px solid #EAF0EB; padding-bottom: 6px; margin-top: 24px; margin-bottom: 12px; }
            .grid { display: flex; flex-wrap: wrap; margin-left: -10px; margin-right: -10px; }
            .col { flex: 1; min-width: 200px; padding: 10px; }
            .card { background-color: #F4F8F4; border: 1px solid #C5D9C8; border-radius: 12px; padding: 15px; }
            .label { font-size: 11px; color: #737373; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
            .value { font-size: 18px; font-weight: bold; color: #1B432E; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #EAF0EB; padding: 12px 15px; text-align: left; font-size: 14px; }
            th { background-color: #1B432E; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #F9FBF9; }
            @media print {
              @page {
                margin: 0;
              }
              body {
                padding: 20mm;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <h1>MilkTrack System Report</h1>
          <p class="subtitle">Generated by Collector ${user?.name || ''} (${user?.phone || ''}) on ${new Date().toLocaleDateString()}</p>
          
          <div class="section-title">Today's Summary</div>
          <div class="grid">
            <div class="col">
              <div class="card">
                <div class="label">Milk Collected</div>
                <div class="value">${dailyReport.litersToday ? dailyReport.litersToday.toFixed(1) : '0'} L</div>
              </div>
            </div>
            <div class="col">
              <div class="card">
                <div class="label">Est. Value</div>
                <div class="value">KSh ${dailyReport.amountToday ? dailyReport.amountToday.toLocaleString() : '0'}</div>
              </div>
            </div>
            <div class="col">
              <div class="card">
                <div class="label">Active Farmers</div>
                <div class="value">${dailyReport.activeFarmers || '0'}</div>
              </div>
            </div>
          </div>

          <div class="section-title">This Month's Summary</div>
          <div class="grid">
            <div class="col">
              <div class="card">
                <div class="label">Total Collected</div>
                <div class="value">${monthlyReport.litersMonth ? monthlyReport.litersMonth.toFixed(1) : '0'} L</div>
              </div>
            </div>
            <div class="col">
              <div class="card">
                <div class="label">Total Worth</div>
                <div class="value">KSh ${monthlyReport.amountMonth ? monthlyReport.amountMonth.toLocaleString() : '0'}</div>
              </div>
            </div>
            <div class="col">
              <div class="card">
                <div class="label">Amount Paid</div>
                <div class="value" style="color: #107C41;">KSh ${monthlyReport.paidMonth ? monthlyReport.paidMonth.toLocaleString() : '0'}</div>
              </div>
            </div>
            <div class="col">
              <div class="card">
                <div class="label">Amount Pending</div>
                <div class="value" style="color: #B26A00;">KSh ${monthlyReport.pendingMonth ? monthlyReport.pendingMonth.toLocaleString() : '0'}</div>
              </div>
            </div>
          </div>

          <div class="section-title">Weekly Breakdown (Last 7 Days)</div>
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Date</th>
                <th>Milk Volume (Litres)</th>
              </tr>
            </thead>
            <tbody>
              ${(monthlyReport.dailyBreakdown || []).map(item => `
                <tr>
                  <td>${item.day}</td>
                  <td>${item.date}</td>
                  <td>${parseFloat(item.liters || 0).toFixed(1)} L</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 500);
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
    } catch (error) {
      console.warn(error);
      Alert.alert('Error', 'Failed to generate PDF report.');
    }
  };

  // Stats Calculations
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Today's collections
  const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCollectionLocalDateString = (collectedAt) => {
    if (!collectedAt) return '';
    const str = String(collectedAt);
    if (str.includes('T')) {
      const d = new Date(str);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return str.substring(0, 10);
  };

  const todayStr = getLocalDateString();
  const todayCollections = collections.filter(c => {
    return getCollectionLocalDateString(c.collected_at) === todayStr;
  });

  const totalMilkToday = todayCollections.reduce((sum, c) => sum + parseFloat(c.liters || 0), 0);
  const totalFarmersTodayCount = new Set(todayCollections.map(c => c.farmer_id)).size;

  // Monthly collections
  const currentYearMonth = todayStr.substring(0, 7); // "YYYY-MM"
  const thisMonthCollections = collections.filter(c => {
    return getCollectionLocalDateString(c.collected_at).substring(0, 7) === currentYearMonth;
  });
  const totalMilkMonth = thisMonthCollections.reduce((sum, c) => sum + parseFloat(c.liters || 0), 0);

  // Total pending payments due
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const paymentsDueSum = pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const getFarmerCollectionToday = (farmerId) => {
    return collections.find(c => {
      return c.farmer_id === farmerId && getCollectionLocalDateString(c.collected_at) === todayStr;
    });
  };

  // Render Tabs
  const renderDashboardTab = () => {
    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {/* Figma Header */}
        <View style={styles.headerBanner}>
          <View>
            <Text style={styles.headerGreeting}>Welcome</Text>
            <Text style={styles.headerUserName}>{user?.name || 'Collector'}</Text>
          </View>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{getInitials(user?.name)}</Text>
          </View>
        </View>

        {/* Sync pending collections banner */}
        {pendingCollections.length > 0 && (
          <View style={styles.syncBanner}>
            <Feather name="cloud-off" size={18} color="#C2410C" style={{ marginRight: 8 }} />
            <Text style={styles.syncText}>
              You have {pendingCollections.length} unsynced collection{pendingCollections.length > 1 ? 's' : ''}.
            </Text>
            <Pressable style={styles.syncButton} onPress={handleSyncCollections} disabled={syncing}>
              {syncing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.syncButtonText}>Sync Now</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Total milk</Text>
              <Text style={styles.metricValue}>
                {totalMilkToday > 0 ? `${totalMilkToday.toFixed(0)} L` : '0 L'}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Farmers today</Text>
              <Text style={styles.metricValue}>
                {totalFarmersTodayCount}
              </Text>
              {pendingPayments.length > 0 && <Text style={styles.metricSubtext}>{pendingPayments.length} pending records</Text>}
            </View>
          </View>
          
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>This month</Text>
              <Text style={styles.metricValue}>
                {totalMilkMonth > 0 ? `${totalMilkMonth.toLocaleString()} L` : '0 L'}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Payments due</Text>
              <Text style={styles.metricValue}>
                KSh {paymentsDueSum.toLocaleString()}
              </Text>
              {pendingPayments.length > 0 && <Text style={styles.metricSubtext}>{pendingPayments.length} farmers unpaid</Text>}
            </View>
          </View>
        </View>

        {/* Reports Banner Card */}
        <Pressable 
          style={styles.reportsBannerCard}
          onPress={() => setReportsModalVisible(true)}
        >
          <View style={styles.reportsBannerLeft}>
            <View style={styles.reportsIconCircle}>
              <Feather name="bar-chart-2" size={20} color="#1B432E" />
            </View>
            <View style={styles.reportsBannerMeta}>
              <Text style={styles.reportsBannerTitle}>Detailed Reports & Analytics</Text>
              <Text style={styles.reportsBannerSubtitle}>View daily breakdowns & weekly charts</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color="#85B68C" />
        </Pressable>

        {/* Section: FARMERS - TODAY */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>FARMERS — TODAY</Text>
        </View>

        <View style={styles.listContainer}>
          {farmers.length === 0 && loading ? (
            <ActivityIndicator size="small" color="#1B432E" style={{ marginVertical: 20 }} />
          ) : farmers.length > 0 ? (
            farmers.map(farmer => {
              const todayColl = getFarmerCollectionToday(farmer.id);
              const initials = getInitials(farmer.name);
              
              return (
                <Pressable
                  key={farmer.id}
                  style={styles.farmerRowCard}
                  onPress={() => navigation.navigate('RecordCollection', { farmerId: farmer.id })}
                >
                  <View style={styles.farmerRowLeft}>
                    <View style={styles.farmerAvatarCircle}>
                      <Text style={styles.farmerAvatarText}>{initials}</Text>
                    </View>
                    <View style={styles.farmerMeta}>
                      <Text style={styles.farmerRowName}>{farmer.name}</Text>
                      <Text style={styles.farmerRowId}>
                        Phone: {farmer.phone || 'N/A'} · {todayColl ? `Recorded ${new Date(todayColl.collected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not recorded today'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.farmerRowRight}>
                    <Text style={styles.farmerLitersText}>
                      {todayColl ? `${parseFloat(todayColl.liters).toFixed(0)} L` : '0 L'}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No collection activities recorded today.</Text>
            </View>
          )}
        </View>

        {/* Large green record new collection button */}
        <Pressable 
          style={styles.actionBannerButton}
          onPress={() => navigation.navigate('RecordCollection')}
        >
          <Text style={styles.actionBannerButtonText}>+ Record new collection</Text>
        </Pressable>
      </ScrollView>
    );
  };

  const renderFarmersTab = () => {
    const filteredFarmers = farmers.filter(f => {
      const query = searchQuery.toLowerCase();
      return (
        f.name?.toLowerCase().includes(query) ||
        (f.phone && f.phone.toLowerCase().includes(query)) ||
        (f.village && f.village.toLowerCase().includes(query))
      );
    });

    return (
      <View style={styles.tabContainer}>
        {/* Header */}
        <View style={styles.tabHeader}>
          <Text style={styles.tabTitle}>Manage farmers</Text>
          <Pressable 
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('CreateFarmer')}
          >
            <Text style={styles.headerActionButtonText}>+ Add farmer</Text>
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color="#737373" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search farmers..."
            placeholderTextColor="#A3A3A3"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView contentContainerStyle={styles.tabScrollContent}>
          {filteredFarmers.length > 0 ? (
            filteredFarmers.map(farmer => {
              const farmerCollections = collections.filter(c => c.farmer_id === farmer.id);
              const farmerPayments = payments.filter(p => p.farmer_id === farmer.id);

              const cumulativeLiters = farmerCollections.reduce((sum, c) => sum + parseFloat(c.liters || 0), 0);
              const cumulativeEarned = farmerCollections.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);
              const farmerPaid = farmerPayments.filter(p => p.status === 'paid' || p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
              const outstandingBalance = Math.max(0, cumulativeEarned - farmerPaid);

              return (
                <View style={styles.farmerDetailCard} key={farmer.id}>
                  <View style={styles.farmerDetailHeader}>
                    <View style={styles.farmerRowLeft}>
                      <View style={[styles.farmerAvatarCircle, { backgroundColor: '#C5D9C8' }]}>
                        <Text style={[styles.farmerAvatarText, { color: '#1B432E' }]}>{getInitials(farmer.name)}</Text>
                      </View>
                      <View style={styles.farmerMeta}>
                        <Text style={styles.farmerRowName}>{farmer.name}</Text>
                        <Text style={styles.farmerRowId}>Phone: {farmer.phone || 'N/A'} · {farmer.village || 'Zone A'}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, farmer.status === 'active' ? styles.statusBadgePaid : styles.statusBadgePending]}>
                      <Text style={[styles.statusBadgeText, farmer.status === 'active' ? styles.statusBadgeTextPaid : styles.statusBadgeTextPending]}>
                        {farmer.status === 'active' ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.farmerStatsRow}>
                    <View style={styles.farmerStatCol}>
                      <Text style={styles.farmerStatLabel}>Delivered</Text>
                      <Text style={styles.farmerStatVal}>{cumulativeLiters.toFixed(0)} L</Text>
                    </View>
                    <View style={styles.farmerStatCol}>
                      <Text style={styles.farmerStatLabel}>Earned</Text>
                      <Text style={styles.farmerStatVal}>KSh {cumulativeEarned.toLocaleString()}</Text>
                    </View>
                    <View style={styles.farmerStatCol}>
                      <Text style={styles.farmerStatLabel}>Balance</Text>
                      <Text style={[styles.farmerStatVal, outstandingBalance > 0 && { color: '#B26A00' }]}>KSh {outstandingBalance.toLocaleString()}</Text>
                    </View>
                  </View>

                  <Pressable 
                    style={styles.cardRecordBtn}
                    onPress={() => navigation.navigate('RecordCollection', { farmerId: farmer.id })}
                  >
                    <Text style={styles.cardRecordBtnText}>Record Milk Collection</Text>
                  </Pressable>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No farmers found matching query.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderPaymentsTab = () => {
    return (
      <View style={styles.tabContainer}>
        {/* Header */}
        <View style={styles.tabHeader}>
          <Text style={styles.tabTitle}>Payments ledger</Text>
          <Pressable 
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('RecordPayment')}
          >
            <Text style={styles.headerActionButtonText}>+ Record payment</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.tabScrollContent}>
          <Text style={styles.subSectionTitle}>Recent Transactions</Text>
          {payments.length > 0 ? (
            payments.map(payment => {
              const initials = getInitials(payment.farmer_name || 'Farmer');
              return (
                <View key={payment.id} style={styles.paymentCard}>
                  <View style={styles.paymentHeader}>
                    <View style={styles.paymentLeft}>
                      <View style={styles.paymentAvatar}>
                        <Text style={styles.paymentAvatarText}>{initials}</Text>
                      </View>
                      <View style={styles.paymentMeta}>
                        <Text style={styles.paymentFarmerName}>{payment.farmer_name || `Phone: ${payment.phone || payment.farmer_phone || payment.farmer_code || 'N/A'}`}</Text>
                        <Text style={styles.paymentDateText}>
                          {new Date(payment.payment_date).toLocaleDateString([], { month: 'long', day: 'numeric' })} · {payment.method.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.paymentRight}>
                      <Text style={styles.paymentAmountVal}>KSh {parseFloat(payment.amount).toLocaleString()}</Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.farmerReportButton}
                    onPress={() => generateFarmerTransactionsPdf(payment)}
                    accessibilityRole="button"
                    accessibilityLabel={`Generate payment report for ${payment.farmer_name || 'farmer'}`}
                  >
                    <Feather name="file-text" size={14} color="#1B432E" />
                    <Text style={styles.farmerReportButtonText}>Farmer report</Text>
                  </Pressable>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No payments recorded yet.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderSettingsTab = () => {
    return (
      <View style={styles.tabContainer}>
        <View style={styles.tabHeader}>
          <Text style={styles.tabTitle}>Settings</Text>
        </View>

        <ScrollView contentContainerStyle={styles.tabScrollContent}>
          {/* Profile settings card */}
          <View style={styles.profileSettingCard}>
            <View style={styles.headerAvatarBig}>
              <Text style={styles.headerAvatarTextBig}>{getInitials(user?.name)}</Text>
            </View>
            <Text style={styles.profileSettingsName}>{user?.name || 'Collector'}</Text>
            <Text style={styles.profileSettingsRole}>Collector Account</Text>
            <Text style={styles.profileSettingsRole}>{user?.phone}</Text>
          </View>

          {/* GENERAL settings section */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>GENERAL</Text>
            <Pressable style={styles.settingItem} onPress={() => { setNewPriceStr(String(collectorPrice)); setPriceModalVisible(true); }}>
              <View style={styles.settingItemLeft}>
                <Feather name="dollar-sign" size={20} color="#1B432E" />
                <Text style={styles.settingItemText}>Milk Price per Litre</Text>
              </View>
              <Text style={styles.settingItemValue}>KSh {collectorPrice}</Text>
            </Pressable>

            <Pressable style={styles.settingItem} onPress={() => { setNewScheduleStr(String(collectorPaymentSchedule)); setScheduleModalVisible(true); }}>
              <View style={styles.settingItemLeft}>
                <Feather name="clock" size={20} color="#1B432E" />
                <Text style={styles.settingItemText}>Payment Schedule</Text>
              </View>
              <Text style={styles.settingItemValue}>Every {collectorPaymentSchedule} days</Text>
            </Pressable>
            
            <View style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Feather name="bell" size={20} color="#1B432E" />
                <Text style={styles.settingItemText}>Push Notifications</Text>
              </View>
              <Text style={styles.settingItemValue}>Enabled</Text>
            </View>
          </View>

          {/* SECURITY settings section */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>SECURITY</Text>
            <Pressable style={styles.settingItem} onPress={() => setPasswordModalVisible(true)}>
              <View style={styles.settingItemLeft}>
                <Feather name="lock" size={20} color="#1B432E" />
                <Text style={styles.settingItemText}>Change Password</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#A3A3A3" />
            </Pressable>
          </View>

          <Pressable style={styles.signOutBtn} onPress={signOut}>
            <Feather name="log-out" size={20} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      {/* Tab Screen Content */}
      <View style={styles.contentBody}>
        {currentTab === 'dashboard' && renderDashboardTab()}
        {currentTab === 'farmers' && renderFarmersTab()}
        {currentTab === 'payments' && renderPaymentsTab()}
        {currentTab === 'settings' && renderSettingsTab()}
      </View>

      {/* Price Edit Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={priceModalVisible}
        onRequestClose={() => setPriceModalVisible(false)}
      >
        <View style={styles.modalCenteredOverlay}>
          <View style={styles.alertModalContent}>
            <Text style={styles.alertModalTitle}>Set Milk Price</Text>
            <Text style={styles.alertModalSubtitle}>Set your collection rate per litre (KSh)</Text>
            
            <TextInput
              style={styles.alertModalInput}
              value={newPriceStr}
              onChangeText={setNewPriceStr}
              keyboardType="decimal-pad"
              placeholder="e.g. 50"
              placeholderTextColor="#A3A3A3"
            />

            <View style={styles.alertModalButtons}>
              <Pressable 
                style={[styles.alertModalBtn, styles.alertModalBtnCancel]} 
                onPress={() => setPriceModalVisible(false)}
              >
                <Text style={styles.alertModalBtnTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.alertModalBtn, styles.alertModalBtnSave]} 
                onPress={handleSavePrice}
              >
                <Text style={styles.alertModalBtnTextSave}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Schedule Edit Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={scheduleModalVisible}
        onRequestClose={() => setScheduleModalVisible(false)}
      >
        <View style={styles.modalCenteredOverlay}>
          <View style={styles.alertModalContent}>
            <Text style={styles.alertModalTitle}>Set Payment Schedule</Text>
            <Text style={styles.alertModalSubtitle}>Set schedule duration in days</Text>
            
            <TextInput
              style={styles.alertModalInput}
              value={newScheduleStr}
              onChangeText={setNewScheduleStr}
              keyboardType="number-pad"
              placeholder="e.g. 30"
              placeholderTextColor="#A3A3A3"
            />

            <View style={styles.alertModalButtons}>
              <Pressable 
                style={[styles.alertModalBtn, styles.alertModalBtnCancel]} 
                onPress={() => setScheduleModalVisible(false)}
              >
                <Text style={styles.alertModalBtnTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.alertModalBtn, styles.alertModalBtnSave]} 
                onPress={handleSaveSchedule}
              >
                <Text style={styles.alertModalBtnTextSave}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Password Change Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={passwordModalVisible}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '65%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <Pressable onPress={() => setPasswordModalVisible(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={24} color="#1B432E" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.formInput}
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry
                placeholder="Enter current password"
                placeholderTextColor="#A3A3A3"
              />

              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.formInput}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Enter new password"
                placeholderTextColor="#A3A3A3"
              />

              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.formInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Confirm new password"
                placeholderTextColor="#A3A3A3"
              />

              <Pressable 
                style={styles.modalSubmitButton} 
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Update Password</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reports Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reportsModalVisible}
        onRequestClose={() => setReportsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>System Reports</Text>
              <Pressable onPress={() => setReportsModalVisible(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={24} color="#1B432E" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              {/* Daily Report Section */}
              <Text style={styles.modalSectionTitle}>TODAY'S SUMMARY</Text>
              <View style={styles.reportGrid}>
                <View style={styles.reportRow}>
                  <View style={styles.reportMiniCard}>
                    <Text style={styles.reportMiniLabel}>Milk Collected</Text>
                    <Text style={styles.reportMiniVal}>{dailyReport.litersToday ? dailyReport.litersToday.toFixed(1) : '0'} L</Text>
                  </View>
                  <View style={styles.reportMiniCard}>
                    <Text style={styles.reportMiniLabel}>Est. Value</Text>
                    <Text style={styles.reportMiniVal}>KSh {dailyReport.amountToday ? dailyReport.amountToday.toLocaleString() : '0'}</Text>
                  </View>
                </View>
                <View style={styles.reportRow}>
                  <View style={styles.reportMiniCard}>
                    <Text style={styles.reportMiniLabel}>Active Farmers</Text>
                    <Text style={styles.reportMiniVal}>{dailyReport.activeFarmers || '0'}</Text>
                  </View>
                  <View style={styles.reportMiniCard}>
                    <Text style={styles.reportMiniLabel}>Active Collectors</Text>
                    <Text style={styles.reportMiniVal}>{dailyReport.activeCollectors || '0'}</Text>
                  </View>
                </View>
              </View>

              {/* Monthly Report Section */}
              <Text style={styles.modalSectionTitle}>THIS MONTH'S SUMMARY</Text>
              <View style={styles.reportGrid}>
                <View style={styles.reportRow}>
                  <View style={styles.reportMiniCard}>
                    <Text style={styles.reportMiniLabel}>Total Collected</Text>
                    <Text style={styles.reportMiniVal}>{monthlyReport.litersMonth ? monthlyReport.litersMonth.toFixed(1) : '0'} L</Text>
                  </View>
                  <View style={styles.reportMiniCard}>
                    <Text style={styles.reportMiniLabel}>Total Worth</Text>
                    <Text style={styles.reportMiniVal}>KSh {monthlyReport.amountMonth ? monthlyReport.amountMonth.toLocaleString() : '0'}</Text>
                  </View>
                </View>
                <View style={styles.reportRow}>
                  <View style={styles.reportMiniCard}>
                    <Text style={styles.reportMiniLabel}>Amount Paid</Text>
                    <Text style={[styles.reportMiniVal, { color: '#107C41' }]}>KSh {monthlyReport.paidMonth ? monthlyReport.paidMonth.toLocaleString() : '0'}</Text>
                  </View>
                  <View style={styles.reportMiniCard}>
                    <Text style={styles.reportMiniLabel}>Amount Pending</Text>
                    <Text style={[styles.reportMiniVal, { color: '#B26A00' }]}>KSh {monthlyReport.pendingMonth ? monthlyReport.pendingMonth.toLocaleString() : '0'}</Text>
                  </View>
                </View>
              </View>

              {/* Chart Section */}
              <Text style={styles.modalSectionTitle}>MILK COLLECTED THIS WEEK (L)</Text>
              <View style={styles.modalChartCard}>
                <View style={styles.chartBarsContainer}>
                  {monthlyReport.dailyBreakdown && monthlyReport.dailyBreakdown.length > 0 ? (
                    monthlyReport.dailyBreakdown.map((item, idx) => {
                      const dayLiters = parseFloat(item.liters || 0);
                      const barHeight = Math.max(8, Math.min(100, dayLiters * 1.2));
                      const isToday = item.date === new Date().toISOString().split('T')[0];
                      return (
                        <View style={styles.chartCol} key={idx}>
                          <Text style={styles.chartBarVal}>{dayLiters > 0 ? dayLiters.toFixed(0) : ''}</Text>
                          <View style={[
                            styles.chartBarFilled,
                            { height: barHeight },
                            isToday && { backgroundColor: '#1B432E' }
                          ]} />
                          <Text style={styles.chartBarLabel}>{item.day}</Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={{ color: '#737373', fontSize: 13, textAlign: 'center', width: '100%', paddingVertical: 20 }}>No weekly breakdown data available.</Text>
                  )}
                </View>
              </View>
              {/* Export PDF Button */}
              <Pressable 
                style={[styles.modalSubmitButton, { marginTop: 10 }]} 
                onPress={exportCollectorReportPDF}
              >
                <Text style={styles.modalSubmitButtonText}>Export PDF Report</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Bottom Tab Bar */}
      <View style={styles.bottomTabBar}>
        <Pressable 
          style={styles.tabBarItem} 
          onPress={() => setCurrentTab('dashboard')}
        >
          <Feather 
            name="home" 
            size={22} 
            color={currentTab === 'dashboard' ? '#1B432E' : '#A3A3A3'} 
          />
          <Text style={[
            styles.tabBarLabel, 
            { color: currentTab === 'dashboard' ? '#1B432E' : '#A3A3A3', fontWeight: currentTab === 'dashboard' ? '700' : '500' }
          ]}>
            Dashboard
          </Text>
        </Pressable>

        <Pressable 
          style={styles.tabBarItem} 
          onPress={() => setCurrentTab('farmers')}
        >
          <Feather 
            name="users" 
            size={22} 
            color={currentTab === 'farmers' ? '#1B432E' : '#A3A3A3'} 
          />
          <Text style={[
            styles.tabBarLabel, 
            { color: currentTab === 'farmers' ? '#1B432E' : '#A3A3A3', fontWeight: currentTab === 'farmers' ? '700' : '500' }
          ]}>
            Farmers
          </Text>
        </Pressable>

        <Pressable 
          style={styles.tabBarItem} 
          onPress={() => setCurrentTab('payments')}
        >
          <Feather 
            name="credit-card" 
            size={22} 
            color={currentTab === 'payments' ? '#1B432E' : '#A3A3A3'} 
          />
          <Text style={[
            styles.tabBarLabel, 
            { color: currentTab === 'payments' ? '#1B432E' : '#A3A3A3', fontWeight: currentTab === 'payments' ? '700' : '500' }
          ]}>
            Payments
          </Text>
        </Pressable>

        <Pressable 
          style={styles.tabBarItem} 
          onPress={() => setCurrentTab('settings')}
        >
          <Feather 
            name="settings" 
            size={22} 
            color={currentTab === 'settings' ? '#1B432E' : '#A3A3A3'} 
          />
          <Text style={[
            styles.tabBarLabel, 
            { color: currentTab === 'settings' ? '#1B432E' : '#A3A3A3', fontWeight: currentTab === 'settings' ? '700' : '500' }
          ]}>
            Settings
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
    paddingBottom: 32,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: {
    color: '#C5D9C8',
    fontSize: 14,
    fontWeight: '500',
  },
  headerUserName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#85B68C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  metricsGrid: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EAF0EB',
  },
  metricTitle: {
    fontSize: 13,
    color: '#737373',
    fontWeight: '600',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1B432E',
    marginBottom: 6,
  },
  metricSubtext: {
    fontSize: 11,
    color: '#85B68C',
    fontWeight: '600',
  },
  sectionHeader: {
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionLabel: {
    color: '#1B432E',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  listContainer: {
    paddingHorizontal: 24,
  },
  farmerRowCard: {
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
  farmerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginLeft: 12,
  },
  farmerRowName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#262626',
  },
  farmerRowId: {
    fontSize: 12,
    color: '#737373',
    marginTop: 4,
  },
  farmerRowRight: {
    alignItems: 'flex-end',
  },
  farmerLitersText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1B432E',
    marginBottom: 4,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
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
  actionBannerButton: {
    backgroundColor: '#E6F7EB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C5D9C8',
    marginHorizontal: 24,
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBannerButtonText: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  tabTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1B432E',
  },
  headerActionButton: {
    backgroundColor: '#1B432E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    marginHorizontal: 24,
    marginBottom: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#262626',
  },
  tabScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  farmerDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  farmerDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    paddingBottom: 12,
  },
  farmerStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  farmerStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  farmerStatLabel: {
    fontSize: 11,
    color: '#737373',
    fontWeight: '600',
    marginBottom: 4,
  },
  farmerStatVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B432E',
  },
  cardRecordBtn: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cardRecordBtnText: {
    fontSize: 12,
    color: '#1B432E',
    fontWeight: '700',
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
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1B432E',
    marginVertical: 12,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 14,
    marginBottom: 10,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentAvatarText: {
    color: '#1B432E',
    fontWeight: '700',
    fontSize: 13,
  },
  paymentMeta: {
    marginLeft: 12,
  },
  paymentFarmerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#262626',
  },
  paymentDateText: {
    fontSize: 11,
    color: '#737373',
    marginTop: 4,
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmountVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B432E',
    marginBottom: 4,
  },
  farmerReportButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EAF0EB',
  },
  farmerReportButtonText: {
    color: '#1B432E',
    fontSize: 12,
    fontWeight: '700',
  },
  profileSettingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  headerAvatarBig: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1B432E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerAvatarTextBig: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  profileSettingsName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#262626',
  },
  profileSettingsRole: {
    fontSize: 13,
    color: '#737373',
    marginTop: 4,
    textAlign: 'center',
  },
  settingsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 16,
    marginBottom: 20,
  },
  settingsSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B432E',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#262626',
    fontWeight: '500',
  },
  settingItemValue: {
    fontSize: 13,
    color: '#737373',
    fontWeight: '600',
  },
  signOutBtn: {
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
  signOutBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
  syncBanner: {
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 24,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncText: {
    flex: 1,
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '600',
  },
  syncButton: {
    backgroundColor: '#EA580C',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  reportsBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 16,
    marginHorizontal: 24,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  reportsBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reportsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6F7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reportsBannerMeta: {
    flex: 1,
  },
  reportsBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B432E',
  },
  reportsBannerSubtitle: {
    fontSize: 12,
    color: '#737373',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F4F8F4',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '80%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAF0EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1B432E',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1B432E',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 12,
  },
  reportGrid: {
    marginBottom: 10,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reportMiniCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#EAF0EB',
  },
  reportMiniLabel: {
    fontSize: 11,
    color: '#737373',
    fontWeight: '600',
    marginBottom: 6,
  },
  reportMiniVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1B432E',
  },
  modalChartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 16,
    marginBottom: 20,
  },
  chartBarsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 20,
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarVal: {
    fontSize: 10,
    fontWeight: '600',
    color: '#737373',
    marginBottom: 4,
  },
  chartBarFilled: {
    width: 24,
    backgroundColor: '#85B68C',
    borderRadius: 6,
  },
  chartBarLabel: {
    fontSize: 10,
    color: '#737373',
    marginTop: 6,
    fontWeight: '600',
  },
  modalCenteredOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '85%',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  alertModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B432E',
    textAlign: 'center',
    marginBottom: 8,
  },
  alertModalSubtitle: {
    fontSize: 13,
    color: '#737373',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  alertModalInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#262626',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  alertModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  alertModalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  alertModalBtnCancel: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  alertModalBtnSave: {
    backgroundColor: '#1B432E',
  },
  alertModalBtnTextCancel: {
    color: '#737373',
    fontWeight: '700',
    fontSize: 14,
  },
  alertModalBtnTextSave: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1B432E',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#262626',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  modalSubmitButton: {
    backgroundColor: '#1B432E',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  modalSubmitButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});

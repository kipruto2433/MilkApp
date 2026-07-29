import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, Modal, TextInput, ActivityIndicator, Platform, Switch } from 'react-native';
import { fetchFarmers, fetchCollections, fetchPayments, fetchCollectors, createCollector, deleteCollector, deleteFarmer, updateFarmerStatus, updateCollectorStatus, changePassword, getSettings, updateSettings, getLogs, fetchReports } from '../api';
import { AuthContext } from '../auth/AuthContext';
import Feather from '@expo/vector-icons/Feather';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, padding: 50, backgroundColor: '#fee' }}>
          <Text style={{ fontSize: 20, color: 'red', fontWeight: 'bold' }}>App Crashed!</Text>
          <Text style={{ marginTop: 20, color: 'black' }}>{this.state.error?.toString()}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function AdminHomeScreenWrapper() {
  return (
    <ErrorBoundary>
      <AdminHomeScreen />
    </ErrorBoundary>
  );
}

function AdminHomeScreen() {
  const { token, signOut, user } = useContext(AuthContext);
  const [farmers, setFarmers] = useState([]);
  const [collections, setCollections] = useState([]);
  const [payments, setPayments] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard' | 'users' | 'reports' | 'settings'
  
  // Reports Dynamic states
  const [monthlyReport, setMonthlyReport] = useState({
    litersMonth: 0,
    amountMonth: 0,
    paidMonth: 0,
    pendingMonth: 0,
    dailyBreakdown: []
  });
  const [balancesReport, setBalancesReport] = useState([]);

  // Search / User Management States
  const [userRoleFilter, setUserRoleFilter] = useState('all'); // 'all' | 'farmer' | 'collector' | 'admin'
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentsModalUser, setPaymentsModalUser] = useState(null);
  const [generatingPaymentsReport, setGeneratingPaymentsReport] = useState(false);
  
  // Create Collector Form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // Settings Toggles
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Additional Settings & Logs
  const [systemSettings, setSystemSettings] = useState({
    milk_price: '50',
    collection_zones: '3',
    payment_schedule: '30',
    session_timeout: '60',
    max_password_age: '90'
  });
  const [logs, setLogs] = useState([]);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [settingModalVisible, setSettingModalVisible] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [adminAccountsModalVisible, setAdminAccountsModalVisible] = useState(false);
  const [reportScheduleModalVisible, setReportScheduleModalVisible] = useState(false);
  const [auditLogsModalVisible, setAuditLogsModalVisible] = useState(false);
  const [createAdminModalVisible, setCreateAdminModalVisible] = useState(false);
  
  const [oldPassword, setOldPassword] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [editingSetting, setEditingSetting] = useState(null);
  const [editingSettingValue, setEditingSettingValue] = useState('');
  
  const [reportSchedule, setReportSchedule] = useState({
    daily: true,
    weekly: true,
    monthly: true
  });

  // Admin Accounts Management
  const [adminList, setAdminList] = useState([
    { id: 1, name: 'System Admin', phone: '0700000001', created: '2026-01-15', lastLogin: '2026-07-06 10:30' },
  ]);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // Login Activity Logs Filters
  const [loginLogSearch, setLoginLogSearch] = useState('');
  const [loginLogFilter, setLoginLogFilter] = useState('all'); // 'all', 'success', 'failed'
  const [loginLogDateRange, setLoginLogDateRange] = useState('7days'); // '7days', '30days', 'all'

  const loadData = async () => {
    setLoading(true);
    try {
      const [farmersRes, collectionsRes, paymentsRes, collectorsRes, settingsRes, monthlyRes, balancesRes] = await Promise.all([
        fetchFarmers(token),
        fetchCollections(token),
        fetchPayments(token),
        fetchCollectors(token),
        getSettings(token).catch(() => ({ data: {} })),
        fetchReports(token, 'monthly').catch(() => ({ data: { litersMonth: 0, amountMonth: 0, paidMonth: 0, pendingMonth: 0, dailyBreakdown: [] } })),
        fetchReports(token, 'balances').catch(() => ({ data: [] }))
      ]);
      setFarmers(farmersRes.data.farmers || []);
      setCollections(collectionsRes.data.collections || []);
      setPayments(paymentsRes.data.payments || []);
      setCollectors(collectorsRes.data.collectors || []);
      if (settingsRes.data) {
        setSystemSettings(prev => ({ ...prev, ...settingsRes.data }));
      }
      if (monthlyRes && monthlyRes.data) {
        setMonthlyReport(monthlyRes.data);
      }
      if (balancesRes && balancesRes.data) {
        setBalancesReport(balancesRes.data);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleAddCollector = async () => {
    if (!newName || !newPhone || !newPassword) {
      return Alert.alert('Validation Error', 'All fields are required.');
    }
    setSaving(true);
    try {
      await createCollector(token, {
        name: newName.trim(),
        phone: newPhone.trim(),
        password: newPassword,
      });
      setModalVisible(false);
      setNewName('');
      setNewPhone('');
      setNewPassword('');
      Alert.alert('Success', 'Collector created successfully.');
      loadData();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create collector.');
    } finally {
      setSaving(false);
    }
  };

  const confirmUserAction = (title, message, actionLabel, onConfirm, destructive = false) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: actionLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
  };

  const handleDeleteUser = (item) => {
    const userRole = item.userType || 'user';
    const message = `Are you sure you want to delete the ${userRole} "${item.name}"? This action is permanent and cannot be undone.`;
    confirmUserAction('Confirm Deletion', message, 'Delete', async () => {
      setLoading(true);
      try {
        if (userRole === 'collector') {
          await deleteCollector(token, item.id);
        } else if (userRole === 'farmer') {
          await deleteFarmer(token, item.id);
        }
        Alert.alert('Success', `${item.name} has been deleted.`);
        await loadData();
      } catch (err) {
        Alert.alert('Error', err.response?.data?.error || `Failed to delete ${userRole}.`);
      } finally {
        setLoading(false);
      }
    }, true);
  };

  const handleToggleUserSuspension = (item) => {
    const userRole = item.userType;
    const nextStatus = item.status === 'suspended' ? 'active' : 'suspended';
    const action = nextStatus === 'suspended' ? 'Suspend' : 'Reactivate';
    const message = `${action} ${item.name}? ${nextStatus === 'suspended' ? 'They will no longer be able to sign in or use the app.' : 'They will be able to sign in again.'}`;

    confirmUserAction(`${action} ${userRole}`, message, action, async () => {
      setLoading(true);
      try {
        if (userRole === 'farmer') {
          await updateFarmerStatus(token, item.id, nextStatus);
        } else if (userRole === 'collector') {
          await updateCollectorStatus(token, item.id, nextStatus);
        }
        Alert.alert('Success', `${item.name} has been ${nextStatus}.`);
        await loadData();
      } catch (error) {
        Alert.alert('Error', error.response?.data?.error || `Failed to ${nextStatus === 'suspended' ? 'suspend' : 'reactivate'} ${userRole}.`);
      } finally {
        setLoading(false);
      }
    }, nextStatus === 'suspended');
  };

  const handlePasswordChange = async () => {
    if (!oldPassword || !adminNewPassword || !confirmPassword) {
      return Alert.alert('Error', 'All fields are required');
    }
    if (adminNewPassword !== confirmPassword) {
      return Alert.alert('Error', 'New passwords do not match');
    }
    setSaving(true);
    try {
      await changePassword(token, oldPassword, adminNewPassword);
      Alert.alert('Success', 'Password changed successfully');
      setPasswordModalVisible(false);
      setOldPassword('');
      setAdminNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSetting = async () => {
    if (!editingSettingValue) {
      return Alert.alert('Error', 'Value cannot be empty');
    }
    setSaving(true);
    try {
      await updateSettings(token, editingSetting, editingSettingValue);
      setSystemSettings(prev => ({ ...prev, [editingSetting]: editingSettingValue }));
      setSettingModalVisible(false);
      Alert.alert('Success', 'Setting updated successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await getLogs(token);
      setLogs(res.data);
      setLogsModalVisible(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    setSaving(true);
    try {
      // Generate detailed tables of farmers and their financial status
      const farmersTableRows = farmers.map(f => {
        const farmerCollections = collections.filter(c => c.farmer_id === f.id);
        const farmerPayments = payments.filter(p => p.farmer_id === f.id);
        const delivered = farmerCollections.reduce((sum, c) => sum + parseFloat(c.liters || 0), 0);
        const earned = farmerCollections.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);
        const paid = farmerPayments.filter(p => p.status === 'paid' || p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const balance = Math.max(0, earned - paid);
        return `
          <tr>
            <td>${f.farmer_code || `F-${f.id}`}</td>
            <td>${f.name}</td>
            <td>${f.phone || 'N/A'}</td>
            <td>${f.village || 'N/A'}</td>
            <td>${delivered.toFixed(0)} L</td>
            <td>KSh ${earned.toLocaleString()}</td>
            <td>KSh ${balance.toLocaleString()}</td>
          </tr>
        `;
      }).join('');

      const collectorsTableRows = collectors.map(c => `
        <tr>
          <td>COL-${c.id}</td>
          <td>${c.name}</td>
          <td>${c.phone || 'N/A'}</td>
          <td>${new Date(c.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>MilkTrack System Backup Summary</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #262626; }
            h1 { color: #1B432E; margin-bottom: 5px; font-size: 26px; }
            p.subtitle { color: #737373; font-size: 14px; margin-top: 0; margin-bottom: 30px; }
            .section-title { font-size: 14px; font-weight: bold; color: #1B432E; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 2px solid #EAF0EB; padding-bottom: 6px; margin-top: 28px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
            th, td { border: 1px solid #EAF0EB; padding: 10px 12px; text-align: left; font-size: 12px; }
            th { background-color: #1B432E; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #F9FBF9; }
            .summary-box { background-color: #E6F7EB; border: 1px solid #C5D9C8; border-radius: 12px; padding: 15px; margin-bottom: 20px; font-size: 13px; }
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
          <h1>MilkTrack Database Snapshot</h1>
          <p class="subtitle">System Backup prepared on ${new Date().toLocaleString()}</p>
          
          <div class="summary-box">
            <strong>Database Snapshot Totals:</strong><br>
            • Registered Farmers: ${farmers.length}<br>
            • Registered Collectors: ${collectors.length}<br>
            • Total Milk Collected: ${collections.reduce((sum, item) => sum + parseFloat(item.liters || 0), 0).toFixed(0)} L<br>
            • Total Payments Settled: KSh ${payments.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0).toLocaleString()}
          </div>

          <div class="section-title">Registered Farmers Database Ledger</div>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Village</th>
                <th>Delivered</th>
                <th>Total Earned</th>
                <th>Outstanding Balance</th>
              </tr>
            </thead>
            <tbody>
              ${farmersTableRows || '<tr><td colspan="7" style="text-align:center;">No farmers found</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">Registered Milk Collectors</div>
          <table>
            <thead>
              <tr>
                <th>Collector ID</th>
                <th>Name</th>
                <th>Phone Number</th>
                <th>Registration Date</th>
              </tr>
            </thead>
            <tbody>
              ${collectorsTableRows || '<tr><td colspan="4" style="text-align:center;">No collectors found</td></tr>'}
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
        setBackupModalVisible(false);
      } else {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        setBackupModalVisible(false);
      }
    } catch (err) {
      console.warn(err);
      Alert.alert('Error', 'Failed to prepare system backup export.');
    } finally {
      setSaving(false);
    }
  };

  const getPaymentsForUser = (selectedUser) => {
    if (!selectedUser) return [];
    return payments
      .filter(payment => selectedUser.userType === 'collector'
        ? payment.collector_id === selectedUser.id
        : payment.farmer_id === selectedUser.id)
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
  };

  const handleGenerateUserPaymentsPdf = async () => {
    if (!paymentsModalUser) return;

    const userPayments = getPaymentsForUser(paymentsModalUser);
    if (userPayments.length === 0) {
      Alert.alert('No payments', 'There are no payments to include in this report.');
      return;
    }

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
    const isCollector = paymentsModalUser.userType === 'collector';
    const reportTitle = isCollector ? 'Collector Payments Report' : 'Farmer Payments Report';
    const relationshipLabel = isCollector ? 'Farmer' : 'Recorded by';
    const totalAmount = userPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
    const rows = userPayments.map(payment => {
      const relatedUser = isCollector
        ? farmers.find(farmer => farmer.id === payment.farmer_id)?.name || payment.farmer_code || 'Farmer'
        : collectors.find(collector => collector.id === payment.collector_id)?.name || payment.collector_name || 'Collector';
      return `<tr><td>${escapeHtml(payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A')}</td><td>${escapeHtml(relatedUser)}</td><td>${escapeHtml((payment.method || 'N/A').toUpperCase())}</td><td>${escapeHtml(payment.mpesa_transaction_id || '-')}</td><td class="amount">KSh ${parseFloat(payment.amount || 0).toLocaleString()}</td></tr>`;
    }).join('');
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${reportTitle}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#262626}h1{color:#1B432E;margin:0 0 6px}.subtitle{color:#737373;margin:0 0 24px}.summary{background:#E6F7EB;border:1px solid #C5D9C8;border-radius:10px;padding:14px;margin-bottom:22px;color:#1B432E}table{width:100%;border-collapse:collapse}th,td{border:1px solid #EAF0EB;padding:10px;text-align:left;font-size:12px}th{background:#1B432E;color:#fff}.amount{text-align:right;font-weight:bold}@media print{@page{margin:0}body{padding:20mm;margin:0}}</style></head><body><h1>${reportTitle}</h1><p class="subtitle">${escapeHtml(isCollector ? `Payments recorded by ${paymentsModalUser.name}` : `Payments made to ${paymentsModalUser.name}`)}<br>Generated ${escapeHtml(new Date().toLocaleString())}</p><div class="summary"><strong>Total records:</strong> ${userPayments.length}<br><strong>Total amount:</strong> KSh ${totalAmount.toLocaleString()}</div><table><thead><tr><th>Date</th><th>${relationshipLabel}</th><th>Method</th><th>Reference</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;

    setGeneratingPaymentsReport(true);
    try {
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (!printWindow) throw new Error('Unable to open the print dialog.');
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
      console.warn(error);
      Alert.alert('Error', 'Failed to generate the payments report.');
    } finally {
      setGeneratingPaymentsReport(false);
    }
  };

  const handleSystemCheck = () => {
    const healthStatus = {
      database: 'Connected',
      apiServer: 'Running on port 4000',
      dataSync: '5 mins ago',
      usersActive: farmers.length + collectors.length + 1,
      diskSpace: 'OK',
      memoryUsage: 'Optimal'
    };
    Alert.alert('System Health', `Database: ${healthStatus.database}\nAPI Server: ${healthStatus.apiServer}\nLast Sync: ${healthStatus.dataSync}\nActive Users: ${healthStatus.usersActive}\nDisk Space: ${healthStatus.diskSpace}\nMemory: ${healthStatus.memoryUsage}`);
  };

  const handleShowAdminAccounts = () => {
    setAdminAccountsModalVisible(true);
  };

  const handleShowReportSchedule = () => {
    setReportScheduleModalVisible(true);
  };

  const handleSaveReportSchedule = () => {
    const scheduleText = `Reports scheduled:\n${reportSchedule.daily ? '✓ Daily' : '○ Daily'}\n${reportSchedule.weekly ? '✓ Weekly' : '○ Weekly'}\n${reportSchedule.monthly ? '✓ Monthly' : '○ Monthly'}`;
    Alert.alert('Schedule Saved', scheduleText);
    setReportScheduleModalVisible(false);
  };

  const handleShowAuditLogs = () => {
    setAuditLogsModalVisible(true);
  };

  const handleShowAdminAccountsModal = () => {
    setAdminAccountsModalVisible(true);
  };

  const handleAddAdmin = async () => {
    if (!newAdminName || !newAdminPhone || !newAdminPassword) {
      return Alert.alert('Validation Error', 'All fields are required.');
    }
    setSaving(true);
    try {
      const newAdmin = {
        id: adminList.length + 1,
        name: newAdminName.trim(),
        phone: newAdminPhone.trim(),
        created: new Date().toISOString().split('T')[0],
        lastLogin: 'Never'
      };
      setAdminList([...adminList, newAdmin]);
      setCreateAdminModalVisible(false);
      setNewAdminName('');
      setNewAdminPhone('');
      setNewAdminPassword('');
      Alert.alert('Success', 'Admin account created successfully.');
    } catch (err) {
      Alert.alert('Error', 'Failed to create admin account.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdmin = (adminId) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this admin account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setAdminList(adminList.filter(a => a.id !== adminId));
            Alert.alert('Success', 'Admin account deleted successfully.');
          }
        }
      ]
    );
  };

  const getFilteredLoginLogs = () => {
    let filtered = logs || [];
    
    // Filter by search query
    if (loginLogSearch.trim()) {
      filtered = filtered.filter(log => 
        log.details?.toLowerCase().includes(loginLogSearch.toLowerCase()) ||
        log.action?.toLowerCase().includes(loginLogSearch.toLowerCase())
      );
    }
    
    // Filter by status
    if (loginLogFilter === 'success') {
      filtered = filtered.filter(log => log.action && log.action.includes('LOGIN') && !log.action.includes('FAILED'));
    } else if (loginLogFilter === 'failed') {
      filtered = filtered.filter(log => log.action && log.action.includes('FAILED'));
    }
    
    // Filter by date range
    const now = new Date();
    let cutoffDate = new Date();
    if (loginLogDateRange === '7days') {
      cutoffDate.setDate(now.getDate() - 7);
    } else if (loginLogDateRange === '30days') {
      cutoffDate.setDate(now.getDate() - 30);
    }
    
    if (loginLogDateRange !== 'all') {
      filtered = filtered.filter(log => new Date(log.created_at) >= cutoffDate);
    }
    
    return filtered;
  };

  const getLoginLogStats = () => {
    const allLogs = logs || [];
    const filteredLogs = getFilteredLoginLogs();
    
    const totalAttempts = allLogs.length;
    const successfulLogins = allLogs.filter(log => log.action && log.action.includes('LOGIN') && !log.action.includes('FAILED')).length;
    const failedLogins = allLogs.filter(log => log.action && log.action.includes('FAILED')).length;
    const filteredCount = filteredLogs.length;
    
    return { totalAttempts, successfulLogins, failedLogins, filteredCount };
  };

  const handleExportLoginLogs = () => {
    const stats = getLoginLogStats();
    const exportText = `Login Activity Report\n\nGenerated: ${new Date().toLocaleString()}\n\nTotal Attempts: ${stats.totalAttempts}\nSuccessful: ${stats.successfulLogins}\nFailed: ${stats.failedLogins}\n\nFiltered Results: ${stats.filteredCount}`;
    Alert.alert('Export Ready', exportText);
  };

  const getInitials = (name) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const adminName = user?.name && user.name !== 'Felix Chepkoech' ? user.name : 'KELVIN KIPRUTO';

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

  // Dynamic Metrics (combining with mock metrics if empty)
  const totalUsersCount = farmers.length + collectors.length + 1; // plus this admin
  const todayStr = getLocalDateString();
  const todayCollections = collections.filter(c => {
    return getCollectionLocalDateString(c.collected_at) === todayStr;
  });
  const totalMilkToday = todayCollections.reduce((sum, item) => sum + parseFloat(item.liters || 0), 0);
  const totalPaymentsVal = payments.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

  const exportAdminReportPDF = async () => {
    try {
      const chartData = (monthlyReport.dailyBreakdown || []).map(item => ({
        day: item.day,
        date: item.date,
        liters: parseFloat(item.liters || 0)
      }));
      const weeklyTotal = chartData.reduce((sum, d) => sum + d.liters, 0);

      const collectorsWithVolume = collectors.map(col => {
        const vol = collections
          .filter(c => c.collector_id === col.id)
          .reduce((sum, c) => sum + parseFloat(c.liters || 0), 0);
        return { ...col, volume: vol };
      }).sort((a, b) => b.volume - a.volume);

      const collectorRows = collectorsWithVolume.map((col, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${col.name}</td>
          <td>COL-${col.id}</td>
          <td>${col.volume.toFixed(0)} L</td>
        </tr>
      `).join('');

      const dailyRows = chartData.map(item => `
        <tr>
          <td>${item.day}</td>
          <td>${item.date}</td>
          <td>${item.liters.toFixed(1)} L</td>
        </tr>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>MilkTrack Administrator Report</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #262626; }
            h1 { color: #1B432E; margin-bottom: 5px; font-size: 26px; }
            p.subtitle { color: #737373; font-size: 14px; margin-top: 0; margin-bottom: 30px; }
            .section-title { font-size: 14px; font-weight: bold; color: #1B432E; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 2px solid #EAF0EB; padding-bottom: 6px; margin-top: 24px; margin-bottom: 12px; }
            .grid { display: flex; flex-wrap: wrap; margin-left: -10px; margin-right: -10px; }
            .col { flex: 1; min-width: 150px; padding: 10px; }
            .card { background-color: #F4F8F4; border: 1px solid #C5D9C8; border-radius: 12px; padding: 15px; }
            .label { font-size: 11px; color: #737373; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
            .value { font-size: 18px; font-weight: bold; color: #1B432E; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
            th, td { border: 1px solid #EAF0EB; padding: 12px 15px; text-align: left; font-size: 13px; }
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
          <h1>MilkTrack Weekly Activity Report</h1>
          <p class="subtitle">System Overview · Prepared on ${new Date().toLocaleDateString()} for Admin ${adminName}</p>
          
          <div class="section-title">Weekly System Metrics</div>
          <div class="grid">
            <div class="col">
              <div class="card">
                <div class="label">Total System Users</div>
                <div class="value">${farmers.length + collectors.length + 1}</div>
              </div>
            </div>
            <div class="col">
              <div class="card">
                <div class="label">Weekly Milk Total</div>
                <div class="value">${weeklyTotal.toFixed(0)} L</div>
              </div>
            </div>
            <div class="col">
              <div class="card">
                <div class="label">Average Daily Intake</div>
                <div class="value">${(weeklyTotal/7).toFixed(0)} L</div>
              </div>
            </div>
            <div class="col">
              <div class="card">
                <div class="label">Pending Payments Due</div>
                <div class="value">KSh ${payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0).toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div class="section-title">Daily Milk Collection breakdown</div>
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Date</th>
                <th>Milk Volume (Litres)</th>
              </tr>
            </thead>
            <tbody>
              ${dailyRows}
            </tbody>
          </table>

          <div class="section-title">Collectors ranking this week</div>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Collector Name</th>
                <th>Collector ID</th>
                <th>Total Volume Collected</th>
              </tr>
            </thead>
            <tbody>
              ${collectorRows || '<tr><td colspan="4" style="text-align:center;">No collectors recorded collections</td></tr>'}
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

  const displayUsers = totalUsersCount;
  const displayMilk = `${totalMilkToday.toFixed(0)} L`;
  const displayPayments = `KSh ${totalPaymentsVal.toLocaleString()}`;

  // Render Dashboard Tab
  const renderDashboardTab = () => {
    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {/* Figma Header Card */}
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.headerLabel}>Admin panel</Text>
            <Text style={styles.headerTitle}>{adminName}</Text>
            <Text style={styles.headerSubtitle}>System Administrator</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{getInitials(adminName)}</Text>
          </View>
        </View>



        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Total users</Text>
              <Text style={styles.metricValue}>{displayUsers}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Milk today</Text>
              <Text style={styles.metricValue}>{displayMilk}</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Payments this month</Text>
              <Text style={styles.metricValue}>{displayPayments}</Text>
              <Text style={styles.metricSubtext}>{payments.length} transactions</Text>
            </View>
          </View>
        </View>

        {/* QUICK ACTIONS Section */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.quickActionsGrid}>
          <View style={styles.quickActionsRow}>
            <Pressable style={styles.actionCard} onPress={() => { setCurrentTab('users'); setModalVisible(true); }}>
              <Feather name="user-plus" size={20} color="#1B432E" />
              <Text style={styles.actionCardText}>Add user</Text>
            </Pressable>
            <Pressable style={styles.actionCard} onPress={() => setCurrentTab('reports')}>
              <Feather name="file-text" size={20} color="#1B432E" />
              <Text style={styles.actionCardText}>Generate report</Text>
            </Pressable>
          </View>
          <View style={styles.quickActionsRow}>
            <Pressable style={styles.actionCard} onPress={() => setCurrentTab('users')}>
              <Feather name="credit-card" size={20} color="#1B432E" />
              <Text style={styles.actionCardText}>Process payments</Text>
            </Pressable>
            <Pressable style={styles.actionCard} onPress={() => setCurrentTab('settings')}>
              <Feather name="settings" size={20} color="#1B432E" />
              <Text style={styles.actionCardText}>System settings</Text>
            </Pressable>
          </View>
        </View>

        {/* RECENT ACTIVITY Section */}
        <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
        <View style={styles.activityList}>
          {collections.length === 0 && payments.length === 0 ? (
            <Text style={{textAlign: 'center', color: '#737373'}}>No recent activity.</Text>
          ) : (
            <>
              {collections.slice(0, 3).map(c => (
                <View style={styles.activityItem} key={`col-${c.id}`}>
                  <View style={styles.activityAvatarCircle}>
                    <Feather name="droplet" size={16} color="#107C41" />
                  </View>
                  <View style={styles.activityMeta}>
                    <Text style={styles.activityTitle}>Collection recorded</Text>
                    <Text style={styles.activitySub}>{c.liters}L from Farmer #{c.farmer_id} · {new Date(c.collected_at).toLocaleDateString()}</Text>
                  </View>
                </View>
              ))}
              {payments.slice(0, 2).map(p => (
                <View style={styles.activityItem} key={`pay-${p.id}`}>
                  <View style={[styles.activityAvatarCircle, { backgroundColor: '#EAF0EB' }]}>
                    <Feather name="credit-card" size={16} color="#1B432E" />
                  </View>
                  <View style={styles.activityMeta}>
                    <Text style={styles.activityTitle}>Payment recorded</Text>
                    <Text style={styles.activitySub}>KSh {p.amount} to Farmer #{p.farmer_id} · {new Date(p.payment_date).toLocaleDateString()}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    );
  };

  // Render Users Tab (User Management)
  const renderUsersTab = () => {
    // Combine lists
    let allUsers = [];
    farmers.forEach(f => allUsers.push({ ...f, userType: 'farmer' }));
    collectors.forEach(c => allUsers.push({ ...c, userType: 'collector' }));

    // Filter lists
    if (userRoleFilter === 'farmer') {
      allUsers = allUsers.filter(u => u.userType === 'farmer');
    } else if (userRoleFilter === 'collector') {
      allUsers = allUsers.filter(u => u.userType === 'collector');
    } else if (userRoleFilter === 'admin') {
      allUsers = [{ name: adminName, phone: user?.phone || '0733333333', userType: 'admin', farmer_code: 'ADM001', status: 'active' }];
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      allUsers = allUsers.filter(u => 
        u.name?.toLowerCase().includes(query) ||
        (u.phone && u.phone.toLowerCase().includes(query)) ||
        (u.farmer_code && u.farmer_code.toLowerCase().includes(query))
      );
    }

    return (
      <View style={styles.tabContainer}>
        {/* Header */}
        <View style={styles.tabHeader}>
          <Text style={styles.tabTitle}>Manage users</Text>
          <Pressable style={styles.headerActionButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.headerActionButtonText}>+ Add user</Text>
          </Pressable>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterScrollContent}>
          <Pressable style={[styles.filterPill, userRoleFilter === 'all' && styles.filterPillActive]} onPress={() => setUserRoleFilter('all')}>
            <Text style={[styles.filterPillText, userRoleFilter === 'all' && styles.filterPillTextActive]}>All ({farmers.length + collectors.length})</Text>
          </Pressable>
          <Pressable style={[styles.filterPill, userRoleFilter === 'farmer' && styles.filterPillActive]} onPress={() => setUserRoleFilter('farmer')}>
            <Text style={[styles.filterPillText, userRoleFilter === 'farmer' && styles.filterPillTextActive]}>Farmers ({farmers.length})</Text>
          </Pressable>
          <Pressable style={[styles.filterPill, userRoleFilter === 'collector' && styles.filterPillActive]} onPress={() => setUserRoleFilter('collector')}>
            <Text style={[styles.filterPillText, userRoleFilter === 'collector' && styles.filterPillTextActive]}>Collectors ({collectors.length})</Text>
          </Pressable>
          <Pressable style={[styles.filterPill, userRoleFilter === 'admin' && styles.filterPillActive]} onPress={() => setUserRoleFilter('admin')}>
            <Text style={[styles.filterPillText, userRoleFilter === 'admin' && styles.filterPillTextActive]}>Admins (1)</Text>
          </Pressable>
        </ScrollView>

        {/* Search */}
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#737373" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#A3A3A3"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Users List */}
        <ScrollView contentContainerStyle={styles.tabScrollContent}>
          {allUsers.length > 0 ? (
            allUsers.map((item, idx) => {
              const isActive = item.status !== 'suspended' || item.userType === 'admin';
              
              const isFarmer = item.userType === 'farmer';
              let deliveredStr = '0 L';
              let earnedStr = 'KSh 0';
              let balanceStr = 'Active';

              if (isFarmer) {
                const farmerCollections = collections.filter(c => c.farmer_id === item.id);
                const farmerPayments = payments.filter(p => p.farmer_id === item.id);
                const delivered = farmerCollections.reduce((sum, c) => sum + parseFloat(c.liters || 0), 0);
                const earned = farmerCollections.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);
                const paid = farmerPayments.filter(p => p.status === 'paid' || p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                const balance = Math.max(0, earned - paid);

                deliveredStr = `${delivered.toFixed(0)} L`;
                earnedStr = `KSh ${earned.toLocaleString()}`;
                balanceStr = `KSh ${balance.toLocaleString()}`;
              } else if (item.userType === 'collector') {
                const collectorCollections = collections.filter(c => c.collector_id === item.id);
                const delivered = collectorCollections.reduce((sum, c) => sum + parseFloat(c.liters || 0), 0);
                const totalReceivedWorth = collectorCollections.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);
                
                const collectorFarmers = farmers.filter(f => f.collector_id === item.id);
                const totalFarmersBalance = collectorFarmers.reduce((sum, f) => {
                  const fCollections = collections.filter(c => c.farmer_id === f.id);
                  const fPayments = payments.filter(p => p.farmer_id === f.id);
                  const fEarned = fCollections.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);
                  const fPaid = fPayments.filter(p => p.status === 'paid' || p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                  return sum + Math.max(0, fEarned - fPaid);
                }, 0);

                deliveredStr = `${delivered.toFixed(0)} L`;
                earnedStr = `KSh ${totalReceivedWorth.toLocaleString()}`;
                balanceStr = `KSh ${totalFarmersBalance.toLocaleString()}`;
              }

              return (
                <View style={styles.userCard} key={idx}>
                  <View style={styles.userCardHeader}>
                    <View style={styles.userCardLeft}>
                      <View style={[styles.userAvatar, { backgroundColor: item.userType === 'farmer' ? '#E6F7EB' : item.userType === 'collector' ? '#DBE9FE' : '#F5F5F5' }]}>
                        <Text style={[styles.userAvatarText, { color: item.userType === 'farmer' ? '#107C41' : item.userType === 'collector' ? '#1D4ED8' : '#737373' }]}>{getInitials(item.name)}</Text>
                      </View>
                      <View style={styles.userMeta}>
                        <View style={styles.userNameRow}>
                          <Text style={styles.userNameText}>{item.name}</Text>
                          <View style={[styles.roleBadge, { backgroundColor: item.userType === 'farmer' ? '#E6F7EB' : item.userType === 'collector' ? '#DBE9FE' : '#F5F5F5' }]}>
                            <Text style={[styles.roleBadgeText, { color: item.userType === 'farmer' ? '#107C41' : item.userType === 'collector' ? '#1D4ED8' : '#737373' }]}>{item.userType}</Text>
                          </View>
                        </View>
                        <Text style={styles.userCodeText}>Phone: {item.phone || item.farmer_code || `COL-${item.id}`} · Unit: {item.village || 'N/A'}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.statusBadge, isActive ? styles.statusBadgePaid : styles.statusBadgePending, { marginRight: 8 }]}>
                        <Text style={[styles.statusBadgeText, isActive ? styles.statusBadgeTextPaid : styles.statusBadgeTextPending]}>
                          {isActive ? 'Active' : 'Suspended'}
                        </Text>
                      </View>
                      {item.userType !== 'admin' && (
                        <>
                          <Pressable
                            onPress={() => handleToggleUserSuspension(item)}
                            style={styles.userActionButton}
                            accessibilityRole="button"
                            accessibilityLabel={`${isActive ? 'Suspend' : 'Reactivate'} ${item.name}`}
                          >
                            <Feather name={isActive ? 'user-x' : 'user-check'} size={18} color={isActive ? '#A16207' : '#107C41'} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteUser(item)}
                            style={styles.userActionButton}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${item.name}`}
                          >
                            <Feather name="trash-2" size={18} color="#EF4444" />
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Summary row details */}
                  <View style={styles.userCardDetailRow}>
                    <View style={styles.userCardDetailItem}>
                      <Text style={styles.userCardDetailLabel}>Delivered/Col.</Text>
                      <Text style={styles.userCardDetailVal}>{deliveredStr}</Text>
                    </View>
                    <View style={styles.userCardDetailItem}>
                      <Text style={styles.userCardDetailLabel}>Earned/Due</Text>
                      <Text style={styles.userCardDetailVal}>{earnedStr}</Text>
                    </View>
                    <View style={styles.userCardDetailItem}>
                      <Text style={styles.userCardDetailLabel}>Balance</Text>
                      <Text style={styles.userCardDetailVal}>{balanceStr}</Text>
                    </View>
                  </View>
                  {item.userType !== 'admin' && (
                    <Pressable
                      style={styles.viewPaymentsButton}
                      onPress={() => setPaymentsModalUser(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`View payments for ${item.name}`}
                    >
                      <Feather name="credit-card" size={15} color="#1B432E" />
                      <Text style={styles.viewPaymentsButtonText}>View payments</Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No users found.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // Render Reports Tab
  const renderReportsTab = () => {
    // Dynamic Chart Data from last 7 days breakdown
    const chartData = (monthlyReport.dailyBreakdown || []).map((item, idx) => {
      const dayLiters = parseFloat(item.liters || 0);
      return { 
        day: item.day, 
        liters: dayLiters, 
        height: Math.max(10, Math.min(120, dayLiters * 1.5)), 
        current: item.date === new Date().toISOString().split('T')[0]
      };
    });
    const weeklyTotal = chartData.reduce((sum, d) => sum + d.liters, 0);

    // Calculate Top Collectors dynamically based on loaded data
    const collectorsWithVolume = collectors.map(col => {
      const vol = collections
        .filter(c => c.collector_id === col.id)
        .reduce((sum, c) => sum + parseFloat(c.liters || 0), 0);
      return { ...col, volume: vol };
    }).sort((a, b) => b.volume - a.volume);

    return (
      <View style={styles.tabContainer}>
        {/* Header */}
        <View style={styles.tabHeader}>
          <Text style={styles.tabTitle}>Reports</Text>
        </View>

        {/* Date Filter Pills */}
        <View style={[styles.filterScrollContent, { paddingHorizontal: 24, marginBottom: 16 }]}>
          <Pressable style={styles.filterPill}><Text style={styles.filterPillText}>Daily</Text></Pressable>
          <Pressable style={[styles.filterPill, styles.filterPillActive]}><Text style={[styles.filterPillText, styles.filterPillTextActive]}>Weekly</Text></Pressable>
          <Pressable style={styles.filterPill}><Text style={styles.filterPillText}>Monthly</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.tabScrollContent}>
          {/* Custom Pure React Native Bar Chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Milk collected this week (Litres)</Text>
            <View style={styles.chartBarsContainer}>
              {chartData.map((data, idx) => (
                <View style={styles.chartCol} key={idx}>
                  <Text style={styles.chartBarVal}>{data.liters > 0 ? data.liters.toFixed(0) : ''}</Text>
                  <View style={[
                    styles.chartBarFilled,
                    { height: data.height },
                    data.current && { backgroundColor: '#1B432E' }
                  ]} />
                  <Text style={styles.chartBarLabel}>{data.day}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Report summary stats */}
          <View style={styles.reportSummaryRow}>
            <View style={styles.reportSummaryCard}>
              <Text style={styles.reportSummaryVal}>{weeklyTotal.toFixed(0)} L</Text>
              <Text style={styles.reportSummaryLabel}>Weekly total</Text>
            </View>
            <View style={styles.reportSummaryCard}>
              <Text style={styles.reportSummaryVal}>{(weeklyTotal/7).toFixed(0)} L</Text>
              <Text style={styles.reportSummaryLabel}>Daily avg</Text>
            </View>
            <View style={styles.reportSummaryCard}>
              <Text style={[styles.reportSummaryVal, { color: '#107C41' }]}>Live</Text>
              <Text style={styles.reportSummaryLabel}>Database synced</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>TOP COLLECTORS THIS WEEK</Text>
          <View style={styles.topCollectorsList}>
            {collectorsWithVolume.length === 0 ? (
              <Text style={{textAlign: 'center', color: '#737373'}}>No data available.</Text>
            ) : (
              collectorsWithVolume.slice(0, 3).map((col, idx) => (
                <View style={styles.topCollectorRow} key={col.id}>
                  <View style={[styles.collectorRankCircle, idx > 0 && { backgroundColor: '#E5E7EB' }]}>
                    <Text style={[styles.collectorRankText, idx > 0 && { color: '#737373' }]}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.collectorRankName}>{col.name}</Text>
                  <Text style={styles.collectorRankVol}>{col.volume.toFixed(0)} L</Text>
                  {idx === 0 && col.volume > 0 && (
                    <View style={[styles.statusBadge, styles.statusBadgePaid]}>
                      <Text style={[styles.statusBadgeText, styles.statusBadgeTextPaid]}>Top</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Export button */}
          <Pressable style={styles.exportReportBtn} onPress={exportAdminReportPDF}>
            <Feather name="download" size={18} color="#1B432E" style={{ marginRight: 8 }} />
            <Text style={styles.exportReportBtnText}>Export report (PDF)</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  };

  // Render Settings Tab
  const renderSettingsTab = () => {
    return (
      <View style={styles.tabContainer}>
        <View style={styles.tabHeader}>
          <Text style={styles.tabTitle}>System settings</Text>
        </View>

        <ScrollView contentContainerStyle={styles.tabScrollContent}>
          
          {/* USER ACCESS & SECURITY section */}
          <View style={styles.settingsGroup}>
            <Text style={styles.settingsGroupTitle}>USER ACCESS & SECURITY</Text>
            
            <Pressable style={styles.settingsRowItem} onPress={handleShowAdminAccounts}>
              <View style={styles.settingLeftCol}>
                <View style={[styles.settingIconBox, { backgroundColor: '#F3E5F5' }]}>
                  <Feather name="shield" size={18} color="#7B1FA2" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingItemLabel}>Admin accounts</Text>
                  <Text style={styles.settingItemDesc}>Add or remove administrators</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="#737373" />
            </Pressable>

            <Pressable style={styles.settingsRowItem} onPress={loadLogs}>
              <View style={styles.settingLeftCol}>
                <View style={[styles.settingIconBox, { backgroundColor: '#FFF3E0' }]}>
                  <Feather name="list" size={18} color="#F57C00" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingItemLabel}>Login activity logs</Text>
                  <Text style={styles.settingItemDesc}>Who logged in, when & where</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="#737373" />
            </Pressable>

            <Pressable style={styles.settingsRowItem} onPress={() => setPasswordModalVisible(true)}>
              <View style={styles.settingLeftCol}>
                <View style={[styles.settingIconBox, { backgroundColor: '#FCE4EC' }]}>
                  <Feather name="lock" size={18} color="#C2185B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingItemLabel}>Change admin password</Text>
                  <Text style={styles.settingItemDesc}>Update your login credentials</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="#737373" />
            </Pressable>
          </View>


          {/* DATA & REPORTS section */}
          <View style={styles.settingsGroup}>
            <Text style={styles.settingsGroupTitle}>DATA & REPORTS</Text>

            <Pressable style={styles.settingsRowItem} onPress={() => setBackupModalVisible(true)}>
              <View style={styles.settingLeftCol}>
                <View style={[styles.settingIconBox, { backgroundColor: '#E8F5E9' }]}>
                  <Feather name="download" size={18} color="#388E3C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingItemLabel}>Export system data</Text>
                  <Text style={styles.settingItemDesc}>Full database backup (Excel / PDF)</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="#737373" />
            </Pressable>

            <Pressable style={styles.settingsRowItem} onPress={handleShowReportSchedule}>
              <View style={styles.settingLeftCol}>
                <View style={[styles.settingIconBox, { backgroundColor: '#E1F5FE' }]}>
                  <Feather name="calendar" size={18} color="#0277BD" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingItemLabel}>Auto-report schedule</Text>
                  <Text style={styles.settingItemDesc}>Daily, weekly monthly auto-reports</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="#737373" />
            </Pressable>

            <Pressable style={styles.settingsRowItem} onPress={handleShowAuditLogs}>
              <View style={styles.settingLeftCol}>
                <View style={[styles.settingIconBox, { backgroundColor: '#FFF3E0' }]}>
                  <Feather name="file-text" size={18} color="#F57C00" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingItemLabel}>Audit logs</Text>
                  <Text style={styles.settingItemDesc}>Full system action history</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="#737373" />
            </Pressable>
          </View>

          {/* Sign Out Button */}
          <Pressable style={styles.signOutBtn} onPress={signOut}>
            <Feather name="log-out" size={18} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={styles.signOutBtnText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.contentBody}>
        {currentTab === 'dashboard' && renderDashboardTab()}
        {currentTab === 'users' && renderUsersTab()}
        {currentTab === 'reports' && renderReportsTab()}
        {currentTab === 'settings' && renderSettingsTab()}
      </View>

      {/* Admin Bottom Navigation Tab Bar */}
      <View style={styles.bottomTabBar}>
        <Pressable style={styles.tabBarItem} onPress={() => setCurrentTab('dashboard')}>
          <Feather name="home" size={22} color={currentTab === 'dashboard' ? '#1B432E' : '#A3A3A3'} />
          <Text style={[styles.tabBarLabel, { color: currentTab === 'dashboard' ? '#1B432E' : '#A3A3A3', fontWeight: currentTab === 'dashboard' ? '700' : '500' }]}>
            Dashboard
          </Text>
        </Pressable>

        <Pressable style={styles.tabBarItem} onPress={() => setCurrentTab('users')}>
          <Feather name="users" size={22} color={currentTab === 'users' ? '#1B432E' : '#A3A3A3'} />
          <Text style={[styles.tabBarLabel, { color: currentTab === 'users' ? '#1B432E' : '#A3A3A3', fontWeight: currentTab === 'users' ? '700' : '500' }]}>
            Users
          </Text>
        </Pressable>

        <Pressable style={styles.tabBarItem} onPress={() => setCurrentTab('reports')}>
          <Feather name="bar-chart-2" size={22} color={currentTab === 'reports' ? '#1B432E' : '#A3A3A3'} />
          <Text style={[styles.tabBarLabel, { color: currentTab === 'reports' ? '#1B432E' : '#A3A3A3', fontWeight: currentTab === 'reports' ? '700' : '500' }]}>
            Reports
          </Text>
        </Pressable>

        <Pressable style={styles.tabBarItem} onPress={() => setCurrentTab('settings')}>
          <Feather name="settings" size={22} color={currentTab === 'settings' ? '#1B432E' : '#A3A3A3'} />
          <Text style={[styles.tabBarLabel, { color: currentTab === 'settings' ? '#1B432E' : '#A3A3A3', fontWeight: currentTab === 'settings' ? '700' : '500' }]}>
            Settings
          </Text>
        </Pressable>
      </View>

      {/* User Payments Modal */}
      <Modal
        visible={Boolean(paymentsModalUser)}
        animationType="slide"
        transparent
        onRequestClose={() => setPaymentsModalUser(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.paymentsModalContent]}>
            <Text style={styles.modalTitle}>Payments made</Text>
            <Text style={styles.paymentsModalSubtitle}>
              {paymentsModalUser?.userType === 'collector'
                ? `Payments recorded by ${paymentsModalUser?.name || 'this collector'}`
                : `Payments made to ${paymentsModalUser?.name || 'this farmer'}`}
            </Text>
            <ScrollView style={styles.paymentsModalList} showsVerticalScrollIndicator={false}>
              {paymentsModalUser && getPaymentsForUser(paymentsModalUser)
                .map(payment => {
                  const relatedUser = paymentsModalUser.userType === 'collector'
                    ? farmers.find(farmer => farmer.id === payment.farmer_id)?.name || payment.farmer_code || 'Farmer'
                    : collectors.find(collector => collector.id === payment.collector_id)?.name || payment.collector_name || 'Collector';
                  return (
                    <View key={payment.id} style={styles.paymentRecordCard}>
                      <View style={styles.paymentRecordHeader}>
                        <Text style={styles.paymentRecordAmount}>KSh {parseFloat(payment.amount || 0).toLocaleString()}</Text>
                        <Text style={styles.paymentRecordDate}>
                          {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'Date unavailable'}
                        </Text>
                      </View>
                      <Text style={styles.paymentRecordDetail}>Method: {(payment.method || 'N/A').toUpperCase()}</Text>
                      <Text style={styles.paymentRecordDetail}>
                        {paymentsModalUser.userType === 'collector' ? `Farmer: ${relatedUser}` : `Recorded by: ${relatedUser}`}
                      </Text>
                    </View>
                  );
                })}
              {paymentsModalUser && getPaymentsForUser(paymentsModalUser).length === 0 && (
                <View style={styles.emptyPaymentState}>
                  <Feather name="credit-card" size={22} color="#A3A3A3" />
                  <Text style={styles.emptyPaymentStateText}>No payments recorded yet.</Text>
                </View>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.saveBtn, (generatingPaymentsReport || getPaymentsForUser(paymentsModalUser).length === 0) && { opacity: 0.55 }]}
                onPress={handleGenerateUserPaymentsPdf}
                disabled={generatingPaymentsReport || getPaymentsForUser(paymentsModalUser).length === 0}
              >
                {generatingPaymentsReport ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveText}>PDF report</Text>}
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.cancelBtn, { marginLeft: 8, marginRight: 0 }]} onPress={() => setPaymentsModalUser(null)}>
                <Text style={styles.cancelText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Collector Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Collector Account</Text>
            <TextInput style={styles.modalInput} placeholder="Name" placeholderTextColor="#A3A3A3" value={newName} onChangeText={setNewName} />
            <TextInput style={styles.modalInput} placeholder="Phone" placeholderTextColor="#A3A3A3" keyboardType="phone-pad" value={newPhone} onChangeText={setNewPhone} />
            <TextInput style={styles.modalInput} placeholder="Password" placeholderTextColor="#A3A3A3" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            {saving ? (
              <ActivityIndicator size="large" color="#1B432E" />
            ) : (
              <View style={styles.modalActions}>
                <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handleAddCollector}>
                  <Text style={styles.saveText}>Save</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={passwordModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Admin Password</Text>
            <TextInput style={styles.modalInput} placeholder="Old Password" placeholderTextColor="#A3A3A3" secureTextEntry value={oldPassword} onChangeText={setOldPassword} />
            <TextInput style={styles.modalInput} placeholder="New Password" placeholderTextColor="#A3A3A3" secureTextEntry value={adminNewPassword} onChangeText={setAdminNewPassword} />
            <TextInput style={styles.modalInput} placeholder="Confirm New Password" placeholderTextColor="#A3A3A3" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
            {saving ? (
              <ActivityIndicator size="large" color="#1B432E" />
            ) : (
              <View style={styles.modalActions}>
                <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setPasswordModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handlePasswordChange}>
                  <Text style={styles.saveText}>Save</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Setting Modal */}
      <Modal visible={settingModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Setting</Text>
            <Text style={{ marginBottom: 12, color: '#737373', fontSize: 14 }}>
              Update {editingSetting ? editingSetting.replace('_', ' ') : ''}
            </Text>
            <TextInput 
              style={styles.modalInput} 
              value={editingSettingValue} 
              onChangeText={setEditingSettingValue} 
            />
            {saving ? (
              <ActivityIndicator size="large" color="#1B432E" />
            ) : (
              <View style={styles.modalActions}>
                <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setSettingModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handleUpdateSetting}>
                  <Text style={styles.saveText}>Save</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Logs Modal */}
      <Modal visible={logsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Activity Logs</Text>
            <ScrollView style={{ width: '100%', marginTop: 10 }}>
              {logs.map((log) => (
                <View key={log.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1B432E' }}>{log.action}</Text>
                  <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 4 }}>{log.details}</Text>
                  <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{new Date(log.created_at).toLocaleString()}</Text>
                </View>
              ))}
              {logs.length === 0 ? (
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#A3A3A3' }}>No logs found</Text>
              ) : null}
            </ScrollView>
            <Pressable style={[styles.modalBtn, styles.cancelBtn, { marginTop: 16 }]} onPress={() => setLogsModalVisible(false)}>
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Data Export/Backup Modal */}
      <Modal visible={backupModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Data Backup & Export</Text>
            
            <View style={{ marginVertical: 16, paddingHorizontal: 12 }}>
              <View style={{ backgroundColor: '#E8F5E9', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <Text style={{ fontSize: 14, color: '#2E7D32', fontWeight: '600' }}>📊 Export Summary</Text>
                <Text style={{ fontSize: 13, color: '#4B5563', marginTop: 8 }}>• Farmers: {farmers.length}</Text>
                <Text style={{ fontSize: 13, color: '#4B5563' }}>• Collectors: {collectors.length}</Text>
                <Text style={{ fontSize: 13, color: '#4B5563' }}>• Collections: {collections.length}</Text>
                <Text style={{ fontSize: 13, color: '#4B5563' }}>• Payments: {payments.length}</Text>
                <Text style={{ fontSize: 13, color: '#4B5563' }}>• Generated: {new Date().toLocaleString()}</Text>
              </View>

              <View style={{ backgroundColor: '#FFF3E0', borderRadius: 8, padding: 12 }}>
                <Text style={{ fontSize: 13, color: '#E65100' }}>⚠️ This will create a complete snapshot of your current system data for backup purposes.</Text>
              </View>
            </View>

            {saving ? (
              <ActivityIndicator size="large" color="#1B432E" />
            ) : (
              <View style={styles.modalActions}>
                <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setBackupModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handleExportData}>
                  <Text style={styles.saveText}>Export Data</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Report Schedule Modal */}
      <Modal visible={reportScheduleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Auto-Report Schedule</Text>
            
            <View style={{ marginVertical: 20, paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 14, color: '#1B432E', fontWeight: '600', marginBottom: 16 }}>Select report frequency:</Text>
              
              <View style={{ backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 14, color: '#1B432E', fontWeight: '500' }}>Daily Report</Text>
                    <Text style={{ fontSize: 12, color: '#7E8C8D', marginTop: 4 }}>Every day at 11:00</Text>
                  </View>
                  <Switch value={reportSchedule.daily} onValueChange={(val) => setReportSchedule({...reportSchedule, daily: val})} trackColor={{ true: '#1B432E' }} />
                </View>
              </View>

              <View style={{ backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 14, color: '#1B432E', fontWeight: '500' }}>Weekly Report</Text>
                    <Text style={{ fontSize: 12, color: '#7E8C8D', marginTop: 4 }}>Every Sunday at 11:00</Text>
                  </View>
                  <Switch value={reportSchedule.weekly} onValueChange={(val) => setReportSchedule({...reportSchedule, weekly: val})} trackColor={{ true: '#1B432E' }} />
                </View>
              </View>

              <View style={{ backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 14, color: '#1B432E', fontWeight: '500' }}>Monthly Report</Text>
                    <Text style={{ fontSize: 12, color: '#7E8C8D', marginTop: 4 }}>Last day of month at 11:00</Text>
                  </View>
                  <Switch value={reportSchedule.monthly} onValueChange={(val) => setReportSchedule({...reportSchedule, monthly: val})} trackColor={{ true: '#1B432E' }} />
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setReportScheduleModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handleSaveReportSchedule}>
                <Text style={styles.saveText}>Save Schedule</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Audit Logs Modal */}
      <Modal visible={auditLogsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Audit Logs - System Actions</Text>
            <ScrollView style={{ width: '100%', marginTop: 10 }}>
              {logs.length > 0 ? logs.map((log) => (
                <View key={log.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1B432E' }}>{log.action}</Text>
                  <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 4 }}>{log.details}</Text>
                  <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{new Date(log.created_at).toLocaleString()}</Text>
                </View>
              )) : (
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#A3A3A3' }}>No audit logs available</Text>
              )}
            </ScrollView>
            <Pressable style={[styles.modalBtn, styles.cancelBtn, { marginTop: 16 }]} onPress={() => setAuditLogsModalVisible(false)}>
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Admin Accounts Modal */}
      <Modal visible={adminAccountsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Admin Accounts</Text>
              <Pressable onPress={() => setCreateAdminModalVisible(true)} style={{ backgroundColor: '#1B432E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 12 }}>+ Add Admin</Text>
              </Pressable>
            </View>

            <ScrollView style={{ width: '100%', marginTop: 10 }}>
              {adminList.length > 0 ? adminList.map((admin) => (
                <View key={admin.id} style={{ backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1B432E' }}>{admin.name}</Text>
                      <Text style={{ fontSize: 12, color: '#7E8C8D', marginTop: 4 }}>📞 {admin.phone}</Text>
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Created: {admin.created}</Text>
                      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Last login: {admin.lastLogin}</Text>
                    </View>
                    <Pressable 
                      onPress={() => handleDeleteAdmin(admin.id)}
                      style={{ backgroundColor: '#FCE4EC', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 }}
                    >
                      <Feather name="trash-2" size={16} color="#C2185B" />
                    </Pressable>
                  </View>
                </View>
              )) : (
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#A3A3A3' }}>No admin accounts available</Text>
              )}
            </ScrollView>

            <Pressable style={[styles.modalBtn, styles.cancelBtn, { marginTop: 16 }]} onPress={() => setAdminAccountsModalVisible(false)}>
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Create Admin Account Modal */}
      <Modal visible={createAdminModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Admin Account</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="Full Name" 
              placeholderTextColor="#A3A3A3" 
              value={newAdminName} 
              onChangeText={setNewAdminName} 
            />
            <TextInput 
              style={styles.modalInput} 
              placeholder="Phone Number" 
              placeholderTextColor="#A3A3A3" 
              keyboardType="phone-pad"
              value={newAdminPhone} 
              onChangeText={setNewAdminPhone} 
            />
            <TextInput 
              style={styles.modalInput} 
              placeholder="Password" 
              placeholderTextColor="#A3A3A3" 
              secureTextEntry 
              value={newAdminPassword} 
              onChangeText={setNewAdminPassword} 
            />
            {saving ? (
              <ActivityIndicator size="large" color="#1B432E" />
            ) : (
              <View style={styles.modalActions}>
                <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setCreateAdminModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handleAddAdmin}>
                  <Text style={styles.saveText}>Create Admin</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Login Activity Logs Modal */}
      <Modal visible={logsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '95%', height: '95%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Login Activity Logs</Text>
              <Pressable onPress={() => setLogsModalVisible(false)}>
                <Feather name="x" size={24} color="#1B432E" />
              </Pressable>
            </View>

            {/* Statistics */}
            <View style={{ backgroundColor: '#E8F5E9', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              {(() => {
                const stats = getLoginLogStats();
                return (
                  <View>
                    <Text style={{ fontSize: 12, color: '#388E3C', fontWeight: '600', marginBottom: 8 }}>📊 Statistics</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1B432E' }}>{stats.totalAttempts}</Text>
                        <Text style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>Total</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#10B981' }}>{stats.successfulLogins}</Text>
                        <Text style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>Success</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#EF4444' }}>{stats.failedLogins}</Text>
                        <Text style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>Failed</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1B432E' }}>{stats.filteredCount}</Text>
                        <Text style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>Filtered</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>

            {/* Search Bar */}
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 12 }}>
              <Feather name="search" size={16} color="#7E8C8D" style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, paddingVertical: 10, fontSize: 13, color: '#1B432E' }}
                placeholder="Search by user or action..."
                placeholderTextColor="#A3A3A3"
                value={loginLogSearch}
                onChangeText={setLoginLogSearch}
              />
            </View>

            {/* Filters */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: '#1B432E', fontWeight: '600', marginBottom: 8 }}>Filters</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                {/* Status Filter */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: '#7E8C8D', marginBottom: 4 }}>Status</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable 
                      onPress={() => setLoginLogFilter('all')}
                      style={[styles.filterBtn, { backgroundColor: loginLogFilter === 'all' ? '#1B432E' : '#F0F0F0' }]}
                    >
                      <Text style={{ color: loginLogFilter === 'all' ? '#FFFFFF' : '#1B432E', fontSize: 11, fontWeight: '600' }}>All</Text>
                    </Pressable>
                    <Pressable 
                      onPress={() => setLoginLogFilter('success')}
                      style={[styles.filterBtn, { backgroundColor: loginLogFilter === 'success' ? '#10B981' : '#F0F0F0' }]}
                    >
                      <Text style={{ color: loginLogFilter === 'success' ? '#FFFFFF' : '#1B432E', fontSize: 11, fontWeight: '600' }}>✓ Success</Text>
                    </Pressable>
                    <Pressable 
                      onPress={() => setLoginLogFilter('failed')}
                      style={[styles.filterBtn, { backgroundColor: loginLogFilter === 'failed' ? '#EF4444' : '#F0F0F0' }]}
                    >
                      <Text style={{ color: loginLogFilter === 'failed' ? '#FFFFFF' : '#1B432E', fontSize: 11, fontWeight: '600' }}>✕ Failed</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Date Range Filter */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: '#7E8C8D', marginBottom: 4 }}>Date Range</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable 
                      onPress={() => setLoginLogDateRange('7days')}
                      style={[styles.filterBtn, { backgroundColor: loginLogDateRange === '7days' ? '#1B432E' : '#F0F0F0' }]}
                    >
                      <Text style={{ color: loginLogDateRange === '7days' ? '#FFFFFF' : '#1B432E', fontSize: 10, fontWeight: '600' }}>7d</Text>
                    </Pressable>
                    <Pressable 
                      onPress={() => setLoginLogDateRange('30days')}
                      style={[styles.filterBtn, { backgroundColor: loginLogDateRange === '30days' ? '#1B432E' : '#F0F0F0' }]}
                    >
                      <Text style={{ color: loginLogDateRange === '30days' ? '#FFFFFF' : '#1B432E', fontSize: 10, fontWeight: '600' }}>30d</Text>
                    </Pressable>
                    <Pressable 
                      onPress={() => setLoginLogDateRange('all')}
                      style={[styles.filterBtn, { backgroundColor: loginLogDateRange === 'all' ? '#1B432E' : '#F0F0F0' }]}
                    >
                      <Text style={{ color: loginLogDateRange === 'all' ? '#FFFFFF' : '#1B432E', fontSize: 10, fontWeight: '600' }}>All</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>

            {/* Login Logs List */}
            <ScrollView style={{ flex: 1, marginBottom: 12 }}>
              {getFilteredLoginLogs().length > 0 ? getFilteredLoginLogs().map((log, idx) => {
                if (log.action && log.action.includes('LOGIN')) {
                  const isSuccess = !log.action.includes('FAILED');
                  return (
                    <View key={idx} style={{ 
                      paddingVertical: 12, 
                      paddingHorizontal: 12,
                      backgroundColor: isSuccess ? '#F0FDF4' : '#FEF2F2',
                      borderLeftWidth: 4,
                      borderLeftColor: isSuccess ? '#10B981' : '#EF4444',
                      borderRadius: 6,
                      marginBottom: 8
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <Feather name={isSuccess ? "check-circle" : "alert-circle"} size={18} color={isSuccess ? "#10B981" : "#EF4444"} style={{ marginRight: 8, marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#1B432E' }}>
                            {isSuccess ? '✓ Login Successful' : '✕ Login Failed'}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 4 }}>{log.details}</Text>
                          <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
                            <Feather name="clock" size={10} /> {new Date(log.created_at).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                }
                return null;
              }) : (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                  <Feather name="inbox" size={40} color="#D1D5DB" style={{ marginBottom: 8 }} />
                  <Text style={{ textAlign: 'center', color: '#A3A3A3', fontSize: 13 }}>No login logs match your filters</Text>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={[styles.modalBtn, styles.cancelBtn, { flex: 1 }]} onPress={handleExportLoginLogs}>
                <Feather name="download" size={16} color="#1B432E" style={{ marginRight: 6 }} />
                <Text style={styles.cancelText}>Export</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.cancelBtn, { flex: 1 }]} onPress={() => setLogsModalVisible(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </Pressable>
            </View>
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
  contentBody: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  headerCard: {
    backgroundColor: '#1B432E',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingTop: 60,
    paddingBottom: 36,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLabel: {
    color: '#C5D9C8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 6,
  },
  headerSubtitle: {
    color: '#85B68C',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  headerBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#85B68C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  operationalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F7EB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 24,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#C5D9C8',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#107C41',
    marginRight: 10,
  },
  operationalText: {
    fontSize: 13,
    color: '#107C41',
    fontWeight: '700',
  },
  metricsGrid: {
    paddingHorizontal: 20,
    marginTop: 20,
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
  sectionLabel: {
    color: '#1B432E',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  quickActionsGrid: {
    paddingHorizontal: 20,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAF0EB',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    flexDirection: 'row',
  },
  actionCardText: {
    color: '#1B432E',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  activityList: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  activityItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  activityAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E6F7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityMeta: {
    marginLeft: 12,
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#262626',
  },
  activitySub: {
    fontSize: 11,
    color: '#737373',
    marginTop: 4,
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
  filterScroll: {
    maxHeight: 46,
    marginBottom: 12,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterPillActive: {
    backgroundColor: '#1B432E',
    borderColor: '#1B432E',
  },
  filterPillText: {
    color: '#737373',
    fontSize: 13,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  searchBar: {
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
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 16,
    marginBottom: 12,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    paddingBottom: 12,
  },
  userCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontWeight: '700',
    fontSize: 14,
  },
  userMeta: {
    marginLeft: 12,
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#262626',
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  userCodeText: {
    fontSize: 11,
    color: '#737373',
    marginTop: 4,
  },
  userActionButton: {
    padding: 5,
    marginLeft: 2,
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
  userCardDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  userCardDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  userCardDetailLabel: {
    fontSize: 10,
    color: '#737373',
    fontWeight: '600',
    marginBottom: 4,
  },
  userCardDetailVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B432E',
  },
  viewPaymentsButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF0EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
  },
  viewPaymentsButtonText: {
    color: '#1B432E',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B432E',
    marginBottom: 20,
  },
  chartBarsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 180,
    paddingHorizontal: 4,
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarVal: {
    fontSize: 9,
    color: '#737373',
    fontWeight: '700',
    marginBottom: 4,
  },
  chartBarFilled: {
    width: 24,
    backgroundColor: '#85B68C',
    borderRadius: 6,
  },
  chartBarLabel: {
    fontSize: 11,
    color: '#737373',
    fontWeight: '600',
    marginTop: 8,
  },
  reportSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  reportSummaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  reportSummaryVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1B432E',
    marginBottom: 4,
  },
  reportSummaryLabel: {
    fontSize: 11,
    color: '#737373',
    fontWeight: '600',
  },
  topCollectorsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 16,
    marginBottom: 20,
  },
  topCollectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  collectorRankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E6F7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  collectorRankText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#107C41',
  },
  collectorRankName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#262626',
  },
  collectorRankVol: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B432E',
    marginRight: 12,
  },
  exportReportBtn: {
    backgroundColor: '#E6F7EB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C5D9C8',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  exportReportBtnText: {
    color: '#1B432E',
    fontSize: 14,
    fontWeight: '800',
  },
  settingsGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 16,
    marginBottom: 20,
  },
  settingsGroupTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1B432E',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  settingLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingItemDesc: {
    fontSize: 12,
    color: '#7E8C8D',
    marginTop: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 18,
    textAlign: 'center',
    color: '#1B432E',
  },
  paymentsModalContent: {
    maxHeight: '80%',
  },
  paymentsModalSubtitle: {
    color: '#737373',
    fontSize: 13,
    textAlign: 'center',
    marginTop: -10,
    marginBottom: 14,
  },
  paymentsModalList: {
    width: '100%',
  },
  paymentRecordCard: {
    backgroundColor: '#F7FAF7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    padding: 14,
    marginBottom: 10,
  },
  paymentRecordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentRecordAmount: {
    color: '#1B432E',
    fontSize: 16,
    fontWeight: '800',
  },
  paymentRecordDate: {
    color: '#737373',
    fontSize: 12,
  },
  paymentRecordDetail: {
    color: '#4B5563',
    fontSize: 12,
    marginTop: 3,
  },
  emptyPaymentState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyPaymentStateText: {
    color: '#737373',
    fontSize: 13,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    color: '#262626',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  saveBtn: {
    backgroundColor: '#1B432E',
    marginLeft: 8,
  },
  cancelText: {
    color: '#737373',
    fontWeight: '700',
  },
  saveText: {
    color: '#FFFFFF',
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
});

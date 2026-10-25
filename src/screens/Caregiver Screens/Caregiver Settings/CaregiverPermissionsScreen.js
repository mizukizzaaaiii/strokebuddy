import React, { useEffect, useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Ionicons } from '@expo/vector-icons';


// ==========================================
// STORAGE
// ==========================================

const ACCOUNTS_KEY = 'strokebuddy_accounts';


// ==========================================
// DEFAULT PERMISSIONS
// ==========================================

const DEFAULT_PERMISSIONS = {
  recoveryProgress: true,
  medications: true,
  exercises: true,
  emergencyAlerts: true,
};


// ==========================================
// CAREGIVER PERMISSIONS SCREEN
// ==========================================

export default function CaregiverPermissionsScreen({
  navigation,
  route,
}) {

  // ==========================================
  // ACCOUNT INFORMATION
  // ==========================================

  const accountId =
    route?.params?.accountId || null;


  // ==========================================
  // STATE
  // ==========================================

  const [recoveryProgress, setRecoveryProgress] =
    useState(true);

  const [medications, setMedications] =
    useState(true);

  const [exercises, setExercises] =
    useState(true);

  const [emergencyAlerts, setEmergencyAlerts] =
    useState(true);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);


  // ==========================================
  // LOAD PERMISSIONS
  // ==========================================

  useEffect(() => {
    loadPermissions();
  }, [accountId]);


  const loadPermissions = async () => {

    try {

      setLoading(true);

      if (!accountId) {
        return;
      }

      const savedAccounts =
        await AsyncStorage.getItem(
          ACCOUNTS_KEY
        );

      if (!savedAccounts) {
        return;
      }

      const accounts =
        JSON.parse(savedAccounts);

      if (!Array.isArray(accounts)) {
        return;
      }


      // Find caregiver account
      const caregiver =
        accounts.find(
          (account) =>
            account.id === accountId &&
            account.role === 'caregiver'
        );


      if (!caregiver) {
        return;
      }


      const permissions = {
        ...DEFAULT_PERMISSIONS,
        ...(caregiver.permissions || {}),
      };


      setRecoveryProgress(
        permissions.recoveryProgress
      );

      setMedications(
        permissions.medications
      );

      setExercises(
        permissions.exercises
      );

      setEmergencyAlerts(
        permissions.emergencyAlerts
      );

    } catch (error) {

      console.log(
        'Load permissions error:',
        error
      );

      Alert.alert(
        'Unable to Load Permissions',
        'We could not load your saved permissions.'
      );

    } finally {

      setLoading(false);

    }

  };


  // ==========================================
  // SAVE PERMISSIONS
  // ==========================================

  const handleSave = async () => {

    if (!accountId) {

      Alert.alert(
        'Account Error',
        'Your caregiver account could not be identified. Please log in again.'
      );

      return;
    }


    try {

      setSaving(true);


      // ========================================
      // LOAD ACCOUNTS
      // ========================================

      const savedAccounts =
        await AsyncStorage.getItem(
          ACCOUNTS_KEY
        );


      if (!savedAccounts) {

        Alert.alert(
          'Account Error',
          'We could not find your account information.'
        );

        return;
      }


      const accounts =
        JSON.parse(savedAccounts);


      if (!Array.isArray(accounts)) {

        Alert.alert(
          'Account Error',
          'Your account information is invalid.'
        );

        return;
      }


      // ========================================
      // FIND CAREGIVER
      // ========================================

      const caregiver =
        accounts.find(
          (account) =>
            account.id === accountId &&
            account.role === 'caregiver'
        );


      if (!caregiver) {

        Alert.alert(
          'Account Error',
          'We could not find your caregiver account. Please log in again.'
        );

        return;
      }


      // ========================================
      // CREATE PERMISSIONS OBJECT
      // ========================================

      const updatedPermissions = {

        recoveryProgress:
          recoveryProgress === true,

        medications:
          medications === true,

        exercises:
          exercises === true,

        emergencyAlerts:
          emergencyAlerts === true,

      };


      // ========================================
      // UPDATE CAREGIVER ACCOUNT
      // ========================================

      const updatedAccounts =
        accounts.map((account) => {

          if (
            account.id === accountId &&
            account.role === 'caregiver'
          ) {

            return {
              ...account,

              permissions:
                updatedPermissions,

            };

          }

          return account;

        });


      // ========================================
      // SAVE
      // ========================================

      await AsyncStorage.setItem(
        ACCOUNTS_KEY,
        JSON.stringify(updatedAccounts)
      );


      // ========================================
      // SUCCESS
      // ========================================

      Alert.alert(
        'Permissions Updated',
        'Your caregiver access permissions have been saved.'
      );

    } catch (error) {

      console.log(
        'Save permissions error:',
        error
      );

      Alert.alert(
        'Something Went Wrong',
        'We could not save your permissions. Please try again.'
      );

    } finally {

      setSaving(false);

    }

  };


  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loading) {

    return (

      <View
        style={styles.loadingContainer}
      >

        <ActivityIndicator
          size="large"
          color="#5B6CFF"
        />

        <Text
          style={styles.loadingText}
        >
          Loading permissions...
        </Text>

      </View>

    );

  }


  // ==========================================
  // UI
  // ==========================================

  return (

    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >

      {/* ========================================
          BACK
      ======================================== */}

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        activeOpacity={0.7}
      >

        <Ionicons
          name="chevron-back"
          size={20}
          color="#5B6CFF"
        />

        <Text style={styles.backText}>
          Back
        </Text>

      </TouchableOpacity>


      {/* ========================================
          HEADER
      ======================================== */}

      <Text style={styles.title}>
        Caregiver Permissions
      </Text>

      <Text style={styles.subtitle}>
        Choose what information your caregiver can
        access from your StrokeBuddy account.
      </Text>


      {/* ========================================
          INFO
      ======================================== */}

      <View style={styles.infoCard}>

        <View style={styles.infoIcon}>

          <Ionicons
            name="shield-checkmark-outline"
            size={24}
            color="#5B6CFF"
          />

        </View>

        <View style={styles.infoContent}>

          <Text style={styles.infoTitle}>
            Your privacy matters
          </Text>

          <Text style={styles.infoText}>
            You can change these permissions at any
            time. Turning an option off prevents the
            caregiver from accessing that category
            of information.
          </Text>

        </View>

      </View>


      {/* ========================================
          SECTION
      ======================================== */}

      <Text style={styles.sectionTitle}>
        Information Access
      </Text>


      {/* ========================================
          RECOVERY PROGRESS
      ======================================== */}

      <PermissionRow
        icon="trending-up-outline"
        title="Recovery Progress"
        description="Allow your caregiver to view your exercise progress, completed sessions, and recovery streak."
        value={recoveryProgress}
        onToggle={() =>
          setRecoveryProgress(
            (previous) => !previous
          )
        }
      />


      {/* ========================================
          MEDICATIONS
      ======================================== */}

      <PermissionRow
        icon="medical-outline"
        title="Medications"
        description="Allow your caregiver to view your medication schedule, reminders, and medication history."
        value={medications}
        onToggle={() =>
          setMedications(
            (previous) => !previous
          )
        }
      />


      {/* ========================================
          EXERCISES
      ======================================== */}

      <PermissionRow
        icon="fitness-outline"
        title="Exercises"
        description="Allow your caregiver to view your assigned exercises, PT progress, and exercise history."
        value={exercises}
        onToggle={() =>
          setExercises(
            (previous) => !previous
          )
        }
      />


      {/* ========================================
          EMERGENCY ALERTS
      ======================================== */}

      <PermissionRow
        icon="alert-circle-outline"
        title="Emergency Alerts"
        description="Allow your caregiver to receive important emergency alerts and safety notifications."
        value={emergencyAlerts}
        onToggle={() =>
          setEmergencyAlerts(
            (previous) => !previous
          )
        }
        emergency
      />


      {/* ========================================
          PERMISSION SUMMARY
      ======================================== */}

      <Text style={styles.sectionTitle}>
        Current Access
      </Text>

      <View style={styles.summaryCard}>

        <AccessSummaryRow
          icon="trending-up-outline"
          title="Recovery Progress"
          enabled={recoveryProgress}
        />

        <AccessSummaryRow
          icon="medical-outline"
          title="Medications"
          enabled={medications}
        />

        <AccessSummaryRow
          icon="fitness-outline"
          title="Exercises"
          enabled={exercises}
        />

        <AccessSummaryRow
          icon="alert-circle-outline"
          title="Emergency Alerts"
          enabled={emergencyAlerts}
          last
        />

      </View>


      {/* ========================================
          SAVE
      ======================================== */}

      <TouchableOpacity
        style={[
          styles.saveButton,
          saving && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        activeOpacity={0.8}
        disabled={saving}
      >

        {saving ? (

          <ActivityIndicator
            size="small"
            color="#FFFFFF"
          />

        ) : (

          <>

            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color="#FFFFFF"
            />

            <Text style={styles.saveButtonText}>
              Save Permissions
            </Text>

          </>

        )}

      </TouchableOpacity>


      {/* ========================================
          SAFETY / PRIVACY NOTE
      ======================================== */}

      <View style={styles.footerNote}>

        <Ionicons
          name="lock-closed-outline"
          size={17}
          color="#777"
        />

        <Text style={styles.footerText}>
          These settings control caregiver access
          within StrokeBuddy. Emergency services
          should always be contacted directly when
          immediate medical assistance is needed.
        </Text>

      </View>

    </ScrollView>

  );

}


// ==========================================
// PERMISSION ROW
// ==========================================

function PermissionRow({
  icon,
  title,
  description,
  value,
  onToggle,
  emergency = false,
}) {

  return (

    <View
      style={[
        styles.permissionCard,
        emergency && styles.emergencyCard,
      ]}
    >

      <View style={styles.permissionIcon}>

        <Ionicons
          name={icon}
          size={21}
          color="#5B6CFF"
        />

      </View>


      <View style={styles.permissionInfo}>

        <View style={styles.permissionTitleRow}>

          <Text style={styles.permissionTitle}>
            {title}
          </Text>

          <View
            style={[
              styles.statusBadge,
              value
                ? styles.statusBadgeActive
                : styles.statusBadgeInactive,
            ]}
          >

            <Text
              style={[
                styles.statusBadgeText,
                value
                  ? styles.statusBadgeTextActive
                  : styles.statusBadgeTextInactive,
              ]}
            >
              {value ? 'ON' : 'OFF'}
            </Text>

          </View>

        </View>

        <Text
          style={styles.permissionDescription}
        >
          {description}
        </Text>

      </View>


      <TouchableOpacity
        style={[
          styles.switch,
          value && styles.switchActive,
        ]}
        onPress={onToggle}
        activeOpacity={0.8}
        accessibilityRole="switch"
        accessibilityState={{
          checked: value,
        }}
        accessibilityLabel={`${title} permission`}
      >

        <View
          style={[
            styles.switchCircle,
            value && styles.switchCircleActive,
          ]}
        />

      </TouchableOpacity>

    </View>

  );

}


// ==========================================
// ACCESS SUMMARY ROW
// ==========================================

function AccessSummaryRow({
  icon,
  title,
  enabled,
  last = false,
}) {

  return (

    <View
      style={[
        styles.summaryRow,
        !last && styles.summaryRowBorder,
      ]}
    >

      <View style={styles.summaryIcon}>

        <Ionicons
          name={icon}
          size={18}
          color={
            enabled
              ? '#5B6CFF'
              : '#9CA3AF'
          }
        />

      </View>

      <Text style={styles.summaryTitle}>
        {title}
      </Text>

      <View
        style={[
          styles.summaryStatus,
          enabled
            ? styles.summaryStatusOn
            : styles.summaryStatusOff,
        ]}
      >

        <Ionicons
          name={
            enabled
              ? 'checkmark'
              : 'close'
          }
          size={13}
          color={
            enabled
              ? '#4F46E5'
              : '#9CA3AF'
          }
        />

        <Text
          style={[
            styles.summaryStatusText,
            enabled
              ? styles.summaryStatusTextOn
              : styles.summaryStatusTextOff,
          ]}
        >
          {enabled
            ? 'Allowed'
            : 'Hidden'}
        </Text>

      </View>

    </View>

  );

}


// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },

  content: {
    padding: 24,
    paddingTop: 55,
    paddingBottom: 50,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    fontSize: 12,
    color: '#777',
    marginTop: 10,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 24,
  },

  backText: {
    color: '#5B6CFF',
    fontSize: 16,
    fontWeight: '600',
  },

  title: {
    fontSize: 27,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },

  infoCard: {
    backgroundColor: '#EEF0FF',
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
  },

  infoIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3730A3',
    marginBottom: 3,
  },

  infoText: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 17,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },

  permissionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  emergencyCard: {
    borderColor: '#F1D7D4',
  },

  permissionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  permissionInfo: {
    flex: 1,
    paddingRight: 7,
  },

  permissionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },

  permissionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    flexShrink: 1,
  },

  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },

  statusBadgeActive: {
    backgroundColor: '#EEF0FF',
  },

  statusBadgeInactive: {
    backgroundColor: '#F3F4F6',
  },

  statusBadgeText: {
    fontSize: 7,
    fontWeight: '800',
  },

  statusBadgeTextActive: {
    color: '#4F46E5',
  },

  statusBadgeTextInactive: {
    color: '#9CA3AF',
  },

  permissionDescription: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
  },

  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D1D5DB',
    padding: 3,
    justifyContent: 'center',
  },

  switchActive: {
    backgroundColor: '#6366F1',
  },

  switchCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },

  switchCircleActive: {
    alignSelf: 'flex-end',
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 18,
  },

  summaryRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
  },

  summaryRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },

  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  summaryTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },

  summaryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },

  summaryStatusOn: {
    backgroundColor: '#EEF0FF',
  },

  summaryStatusOff: {
    backgroundColor: '#F3F4F6',
  },

  summaryStatusText: {
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 3,
  },

  summaryStatusTextOn: {
    color: '#4F46E5',
  },

  summaryStatusTextOff: {
    color: '#9CA3AF',
  },

  saveButton: {
    backgroundColor: '#818CF8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },

  saveButtonDisabled: {
    opacity: 0.7,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 7,
  },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 5,
    marginTop: 22,
  },

  footerText: {
    flex: 1,
    color: '#777',
    fontSize: 10,
    lineHeight: 16,
    marginLeft: 7,
  },

});
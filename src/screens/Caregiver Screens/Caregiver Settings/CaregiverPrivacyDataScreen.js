import React, {
  useState,
} from 'react';

import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  getCaregiverSettingsKey,
  resetCaregiverSettings,
} from './CaregiverSettingsStorage';


// ==========================================
// SCREEN
// ==========================================

export default function CaregiverPrivacyDataScreen({
  navigation,
  route,
}) {

  const {
    accountId,
  } = route?.params || {};

  const [clearing, setClearing] =
    useState(false);

  const [message, setMessage] =
    useState('');


  // ==========================================
  // CLEAR LOCAL CAREGIVER DATA
  // ==========================================

  const handleClearLocalData = () => {

    Alert.alert(
      'Clear Caregiver Data?',
      'This will clear caregiver-local preferences and temporary caregiver data stored on this device. Your caregiver account, patient connection, and patient data will not be deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: clearLocalData,
        },
      ]
    );

  };


  const clearLocalData = async () => {

    try {

      setClearing(true);

      setMessage(
        'Clearing caregiver-local data...'
      );


      const settingsKey =
        getCaregiverSettingsKey(
          accountId
        );


      // Remove only caregiver preference data.
      // Do NOT remove strokebuddy_accounts.
      await AsyncStorage.removeItem(
        settingsKey
      );


      // Restore defaults.
      await resetCaregiverSettings(
        accountId
      );


      setMessage(
        'Caregiver-local data was cleared successfully.'
      );

      Alert.alert(
        'Data Cleared',
        'Your caregiver-local preferences were cleared and restored to their default values. Your account and patient connection were preserved.'
      );

    } catch (error) {

      console.log(
        'Clear caregiver data error:',
        error
      );

      setMessage(
        'We could not clear the caregiver-local data.'
      );

      Alert.alert(
        'Unable to Clear Data',
        'Something went wrong while clearing caregiver-local data. Your account and patient connection were not intentionally changed.'
      );

    } finally {

      setClearing(false);

    }

  };


  return (

    <SafeAreaView style={styles.safeArea}>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.header}>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              navigation.goBack()
            }
            activeOpacity={0.8}
          >

            <Ionicons
              name="arrow-back"
              size={22}
              color="#111827"
            />

          </TouchableOpacity>

          <View style={styles.headerText}>

            <Text style={styles.title}>
              Privacy & Data
            </Text>

            <Text style={styles.subtitle}>
              Understand and manage caregiver-local data.
            </Text>

          </View>

        </View>


        <View style={styles.infoCard}>

          <View style={styles.infoIcon}>

            <Ionicons
              name="shield-checkmark-outline"
              size={25}
              color="#6366F1"
            />

          </View>

          <View style={styles.infoContent}>

            <Text style={styles.infoTitle}>
              Your account stays protected
            </Text>

            <Text style={styles.infoText}>
              Privacy controls here apply to your
              caregiver account and local caregiver
              preferences. They do not delete your
              account or disconnect your patient.
            </Text>

          </View>

        </View>


        <Text style={styles.sectionTitle}>
          Patient Data
        </Text>


        <View style={styles.card}>

          <View style={styles.iconCircle}>

            <Ionicons
              name="people-outline"
              size={23}
              color="#6366F1"
            />

          </View>

          <View style={styles.cardText}>

            <Text style={styles.cardTitle}>
              Patient information
            </Text>

            <Text style={styles.cardDescription}>
              Patient information is shared according
              to the patient's caregiver permissions.
              Your caregiver settings cannot override
              those permissions.
            </Text>

          </View>

        </View>


        <Text style={styles.sectionTitle}>
          Local Caregiver Data
        </Text>


        <View style={styles.card}>

          <View style={styles.iconCircle}>

            <Ionicons
              name="phone-portrait-outline"
              size={23}
              color="#6366F1"
            />

          </View>

          <View style={styles.cardText}>

            <Text style={styles.cardTitle}>
              Caregiver preferences
            </Text>

            <Text style={styles.cardDescription}>
              Notification, accessibility, caregiver
              experience, and other caregiver-local
              preferences are stored on this device
              for your caregiver account.
            </Text>

          </View>

        </View>


        <Text style={styles.sectionTitle}>
          Clear Local Data
        </Text>


        <TouchableOpacity
          style={[
            styles.clearButton,
            clearing &&
              styles.clearButtonDisabled,
          ]}
          onPress={handleClearLocalData}
          disabled={clearing}
          activeOpacity={0.8}
        >

          {clearing ? (

            <ActivityIndicator
              size="small"
              color="#B91C1C"
            />

          ) : (

            <Ionicons
              name="trash-outline"
              size={20}
              color="#B91C1C"
            />

          )}

          <Text style={styles.clearText}>
            {clearing
              ? 'Clearing...'
              : 'Clear Caregiver-Local Data'}
          </Text>

        </TouchableOpacity>


        {!!message && (

          <View style={styles.statusCard}>

            <Ionicons
              name="checkmark-circle-outline"
              size={19}
              color="#4F46E5"
            />

            <Text style={styles.statusText}>
              {message}
            </Text>

          </View>

        )}


        <View style={styles.footerNote}>

          <Ionicons
            name="lock-closed-outline"
            size={17}
            color="#6B7280"
          />

          <Text style={styles.footerText}>
            This action does not delete the account
            record, patient connection, or patient
            data.
          </Text>

        </View>

      </ScrollView>

    </SafeAreaView>

  );

}


// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  content: {
    padding: 20,
    paddingBottom: 45,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: '#111827',
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    marginTop: 3,
  },

  infoCard: {
    backgroundColor: '#EEF0FF',
    borderRadius: 20,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },

  infoIcon: {
    marginRight: 11,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3730A3',
    marginBottom: 4,
  },

  infoText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#4B5563',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  cardText: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },

  cardDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: '#6B7280',
  },

  clearButton: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F1D6D6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  clearButtonDisabled: {
    opacity: 0.65,
  },

  clearText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B91C1C',
    marginLeft: 7,
  },

  statusCard: {
    marginTop: 12,
    backgroundColor: '#EEF0FF',
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  statusText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: '#4B5563',
    marginLeft: 7,
  },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    paddingHorizontal: 4,
  },

  footerText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 16,
    color: '#6B7280',
    marginLeft: 7,
  },

});
import React, {
  useEffect,
  useState,
} from 'react';

import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  loadCaregiverAccount,
} from './CaregiverSettingsStorage';


// ==========================================
// ACCOUNT SCREEN
// ==========================================

export default function CaregiverAccountScreen({
  navigation,
  route,
}) {

  const {
    name,
    email,
    accountId,
  } = route?.params || {};

  const [account, setAccount] =
    useState(null);

  const [loading, setLoading] =
    useState(true);


  useEffect(() => {

    loadAccount();

  }, [accountId]);


  const loadAccount = async () => {

    try {

      setLoading(true);

      const loaded =
        await loadCaregiverAccount(
          accountId
        );

      setAccount(loaded);

    } catch (error) {

      console.log(
        'Account screen load error:',
        error
      );

    } finally {

      setLoading(false);

    }

  };


  const displayName =
    account?.name ||
    name ||
    'Caregiver';

  const displayEmail =
    account?.email ||
    email ||
    '';


  return (

    <SafeAreaView style={styles.safeArea}>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        <Header
          navigation={navigation}
          title="Account & Profile"
          subtitle="View your caregiver account information."
        />


        {loading ? (

          <View style={styles.loading}>

            <ActivityIndicator
              size="large"
              color="#6366F1"
            />

            <Text style={styles.loadingText}>
              Loading account...
            </Text>

          </View>

        ) : (

          <>

            <View style={styles.profileCard}>

              <View style={styles.avatar}>

                <Ionicons
                  name="person"
                  size={34}
                  color="#6366F1"
                />

              </View>

              <Text style={styles.name}>
                {displayName}
              </Text>

              <Text style={styles.role}>
                Caregiver Account
              </Text>

            </View>


            <Text style={styles.sectionTitle}>
              Account Information
            </Text>

            <InfoRow
              icon="person-outline"
              label="Name"
              value={displayName}
            />

            <InfoRow
              icon="mail-outline"
              label="Email"
              value={
                displayEmail || 'Not provided'
              }
            />

            <InfoRow
              icon="shield-checkmark-outline"
              label="Role"
              value="Caregiver"
            />

            <InfoRow
              icon="key-outline"
              label="Account ID"
              value={
                accountId || 'Unavailable'
              }
              last
            />


            <View style={styles.infoCard}>

              <View style={styles.infoIcon}>

                <Ionicons
                  name="information-circle-outline"
                  size={23}
                  color="#6366F1"
                />

              </View>

              <Text style={styles.infoText}>
                Your caregiver settings are saved
                specifically to this account. Your
                preferences will remain associated
                with your account when you return
                to StrokeBuddy.
              </Text>

            </View>

          </>

        )}

      </ScrollView>

    </SafeAreaView>

  );

}


// ==========================================
// HEADER
// ==========================================

function Header({
  navigation,
  title,
  subtitle,
}) {

  return (

    <View style={styles.header}>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() =>
          navigation.goBack()
        }
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >

        <Ionicons
          name="arrow-back"
          size={22}
          color="#111827"
        />

      </TouchableOpacity>

      <View style={styles.headerText}>

        <Text style={styles.title}>
          {title}
        </Text>

        <Text style={styles.subtitle}>
          {subtitle}
        </Text>

      </View>

    </View>

  );

}


// ==========================================
// INFO ROW
// ==========================================

function InfoRow({
  icon,
  label,
  value,
  last = false,
}) {

  return (

    <View
      style={[
        styles.infoRow,
        !last && styles.infoRowBorder,
      ]}
    >

      <View style={styles.rowIcon}>

        <Ionicons
          name={icon}
          size={20}
          color="#6366F1"
        />

      </View>

      <View style={styles.rowContent}>

        <Text style={styles.rowLabel}>
          {label}
        </Text>

        <Text style={styles.rowValue}>
          {value}
        </Text>

      </View>

    </View>

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
    paddingTop: 1,
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

  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
  },

  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 10,
  },

  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    padding: 25,
    marginBottom: 24,
  },

  avatar: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },

  role: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },

  infoRow: {
    backgroundColor: '#FFFFFF',
    minHeight: 67,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },

  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },

  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  rowContent: {
    flex: 1,
  },

  rowLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },

  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  infoCard: {
    marginTop: 20,
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  infoIcon: {
    marginRight: 10,
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#4B5563',
  },

});
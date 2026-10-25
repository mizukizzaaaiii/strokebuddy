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
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  loadCaregiverSettings,
  updateCaregiverSetting,
} from './CaregiverSettingsStorage';


// ==========================================
// SCREEN
// ==========================================

export default function CaregiverNotificationsScreen({
  navigation,
  route,
}) {

  const {
    accountId,
  } = route?.params || {};

  const [settings, setSettings] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(null);


  useEffect(() => {

    loadSettings();

  }, [accountId]);


  const loadSettings = async () => {

    try {

      setLoading(true);

      const loaded =
        await loadCaregiverSettings(
          accountId
        );

      setSettings(loaded);

    } catch (error) {

      Alert.alert(
        'Unable to Load Settings',
        'We could not load your notification preferences.'
      );

    } finally {

      setLoading(false);

    }

  };


  const toggle = async (
    setting
  ) => {

    if (!settings) {
      return;
    }

    const next =
      !settings[setting];

    setSettings({
      ...settings,
      [setting]: next,
    });

    setSaving(setting);

    try {

      await updateCaregiverSetting(
        accountId,
        setting,
        next
      );

    } catch (error) {

      setSettings({
        ...settings,
      });

      Alert.alert(
        'Unable to Save',
        'Your notification preference could not be saved.'
      );

    } finally {

      setSaving(null);

    }

  };


  return (

    <SafeAreaView style={styles.safeArea}>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        <Header
          navigation={navigation}
          title="Notifications & Alerts"
          subtitle="Choose which caregiver notifications you receive."
        />


        {loading || !settings ? (

          <View style={styles.loading}>

            <ActivityIndicator
              size="large"
              color="#6366F1"
            />

            <Text style={styles.loadingText}>
              Loading notifications...
            </Text>

          </View>

        ) : (

          <>

            <View style={styles.infoCard}>

              <View style={styles.infoIcon}>

                <Ionicons
                  name="notifications-outline"
                  size={24}
                  color="#6366F1"
                />

              </View>

              <Text style={styles.infoText}>
                These switches control notifications
                for your caregiver account. They do
                not change what information the
                patient has chosen to share.
              </Text>

            </View>


            <Text style={styles.sectionTitle}>
              General Notifications
            </Text>

            <SettingCard
              icon="notifications-outline"
              title="Caregiver Notifications"
              description="Allow StrokeBuddy to send notifications to your caregiver account."
              value={settings.notificationsEnabled}
              saving={
                saving ===
                'notificationsEnabled'
              }
              onToggle={() =>
                toggle(
                  'notificationsEnabled'
                )
              }
            />


            <Text style={styles.sectionTitle}>
              Patient Activity Alerts
            </Text>

            <SettingCard
              icon="medical-outline"
              title="Medication Alerts"
              description="Receive alerts related to important medication activity."
              value={settings.medicationAlerts}
              saving={
                saving ===
                'medicationAlerts'
              }
              onToggle={() =>
                toggle(
                  'medicationAlerts'
                )
              }
            />

            <SettingCard
              icon="fitness-outline"
              title="Exercise Alerts"
              description="Receive alerts related to exercise and recovery activity."
              value={settings.exerciseAlerts}
              saving={
                saving ===
                'exerciseAlerts'
              }
              onToggle={() =>
                toggle(
                  'exerciseAlerts'
                )
              }
            />

            <SettingCard
              icon="chatbubble-outline"
              title="Message Alerts"
              description="Receive notifications when the patient sends you a message."
              value={settings.messageAlerts}
              saving={
                saving ===
                'messageAlerts'
              }
              onToggle={() =>
                toggle(
                  'messageAlerts'
                )
              }
            />

            <SettingCard
              icon="alert-circle-outline"
              title="Emergency Alerts"
              description="Receive important emergency and safety notifications."
              value={settings.emergencyAlerts}
              saving={
                saving ===
                'emergencyAlerts'
              }
              onToggle={() =>
                toggle(
                  'emergencyAlerts'
                )
              }
              emergency
            />


            <View style={styles.footerNote}>

              <Ionicons
                name="information-circle-outline"
                size={17}
                color="#6B7280"
              />

              <Text style={styles.footerText}>
                Emergency notifications should not
                replace contacting emergency services
                when immediate help is needed.
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
// SETTING CARD
// ==========================================

function SettingCard({
  icon,
  title,
  description,
  value,
  onToggle,
  saving,
  emergency = false,
}) {

  return (

    <View
      style={[
        styles.settingCard,
        emergency &&
          styles.emergencyCard,
      ]}
    >

      <View style={styles.iconCircle}>

        <Ionicons
          name={icon}
          size={22}
          color="#6366F1"
        />

      </View>

      <View style={styles.settingInfo}>

        <Text style={styles.settingTitle}>
          {title}
        </Text>

        <Text style={styles.settingDescription}>
          {description}
        </Text>

      </View>

      {saving ? (

        <ActivityIndicator
          size="small"
          color="#6366F1"
        />

      ) : (

        <Switch
          value={value === true}
          onValueChange={onToggle}
          trackColor={{
            false: '#D1D5DB',
            true: '#A5B4FC',
          }}
          thumbColor={
            value
              ? '#6366F1'
              : '#F9FAFB'
          }
          accessibilityRole="switch"
          accessibilityState={{
            checked: value === true,
          }}
          accessibilityLabel={title}
        />

      )}

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
    paddingVertical: 70,
  },

  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 10,
  },

  infoCard: {
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
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

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },

  settingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  emergencyCard: {
    borderColor: '#F1D6D6',
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

  settingInfo: {
    flex: 1,
    paddingRight: 8,
  },

  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 3,
  },

  settingDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: '#6B7280',
  },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
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
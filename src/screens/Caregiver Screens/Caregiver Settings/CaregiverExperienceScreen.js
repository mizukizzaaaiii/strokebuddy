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

export default function CaregiverExperienceScreen({
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

      const loaded =
        await loadCaregiverSettings(
          accountId
        );

      setSettings(loaded);

    } catch (error) {

      Alert.alert(
        'Unable to Load Settings',
        'We could not load your caregiver experience preferences.'
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

    const previous = {
      ...settings,
    };

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

      setSettings(previous);

      Alert.alert(
        'Unable to Save',
        'This preference could not be saved.'
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
          title="Caregiver Experience"
          subtitle="Customize how StrokeBuddy keeps you informed."
        />


        {loading || !settings ? (

          <View style={styles.loading}>

            <ActivityIndicator
              size="large"
              color="#6366F1"
            />

            <Text style={styles.loadingText}>
              Loading preferences...
            </Text>

          </View>

        ) : (

          <>

            <View style={styles.infoCard}>

              <Ionicons
                name="heart-outline"
                size={24}
                color="#6366F1"
              />

              <Text style={styles.infoText}>
                These preferences control your
                caregiver experience. Patient privacy
                and sharing permissions remain under
                the patient's control.
              </Text>

            </View>


            <Text style={styles.sectionTitle}>
              Sound
            </Text>

            <ExperienceRow
              icon="volume-high-outline"
              title="Caregiver Sound"
              description="Allow caregiver-specific sounds and audio cues when supported."
              value={settings.caregiverSound}
              saving={
                saving ===
                'caregiverSound'
              }
              onToggle={() =>
                toggle(
                  'caregiverSound'
                )
              }
            />


            <Text style={styles.sectionTitle}>
              Recovery
            </Text>

            <ExperienceRow
              icon="trending-up-outline"
              title="Recovery Updates"
              description="Show recovery progress updates when patient activity is available."
              value={settings.recoveryUpdates}
              saving={
                saving ===
                'recoveryUpdates'
              }
              onToggle={() =>
                toggle(
                  'recoveryUpdates'
                )
              }
            />

            <ExperienceRow
              icon="fitness-outline"
              title="Exercise Activity"
              description="Show exercise and physical therapy activity when permitted."
              value={settings.exerciseActivity}
              saving={
                saving ===
                'exerciseActivity'
              }
              onToggle={() =>
                toggle(
                  'exerciseActivity'
                )
              }
            />


            <Text style={styles.sectionTitle}>
              Medications & Messages
            </Text>

            <ExperienceRow
              icon="medical-outline"
              title="Medication Activity"
              description="Show medication activity when medication access is permitted."
              value={settings.medicationActivity}
              saving={
                saving ===
                'medicationActivity'
              }
              onToggle={() =>
                toggle(
                  'medicationActivity'
                )
              }
            />

            <ExperienceRow
              icon="chatbubble-outline"
              title="Patient Messages"
              description="Show patient messages and messaging activity in caregiver areas."
              value={settings.patientMessages}
              saving={
                saving ===
                'patientMessages'
              }
              onToggle={() =>
                toggle(
                  'patientMessages'
                )
              }
            />


            <View style={styles.noteCard}>

              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color="#6366F1"
              />

              <Text style={styles.noteText}>
                A caregiver preference can control
                what you see, but it cannot override a
                patient's privacy or caregiver-access
                permissions.
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
// EXPERIENCE ROW
// ==========================================

function ExperienceRow({
  icon,
  title,
  description,
  value,
  onToggle,
  saving,
}) {

  return (

    <View style={styles.settingCard}>

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

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#4B5563',
    marginLeft: 10,
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

  noteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 15,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  noteText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 16,
    color: '#6B7280',
    marginLeft: 9,
  },

});
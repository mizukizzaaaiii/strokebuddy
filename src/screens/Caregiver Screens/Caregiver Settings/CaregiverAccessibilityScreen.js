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

export default function CaregiverAccessibilityScreen({
  navigation,
  route,
}) {

  const {
    accountId,
  } = route?.params || {};

  const [largeText, setLargeText] =
    useState(false);

  const [highContrast, setHighContrast] =
    useState(false);

  const [loading, setLoading] =
    useState(true);


  useEffect(() => {

    loadSettings();

  }, [accountId]);


  const loadSettings = async () => {

    try {

      const settings =
        await loadCaregiverSettings(
          accountId
        );

      setLargeText(
        settings.largeText === true
      );

      setHighContrast(
        settings.highContrast === true
      );

    } catch (error) {

      Alert.alert(
        'Unable to Load Settings',
        'We could not load your accessibility preferences.'
      );

    } finally {

      setLoading(false);

    }

  };


  const toggleLargeText = async (
    value
  ) => {

    setLargeText(value);

    await updateCaregiverSetting(
      accountId,
      'largeText',
      value
    );

  };


  const toggleHighContrast = async (
    value
  ) => {

    setHighContrast(value);

    await updateCaregiverSetting(
      accountId,
      'highContrast',
      value
    );

  };


  const backgroundColor =
    highContrast
      ? '#FFFFFF'
      : '#FAF8F5';

  const textColor =
    highContrast
      ? '#000000'
      : '#111827';

  const secondaryColor =
    highContrast
      ? '#222222'
      : '#6B7280';


  return (

    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor,
        },
      ]}
    >

      <ScrollView
        style={[
          styles.container,
          {
            backgroundColor,
          },
        ]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.header}>

          <TouchableOpacity
            style={[
              styles.backButton,
              highContrast &&
                styles.highContrastBorder,
            ]}
            onPress={() =>
              navigation.goBack()
            }
            activeOpacity={0.8}
          >

            <Ionicons
              name="arrow-back"
              size={22}
              color={
                highContrast
                  ? '#000000'
                  : '#111827'
              }
            />

          </TouchableOpacity>

          <View style={styles.headerText}>

            <Text
              style={[
                styles.title,
                {
                  color: textColor,
                  fontSize:
                    largeText
                      ? 31
                      : 26,
                },
              ]}
            >
              Accessibility
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: secondaryColor,
                  fontSize:
                    largeText
                      ? 16
                      : 13,
                },
              ]}
            >
              Make StrokeBuddy easier and more comfortable to use.
            </Text>

          </View>

        </View>


        <View
          style={[
            styles.previewCard,
            highContrast &&
              styles.highContrastCard,
          ]}
        >

          <View style={styles.previewIcon}>

            <Ionicons
              name="accessibility-outline"
              size={27}
              color="#6366F1"
            />

          </View>

          <Text
            style={[
              styles.previewTitle,
              {
                color: textColor,
                fontSize:
                  largeText
                    ? 20
                    : 17,
              },
            ]}
          >
            Accessibility Preview
          </Text>

          <Text
            style={[
              styles.previewText,
              {
                color: secondaryColor,
                fontSize:
                  largeText
                    ? 16
                    : 13,
              },
            ]}
          >
            This preview demonstrates how text
            appears when accessibility options are
            enabled.
          </Text>

        </View>


        <Text
          style={[
            styles.sectionTitle,
            {
              color: textColor,
              fontSize:
                largeText
                  ? 21
                  : 18,
            },
          ]}
        >
          Display
        </Text>


        <AccessibilityRow
          icon="text-outline"
          title="Larger Text"
          description="Increase text size throughout caregiver screens that support this preference."
          value={largeText}
          onToggle={toggleLargeText}
          largeText={largeText}
          highContrast={highContrast}
          textColor={textColor}
          secondaryColor={secondaryColor}
        />


        <AccessibilityRow
          icon="contrast-outline"
          title="High Contrast"
          description="Increase contrast between backgrounds, text, borders, and controls."
          value={highContrast}
          onToggle={toggleHighContrast}
          largeText={largeText}
          highContrast={highContrast}
          textColor={textColor}
          secondaryColor={secondaryColor}
        />


        <View
          style={[
            styles.infoCard,
            highContrast &&
              styles.highContrastCard,
          ]}
        >

          <Ionicons
            name="information-circle-outline"
            size={22}
            color={
              highContrast
                ? '#000000'
                : '#6366F1'
            }
          />

          <Text
            style={[
              styles.infoText,
              {
                color: textColor,
                fontSize:
                  largeText
                    ? 13
                    : 11,
              },
            ]}
          >
            Accessibility preferences are saved to
            your caregiver account and are separate
            from the patient's accessibility settings.
          </Text>

        </View>

      </ScrollView>

    </SafeAreaView>

  );

}


// ==========================================
// ACCESSIBILITY ROW
// ==========================================

function AccessibilityRow({
  icon,
  title,
  description,
  value,
  onToggle,
  largeText,
  highContrast,
  textColor,
  secondaryColor,
}) {

  return (

    <View
      style={[
        styles.settingCard,
        highContrast &&
          styles.highContrastCard,
      ]}
    >

      <View
        style={[
          styles.iconCircle,
          highContrast &&
            styles.highContrastIcon,
        ]}
      >

        <Ionicons
          name={icon}
          size={23}
          color={
            highContrast
              ? '#000000'
              : '#6366F1'
          }
        />

      </View>

      <View style={styles.settingInfo}>

        <Text
          style={[
            styles.settingTitle,
            {
              color: textColor,
              fontSize:
                largeText
                  ? 17
                  : 14,
            },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.settingDescription,
            {
              color: secondaryColor,
              fontSize:
                largeText
                  ? 13
                  : 11,
            },
          ]}
        >
          {description}
        </Text>

      </View>

      <Switch
        value={value}
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
          checked: value,
        }}
        accessibilityLabel={title}
      />

    </View>

  );

}


// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
  },

  container: {
    flex: 1,
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

  highContrastBorder: {
    borderColor: '#000000',
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontWeight: '700',
    lineHeight: 32,
  },

  subtitle: {
    lineHeight: 19,
    marginTop: 3,
  },

  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    marginBottom: 24,
  },

  highContrastCard: {
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },

  previewIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  previewTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },

  previewText: {
    lineHeight: 20,
  },

  sectionTitle: {
    fontWeight: '700',
    marginBottom: 10,
  },

  settingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  highContrastIcon: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
  },

  settingInfo: {
    flex: 1,
    paddingRight: 8,
  },

  settingTitle: {
    fontWeight: '700',
    marginBottom: 3,
  },

  settingDescription: {
    lineHeight: 17,
  },

  infoCard: {
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 15,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  infoText: {
    flex: 1,
    lineHeight: 18,
    marginLeft: 9,
  },

});
import React from 'react';

import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useAccessibility,
} from '../../context/AccessibilityContext';


export default function AccessibilityScreen({ navigation }) {
  const {
    largeText,
    highContrast,
    setLargeText,
    setHighContrast,
  } = useAccessibility();


  const font = (normal, large) =>
    largeText ? large : normal;


  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        highContrast && styles.highContrastBackground,
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* HEADER */}

        <View style={styles.header}>
          <TouchableOpacity
            style={[
              styles.backButton,
              highContrast && styles.highContrastBorder,
            ]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={highContrast ? '#000000' : '#111827'}
            />
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text
              style={[
                styles.title,
                {
                  fontSize: font(26, 32),
                  color: highContrast ? '#000000' : '#111827',
                },
              ]}
            >
              Accessibility
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  fontSize: font(14, 18),
                  lineHeight: font(20, 26),
                  color: highContrast ? '#000000' : '#6B7280',
                },
              ]}
            >
              Make StrokeBuddy easier and more comfortable to use.
            </Text>
          </View>
        </View>


        {/* TEXT SIZE */}

        <View
          style={[
            styles.card,
            highContrast && styles.highContrastCard,
          ]}
        >
          <View style={styles.settingRow}>

            <View
              style={[
                styles.iconCircle,
                highContrast && styles.highContrastIconCircle,
              ]}
            >
              <Ionicons
                name="text-outline"
                size={25}
                color={highContrast ? '#000000' : '#5B6CFF'}
              />
            </View>

            <View style={styles.settingText}>
              <Text
                style={[
                  styles.settingTitle,
                  {
                    fontSize: font(17, 21),
                    color: highContrast ? '#000000' : '#111827',
                  },
                ]}
              >
                Large Text
              </Text>

              <Text
                style={[
                  styles.settingDescription,
                  {
                    fontSize: font(13, 17),
                    lineHeight: font(19, 24),
                    color: highContrast ? '#000000' : '#6B7280',
                  },
                ]}
              >
                Increase text size throughout the patient app.
              </Text>
            </View>

            <Switch
              value={largeText}
              onValueChange={setLargeText}
              trackColor={{
                false: '#D1D5DB',
                true: '#A5B4FC',
              }}
              thumbColor={
                largeText
                  ? '#5B6CFF'
                  : '#F9FAFB'
              }
            />

          </View>
        </View>


        {/* HIGH CONTRAST */}

        <View
          style={[
            styles.card,
            highContrast && styles.highContrastCard,
          ]}
        >
          <View style={styles.settingRow}>

            <View
              style={[
                styles.iconCircle,
                highContrast && styles.highContrastIconCircle,
              ]}
            >
              <Ionicons
                name="contrast-outline"
                size={25}
                color={highContrast ? '#000000' : '#5B6CFF'}
              />
            </View>

            <View style={styles.settingText}>
              <Text
                style={[
                  styles.settingTitle,
                  {
                    fontSize: font(17, 21),
                    color: highContrast ? '#000000' : '#111827',
                  },
                ]}
              >
                High Contrast
              </Text>

              <Text
                style={[
                  styles.settingDescription,
                  {
                    fontSize: font(13, 17),
                    lineHeight: font(19, 24),
                    color: highContrast ? '#000000' : '#6B7280',
                  },
                ]}
              >
                Increase contrast between text, borders, and backgrounds.
              </Text>
            </View>

            <Switch
              value={highContrast}
              onValueChange={setHighContrast}
              trackColor={{
                false: '#D1D5DB',
                true: '#A5B4FC',
              }}
              thumbColor={
                highContrast
                  ? '#5B6CFF'
                  : '#F9FAFB'
              }
            />

          </View>
        </View>


        {/* PREVIEW */}

        <Text
          style={[
            styles.sectionTitle,
            {
              fontSize: font(18, 22),
              color: highContrast ? '#000000' : '#111827',
            },
          ]}
        >
          Preview
        </Text>

        <View
          style={[
            styles.previewCard,
            highContrast && styles.highContrastPreview,
          ]}
        >
          <Text
            style={[
              styles.previewTitle,
              {
                fontSize: font(18, 23),
                color: highContrast ? '#000000' : '#111827',
              },
            ]}
          >
            Recovery Progress
          </Text>

          <Text
            style={[
              styles.previewText,
              {
                fontSize: font(14, 18),
                lineHeight: font(21, 27),
                color: highContrast ? '#000000' : '#4B5563',
              },
            ]}
          >
            Your accessibility settings are shared across the patient
            experience.
          </Text>

          <View
            style={[
              styles.previewButton,
              highContrast && styles.highContrastPreviewButton,
            ]}
          >
            <Text
              style={[
                styles.previewButtonText,
                {
                  fontSize: font(14, 18),
                },
              ]}
            >
              Continue Recovery
            </Text>
          </View>
        </View>


        {/* INFORMATION */}

        <View
          style={[
            styles.infoCard,
            highContrast && styles.highContrastInfoCard,
          ]}
        >
          <View
            style={[
              styles.infoIconCircle,
              highContrast && styles.highContrastInfoIconCircle,
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={highContrast ? '#000000' : '#5B6CFF'}
            />
          </View>

          <Text
            style={[
              styles.infoText,
              {
                fontSize: font(13, 17),
                lineHeight: font(20, 25),
                color: highContrast ? '#000000' : '#4B5563',
              },
            ]}
          >
            Accessibility settings are saved automatically and linked to
            your patient account.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  highContrastBackground: {
    backgroundColor: '#FFFFFF',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  highContrastBorder: {
    borderColor: '#000000',
    borderWidth: 2,
  },

  headerTextContainer: {
    flex: 1,
  },

  title: {
    fontWeight: '800',
    marginBottom: 5,
  },

  subtitle: {
    fontWeight: '500',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 16,
  },

  highContrastCard: {
    borderColor: '#000000',
    borderWidth: 2,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  highContrastIconCircle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  settingText: {
    flex: 1,
    paddingRight: 10,
  },

  settingTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },

  settingDescription: {
    fontWeight: '500',
  },

  sectionTitle: {
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 12,
  },

  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    marginBottom: 16,
  },

  highContrastPreview: {
    borderColor: '#000000',
    borderWidth: 2,
  },

  previewTitle: {
    fontWeight: '800',
    marginBottom: 8,
  },

  previewText: {
    fontWeight: '500',
    marginBottom: 18,
  },

  previewButton: {
    backgroundColor: '#5B6CFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  highContrastPreviewButton: {
    backgroundColor: '#000000',
  },

  previewButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },

  highContrastInfoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  infoIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  highContrastInfoIconCircle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  infoText: {
    flex: 1,
    fontWeight: '500',
  },

});
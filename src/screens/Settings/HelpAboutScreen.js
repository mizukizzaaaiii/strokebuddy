import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';

export default function HelpAboutScreen({ navigation }) {
  const [openQuestion, setOpenQuestion] = useState(null);

  const toggleQuestion = (question) => {
    setOpenQuestion(
      openQuestion === question ? null : question
    );
  };

  const openEmail = async () => {
    const emailUrl =
      'mailto:support@strokebuddy.app?subject=StrokeBuddy%20Support';

    try {
      const supported = await Linking.canOpenURL(emailUrl);

      if (supported) {
        await Linking.openURL(emailUrl);
      } else {
        Alert.alert(
          'Contact Support',
          'Your device does not have an email app available.'
        );
      }
    } catch (error) {
      console.log('Error opening email:', error);

      Alert.alert(
        'Contact Support',
        'Unable to open your email application.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.header}>Help & About</Text>

        <Text style={styles.intro}>
          Learn more about StrokeBuddy and find answers to common
          questions.
        </Text>

        <View style={styles.aboutCard}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>S</Text>
          </View>

          <Text style={styles.appName}>StrokeBuddy</Text>

          <Text style={styles.tagline}>
            Recovery support, connected care.
          </Text>

          <Text style={styles.aboutText}>
            StrokeBuddy is designed to help patients organize recovery
            activities, medications, communication, and caregiver
            support in one place.
          </Text>

          <View style={styles.versionContainer}>
            <Text style={styles.versionLabel}>App Version</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>What StrokeBuddy Does</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recovery</Text>
          <Text style={styles.cardText}>
            Track exercises, progress, goals, and recovery activity.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Medications</Text>
          <Text style={styles.cardText}>
            Keep track of medications, doses, instructions, and dose
            history.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Caregiver Support</Text>
          <Text style={styles.cardText}>
            Connect with a caregiver and use supported communication
            features.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accessibility</Text>
          <Text style={styles.cardText}>
            Customize supported accessibility and patient experience
            settings.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

        <TouchableOpacity
          style={styles.faqCard}
          onPress={() => toggleQuestion(1)}
        >
          <View style={styles.faqHeader}>
            <Text style={styles.faqQuestion}>
              How do I connect a caregiver?
            </Text>

            <Text style={styles.faqArrow}>
              {openQuestion === 1 ? '⌃' : '⌄'}
            </Text>
          </View>

          {openQuestion === 1 && (
            <Text style={styles.faqAnswer}>
              Open Settings and select Caregiver Connection. Your
              caregiver can use the connection process provided there to
              link the two accounts.
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.faqCard}
          onPress={() => toggleQuestion(2)}
        >
          <View style={styles.faqHeader}>
            <Text style={styles.faqQuestion}>
              How do I change accessibility settings?
            </Text>

            <Text style={styles.faqArrow}>
              {openQuestion === 2 ? '⌃' : '⌄'}
            </Text>
          </View>

          {openQuestion === 2 && (
            <Text style={styles.faqAnswer}>
              Go to Settings → Accessibility. Your accessibility
              preferences are saved automatically when you change them.
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.faqCard}
          onPress={() => toggleQuestion(3)}
        >
          <View style={styles.faqHeader}>
            <Text style={styles.faqQuestion}>
              Where can I see my medication history?
            </Text>

            <Text style={styles.faqArrow}>
              {openQuestion === 3 ? '⌃' : '⌄'}
            </Text>
          </View>

          {openQuestion === 3 && (
            <Text style={styles.faqAnswer}>
              Open the Medications section to view your medications and
              available dose history.
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.faqCard}
          onPress={() => toggleQuestion(4)}
        >
          <View style={styles.faqHeader}>
            <Text style={styles.faqQuestion}>
              What should I do in an emergency?
            </Text>

            <Text style={styles.faqArrow}>
              {openQuestion === 4 ? '⌃' : '⌄'}
            </Text>
          </View>

          {openQuestion === 4 && (
            <Text style={styles.faqAnswer}>
              Use the Emergency features in StrokeBuddy when appropriate.
              For a medical emergency, contact your local emergency
              services immediately.
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Need More Help?</Text>

        <TouchableOpacity
          style={styles.helpButton}
          onPress={openEmail}
        >
          <View style={styles.helpTextContainer}>
            <Text style={styles.helpTitle}>Contact StrokeBuddy Support</Text>
            <Text style={styles.helpDescription}>
              Open your email application to send a support message.
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>Important</Text>
          <Text style={styles.disclaimerText}>
            StrokeBuddy is intended to support recovery management and
            communication. It does not replace professional medical
            advice or emergency medical services.
          </Text>
        </View>

        <Text style={styles.copyright}>
          © 2026 StrokeBuddy
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  container: {
    padding: 20,
    paddingBottom: 100,
  },

  backBtn: {
    marginBottom: 10,
  },

  backText: {
    color: '#5B6CFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  header: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -0.4,
    marginBottom: 8,
  },

  intro: {
    fontSize: 14,
    color: '#777777',
    lineHeight: 20,
    marginBottom: 22,
  },

  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },

  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  logoText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#5B6CFF',
  },

  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
  },

  tagline: {
    fontSize: 13,
    color: '#5B6CFF',
    fontWeight: '600',
    marginTop: 3,
    marginBottom: 12,
  },

  aboutText: {
    fontSize: 13,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 19,
  },

  versionContainer: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    width: '100%',
    justifyContent: 'center',
    gap: 6,
  },

  versionLabel: {
    fontSize: 12,
    color: '#999999',
  },

  versionValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333333',
    marginBottom: 12,
    marginTop: 4,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 5,
  },

  cardText: {
    fontSize: 13,
    color: '#777777',
    lineHeight: 19,
  },

  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
    paddingRight: 10,
  },

  faqArrow: {
    fontSize: 20,
    color: '#777777',
  },

  faqAnswer: {
    fontSize: 13,
    color: '#777777',
    lineHeight: 19,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

  helpButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },

  helpTextContainer: {
    flex: 1,
    paddingRight: 10,
  },

  helpTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },

  helpDescription: {
    fontSize: 12,
    color: '#777777',
    lineHeight: 17,
  },

  arrow: {
    fontSize: 28,
    color: '#999999',
    fontWeight: '300',
  },

  disclaimerCard: {
    backgroundColor: '#EEF0FF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D9DCFF',
  },

  disclaimerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#333333',
    marginBottom: 5,
  },

  disclaimerText: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 18,
  },

  copyright: {
    textAlign: 'center',
    color: '#AAAAAA',
    fontSize: 11,
    marginTop: 20,
  },
});
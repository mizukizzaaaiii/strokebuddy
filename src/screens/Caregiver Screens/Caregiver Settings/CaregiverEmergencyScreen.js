import React from 'react';

import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';


// ==========================================
// SCREEN
// ==========================================

export default function CaregiverEmergencyScreen({
  navigation,
}) {

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
              Emergency Information
            </Text>

            <Text style={styles.subtitle}>
              Important information for caregiver safety and emergency situations.
            </Text>

          </View>

        </View>


        <View style={styles.warningCard}>

          <View style={styles.warningIcon}>

            <Ionicons
              name="alert-circle-outline"
              size={28}
              color="#B91C1C"
            />

          </View>

          <Text style={styles.warningTitle}>
            Emergency situations
          </Text>

          <Text style={styles.warningText}>
            StrokeBuddy caregiver features are
            designed to help you stay informed.
            They should not replace emergency
            medical services.
          </Text>

        </View>


        <Text style={styles.sectionTitle}>
          What to do
        </Text>


        <EmergencyRow
          number="1"
          title="Assess the situation"
          text="Stay with the patient when it is safe to do so and assess what is happening."
        />

        <EmergencyRow
          number="2"
          title="Contact emergency services"
          text="If the situation may be life-threatening, contact your local emergency services immediately."
        />

        <EmergencyRow
          number="3"
          title="Use StrokeBuddy alerts"
          text="Use available caregiver emergency information and alerts to help coordinate care."
        />


        <View style={styles.infoCard}>

          <Ionicons
            name="information-circle-outline"
            size={22}
            color="#6366F1"
          />

          <Text style={styles.infoText}>
            Patient emergency contacts and patient
            emergency information remain controlled
            by the patient's account and permissions.
          </Text>

        </View>

      </ScrollView>

    </SafeAreaView>

  );

}


// ==========================================
// EMERGENCY ROW
// ==========================================

function EmergencyRow({
  number,
  title,
  text,
}) {

  return (

    <View style={styles.emergencyRow}>

      <View style={styles.numberCircle}>

        <Text style={styles.numberText}>
          {number}
        </Text>

      </View>

      <View style={styles.rowContent}>

        <Text style={styles.rowTitle}>
          {title}
        </Text>

        <Text style={styles.rowText}>
          {text}
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

  warningCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1D6D6',
    padding: 18,
    marginBottom: 24,
  },

  warningIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 5,
  },

  warningText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7F1D1D',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },

  emergencyRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },

  numberCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  numberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },

  rowContent: {
    flex: 1,
  },

  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },

  rowText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#6B7280',
  },

  infoCard: {
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 15,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: '#4B5563',
    marginLeft: 9,
  },

});
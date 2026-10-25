import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';


// ==========================================
// ACCESSIBILITY CONTEXT
// ==========================================

const AccessibilityContext = createContext(null);


// ==========================================
// ACCESSIBILITY PROVIDER
// ==========================================

export function AccessibilityProvider({
  children,
  accountId,
}) {

  // ========================================
  // ACCESSIBILITY SETTINGS
  // ========================================

  const [largeText, setLargeTextState] = useState(false);

  const [highContrast, setHighContrastState] = useState(false);

  const [loaded, setLoaded] = useState(false);


  // ========================================
  // PATIENT-SPECIFIC STORAGE KEY
  // ========================================

  const storageKey =
    `strokebuddy_accessibility_settings_${
      accountId || 'default_patient'
    }`;


  // ========================================
  // LOAD SAVED SETTINGS
  // ========================================

  useEffect(() => {

    let cancelled = false;

    const loadSettings = async () => {

      try {

        setLoaded(false);

        const saved =
          await AsyncStorage.getItem(storageKey);

        if (cancelled) {
          return;
        }

        if (saved) {

          let settings = {};

          try {
            settings = JSON.parse(saved) || {};
          } catch (parseError) {

            console.log(
              'Accessibility settings JSON parse error:',
              parseError
            );

            settings = {};

          }

          setLargeTextState(
            typeof settings.largeText === 'boolean'
              ? settings.largeText
              : false
          );

          setHighContrastState(
            typeof settings.highContrast === 'boolean'
              ? settings.highContrast
              : false
          );

        } else {

          setLargeTextState(false);

          setHighContrastState(false);

        }

      } catch (error) {

        console.log(
          'Accessibility settings load error:',
          error
        );

        if (!cancelled) {

          setLargeTextState(false);

          setHighContrastState(false);

        }

      } finally {

        if (!cancelled) {
          setLoaded(true);
        }

      }

    };

    loadSettings();

    return () => {
      cancelled = true;
    };

  }, [accountId, storageKey]);


  // ==========================================
  // SAVE SETTINGS
  // ==========================================

  const saveSettings = useCallback(
    async (
      newLargeText,
      newHighContrast
    ) => {

      try {

        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({
            largeText: newLargeText,
            highContrast: newHighContrast,
          })
        );

      } catch (error) {

        console.log(
          'Accessibility settings save error:',
          error
        );

      }

    },
    [storageKey]
  );


  // ==========================================
  // LARGE TEXT
  // ==========================================

  const setLargeText = useCallback(
    async (value) => {

      const nextValue = Boolean(value);

      setLargeTextState(nextValue);

      await saveSettings(
        nextValue,
        highContrast
      );

    },
    [
      highContrast,
      saveSettings,
    ]
  );


  // ==========================================
  // HIGH CONTRAST
  // ==========================================

  const setHighContrast = useCallback(
    async (value) => {

      const nextValue = Boolean(value);

      setHighContrastState(nextValue);

      await saveSettings(
        largeText,
        nextValue
      );

    },
    [
      largeText,
      saveSettings,
    ]
  );


  // ==========================================
  // FONT SIZE HELPER
  // ==========================================

  const getFontSize = useCallback(
    (
      normalSize,
      largeSize
    ) => {

      return largeText
        ? largeSize
        : normalSize;

    },
    [largeText]
  );


  // ==========================================
  // LINE HEIGHT HELPER
  // ==========================================

  const getLineHeight = useCallback(
    (
      normalLineHeight,
      largeLineHeight
    ) => {

      return largeText
        ? largeLineHeight
        : normalLineHeight;

    },
    [largeText]
  );


  // ==========================================
  // SPACING HELPER
  // ==========================================

  const getSpacing = useCallback(
    (
      normalSpacing,
      largeSpacing
    ) => {

      return largeText
        ? largeSpacing
        : normalSpacing;

    },
    [largeText]
  );


  // ==========================================
  // TEXT COLOR HELPER
  // ==========================================

  const getTextColor = useCallback(
    (
      normalColor = '#333333',
      highContrastColor = '#000000'
    ) => {

      return highContrast
        ? highContrastColor
        : normalColor;

    },
    [highContrast]
  );


  // ==========================================
  // SECONDARY TEXT COLOR HELPER
  // ==========================================

  const getSecondaryTextColor = useCallback(
    (
      normalColor = '#6B7280',
      highContrastColor = '#1F2937'
    ) => {

      return highContrast
        ? highContrastColor
        : normalColor;

    },
    [highContrast]
  );


  // ==========================================
  // BACKGROUND COLOR HELPER
  // ==========================================

  const getBackgroundColor = useCallback(
    (
      normalColor = '#FFFFFF',
      highContrastColor = '#FFFFFF'
    ) => {

      return highContrast
        ? highContrastColor
        : normalColor;

    },
    [highContrast]
  );


  // ==========================================
  // CARD COLOR HELPER
  // ==========================================

  const getCardColor = useCallback(
    (
      normalColor = '#FFFFFF',
      highContrastColor = '#FFFFFF'
    ) => {

      return highContrast
        ? highContrastColor
        : normalColor;

    },
    [highContrast]
  );


  // ==========================================
  // BORDER COLOR HELPER
  // ==========================================

  const getBorderColor = useCallback(
    (
      normalColor = '#E5E7EB',
      highContrastColor = '#111827'
    ) => {

      return highContrast
        ? highContrastColor
        : normalColor;

    },
    [highContrast]
  );


  // ==========================================
  // BUTTON COLOR HELPER
  // ==========================================

  const getButtonColor = useCallback(
    (
      normalColor = '#6366F1',
      highContrastColor = '#000000'
    ) => {

      return highContrast
        ? highContrastColor
        : normalColor;

    },
    [highContrast]
  );


  // ==========================================
  // BUTTON TEXT COLOR HELPER
  // ==========================================

  const getButtonTextColor = useCallback(
    (
      normalColor = '#FFFFFF',
      highContrastColor = '#FFFFFF'
    ) => {

      return highContrast
        ? highContrastColor
        : normalColor;

    },
    [highContrast]
  );


  // ==========================================
  // ICON COLOR HELPER
  // ==========================================

  const getIconColor = useCallback(
    (
      normalColor = '#6366F1',
      highContrastColor = '#000000'
    ) => {

      return highContrast
        ? highContrastColor
        : normalColor;

    },
    [highContrast]
  );


  // ==========================================
  // CONTEXT VALUE
  // ==========================================

  const value = useMemo(
    () => ({

      // Current settings
      largeText,
      highContrast,
      loaded,

      // Settings controls
      setLargeText,
      setHighContrast,

      // Large Text helpers
      getFontSize,
      getLineHeight,
      getSpacing,

      // High Contrast helpers
      getTextColor,
      getSecondaryTextColor,
      getBackgroundColor,
      getCardColor,
      getBorderColor,
      getButtonColor,
      getButtonTextColor,
      getIconColor,

    }),

    [
      largeText,
      highContrast,
      loaded,

      setLargeText,
      setHighContrast,

      getFontSize,
      getLineHeight,
      getSpacing,

      getTextColor,
      getSecondaryTextColor,
      getBackgroundColor,
      getCardColor,
      getBorderColor,
      getButtonColor,
      getButtonTextColor,
      getIconColor,
    ]
  );


  // ==========================================
  // PROVIDER
  // ==========================================

  return (
    <AccessibilityContext.Provider
      value={value}
    >
      {children}
    </AccessibilityContext.Provider>
  );

}


// ==========================================
// ACCESSIBILITY HOOK
// ==========================================

export function useAccessibility() {

  const context =
    useContext(
      AccessibilityContext
    );


  if (!context) {

    throw new Error(
      'useAccessibility must be used inside AccessibilityProvider'
    );

  }


  return context;

}
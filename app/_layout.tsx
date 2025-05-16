import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { NotificationProvider } from '@/context/NotificationContext';
import MatchToast from '@/components/MatchToast';
import DebugOverlay, { addDebugLog } from '@/components/DebugOverlay';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// Root layout wrapper with auth provider
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <NotificationProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <RootLayoutNav />
            <MatchToast />
            <DebugOverlay />
            <StatusBar style="auto" />
          </GestureHandlerRootView>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Navigation component that handles auth state
function RootLayoutNav() {
  const { user, userProfile, loading, fetchCurrentUser } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Track current path
  const currentPathRef = useRef('');

  // Debug logger
  const log = {
    info: (message: string, data?: any) => {
      if (data) {
        console.log(`[NAV] 🔵 ${message}`, data);
        addDebugLog('info', `[NAV] ${message}`, data);
      } else {
        console.log(`[NAV] 🔵 ${message}`);
        addDebugLog('info', `[NAV] ${message}`);
      }
    },
    success: (message: string, data?: any) => {
      if (data) {
        console.log(`[NAV] ✅ ${message}`, data);
        addDebugLog('success', `[NAV] ${message}`, data);
      } else {
        console.log(`[NAV] ✅ ${message}`);
        addDebugLog('success', `[NAV] ${message}`);
      }
    },
    warn: (message: string, data?: any) => {
      if (data) {
        console.warn(`[NAV] ⚠️ ${message}`, data);
        addDebugLog('warn', `[NAV] ${message}`, data);
      } else {
        console.warn(`[NAV] ⚠️ ${message}`);
        addDebugLog('warn', `[NAV] ${message}`);
      }
    },
    error: (message: string, error?: any) => {
      if (error) {
        console.error(`[NAV] ❌ ${message}`, error);
        addDebugLog('error', `[NAV] ${message}`, error);
      } else {
        console.error(`[NAV] ❌ ${message}`);
        addDebugLog('error', `[NAV] ${message}`);
      }
    }
  };

  // Initialize app state on mount
  useEffect(() => {
    // Set a timeout to ensure we don't get stuck in loading state
    const initTimeout = setTimeout(() => {
      if (!isInitialized) {
        console.log('[NAV] !!!!! INIT TIMEOUT FIRING NOW !!!!!'); // New log
        log.warn('Initialization timeout detected');
        
        // Before defaulting to not onboarded, let's check localStorage for any cached onboarding info
        // or attempt to determine the user's onboarding status from what we have
        if (userProfile) {
          // We have a profile, so use that to determine onboarding
          const onboardingStatus = Boolean(userProfile.is_onboarded);
          log.info('Timeout recovery: Using existing user profile', {
            userId: userProfile.id,
            onboardingStatus
          });
          setIsOnboarded(onboardingStatus);
        } else if (user) {
          // We have a user but no profile yet
          log.info('Timeout recovery: User exists but profile not loaded yet, forcing profile fetch');
          // Instead of defaulting to false, trigger a profile fetch
          fetchCurrentUser().then(profile => {
            if (profile) {
              log.success('Timeout recovery: Profile fetch successful', {
                userId: profile.id,
                isOnboarded: Boolean(profile.is_onboarded)
              });
              setIsOnboarded(Boolean(profile.is_onboarded));
            } else {
              log.warn('Timeout recovery: Profile fetch returned no data, defaulting to not onboarded');
              setIsOnboarded(false);
            }
          }).catch(error => {
            log.error('Timeout recovery: Failed to fetch profile', error);
            setIsOnboarded(false); // Default to false on error
          });
        } else {
          // No user or profile, so they're not onboarded
          log.info('Timeout recovery: No user or profile available, defaulting to not onboarded');
          setIsOnboarded(false);
        }
        
        // Mark initialization as complete regardless
        setIsInitialized(true);
      }
    }, 15000); // Increased to 15 seconds to give more time for Supabase auth and profile fetch
    
    return () => clearTimeout(initTimeout);
  }, [isInitialized, user, userProfile, fetchCurrentUser]);
  
  // Determine onboarding status whenever user or userProfile changes
  useEffect(() => {
    // Skip if we're still loading auth state
    if (loading) {
      return;
    }
    
    // If we have no user, they're not authenticated and not onboarded
    if (!user) {
      log.info('No authenticated user');
      setIsOnboarded(false);
      setIsInitialized(true);
      return;
    }
    
    // If we have userProfile, use it to determine onboarding status
    if (userProfile) {
      // More flexible onboarding status check that handles different data types
      // This will treat any truthy value (true, 1, '1', 'true') as true
      const onboardingStatus = Boolean(userProfile.is_onboarded);
      log.info('Determined onboarding status from user profile', { 
        userId: userProfile.id, 
        isOnboarded: onboardingStatus,
        rawValue: userProfile.is_onboarded,
        valueType: typeof userProfile.is_onboarded
      });
      setIsOnboarded(onboardingStatus);
      setIsInitialized(true);
      return;
    }
    
    // If we have user but no profile, fetch the profile
    if (user && !userProfile && !loading) {
      log.info('User exists but no profile, fetching profile data', { userId: user.id });
      fetchCurrentUser().then((profile) => {
        if (profile) {
          log.success('User profile fetched successfully', {
            userId: profile.id,
            isOnboarded: Boolean(profile.is_onboarded),
            rawValue: profile.is_onboarded,
            valueType: typeof profile.is_onboarded
          });
        } else {
          log.warn('User profile fetch returned no profile');
          // Default to not onboarded if no profile
          setIsOnboarded(false);
          setIsInitialized(true);
        }
      }).catch(error => {
        log.error('Failed to fetch user profile', error);
        // Default to not onboarded on error
        setIsOnboarded(false);
        setIsInitialized(true);
      });
    }
  }, [user, userProfile, loading, fetchCurrentUser]);
  
  // Update onboarding status when userProfile changes
  useEffect(() => {
    if (!loading && userProfile) {
      const onboardingStatus = Boolean(userProfile.is_onboarded);
      log.info('User profile updated, updating onboarding status', { 
        isOnboarded: onboardingStatus 
      });
      setIsOnboarded(onboardingStatus);
      setIsInitialized(true);
    }
  }, [userProfile, loading]);

  // Update current path whenever segments change and refresh onboarding status when needed
  useEffect(() => {
    const newPath = segments.join('/');
    const previousPath = currentPathRef.current;
    currentPathRef.current = newPath;
    
    // If we're navigating from onboarding to root, refresh the user profile
    // This ensures we have the latest onboarding status after completing the flow
    if (user && 
        previousPath.startsWith('(onboarding)') && 
        (newPath === '' || newPath === '(tabs)') && 
        isInitialized) {
      log.info('Detected navigation from onboarding to main app, refreshing user profile');
      fetchCurrentUser().catch(error => {
        log.error('Failed to refresh user profile after onboarding', error);
      });
    }
  }, [segments, user, isInitialized, fetchCurrentUser]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!isInitialized || loading || isOnboarded === null) {
      log.info('RootLayoutNav: Skipping navigation (initializing, loading, or isOnboarded not determined yet)');
      return;
    }

    const currentPath = segments.join('/');
    // Convert an empty path (root) to something distinct for logging if needed, or handle it directly.
    const effectiveCurrentPath = currentPath === '' ? '/' : currentPath;

    log.info('RootLayoutNav: Navigation check', { user: !!user, isOnboarded, currentPath: effectiveCurrentPath, segments });

    const isInAuthGroup = effectiveCurrentPath.startsWith('/(auth)'); // Added leading / for clarity
    const isInOnboardingGroup = effectiveCurrentPath.startsWith('/(onboarding)');
    const isInTabsGroup = effectiveCurrentPath.startsWith('/(tabs)');

    if (!user) {
      if (!isInAuthGroup) {
        log.info('RootLayoutNav: No user, redirecting to (auth)/login');
        router.replace('/(auth)/login');
      }
    } else { // User exists
      if (isOnboarded === false) {
        // If user is not onboarded, and they are NOT already in an onboarding path,
        // OR if they somehow landed on +not-found or the very root after login, send to onboarding.
        if (!isInOnboardingGroup || effectiveCurrentPath === '/+not-found' || effectiveCurrentPath === '/') {
          log.info(`RootLayoutNav: User not onboarded. Current: "${effectiveCurrentPath}". Redirecting to (onboarding)/index`);
          router.replace('/(onboarding)/index');
        } else {
          log.info(`RootLayoutNav: User not onboarded, but already in onboarding. Current: "${effectiveCurrentPath}"`);
        }
      } else if (isOnboarded === true) {
        // User is onboarded.
        // If they are coming from auth/onboarding, or are at root, or +not-found, send to tabs.
        if (isInAuthGroup || isInOnboardingGroup || effectiveCurrentPath === '/' || effectiveCurrentPath === '/+not-found') {
          log.info(`RootLayoutNav: User onboarded. Current: "${effectiveCurrentPath}". Redirecting to default tab /(tabs)/nearby`);
          router.replace('/(tabs)/nearby');
        } else if (!isInTabsGroup && !effectiveCurrentPath.startsWith('/_sitemap')) {
          // If onboarded but on a weird path that isn't tabs, auth, or onboarding, redirect to tabs.
          log.warn(`RootLayoutNav: User onboarded but on unexpected path "${effectiveCurrentPath}". Redirecting to /(tabs)/nearby.`);
          router.replace('/(tabs)/nearby');
        }
      }
    }
  }, [user, loading, isOnboarded, isInitialized, segments, router]);

  // Show loading indicator while initializing
  if (loading || !isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Render the current route
  return <Slot />;
}

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
    // Don't redirect if we're still loading or don't have onboarding status yet
    if (!isInitialized || loading || isOnboarded === null) {
      return;
    }
    
    // Get the current path
    const currentPath = currentPathRef.current;
    
    log.info('Navigation check', { 
      user: !!user, 
      isOnboarded, 
      currentPath
    });
    
    // Simple navigation logic based on user and onboarding status
    if (!user) {
      // Redirect to login if not already there
      if (!currentPath.startsWith('(auth)')) {
        log.info('RootLayoutNav: No user, redirecting to (auth)/login');
        router.replace('/(auth)/login');
      }
    } else { // User exists
      if (isOnboarded === false) {
        // User is authenticated but not onboarded
        if (!currentPath.startsWith('(onboarding)')) {
          log.info('RootLayoutNav: User authenticated but not onboarded, redirecting to (onboarding)/index');
          router.replace('/(onboarding)/index'); // Always start at (onboarding)/index
        }
      } else if (isOnboarded === true) {
        // User is authenticated and onboarded
        if (currentPath.startsWith('(auth)') || currentPath.startsWith('(onboarding)')) {
          log.info('RootLayoutNav: User authenticated and onboarded, redirecting to /(app)');
          router.replace('/(app)'); // Navigate to the (app) group's layout
        }
      }
    }
  }, [user, loading, isOnboarded, isInitialized, segments]);

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

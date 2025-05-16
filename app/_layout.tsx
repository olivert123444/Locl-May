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
    log.info('RootLayoutNav: [EFFECT on user, userProfile, loading] Determining init/onboarding state.');
    if (loading) {
      log.info('RootLayoutNav: AuthContext is loading. isInitialized = false.');
      setIsInitialized(false); // Stay uninitialized while AuthContext loads
      return;
    }

    // AuthContext loading is false from this point

    if (!user) {
      log.info('RootLayoutNav: No user from AuthContext. Setting not onboarded, initialized.');
      setIsOnboarded(false);
      setIsInitialized(true);
      return;
    }

    // User exists
    if (userProfile) {
      const onboardingStatus = Boolean(userProfile.is_onboarded);
      log.info('RootLayoutNav: User and profile exist from AuthContext. Setting onboarding from profile.', {
        userId: userProfile.id,
        isOnboarded: onboardingStatus,
        rawValue: userProfile.is_onboarded,
      });
      setIsOnboarded(onboardingStatus);
      setIsInitialized(true);
    } else {
      // User exists, but userProfile is null from AuthContext.
      // This means AuthContext's fetchCurrentUser either failed or hasn't completed setting userProfile.
      // We should wait for AuthContext to provide it.
      // If this state persists, it indicates an issue in AuthContext's fetchCurrentUser or its state updates.
      log.warn('RootLayoutNav: User exists, but userProfile is NULL from AuthContext. isInitialized remains false. AuthContext should provide this.');
      setIsInitialized(false); // Explicitly wait for userProfile from context
    }
  }, [user, userProfile, loading]); // Removed fetchCurrentUser and isInitialized from deps
  
  // Update current path whenever segments change (but don't refresh profile)
  useEffect(() => {
    const newPath = segments.join('/');
    const previousPath = currentPathRef.current;
    currentPathRef.current = newPath;
    
    // Just track path changes, but don't trigger profile refresh
    if (user && 
        previousPath.startsWith('(onboarding)') && 
        (newPath === '' || newPath === '(tabs)') && 
        isInitialized) {
      log.info('Detected navigation from onboarding to main app (no longer triggering profile refresh)');
      // Removed fetchCurrentUser call that was likely causing issues
    }
  }, [segments, user, isInitialized]);

  // Handle navigation based on auth state
  useEffect(() => {
    // 1. Initial skip condition
    if (!isInitialized || loading || isOnboarded === null) {
      log.info('RootLayoutNav: Skipping navigation (initializing, loading, or isOnboarded not determined yet)');
      return;
    }

    const currentSegments = segments; // Use a stable variable for the current render
    const currentPath = currentSegments.join('/') || '/'; // Default to '/' if segments is empty
    log.info('RootLayoutNav: Navigation check', { user: !!user, isOnboarded, currentPath, segments: currentSegments });

    let targetPath: string | null = null;

    if (!user) {
      // If no user, and not already in auth flow, go to login
      if (!currentPath.startsWith('/(auth)')) {
        targetPath = '/(auth)/login';
        log.info(`RootLayoutNav: No user. Current: "${currentPath}". Setting target: "${targetPath}"`);
      }
    } else { // User exists
      if (isOnboarded === false) {
        // If user is not onboarded:
        // - and not already in an onboarding path, OR
        // - is somehow on +not-found, OR
        // - is at the root path
        // THEN target onboarding. (Still using /location as the temporary debug target)
        if (!currentPath.startsWith('/(onboarding)') || currentPath === '/+not-found' || currentPath === '/') {
          targetPath = '/(onboarding)/index'; // Changed back to index for testing the ultra-simple screen
          log.info(`RootLayoutNav: User not onboarded. Current: "${currentPath}". Setting target: "${targetPath}"`);
        }
      } else if (isOnboarded === true) {
        // If user IS onboarded:
        // - and currently in auth, onboarding, at root, or +not-found
        // THEN target the main app (tabs).
        if (currentPath.startsWith('/(auth)') || currentPath.startsWith('/(onboarding)') || currentPath === '/' || currentPath === '/+not-found') {
          targetPath = '/(tabs)/nearby'; // Default screen in main app
          log.info(`RootLayoutNav: User onboarded. Current: "${currentPath}". Setting target: "${targetPath}"`);
        }
        // Optional: Catch-all for onboarded users on weird paths (can be added later if needed)
        // else if (!currentPath.startsWith('/(tabs)') && !currentPath.startsWith('/chat') /* add other valid app paths */ && !currentPath.startsWith('/_sitemap')) {
        //   targetPath = '/(tabs)/nearby';
        //   log.warn(`RootLayoutNav: User onboarded on unexpected path. Current: "${currentPath}". Setting target: "${targetPath}"`);
        // }
      }
    }

    // --- This is the key change to prevent loops ---
    // Only navigate if a targetPath is determined AND we are not already effectively at that targetPath.
    if (targetPath && currentPath !== targetPath) {
      // Check if currentPath is essentially the same as targetPath if one is an index route
      // e.g. if targetPath is '/(onboarding)/location' and currentPath is '/(onboarding)/location/index'
      // For simplicity now, we'll do a direct comparison. This can be refined if index routes are an issue.
      log.info(`RootLayoutNav: Executing router.replace to "${targetPath}" (from "${currentPath}")`);
      router.replace(targetPath);
    } else if (targetPath && currentPath === targetPath) {
      log.info(`RootLayoutNav: Already at target path "${targetPath}". No navigation needed.`);
    } else {
      log.info(`RootLayoutNav: No navigation target determined for current state, or already at a stable path. CurrentPath: "${currentPath}", IsOnboarded: ${isOnboarded}, User: ${!!user}`);
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

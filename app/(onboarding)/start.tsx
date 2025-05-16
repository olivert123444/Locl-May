// app/(onboarding)/start.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentLocation } from '@/lib/locationService';

export default function OnboardingStart() {
  const router = useRouter();
  const { user, userProfile: authContextUserProfileForIndex } = useAuth();
  console.log('[ONBOARDING START SCREEN] Mounted. AuthContext userProfile.is_onboarded:', authContextUserProfileForIndex?.is_onboarded);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  // Track if this component is mounted
  const isMountedRef = useRef(true);
  
  // Track if user is onboarded
  const [isOnboarded, setIsOnboarded] = useState(false);
  
  // Initialize location permissions when component mounts
  useEffect(() => {
    if (!user) return;
    
    console.log('Onboarding start mounted, checking location permissions...');
    isMountedRef.current = true;
    
    // Proceed directly with location checks
    // RootLayoutNav handles redirection if user is already onboarded
    checkLocationPermissions();
    
    // Cleanup timeout on unmount
    return () => {
      isMountedRef.current = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user]);
  
  // Function to check if location permissions are granted and request them if needed
  const checkLocationPermissions = async () => {
    if (!user) return;
    
    setCheckingLocation(true);
    setIsLoading(true);
    setError(null);
    
    // Set a timeout for the location permission request
    const timeout = setTimeout(() => {
      setError('Getting your location is taking longer than expected. Please check your GPS settings and try again.');
      setIsLoading(false);
      setCheckingLocation(false);
    }, 10000); // 10 seconds timeout
    
    setTimeoutId(timeout);
    
    try {
      // Check if location permissions are already granted
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status === 'granted') {
        console.log('Location permissions already granted, attempting to auto-save location');
        clearTimeout(timeout);
        setTimeoutId(null);
        await autoSaveLocationAndProceed();
      } else {
        console.log('Location permissions not granted yet, requesting permissions...');
        
        // Actively request location permissions
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        
        clearTimeout(timeout);
        setTimeoutId(null);
        
        if (newStatus === 'granted') {
          console.log('Location permissions granted, proceeding with location save');
          await autoSaveLocationAndProceed();
        } else {
          console.log('Location permission denied by user');
          setError('Location permission is required to use this app. Please enable location services and try again.');
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error checking or requesting location permissions:', error);
      clearTimeout(timeout);
      setTimeoutId(null);
      setError('Failed to access location services. Please check your device settings and try again.');
      setIsLoading(false);
    } finally {
      setCheckingLocation(false);
    }
  };
  
  // Function to automatically save location and proceed to profile page
  const autoSaveLocationAndProceed = async () => {
    console.log('[ONBOARDING START - autoSaveLocationAndProceed START] AuthContext userProfile.is_onboarded at start:', authContextUserProfileForIndex?.is_onboarded);
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    // Set a timeout to show an error if the location save takes too long
    const timeout = setTimeout(() => {
      setError('Saving location is taking longer than expected. Please check your GPS settings and try again.');
      setIsLoading(false);
    }, 10000); // 10 seconds timeout
    
    setTimeoutId(timeout);
    
    try {
      // Get current location data - force fresh data (no cache)
      const locationData = await getCurrentLocation(false);
      
      // Clear the timeout since we got a response
      clearTimeout(timeout);
      setTimeoutId(null);
      
      // Check if we have valid location data (coordinates are enough)
      if (locationData && locationData.latitude && locationData.longitude) {
        console.log('Got valid location data, saving to user profile');
        
        // Format location data for storage
        const formattedLocation = {
          // Use city from geocoding or coordinates-based placeholder
          city: locationData.city || `Location (${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)})`,
          // Use zip code if available, but it's optional
          zip_code: locationData.postalCode || locationData.zip_code || '',
          country: locationData.country || 'Unknown',
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          address: locationData.address || ''
        };
        
        console.log('Saving location data:', formattedLocation);
        
        // Check if user exists in the users table and get ALL existing data
        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        let result;

        if (!existingUser && (!fetchError || fetchError.code === 'PGRST116')) {
          // User doesn't exist yet, create a new user record
          console.log('Creating new user record with location data');
          console.log('[ONBOARDING START - autoSaveLocationAndProceed] DB WRITE: Setting is_onboarded to false.');
          result = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email || '',
              full_name: '',
              location: formattedLocation,
              is_seller: false,
              is_buyer: true,
              // Explicitly set is_onboarded to false until onboarding is fully completed
              is_onboarded: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
        } else {
          // User exists, update ONLY the location while preserving all other fields
          console.log('Updating existing user record with location data');
          
          // Log the existing user data to verify what fields we have
          console.log('Existing user data before update:', existingUser);
          
          // Only update the location and timestamp, and explicitly set is_onboarded to false
          const updateData = {
            location: formattedLocation,
            is_onboarded: false, // Explicitly set to false to ensure consistency
            updated_at: new Date().toISOString(),
          };
          
          console.log('Updating only location data:', updateData);
          console.log('[ONBOARDING START - autoSaveLocationAndProceed] DB WRITE: Setting is_onboarded to false.');
          
          result = await supabase
            .from('users')
            .update(updateData)
            .eq('id', user.id);
        }
        
        if (result.error) {
          console.error('Error saving location data:', result.error);
          throw new Error(`Database error: ${result.error.message}`);
        }
        
        // Skip location page and go directly to profile setup
        console.log('Location saved successfully, proceeding to profile setup');
        console.log('[ONBOARDING START - autoSaveLocationAndProceed END] AuthContext userProfile.is_onboarded before navigating to profile:', authContextUserProfileForIndex?.is_onboarded);
        router.push('/(onboarding)/profile');
        return;
      } else {
        // No valid coordinates - show error and let user retry
        console.log('No valid location data available');
        setError('Could not get your location. Please check your GPS settings and try again.');
      }
    } catch (error) {
      console.error('Error in auto-save location:', error);
      // Clear the timeout if there was an error
      if (timeoutId) {
        clearTimeout(timeout);
        setTimeoutId(null);
      }
      setError('Failed to save location. Please check your GPS settings and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetStarted = async () => {
    setIsLoading(true);
    setError(null);
    
    // Set a timeout for the location check
    const timeout = setTimeout(() => {
      setError('Getting your location is taking longer than expected. Please check your GPS settings and try again.');
      setIsLoading(false);
    }, 10000); // 10 seconds timeout
    
    setTimeoutId(timeout);
    
    try {
      // Request location permissions if not already granted
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Requesting location permissions...');
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        
        if (newStatus !== 'granted') {
          clearTimeout(timeout);
          setTimeoutId(null);
          setError('Location permission is required to use this app. Please enable location services and try again.');
          setIsLoading(false);
          return;
        }
      }
      
      // Get current location data
      const locationData = await getCurrentLocation(false);
      
      if (!locationData || !locationData.latitude || !locationData.longitude) {
        clearTimeout(timeout);
        setTimeoutId(null);
        setError('Could not get your location. Please check your GPS settings and try again.');
        setIsLoading(false);
        return;
      }
      
      // Save location data and proceed to profile setup
      await autoSaveLocationAndProceed();
      
      clearTimeout(timeout);
      setTimeoutId(null);
    } catch (error) {
      console.error('Error in handleGetStarted:', error);
      clearTimeout(timeout);
      setTimeoutId(null);
      setError('Failed to get your location. Please try again.');
      setIsLoading(false);
    }
  };

  // Early return if user is already onboarded to prevent rendering and re-mounting
  if (isOnboarded) {
    console.log('User is onboarded, preventing render of onboarding component');
    return null;
  }
  
  return (
    <View style={styles.container}>
      {(isLoading || checkingLocation) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Setting up your account...</Text>
          {error && (
            <>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity 
                style={styles.retryButton} 
                onPress={() => {
                  setError(null);
                  checkLocationPermissions();
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.title}>Welcome to Locl</Text>
          <Text style={styles.subtitle}>
            Find and connect with local sellers and buyers in your area.
          </Text>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleGetStarted}
            disabled={isLoading || checkingLocation}
          >
            {isLoading || checkingLocation ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Get Started</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    color: '#555',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#777',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    marginTop: 20,
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loader: {
    marginTop: 20,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

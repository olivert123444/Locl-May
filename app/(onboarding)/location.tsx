import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import { getCurrentLocation, LocationData } from '@/lib/locationService';
import { addDebugLog } from '@/components/DebugOverlay';

// Debug logger for location setup
const log = {
  info: (message: string, data?: any) => {
    if (data) {
      console.log(`[LOCATION] 🔵 ${message}`, data);
      addDebugLog('info', `[LOCATION] ${message}`, data);
    } else {
      console.log(`[LOCATION] 🔵 ${message}`);
      addDebugLog('info', `[LOCATION] ${message}`);
    }
  },
  success: (message: string, data?: any) => {
    if (data) {
      console.log(`[LOCATION] ✅ ${message}`, data);
      addDebugLog('success', `[LOCATION] ${message}`, data);
    } else {
      console.log(`[LOCATION] ✅ ${message}`);
      addDebugLog('success', `[LOCATION] ${message}`);
    }
  },
  warn: (message: string, data?: any) => {
    if (data) {
      console.warn(`[LOCATION] ⚠️ ${message}`, data);
      addDebugLog('warn', `[LOCATION] ${message}`, data);
    } else {
      console.warn(`[LOCATION] ⚠️ ${message}`);
      addDebugLog('warn', `[LOCATION] ${message}`);
    }
  },
  error: (message: string, error?: any) => {
    if (error) {
      console.error(`[LOCATION] ❌ ${message}`, error);
      addDebugLog('error', `[LOCATION] ${message}`, error);
    } else {
      console.error(`[LOCATION] ❌ ${message}`);
      addDebugLog('error', `[LOCATION] ${message}`);
    }
  }
};

export default function LocationSetup() {
  const router = useRouter();
  const { user, updateUserProfile, fetchCurrentUser } = useAuth();
  const [location, setLocation] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Log component mount
  React.useEffect(() => {
    log.info('Location setup screen mounted', { userId: user?.id });
  }, []);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (timeoutId) {
        log.info('Clearing location detection timeout');
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      log.info('Starting location detection process');
      
      // Set a timeout to prevent hanging indefinitely
      const timeout = setTimeout(() => {
        log.warn('Location detection timed out after 10 seconds');
        setErrorMsg('Getting your location is taking longer than expected. Please try again or enter your location manually.');
        setIsLoading(false);
      }, 10000); // 10 seconds timeout
      
      setTimeoutId(timeout);
      log.info('Location detection timeout set for 10 seconds');
      
      try {
        // STEP 1: Check if user is already onboarded
        log.info('Checking if user is already onboarded');
        if (user) {
          const { data, error } = await supabase
            .from('users')
            .select('is_onboarded')
            .eq('id', user.id)
            .single();
          
          if (error) {
            log.error('Error checking onboarding status', error);
          }
          
          if (!error && data && data.is_onboarded === true) {
            log.info('User is already onboarded, redirecting to home');
            clearTimeout(timeout);
            router.replace('/');
            return;
          }
        } else {
          log.warn('No user object available, cannot check onboarding status');
        }
        
        // STEP 2: Check location permissions
        log.info('Checking location permissions');
        const { status } = await Location.getForegroundPermissionsAsync();
        log.info('Location permission status', { status });
        
        // If permissions are already granted, try to auto-proceed
        if (status === 'granted') {
          log.info('Location permissions already granted - attempting to auto-proceed');
          
          // STEP 3: Get current location
          log.info('Requesting current location');
          const autoLocationData = await getCurrentLocation(false); // Don't use cache to get fresh data
          
          if (autoLocationData) {
            log.info('Received location data', { 
              hasCoordinates: !!(autoLocationData.latitude && autoLocationData.longitude),
              city: autoLocationData.city,
              postalCode: autoLocationData.postalCode || autoLocationData.zip_code
            });
          } else {
            log.warn('No location data received');
          }
          
          // If we have coordinates, we can proceed automatically
          if (autoLocationData && autoLocationData.latitude && autoLocationData.longitude) {
            log.success('Got valid coordinates, auto-saving and proceeding');
            
            // Set the data in state (even though we'll skip this screen)
            setLocation(autoLocationData.city || `Location (${autoLocationData.latitude.toFixed(4)}, ${autoLocationData.longitude.toFixed(4)})`);
            setZipCode(autoLocationData.postalCode || autoLocationData.zip_code || '');
            
            // Clear the timeout since we're proceeding
            clearTimeout(timeout);
            setTimeoutId(null);
            
            // STEP 4: Save location data to database
            log.info('Auto-saving location data to database');
            await saveLocationToDatabase(autoLocationData);
            
            // STEP 5: Mark the user as onboarded
            if (user) {
              log.info('Auto-proceed: Marking user as onboarded after successful location setup');
              try {
                // Update the is_onboarded flag using the global context function
                log.info('Updating user profile with is_onboarded=true');
                const updatedProfile = await updateUserProfile({ is_onboarded: true });
                
                if (!updatedProfile) {
                  log.error('Auto-proceed: Error marking user as onboarded - no profile returned');
                } else {
                  log.success('Auto-proceed: Successfully marked user as onboarded', {
                    userId: updatedProfile.id,
                    isOnboarded: updatedProfile.is_onboarded
                  });
                  
                  // STEP 6: Fetch the latest user data to ensure we have the most up-to-date state
                  log.info('Auto-proceed: Fetching latest user data to confirm onboarding status');
                  const freshProfile = await fetchCurrentUser();
                  
                  if (freshProfile) {
                    log.info('Auto-proceed: Received fresh user profile data', {
                      userId: freshProfile.id,
                      isOnboarded: freshProfile.is_onboarded
                    });
                    
                    if (freshProfile.is_onboarded !== true) {
                      log.warn('Auto-proceed: Warning: User still not marked as onboarded in fresh data');
                    } else {
                      log.success('Auto-proceed: Confirmed user is marked as onboarded');
                    }
                  } else {
                    log.warn('Auto-proceed: Could not fetch fresh profile data');
                  }
                }
                
                // Immediately proceed to the main app
                console.log('Auto-proceed: Location setup complete, redirecting to main app');
                router.replace('/(tabs)/nearby');
              } catch (error) {
                console.error('Auto-proceed: Error updating onboarding status:', error);
              }
            } else {
              console.error('Auto-proceed: No authenticated user found');
            }
            return; // Exit early - we're skipping this screen entirely
          } else {
            console.log('No valid coordinates despite permissions, showing manual entry');
          }
        }
        
        // If we're still here, we need to show the manual entry form
        // Get location data to pre-fill the form
        const locationData = await getCurrentLocation(false);
        
        if (locationData) {
          console.log('Got location data for form pre-fill:', locationData);
          
          // Set the city/neighborhood from the location data
          if (locationData.city) {
            // We should now always have a city name from our enhanced location service
            setLocation(locationData.city);
            console.log(`Setting location to city: ${locationData.city}`);
          } else if (locationData.address) {
            // Fallback: Extract city from address if available
            const addressParts = locationData.address.split(',');
            if (addressParts.length > 1) {
              setLocation(addressParts[0].trim());
              console.log(`Setting location from address part: ${addressParts[0].trim()}`);
            } else {
              setLocation(locationData.address);
              console.log(`Setting location from full address: ${locationData.address}`);
            }
          } else if (locationData.region) {
            // Fallback to region if no city or address
            setLocation(locationData.region);
            console.log(`Setting location from region: ${locationData.region}`);
          } else {
            // Last resort: use coordinates
            const coordLocation = `Location (${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)})`;
            setLocation(coordLocation);
            console.log(`Setting location from coordinates: ${coordLocation}`);
          }
          
          // Set the zip code if available from the location data
          if (locationData.postalCode) {
            setZipCode(locationData.postalCode);
            console.log(`Setting zip code: ${locationData.postalCode}`);
          } else if (locationData.zip_code) {
            setZipCode(locationData.zip_code);
            console.log(`Setting zip code: ${locationData.zip_code}`);
          } else {
            // Leave it blank and let the user fill it in
            setZipCode('');
            console.log('No zip code available, leaving field empty for user input');
          }
        } else {
          console.log('Could not determine location, prompting user for manual entry');
          setErrorMsg('Could not determine your location. Please enter it manually.');
        }
      } catch (error) {
        console.error('Error getting location:', error);
        setErrorMsg('Could not determine your location. Please enter it manually.');
      } finally {
        // Clear the timeout if we're done loading
        if (timeoutId) {
          clearTimeout(timeoutId);
          setTimeoutId(null);
        }
        setIsLoading(false);
      }
    })();
  }, [user]);

  // Helper function to save location data to database
  const saveLocationToDatabase = async (locationData: LocationData) => {
    if (!user) {
      console.error('No authenticated user found');
      throw new Error('You must be logged in to continue');
    }

    console.log('Saving location for user:', user.id);
    
    // Format location as JSONB for the users table
    const formattedLocation = {
      city: locationData.city || `Location (${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)})`,
      zip_code: locationData.postalCode || locationData.zip_code || '',
      // Use country from location data or a reasonable default
      country: locationData.country || 'Unknown',
      // Include coordinates
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      // Include address if available
      address: locationData.address || ''
    };

    console.log('Formatted location data:', formattedLocation);

    // Check if user exists in the users table and get all existing data
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    console.log('User check result:', { existingUser, fetchError });

    let result;

    if (!existingUser && (!fetchError || fetchError.code === 'PGRST116')) {
      // User doesn't exist yet, create a new user record
      console.log('Creating new user record');
      result = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: '',
          location: formattedLocation,
          is_seller: false,
          is_buyer: true,
          // Explicitly set is_onboarded to false (as boolean) - will be set to true after profile setup
          is_onboarded: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    } else {
      // User exists, update ONLY the location while preserving other fields
      console.log('Updating existing user record');
      
      // Prepare update data - only include the location and updated timestamp
      const updateData: { 
        location: typeof formattedLocation; 
        updated_at: string; 
        is_onboarded?: boolean;
      } = {
        location: formattedLocation,
        updated_at: new Date().toISOString(),
      };
      
      // Only modify is_onboarded if it's not already set to true
      // This ensures we don't reset onboarding progress if the user is updating their location later
      const existingOnboarded = existingUser?.is_onboarded === true || existingUser?.is_onboarded === 'true';
      if (!existingOnboarded) {
        updateData.is_onboarded = false; // Use boolean false, not string
      }
      
      console.log('Updating user with data:', updateData);
      
      result = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);
    }

    console.log('Database operation result:', result);

    if (result.error) {
      console.error('Database error:', result.error);
      throw new Error(`Database error: ${result.error.message}`);
    }

    console.log('Location saved successfully');
    return true;
  };

  const handleContinue = async () => {
    if (!location || !zipCode) {
      setErrorMsg('Please enter your location and zip code');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    
    // Set a timeout to prevent hanging indefinitely
    const timeout = setTimeout(() => {
      console.log('Manual location save timed out');
      setErrorMsg('Saving your location is taking longer than expected. Please try again.');
      setIsLoading(false);
    }, 10000); // 10 seconds timeout
    
    setTimeoutId(timeout);
    
    try {
      if (!user) {
        console.error('No authenticated user found');
        setErrorMsg('You must be logged in to continue');
        return;
      }

      console.log('Manual location entry:', { location, zipCode });

      // Get current location data to include coordinates if available
      const currentLocation = await getCurrentLocation(false);
      
      // Create location data object combining manual entry with GPS data if available
      const locationData: LocationData = {
        city: location,
        zip_code: zipCode,
        postalCode: zipCode,
        // Use country from current location or a reasonable default based on region
        country: currentLocation?.country || 
                (zipCode.startsWith('3') ? 'ES' : 'Unknown'),
        // Include coordinates if available, otherwise use placeholder values
        latitude: currentLocation?.latitude || 0,
        longitude: currentLocation?.longitude || 0,
        // Include address if available
        address: currentLocation?.address
      };

      // Save to database using our helper function
      await saveLocationToDatabase(locationData);
      
      // Clear the timeout if it exists
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      
      // Navigate to the next step in the onboarding flow (profile setup)
      console.log('Location saved successfully, proceeding to profile setup');
      router.push('/(onboarding)/profile');
    } catch (error: any) {
      console.error('Error saving location:', error);
      // Provide more specific error message to help with debugging
      setErrorMsg(`Failed to save your location: ${error.message || 'Unknown error'}`);
      
      // Clear the timeout if it's still active
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      setIsLoading(false);
    } finally {
      // Clear the timeout if it's still active
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Set Your Location</Text>
        <Text style={styles.subtitle}>
          We'll use your location to show you items nearby and help you connect with local buyers and sellers.
        </Text>

        {isLoading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>City/Neighborhood</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your city or neighborhood"
                value={location}
                onChangeText={setLocation}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Zip Code</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your zip code"
                value={zipCode}
                onChangeText={setZipCode}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          </>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.button, (isLoading || (!location && !zipCode)) && styles.buttonDisabled]} 
        onPress={handleContinue}
        disabled={isLoading || (!location && !zipCode)}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
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
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    color: '#555',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  loader: {
    marginVertical: 30,
  },
  errorText: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

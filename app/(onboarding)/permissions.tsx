import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function PermissionsSetup() {
  const router = useRouter();
  const { user, updateUserProfile, fetchCurrentUser } = useAuth();
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      // Check camera permission - handle web differently
      if (Platform.OS === 'web') {
        // On web, we'll check if the browser supports camera access
        if (navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            // Try to access the camera
            await navigator.mediaDevices.getUserMedia({ video: true });
            setCameraPermission(true);
          } catch (error) {
            console.log('Camera permission not granted on web:', error);
            setCameraPermission(false);
          }
        } else {
          console.log('Camera API not available in this browser');
          setCameraPermission(false);
        }
      } else {
        // For native platforms, we'll just assume camera access is available for now
        // since we're focusing on web for this implementation
        setCameraPermission(true);
      }

      // Check notification permission
      try {
        const notificationStatus = await Notifications.getPermissionsAsync();
        setNotificationPermission(notificationStatus.status === 'granted');
      } catch (error) {
        console.log('Error checking notification permissions:', error);
        setNotificationPermission(false);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      // Set default values if there's an error
      setCameraPermission(false);
      setNotificationPermission(false);
    }
  };

  const requestCameraPermission = async () => {
    setIsLoading(true);
    try {
      if (Platform.OS === 'web') {
        // On web, we need to use the browser's API
        if (navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            // Request camera access
            await navigator.mediaDevices.getUserMedia({ video: true });
            setCameraPermission(true);
          } catch (error) {
            console.log('Failed to get camera permission on web:', error);
            setCameraPermission(false);
          }
        } else {
          console.log('Camera API not available in this browser');
          setCameraPermission(false);
        }
      } else {
        // For native platforms, we'll just assume camera access is available for now
        // since we're focusing on web for this implementation
        setCameraPermission(true);
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      setCameraPermission(false);
    } finally {
      setIsLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    setIsLoading(true);
    try {
      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(status === 'granted');
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setNotificationPermission(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!user) {
      console.error('No authenticated user found');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Permissions step: Finalizing onboarding process for user:', user.id);
      
      // Use AuthContext's updateUserProfile to set is_onboarded and refresh context
      // This ensures the AuthContext state is updated immediately
      const updatedProfile = await updateUserProfile({ is_onboarded: true });
      
      if (!updatedProfile || updatedProfile.is_onboarded !== true) {
        console.error('Permissions step: Failed to update onboarding status via AuthContext or status not true.');
        // Fallback direct update if context update seems problematic
        const { error: directUpdateError } = await supabase
          .from('users')
          .update({ is_onboarded: true, updated_at: new Date().toISOString() })
          .eq('id', user.id);
        
        if (directUpdateError) {
          throw directUpdateError;
        }
        
        // Re-fetch user to ensure context is definitely updated if fallback was used
        await fetchCurrentUser();
      }
      
      console.log('Permissions step: Onboarding completed and user marked as onboarded.');
      
      // Navigate to a neutral or main app route
      // RootLayoutNav will then see isOnboarded = true and allow access
      router.replace('/(tabs)/nearby');
    } catch (err) {
      console.error('Error completing onboarding:', err);
      setError('Failed to complete setup. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.content}>
        <Text style={styles.title}>App Permissions</Text>
        <Text style={styles.subtitle}>
          To get the most out of Locl, we need a few permissions. These help you take photos of items to sell and stay updated on offers.
        </Text>
        
        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.permissionCard}>
          <View style={styles.permissionHeader}>
            <Ionicons name="camera" size={24} color="#007AFF" />
            <Text style={styles.permissionTitle}>Camera Access</Text>
          </View>
          <Text style={styles.permissionDescription}>
            We need camera access so you can take photos of items you want to sell.
          </Text>
          <TouchableOpacity 
            style={[
              styles.permissionButton, 
              cameraPermission ? styles.permissionGranted : styles.permissionNeeded
            ]} 
            onPress={requestCameraPermission}
            disabled={cameraPermission || isLoading}
          >
            <Text style={styles.permissionButtonText}>
              {cameraPermission ? 'Access Granted' : 'Grant Access'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.permissionCard}>
          <View style={styles.permissionHeader}>
            <Ionicons name="notifications" size={24} color="#007AFF" />
            <Text style={styles.permissionTitle}>Notifications</Text>
          </View>
          <Text style={styles.permissionDescription}>
            Get notified when you receive offers, messages, or when your items sell.
          </Text>
          <TouchableOpacity 
            style={[
              styles.permissionButton, 
              notificationPermission ? styles.permissionGranted : styles.permissionNeeded
            ]} 
            onPress={requestNotificationPermission}
            disabled={notificationPermission || isLoading}
          >
            <Text style={styles.permissionButtonText}>
              {notificationPermission ? 'Access Granted' : 'Grant Access'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>
          You can always change these permissions later in your device settings.
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue to Locl</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
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
  permissionCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#555',
    marginBottom: 15,
  },
  permissionButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  permissionNeeded: {
    backgroundColor: '#007AFF',
  },
  permissionGranted: {
    backgroundColor: '#4CD964',
  },
  permissionButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  note: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  loader: {
    marginVertical: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 10,
  },
});

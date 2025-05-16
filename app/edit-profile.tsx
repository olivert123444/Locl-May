import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getUserProfile, updateUserProfile } from '@/lib/supabase';
import { getCurrentLocation, LocationData } from '@/lib/locationService';
import AvatarUpload from '@/components/AvatarUpload';

export default function EditProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Profile fields
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  // Removed phone field as it doesn't exist in the database schema
  const [location, setLocation] = useState<LocationData | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      if (!user) return;
      
      const profileData = await getUserProfile(user.id);
      
      if (profileData) {
        setFullName(profileData.full_name || '');
        setBio(profileData.bio || '');
        setEmail(profileData.email || user.email || '');
        // Phone field removed since it doesn't exist in the database schema
        setAvatarUrl(profileData.avatar_url || null);
        
        // Parse location if it exists
        if (profileData.location) {
          try {
            const locationObj = typeof profileData.location === 'string' 
              ? JSON.parse(profileData.location) 
              : profileData.location;
            
            setLocation(locationObj);
          } catch (error) {
            console.error('Error parsing location:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLocation = async () => {
    setIsGettingLocation(true);
    try {
      const locationData = await getCurrentLocation();
      if (locationData) {
        setLocation(locationData);
        Alert.alert('Success', 'Your location has been updated.');
      } else {
        Alert.alert('Error', 'Could not get your current location. Please check your device settings.');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Prepare updates object with only valid fields
      const updates: Record<string, any> = {
        full_name: fullName.trim(),
        bio: bio.trim(),
        location: location,
        updated_at: new Date().toISOString()
      };
      
      // Only include email if it's not empty (email has NOT NULL constraint)
      if (email.trim()) {
        updates.email = email.trim();
      }
      
      await updateUserProfile(user.id, updates);
      
      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Format location for display in a user-friendly way
  const getLocationDisplay = (): string => {
    if (!location) return 'No location set';
    
    // First priority: use the city name if available
    // This is the most user-friendly option and comes from our geocoding service
    if (location.city) {
      // If we have a region/state and it's not already part of the city name
      if (location.region && !location.city.includes(location.region)) {
        return `${location.city}, ${location.region}`;
      }
      return location.city;
    }
    
    // Second priority: use the full address if available
    if (location.address) return location.address;
    
    // Third priority: try to build from components
    const region = location.region;
    const country = location.country;
    
    if (region) {
      return country ? `${region}, ${country}` : region;
    }
    
    if (country) {
      return country;
    }
    
    // Last resort: if we have coordinates but no readable location
    // Instead of showing raw coordinates, use a friendly message
    if (location.latitude && location.longitude) {
      return 'Nearby Location';
    }
    
    return 'Location available';
  };
  
  // Handle avatar update from the AvatarUpload component
  const handleAvatarUpdated = (newUrl: string) => {
    setAvatarUrl(newUrl);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
        <View style={styles.avatarContainer}>
          {user && (
            <AvatarUpload
              userId={user.id}
              currentAvatarUrl={avatarUrl}
              size={100}
              onAvatarUpdated={handleAvatarUpdated}
            />
          )}
          <Text style={styles.changePhotoText}>Tap to change photo</Text>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
          />
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell others about yourself"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        
        {/* Phone field removed as it doesn't exist in the database schema */}
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Location</Text>
          <View style={styles.locationContainer}>
            <Text style={styles.locationText}>{getLocationDisplay()}</Text>
            <TouchableOpacity 
              style={styles.updateLocationButton} 
              onPress={handleUpdateLocation}
              disabled={isGettingLocation}
            >
              {isGettingLocation ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="location" size={16} color="#fff" />
                  <Text style={styles.updateLocationText}>Update Location</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
          onPress={handleSaveProfile}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Profile</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  changePhotoText: {
    marginTop: 8,
    fontSize: 14,
    color: '#007AFF',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  locationContainer: {
    marginTop: 8,
  },
  locationText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  updateLocationButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateLocationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#a0c8ff',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

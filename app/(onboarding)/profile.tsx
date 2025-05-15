import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Switch, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, uploadUserAvatar, updateUserProfile as updateUserProfileDirect } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { addDebugLog } from '@/components/DebugOverlay';

// Debug logger for profile setup
const log = {
  info: (message: string, data?: any) => {
    if (data) {
      console.log(`[PROFILE] 🔵 ${message}`, data);
      addDebugLog('info', `[PROFILE] ${message}`, data);
    } else {
      console.log(`[PROFILE] 🔵 ${message}`);
      addDebugLog('info', `[PROFILE] ${message}`);
    }
  },
  success: (message: string, data?: any) => {
    if (data) {
      console.log(`[PROFILE] ✅ ${message}`, data);
      addDebugLog('success', `[PROFILE] ${message}`, data);
    } else {
      console.log(`[PROFILE] ✅ ${message}`);
      addDebugLog('success', `[PROFILE] ${message}`);
    }
  },
  warn: (message: string, data?: any) => {
    if (data) {
      console.warn(`[PROFILE] ⚠️ ${message}`, data);
      addDebugLog('warn', `[PROFILE] ${message}`, data);
    } else {
      console.warn(`[PROFILE] ⚠️ ${message}`);
      addDebugLog('warn', `[PROFILE] ${message}`);
    }
  },
  error: (message: string, error?: any) => {
    if (error) {
      console.error(`[PROFILE] ❌ ${message}`, error);
      addDebugLog('error', `[PROFILE] ${message}`, error);
    } else {
      console.error(`[PROFILE] ❌ ${message}`);
      addDebugLog('error', `[PROFILE] ${message}`);
    }
  }
};

// Diagnostic Tests Function
const runDiagnosticTests = async (user: any, log: any) => {
  if (!user || !user.id) {
    log.error('DIAGNOSTIC: No user available for testing');
    return;
  }
  
  const userId = user.id;
  log.info('DIAGNOSTIC: Starting tests for user', { userId });
  
  // Test 1: Basic read test - Can we read the current user profile?
  try {
    log.info('DIAGNOSTIC TEST 1: Reading user profile');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (userError) {
      log.error('DIAGNOSTIC TEST 1 FAILED: Cannot read user profile', userError);
    } else if (userData) {
      log.success('DIAGNOSTIC TEST 1 PASSED: User profile read successfully', {
        id: userData.id,
        email: userData.email,
        fullName: userData.full_name,
        name: userData.name,
        isOnboarded: userData.is_onboarded,
        isSeller: userData.is_seller,
        isBuyer: userData.is_buyer,
        hasAvatar: !!userData.avatar_url,
        hasBio: !!userData.bio
      });
    }
  } catch (e) {
    log.error('DIAGNOSTIC TEST 1 ERROR:', e);
  }
  
  // Test 2: Update name only 
  try {
    log.info('DIAGNOSTIC TEST 2: Updating only full_name');
    const testName = `Test Name ${new Date().getTime().toString().slice(-4)}`;
    const { data: nameData, error: nameError } = await supabase
      .from('users')
      .update({ full_name: testName })
      .eq('id', userId)
      .select('*')
      .single();
      
    if (nameError) {
      log.error('DIAGNOSTIC TEST 2 FAILED: Cannot update name', nameError);
    } else if (nameData) {
      log.success('DIAGNOSTIC TEST 2 PASSED: Name updated successfully', {
        newName: nameData.full_name,
        originalName: nameData.name
      });
    }
  } catch (e) {
    log.error('DIAGNOSTIC TEST 2 ERROR:', e);
  }
  
  // Test 3: Update boolean fields with different formats
  try {
    log.info('DIAGNOSTIC TEST 3: Testing boolean field formats');
    const testData = {
      is_seller: true,       // Boolean true
      is_buyer: true,        // Boolean true
      is_onboarded: true     // Boolean true
    };
    
    const { data: boolData, error: boolError } = await supabase
      .from('users')
      .update(testData)
      .eq('id', userId)
      .select('*')
      .single();
      
    if (boolError) {
      log.error('DIAGNOSTIC TEST 3 FAILED: Cannot update boolean fields', boolError);
    } else if (boolData) {
      log.success('DIAGNOSTIC TEST 3 PASSED: Boolean fields updated successfully', {
        isSeller: boolData.is_seller,
        sellerType: typeof boolData.is_seller,
        isBuyer: boolData.is_buyer,
        buyerType: typeof boolData.is_buyer,
        isOnboarded: boolData.is_onboarded,
        onboardedType: typeof boolData.is_onboarded
      });
    }
  } catch (e) {
    log.error('DIAGNOSTIC TEST 3 ERROR:', e);
  }
  
  // Test 4: Update all profile fields at once
  try {
    log.info('DIAGNOSTIC TEST 4: Comprehensive profile update');
    const timestamp = new Date().getTime().toString().slice(-4);
    const fullTestData = {
      full_name: `Full Test ${timestamp}`,
      bio: `Test bio ${timestamp}`,
      is_seller: true,
      is_buyer: true,
      is_onboarded: true,
      updated_at: new Date().toISOString()
    };
    
    const { data: fullData, error: fullError } = await supabase
      .from('users')
      .update(fullTestData)
      .eq('id', userId)
      .select('*')
      .single();
      
    if (fullError) {
      log.error('DIAGNOSTIC TEST 4 FAILED: Cannot update all profile fields', fullError);
    } else if (fullData) {
      log.success('DIAGNOSTIC TEST 4 PASSED: All profile fields updated successfully', {
        fullName: fullData.full_name,
        bio: fullData.bio ? fullData.bio.substring(0, 20) + '...' : null,
        isSeller: fullData.is_seller,
        isBuyer: fullData.is_buyer,
        isOnboarded: fullData.is_onboarded
      });
    }
  } catch (e) {
    log.error('DIAGNOSTIC TEST 4 ERROR:', e);
  }
  
  // Test 5: Update full_name and name simultaneously
  try {
    log.info('DIAGNOSTIC TEST 5: Testing name field confusion');
    const timestamp = new Date().getTime().toString().slice(-4);
    const nameTestData = {
      full_name: `Full Name ${timestamp}`,
      name: `Name ${timestamp}`
    };
    
    const { data: nameData, error: nameError } = await supabase
      .from('users')
      .update(nameTestData)
      .eq('id', userId)
      .select('*')
      .single();
      
    if (nameError) {
      log.error('DIAGNOSTIC TEST 5 FAILED: Cannot update both name fields', nameError);
    } else if (nameData) {
      log.success('DIAGNOSTIC TEST 5 PASSED: Both name fields updated successfully', {
        fullName: nameData.full_name,
        name: nameData.name,
        // Which one actually shows in the UI?
        effectiveName: nameData.full_name || nameData.name
      });
    }
  } catch (e) {
    log.error('DIAGNOSTIC TEST 5 ERROR:', e);
  }
  
  log.info('DIAGNOSTIC: All tests completed');
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateUserProfile, fetchCurrentUser } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [isSeller, setIsSeller] = useState(true);
  const [isBuyer, setIsBuyer] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Log component mount
  React.useEffect(() => {
    log.info('Profile setup screen mounted', { userId: user?.id });
  }, []);

  const pickImage = async () => {
    try {
      log.info('Requesting media library permissions');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        log.warn('Media library permissions denied');
        setErrorMsg('We need camera roll permissions to set your profile picture');
        return;
      }
      
      log.info('Opening image picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        log.success('Image selected successfully');
        setProfileImage(result.assets[0].uri);
      } else {
        log.info('Image selection canceled');
      }
    } catch (error) {
      log.error('Error picking image', error);
      setErrorMsg('Failed to select image. Please try again.');
    }
  };

  const uploadProfileImage = async (): Promise<string | null> => {
    if (!profileImage) {
      log.info('No profile image to upload');
      return null;
    }
    
    try {
      log.info('Starting profile image upload using uploadUserAvatar');
      
      if (!user) {
        log.error('Cannot upload image - user not authenticated');
        throw new Error('User not authenticated');
      }
      
      // Log image details (size, format, etc.)
      log.info('Image details', { 
        userId: user.id,
        imageUri: profileImage.substring(0, 50) + '...' // Only log part of the URI for privacy
      });
      
      // Use the improved uploadUserAvatar function from supabase.ts
      // This function now properly handles base64 data URLs
      const avatarUrl = await uploadUserAvatar(user.id, profileImage);
      
      if (avatarUrl) {
        log.success('Profile image upload completed', { avatarUrl });
      } else {
        log.warn('Profile image upload completed but no URL returned');
      }
      
      return avatarUrl;
    } catch (error) {
      log.error('Error uploading profile image', error);
      log.info('Continuing profile setup without image');
      return null; // Continue without image
    }
  };

  const handleSubmit = async () => {
    console.log('SUBMIT BUTTON PRESSED - handleSubmit function called');
    log.info('Profile submission initiated');
    
    // Validate form data
    if (!name) {
      log.warn('Submission validation failed: No name provided');
      setErrorMsg('Please enter your name');
      return;
    }

    if (isLoading) {
      log.warn('Submission already in progress');
      return;
    }
    
    setIsLoading(true);
    setErrorMsg(null);
    
    try {
      // Check if we have a user
      if (!user) {
        log.error('Cannot create profile: No authenticated user');
        setErrorMsg('Authentication error. Please sign out and try again.');
        setIsLoading(false);
        return;
      }
      
      console.log('DIRECT UPDATE: Starting profile update with user ID:', user.id);
      
      // Step 1: Prepare profile update data
      const profileUpdateData = {
        full_name: name.trim(),
        bio: bio ? bio.trim() : null,
        is_seller: isSeller,
        is_buyer: isBuyer,
        is_onboarded: true,
        updated_at: new Date().toISOString()
      };
      
      console.log('DIRECT UPDATE: Profile data prepared', profileUpdateData);
      
      // Step 2: Upload image if exists
      let avatarUrl = null;
      if (profileImage) {
        try {
          console.log('DIRECT UPDATE: Uploading profile image');
          avatarUrl = await uploadUserAvatar(user.id, profileImage);
          console.log('DIRECT UPDATE: Avatar uploaded successfully:', avatarUrl);
        } catch (imageError) {
          console.error('DIRECT UPDATE: Image upload failed:', imageError);
        }
      }
      
      // Step 3: Direct database update
      console.log('DIRECT UPDATE: Performing direct database update');
      
      // Explicitly specify only the fields we want to update
      // instead of using spread operator which might include unwanted fields
      // Use proper typing to allow for optional fields
      const updateObject: {
        full_name: string;
        bio: string | null;
        is_seller: boolean;
        is_buyer: boolean;
        updated_at: string;
        avatar_url?: string; // Make avatar_url optional
      } = {
        full_name: name.trim(),
        bio: bio ? bio.trim() : null,
        is_seller: isSeller,
        is_buyer: isBuyer,
        updated_at: new Date().toISOString()
      };
      
      // Only add avatar_url if we have one
      if (avatarUrl) {
        updateObject.avatar_url = avatarUrl;
      }
      
      console.log('DIRECT UPDATE: Final update object:', updateObject);
      
      const { data: updateResult, error: updateError } = await supabase
        .from('users')
        .update(updateObject)
        .eq('id', user.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('DIRECT UPDATE: Database update failed:', updateError);
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }
      
      console.log('DIRECT UPDATE: Profile updated successfully:', updateResult);
      
      // Step 4: Refresh user data and navigate
      try {
        if (fetchCurrentUser) {
          console.log('DIRECT UPDATE: Refreshing user context');
          await fetchCurrentUser();
        }
      } catch (refreshError) {
        console.error('DIRECT UPDATE: Failed to refresh user context:', refreshError);
        // Continue even if refresh fails
      }
      
      // Step 5: Navigate to permissions screen (next step in onboarding)
      console.log('DIRECT UPDATE: Navigation to permissions screen');
      setIsLoading(false);
      router.push('/(onboarding)/permissions');
      
    } catch (error) {
      console.error('DIRECT UPDATE: Overall profile update failed:', error);
      log.error(`Error saving profile: ${error}`);
      setErrorMsg('Failed to save your profile. Please try again.');
      setIsLoading(false);
    }
  };
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.content}>
        <Text style={styles.title}>Create Your Profile</Text>
        <Text style={styles.subtitle}>
          Tell us a bit about yourself to help others connect with you.
        </Text>

        <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
          {profileImage ? (
            <View style={styles.profileImageContainer}>
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>Add Profile Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Bio (Optional)</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            placeholder="Tell others a bit about yourself..."
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.switchContainer}>
          <Text style={styles.label}>I want to sell items</Text>
          <Switch
            value={isSeller}
            onValueChange={setIsSeller}
            trackColor={{ false: '#ccc', true: '#007AFF' }}
          />
        </View>

        <View style={styles.switchContainer}>
          <Text style={styles.label}>I want to buy items</Text>
          <Switch
            value={isBuyer}
            onValueChange={setIsBuyer}
            trackColor={{ false: '#ccc', true: '#007AFF' }}
          />
        </View>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <>
          <TouchableOpacity
            style={[styles.button, !name && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!name}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
          
          {/* Diagnostic tools section */}
          <View style={{
            marginTop: 20,
            padding: 10,
            backgroundColor: '#f0f0f0',
            borderRadius: 8,
            marginBottom: 20
          }}>
            <Text style={{
              fontWeight: 'bold',
              marginBottom: 10,
              textAlign: 'center'
            }}>🔍 Diagnostic Tools</Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#007AFF',
                padding: 10,
                borderRadius: 8,
                alignItems: 'center'
              }}
              onPress={() => {}}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Run Database Tests</Text>
            </TouchableOpacity>
          </View>
        </>
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
  imagePickerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#777',
    textAlign: 'center',
    fontSize: 14,
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
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  loader: {
    marginVertical: 20,
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
    marginTop: 20,
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

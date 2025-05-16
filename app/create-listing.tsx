import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { uploadMultipleImages } from '@/lib/uploadHelpers';
import { getCurrentLocation, LocationData } from '@/lib/locationService';
import * as FileSystem from 'expo-file-system';


const categories = [
  'Furniture', 
  'Electronics', 
  'Clothing', 
  'Books', 
  'Sports', 
  'Home Goods',
  'Toys & Games',
  'Vehicles',
  'Other'
];

export default function CreateListingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('');

  const pickImage = async () => {
    if (images.length >= 5) {
      setError('You can only upload up to 5 images');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        setError('We need camera roll permissions to upload images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImages([...images, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setError('Failed to select image. Please try again.');
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const uploadImages = async (): Promise<string[]> => {
    if (images.length === 0) return [];
    
    console.log('Starting image upload process...');
    setUploadStatus('Preparing images for upload...');
    setUploadProgress(0);
    
    try {
      // Set up progress callback for tracking uploads
      const onProgress = (progress: number, currentIndex: number, total: number) => {
        // Calculate overall progress considering all images
        // Each image contributes its percentage divided by total images
        const baseProgress = (currentIndex / total) * 100;
        const currentItemContribution = (progress / 100) * (100 / total);
        const overallProgress = Math.round(baseProgress + currentItemContribution);
        
        setUploadProgress(overallProgress);
        setUploadStatus(`Uploading image ${currentIndex + 1} of ${total}: ${Math.round(progress)}%`);
      };
      
      // Use the uploadMultipleImages function with all images at once
      // This is more efficient and allows for better progress tracking
      const uploadedUrls = await uploadMultipleImages(
        images,
        'listings',
        user?.id || 'anonymous',
        onProgress
      );
      
      setUploadStatus('Upload complete!');
      setUploadProgress(100);
      console.log(`Upload complete. Total images uploaded: ${uploadedUrls.length}`);
      return uploadedUrls;
    } catch (error) {
      setUploadStatus(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error uploading images:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  const handleSubmit = async () => {
    // Validate inputs
    if (!title) {
      setError('Please enter a title');
      return;
    }
    
    if (!price) {
      setError('Please enter a price');
      return;
    }
    
    if (isNaN(parseFloat(price))) {
      setError('Price must be a number');
      return;
    }
    
    if (!category) {
      setError('Please select a category');
      return;
    }
    
    // Require at least one image for the listing
    if (images.length === 0) {
      setError('Please add at least one image');
      return;
    }
    console.log('Validating image requirement...');

    // Verify user is authenticated
    if (!user?.id) {
      setError('You must be logged in to create a listing');
      return;
    }

    setIsLoading(true);
    setError(null);
    setUploadStatus('Initializing...');
    setUploadProgress(0);
    setLocationStatus('Getting your location...');
    
    try {
      console.log('Starting listing creation process...');
      
      // Upload images to Supabase storage
      console.log('Starting image upload process...');
      let imageUrls: string[] = [];
      
      try {
        // Call the uploadImages function to handle the upload process
        imageUrls = await uploadImages();
        console.log(`Successfully uploaded ${imageUrls.length} images:`, imageUrls);
        setUploadStatus('Creating listing...');
      } catch (uploadError) {
        console.error('Error uploading images:', uploadError);
        setError('Failed to upload images. Please try again.');
        setUploadStatus('Upload failed');
        setIsLoading(false);
        return;
      }
      
      // Get user's current location
      setLocationStatus('Getting your location...');
      let locationData: LocationData | null = null;
      
      try {
        locationData = await getCurrentLocation();
        if (!locationData) {
          console.log('Location not available, using default');
          setLocationStatus('Location not available, using default');
          // Use default location if user's location is not available
          locationData = {
            latitude: 48.8566, // Default to Paris coordinates
            longitude: 2.3522,
            address: 'Paris, France'
          };
        } else {
          console.log('Got user location:', locationData);
          setLocationStatus('Location acquired successfully');
        }
      } catch (locationError) {
        console.error('Error getting location:', locationError);
        setLocationStatus('Failed to get location, using default');
        // Use default location on error
        locationData = {
          latitude: 48.8566,
          longitude: 2.3522,
          address: 'Paris, France'
        };
      }
      
      // Create listing data object
      const listingData = {
        title,
        description,
        price: parseFloat(price),
        category,
        condition: 'good', // Default condition
        seller_id: user.id,
        images: imageUrls, // Store as array (jsonb)
        status: 'active',
        // Add location data for distance-based search
        location: locationData
      };
      
      console.log('Prepared listing data:', JSON.stringify(listingData));
      
      // Insert directly into Supabase instead of using the helper function
      console.log('Inserting listing into Supabase...');
      const { data, error } = await supabase
        .from('listings')
        .insert(listingData)
        .select();
      
      if (error) {
        console.error('Supabase insert error:', error);
        throw new Error(error.message || 'Failed to insert listing into database');
      }
      
      console.log('Listing created successfully:', data);
      
      // Navigate back to home screen
      router.replace('/');
    } catch (error) {
      console.error('Error creating listing:', error);
      if (error instanceof Error) {
        setError(`Failed to create listing: ${error.message}`);
      } else {
        setError('Failed to create listing. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Listing</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="What are you selling?"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={styles.label}>Price ($)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Category</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  category === cat && styles.categoryButtonActive
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text 
                  style={[
                    styles.categoryButtonText,
                    category === cat && styles.categoryButtonTextActive
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your item (condition, features, etc.)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Photos</Text>
          <View style={styles.imagesContainer}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri }} style={styles.image} />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close-circle" size={24} color="white" />
                </TouchableOpacity>
              </View>
            ))}
            
            {images.length < 5 && (
              <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                <Ionicons name="camera-outline" size={30} color="#777" />
                <Text style={styles.addImageText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
          
          {/* Upload Progress Indicator */}
          {isLoading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Upload Progress</Text>
                <Text style={styles.progressPercentage}>{uploadProgress}%</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View 
                  style={[styles.progressBar, { width: `${uploadProgress}%` }]} 
                />
              </View>
              <Text style={styles.progressText}>{uploadStatus}</Text>
              {locationStatus ? (
                <Text style={styles.locationStatus}>{locationStatus}</Text>
              ) : null}
            </View>
          )}

          <TouchableOpacity 
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]} 
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Create Listing</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  form: {
    flex: 1,
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
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoriesContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
  },
  categoryButtonText: {
    color: '#333',
  },
  categoryButtonTextActive: {
    color: 'white',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
    marginBottom: 8,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  addImageText: {
    color: '#777',
    marginTop: 4,
    fontSize: 12,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginVertical: 15,
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6C5CE7',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6C5CE7',
  },
  locationStatus: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

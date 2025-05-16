import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  Image, 
  Dimensions, 
  StatusBar,
  Modal,
  TextInput,
  Alert,
  Animated,
  Easing,
  ActivityIndicator
} from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getNearbyListings, createOffer } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import ProductDetailModal from '@/components/ProductDetailModal';

const { width, height } = Dimensions.get('window');

// Define product type
interface Product {
  id: string;
  title: string;
  price: number;
  distance: number;
  formattedDistance?: string; // Add formatted distance for display
  image: string; // Keep for backward compatibility
  images: string[]; // Array of image URLs
  seller: string;
  seller_id: string;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
  };
  details?: { // Optional structured details
    brand?: string;
    size?: string;
    color?: string;
    condition?: string;
  };
}

// Empty array for products - will be populated from database
const emptyProducts: Product[] = [];

// Distance options
const distanceOptions = [1, 5, 10, 20, 50];

// Function to add a new match to chat matches
const addMatchToChats = (product: Product, offerAmount: number) => {
  // This would normally be a backend API call
  // For now, we're simulating it by adding to a global variable
  // that the chat screen will access
  
  // In a real app, this would be handled by a state management solution or backend
  if (typeof window !== 'undefined') {
    // Create a new chat match from the product
    const newMatch = {
      id: Date.now().toString(),
      productName: product.title,
      price: offerAmount,
      productImage: product.image,
      sellerName: product.seller,
      lastMessage: `I'm interested in your ${product.title}. Would you accept $${offerAmount}?`,
      time: 'Just now',
      unread: 1
    };
    
    // Add to global chatMatches if it exists
    if (!(window as any).globalChatMatches) {
      (window as any).globalChatMatches = [];
    }
    
    (window as any).globalChatMatches.unshift(newMatch);
    
    // Set a flag to indicate new matches
    (window as any).hasNewMatches = true;
  }
};

export default function NearbyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [searchDistance, setSearchDistance] = useState(1);
  const [knobWidth, setKnobWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showDistanceFilter, setShowDistanceFilter] = useState(false);
  
  // Track window dimensions for responsive layout
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : width,
    height: typeof window !== 'undefined' ? window.innerHeight : height
  });
  
  // Update dimensions when window resizes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        setWindowDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);
  
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [showAnimation, setShowAnimation] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const swiperRef = useRef<Swiper<Product>>(null);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const sliderPosition = useRef(new Animated.Value(0)).current;
  
  // State for ProductDetailModal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  
  // Fetch listings based on search distance
  const fetchListings = useCallback(async (distance?: number) => {
    if (!user) return;
    
    setIsLoading(true);
    console.log('Fetching nearby listings...');
    
    try {
      const distanceToUse = distance !== undefined ? distance : searchDistance;
      console.log(`Search radius: ${distanceToUse}km`);
      
      const listings = await getNearbyListings(user.id, distanceToUse);
      
      // Convert Supabase listings to Product format
      const formattedProducts: Product[] = listings.map(listing => ({
        id: listing.id,
        title: listing.title,
        price: listing.price,
        distance: listing.distance || 0,
        formattedDistance: listing.formattedDistance || `${(listing.distance || 0).toFixed(1)} km`,
        image: listing.main_image_url || 'https://images.unsplash.com/photo-1627843563095-f6e94676cfe0',
        // Handle images array, with fallback
        images: listing.images && listing.images.length > 0 
          ? listing.images 
          : [listing.main_image_url || 'https://images.unsplash.com/photo-1627843563095-f6e94676cfe0'],
        seller: listing.seller,
        seller_id: listing.seller_id || '',
        description: listing.description || '',
        location: listing.location,
        details: listing.details || {}, // Include structured details
      }));
      
      console.log(`Found ${formattedProducts.length} nearby listings`);
      setProducts(formattedProducts);
    } catch (error) {
      console.error('Error fetching listings:', error);
      // Fallback to sample products if there's an error
      setProducts(emptyProducts.filter(p => p.distance <= searchDistance));
    } finally {
      setIsLoading(false);
    }
  }, [user, searchDistance]);
  
  // Fetch listings when component mounts or search distance changes
  useEffect(() => {
    fetchListings();
  }, [fetchListings, searchDistance]);
  
  // Calculate the current position based on the search distance
  useEffect(() => {
    const index = distanceOptions.indexOf(searchDistance);
    const position = (index / (distanceOptions.length - 1)) * 100;
    sliderPosition.setValue(position);
  }, [searchDistance]);
  
  // Slider references and state
  const sliderWidth = useRef<number>(0);
  
  // RadiusSlider component for selecting search distance
const RadiusSlider = ({ radius, setRadius, onRadiusChange }: { 
  radius: number; 
  setRadius: (val: number) => void;
  onRadiusChange?: () => void;
}) => {
  return (
    <View style={styles.radiusSliderContainer}>
      <View style={styles.sliderWrapper}>
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={radius}
          onChange={(e) => {
            const newValue = Number(e.target.value);
            setRadius(newValue);
          }}
          onMouseUp={onRadiusChange}
          onTouchEnd={onRadiusChange}
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#E5E7EB',
            borderRadius: '8px',
            accentColor: '#6C5CE7',
            cursor: 'pointer',
            WebkitAppearance: 'none',
            appearance: 'none',
          }}
        />
      </View>
      <Text style={styles.radiusValue}>Current radius: {radius} km</Text>
    </View>
  );
};

  // Animation for the swoosh effect
  const startAnimation = () => {
    setShowAnimation(true);
    animatedValue.setValue(0);
    
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true
    }).start(() => {
      setShowAnimation(false);
    });
    
    // Note: In a real app, we would play a sound effect here
    console.log('Swoosh sound would play here');
  };

  const handleSwipeRight = (cardIndex: number) => {
    // Use real products if available, otherwise fall back to sample products
    const productsToUse = products.length > 0 ? products : emptyProducts;
    const product = productsToUse[cardIndex];
    setCurrentProduct(product);
    setOfferAmount(product.price.toString());
    setOfferModalVisible(true);
  };

  const handleOfferPress = (product: Product) => {
    setCurrentProduct(product);
    setOfferModalVisible(true);
    setOfferAmount(product.price.toString()); // Default to product price
  };

  // Function to open product detail modal
  const openProductModal = (product: Product) => {
    console.log('Opening modal for product:', product.id);
    setSelectedProductForModal(product);
    setModalVisible(true);
  };

  const handleSwipeLeft = (cardIndex: number) => {
    // Use real products if available, otherwise fall back to sample products
    const productsToUse = products.length > 0 ? products : emptyProducts;
    console.log('Skipped product:', productsToUse[cardIndex].title);
  };

  const handleLike = useCallback(() => {
    if (!currentProduct) return;
    
    console.log(`Liked: ${currentProduct.title}`);
    
    // Show the offer modal
    setOfferModalVisible(true);
  }, [currentProduct]);

  const handleSendOffer = async () => {
    if (!currentProduct || !user) {
      console.error('Missing currentProduct or user:', { currentProduct, user });
      Alert.alert('Error', 'Missing product or user information. Please try again.');
      return;
    }
    
    const amount = parseFloat(offerAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid offer amount.');
      return;
    }
    
    // Close the modal first
    setOfferModalVisible(false);
    
    // Start the animation and play sound
    startAnimation();
    
    try {
      console.log('🔍 DEBUG - nearby - Creating offer with the following data:');
      console.log(`Creating offer for ${currentProduct.title}`);
      console.log('🔍 DEBUG - nearby - Listing ID:', currentProduct.id);
      console.log('🔍 DEBUG - nearby - Buyer ID:', user.id);
      console.log('🔍 DEBUG - nearby - Seller ID:', currentProduct.seller_id);
      console.log('🔍 DEBUG - nearby - Offer Price:', amount);
      
      // Create a real offer in Supabase
      const offerData = {
        listing_id: currentProduct.id,
        buyer_id: user.id,
        seller_id: currentProduct.seller_id, // Make sure we have the seller ID
        offer_price: amount,
        message: offerAmount !== currentProduct.price.toString() ? 
          `I'm interested in your ${currentProduct.title}. Would you accept $${amount}?` : 
          `I'm interested in your ${currentProduct.title}.`,
        status: 'pending',
        is_test: false // Ensure this is a real offer, not a test one
      };
      
      console.log('🔍 DEBUG - nearby - Full offer data:', JSON.stringify(offerData, null, 2));
      
      console.log('🔍 DEBUG - nearby - Calling createOffer function');
      console.log(`Sending offer: $${amount}`);
      const result = await createOffer(offerData);
      console.log('🔍 DEBUG - nearby - Offer created successfully:', JSON.stringify(result, null, 2));
      console.log(`Offer sent successfully!`);
      
      // Show a brief notification
      setTimeout(() => {
        Alert.alert(
          'Offer Sent!',
          `Your offer of $${amount} for ${currentProduct.title} has been sent to the seller. You'll be notified when they respond.`
        );
      }, 1200); // Wait for animation to finish
    } catch (error) {
      console.error('🔍 DEBUG - nearby - Error creating offer:', error);
      console.log(`Error: ${error instanceof Error ? error.message : 'Failed to send offer'}`);
      console.log('🔍 DEBUG - nearby - Error details:', error instanceof Error ? error.message : String(error));
      console.log('🔍 DEBUG - nearby - Error stack:', error instanceof Error && error.stack ? error.stack : 'No stack trace');
      Alert.alert(
        'Error Creating Offer', 
        `Failed to send offer: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Product Detail Modal */}
      <ProductDetailModal
        visible={modalVisible}
        product={selectedProductForModal}
        onClose={() => setModalVisible(false)}
      />
      
      {/* Debug Overlay removed */}
      
      {/* Swoosh Animation */}
      {showAnimation && (
        <Animated.View
          style={[
            styles.swooshAnimation,
            {
              transform: [
                {
                  translateX: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, width + 100]
                  })
                }
              ],
              opacity: animatedValue.interpolate({
                inputRange: [0, 0.8, 1],
                outputRange: [1, 0.8, 0]
              })
            }
          ]}
        >
          <Ionicons name="mail" size={32} color="#fff" />
        </Animated.View>
      )}
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nearby</Text>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => setShowDistanceFilter(prev => !prev)}
        >
          <Ionicons name="search-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>
      
      {/* Distance Filter */}
      {showDistanceFilter && (
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>
            Search Radius: {searchDistance} km
          </Text>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>1</Text>
            <View 
              style={styles.sliderTrack}
              onLayout={(event) => {
                const { width } = event.nativeEvent.layout;
                sliderWidth.current = width;
              }}
              
            >
              {/* Filled Track */}
              <View style={[styles.sliderFill, { width: `${(searchDistance - 1) / 99 * 100}%` }]} />
              
              {/* Distance Markers */}
              <View style={styles.distanceMarkerContainer}>
                <View style={[styles.distanceMarker, { left: '0%' }]} />
                <View style={[styles.distanceMarker, { left: '25%' }]} />
                <View style={[styles.distanceMarker, { left: '50%' }]} />
                <View style={[styles.distanceMarker, { left: '75%' }]} />
                <View style={[styles.distanceMarker, { left: '100%' }]} />
              </View>
              
              {/* Draggable Knob */}
              <View style={[styles.sliderKnob, { left: `${(searchDistance - 1) / 99 * 100}%` }]}>
                <View style={styles.sliderKnobInner} />
              </View>
            </View>
            <Text style={styles.sliderLabel}>100</Text>
          </View>
          
          {/* Distance Value Display */}
          <Text style={styles.distanceValue}>
            Current radius: {searchDistance} km
          </Text>
        </View>
      )}
      
      {/* Main Content - Product Cards */}
      <View style={styles.cardContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Finding items near you...</Text>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No items found within {searchDistance}km</Text>
            <Text style={styles.emptySubtext}>Try increasing your search distance</Text>
          </View>
        ) : (
          <Swiper
            ref={swiperRef}
            cards={products.length > 0 ? products : emptyProducts}
            renderCard={(product) => (
            <TouchableOpacity 
              style={styles.card}
              onPress={() => openProductModal(product)}
            >
              <Image
                source={{ uri: product.image }}
                style={styles.cardImage}
              />
              {/* Distance badge at the top */}
              <View style={styles.distanceBadge}>
                <Ionicons name="location" size={14} color="#fff" />
                <Text style={styles.distanceText}>
                  {product.formattedDistance || `${product.distance.toFixed(1)} km`}
                </Text>
              </View>
              
              {/* Semi-transparent overlay covering the bottom portion */}
              <View style={styles.cardOverlay}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{product.title}</Text>
                  <Text style={styles.cardPrice}>${product.price}</Text>
                  <View style={styles.sellerContainer}>
                    <Ionicons name="person-circle-outline" size={16} color="#fff" />
                    <Text style={styles.sellerText}>{product.seller}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )} 
          onSwipedRight={handleSwipeRight}
          onSwipedLeft={handleSwipeLeft}
          backgroundColor={'transparent'}
          cardVerticalMargin={20}
          stackSize={3}
          stackSeparation={15}
          animateOverlayLabelsOpacity
          animateCardOpacity
          disableBottomSwipe={true}
          disableTopSwipe={true}
          overlayLabels={{
            left: {
              title: 'SKIP',
              style: {
                label: {
                  backgroundColor: '#FF3B30',
                  color: 'white',
                  fontSize: 16,
                  borderRadius: 10,
                  padding: 10,
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  marginTop: 30,
                  marginLeft: -30,
                },
              },
            },
            right: {
              title: 'OFFER',
              style: {
                label: {
                  backgroundColor: '#34C759',
                  color: 'white',
                  fontSize: 16,
                  borderRadius: 10,
                  padding: 10,
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  marginTop: 30,
                  marginLeft: 30,
                },
              },
            },
          }}
        />
        )}
      </View>
      
      {/* Distance Slider (below the image) */}
      <RadiusSlider 
        radius={searchDistance} 
        setRadius={setSearchDistance}
        onRadiusChange={() => fetchListings(searchDistance)}
      />

      {/* Offer Modal */}
      <Modal
        visible={offerModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOfferModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make an Offer</Text>
              <TouchableOpacity onPress={() => setOfferModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            {currentProduct && (
              <View style={styles.modalItemInfo}>
                <Image 
                  source={{ uri: currentProduct.image }} 
                  style={styles.modalItemImage} 
                />
                <View style={styles.modalItemDetails}>
                  <Text style={styles.modalItemTitle}>{currentProduct.title}</Text>
                  <Text style={styles.modalItemPrice}>Listed for ${currentProduct.price}</Text>
                  <Text style={styles.modalItemSeller}>Seller: {currentProduct.seller}</Text>
                </View>
              </View>
            )}
            
            <Text style={styles.modalLabel}>Your Offer Amount ($)</Text>
            <TextInput
              style={styles.modalInput}
              value={offerAmount}
              onChangeText={setOfferAmount}
              keyboardType="decimal-pad"
              placeholder="Enter amount"
            />
            
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={handleSendOffer}
            >
              <Text style={styles.modalButtonText}>Send Offer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Tab Bar has been moved to the app layout */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // RadiusSlider styles
  radiusSliderContainer: {
    marginHorizontal: 24,
    marginVertical: 12,
    maxWidth: 600,
    alignSelf: 'center',
    width: '92%',
  },
  sliderWrapper: {
    width: '100%',
    marginVertical: 8,
  },
  radiusValue: {
    fontSize: 15,
    color: '#6C5CE7',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  // Filter styles
  filterContainer: {
    backgroundColor: 'white',
    padding: 24,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 16,
    maxWidth: 600,
    alignSelf: 'center',
    width: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  filterLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
    height: 50,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#666',
    width: 30,
    textAlign: 'center',
    fontWeight: '600',
  },
  sliderTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    position: 'relative',
    marginHorizontal: 8,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#6C5CE7',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderKnob: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    position: 'absolute',
    top: -12,
    marginLeft: -16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#6C5CE7',
  },
  sliderKnobInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#6C5CE7',
  },
  distanceMarkerContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  distanceMarker: {
    width: 2,
    height: 8,
    backgroundColor: '#CCCCCC',
    position: 'absolute',
    top: 0,
    zIndex: 5,
  },
  distanceValue: {
    fontSize: 18,
    color: '#6C5CE7',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  distanceLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 38,
    marginTop: 4,
  },
  distanceTickLabel: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    fontWeight: '500',
  },
  // Debug overlay styles removed
  swooshAnimation: {
    position: 'absolute',
    top: height / 2 - 50,
    left: 20,
    zIndex: 1000,
    backgroundColor: '#6C5CE7',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    width: width - 40,
    height: height * 0.65, // Maintain proper height
    maxWidth: 500,
    maxHeight: 600,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
    marginBottom: 60, // Add margin to create space above the slider
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 30, // Add more padding at the bottom
    height: '40%', // Take up 40% of the card height from the bottom
    backgroundColor: 'rgba(0,0,0,0.6)', // Darker overlay for better readability
    // Create a fade effect from bottom to top
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  distanceBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#6C5CE7',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  distanceText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  cardInfo: {
    marginBottom: 10,
    width: '100%',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  cardPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  sellerContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  sellerText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 2,
  },
  // Original slider styles (for another component)
  distanceSliderContainer: {
    padding: 16,
    marginBottom: 20,
    position: 'relative',
  },
  distanceSliderLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  distanceSliderTrack: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginBottom: 30,
    position: 'relative',
    width: '100%',
  },
  sliderMarker: {
    width: 2,
    height: 10,
    backgroundColor: '#ccc',
    position: 'absolute',
    top: -2,
    marginLeft: -1,
  },
  distanceSliderFill: {
    height: 6,
    backgroundColor: '#6C5CE7',
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6C5CE7',
    position: 'absolute',
    top: -7,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sliderLabels: {
    position: 'relative',
    height: 20,
  },
  distanceOption: {
    position: 'absolute',
    transform: [{ translateX: -15 }],
  },
  selectedDistance: {
    backgroundColor: 'transparent',
  },
  distanceOptionText: {
    color: '#666',
    fontSize: 12,
  },
  selectedDistanceText: {
    color: '#6C5CE7',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '85%',
    maxWidth: 450,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalItemInfo: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  modalItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
  },
  modalItemDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  modalItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  modalItemPrice: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  modalItemSeller: {
    fontSize: 14,
    color: '#6C5CE7',
  },
  modalLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 10,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  tabItem: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  tabText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#6C5CE7',
  },
  activeTabText: {
    color: '#6C5CE7',
  },
});

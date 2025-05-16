import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Import MapDisplay component with explicit extension for web platform
import MapDisplay from './MapDisplay.web'; // This will use MapDisplay.web.tsx on web

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  seller: string;
  seller_id: string;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
  };
  details?: {
    brand?: string;
    size?: string;
    color?: string;
    condition?: string;
  };
}

interface ProductDetailModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
}

const THUMBNAIL_SIZE = 60;
const THUMBNAIL_MARGIN = 5;

export default function ProductDetailModal({
  visible,
  product,
  onClose,
}: ProductDetailModalProps) {
  const [selectedImageUri, setSelectedImageUri] = useState<string>('');
  const [activeContentIndex, setActiveContentIndex] = useState(0);
  const contentFlatListRef = useRef<FlatList>(null);
  const thumbnailFlatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (product && product.images && product.images.length > 0) {
      setSelectedImageUri(product.images[0]);
      setActiveContentIndex(0); // Reset to description tab
      if (contentFlatListRef.current) {
        contentFlatListRef.current.scrollToOffset({ offset: 0, animated: false });
      }
    } else if (product) {
      setSelectedImageUri('https://placehold.co/400x300/png?text=No+Image');
    }
  }, [product]);

  if (!product) {
    return null;
  }

  const handleThumbnailPress = (uri: string, index: number) => {
    setSelectedImageUri(uri);
    if (thumbnailFlatListRef.current) {
      thumbnailFlatListRef.current.scrollToIndex({ animated: true, index, viewPosition: 0.5 });
    }
  };

  const renderThumbnail = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      style={[
        styles.thumbnailTouchable,
        item === selectedImageUri && styles.selectedThumbnail,
      ]}
      onPress={() => handleThumbnailPress(item, index)}>
      <Image source={{ uri: item }} style={styles.thumbnailImage} />
    </TouchableOpacity>
  );

  const renderDescription = () => (
    <ScrollView style={styles.contentPage} contentContainerStyle={styles.contentPageScroll}>
      <Text style={styles.productTitleModal}>{product.title}</Text>
      <Text style={styles.productPriceModal}>${product.price.toFixed(2)}</Text>

      {product.details?.brand && <Text style={styles.detailItem}><Text style={styles.detailLabel}>Brand:</Text> {product.details.brand}</Text>}
      {product.details?.size && <Text style={styles.detailItem}><Text style={styles.detailLabel}>Size:</Text> {product.details.size}</Text>}
      {product.details?.color && <Text style={styles.detailItem}><Text style={styles.detailLabel}>Color:</Text> {product.details.color}</Text>}
      {product.details?.condition && <Text style={styles.detailItem}><Text style={styles.detailLabel}>Condition:</Text> {product.details.condition}</Text>}

      <Text style={styles.detailLabel}>Description:</Text>
      <Text style={styles.productDescription}>{product.description || 'No detailed description available.'}</Text>

      <Text style={styles.sellerInfo}>Sold by: {product.seller}</Text>
      {product.location?.city && <Text style={styles.sellerInfo}>Approx. Location: {product.location.city}</Text>}
    </ScrollView>
  );

  const renderMap = () => (
    <View style={styles.contentPage}>
      <MapDisplay
        latitude={product.location?.latitude}
        longitude={product.location?.longitude}
        title={product.title}
        address={product.location?.address}
        city={product.location?.city}
      />
    </View>
  );

  const contentData = [{ key: 'description' }, { key: 'map' }];

  const onContentScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / screenWidth);
    if (newIndex !== activeContentIndex) {
      setActiveContentIndex(newIndex);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitleHeader} numberOfLines={1}>{product.title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close-circle" size={28} color="#555" />
          </TouchableOpacity>
        </View>

        <View style={styles.imageViewerContainer}>
          <Image source={{ uri: selectedImageUri }} style={styles.mainImageModal} resizeMode="contain" />
          {product.images && product.images.length > 1 && (
            <View style={styles.thumbnailContainer}>
              <FlatList
                ref={thumbnailFlatListRef}
                data={product.images}
                renderItem={renderThumbnail}
                keyExtractor={(item, index) => `modal-thumb-${item}-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailListContentContainer}
                bounces={false}
              />
            </View>
          )}
        </View>

        <View style={styles.contentPagerContainer}>
          <FlatList
            ref={contentFlatListRef}
            data={contentData}
            renderItem={({ item }) => item.key === 'description' ? renderDescription() : renderMap()}
            keyExtractor={(item) => `content-page-${item.key}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onContentScroll}
            scrollEventThrottle={16}
            bounces={false}
          />
        </View>
        <View style={styles.indicatorContainer}>
          {contentData.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dotIndicator,
                index === activeContentIndex ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  modalTitleHeader: { /* Renamed to avoid conflict */
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  closeButton: {
    padding: 5,
  },
  imageViewerContainer: {
    width: screenWidth,
    height: screenHeight * 0.40, // Reduced height for main image
    backgroundColor: '#000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainImageModal: { /* Renamed to avoid conflict */
    maxWidth: '100%',
    maxHeight: '100%',
  },
  thumbnailContainer: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: 'rgba(40, 40, 40, 0.75)', // Darker, more contrast
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  thumbnailListContentContainer: { /* Renamed to avoid conflict */
    alignItems: 'center',
  },
  thumbnailTouchable: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 4,
    marginHorizontal: THUMBNAIL_MARGIN, // THUMBNAIL_MARGIN is 0 now, but keep for structure
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedThumbnail: {
    borderColor: '#007AFF',
    transform: [{ scale: 1.05 }], // Slight zoom for selected
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  contentPagerContainer: {
    flex: 1,
  },
  contentPage: {
    width: screenWidth,
    backgroundColor: '#ffffff',
  },
  contentPageScroll: { // For ScrollView inside description page
    padding: 20,
  },
  productTitleModal: { /* Renamed */
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 6,
  },
  productPriceModal: { /* Renamed */
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
    marginBottom: 3,
  },
  detailItem: {
    fontSize: 15,
    color: '#444',
    marginBottom: 4,
    lineHeight: 21,
  },
  productDescription: {
    fontSize: 15,
    color: '#222',
    lineHeight: 22,
    marginBottom: 16,
  },
  sellerInfo: {
    fontSize: 14,
    color: '#555',
    marginTop: 6,
    marginBottom: 3,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    backgroundColor: '#f8f9fa',
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#007AFF',
  },
  inactiveDot: {
    backgroundColor: '#ccc',
  },
});

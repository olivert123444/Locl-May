// components/MapDisplay.web.tsx
import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MapDisplayProps {
  latitude?: number;
  longitude?: number;
  title?: string;
  description?: string;
  address?: string;
  city?: string;
}

export default function MapDisplay({ latitude, longitude, title, address, city }: MapDisplayProps) {
  if (latitude == null || longitude == null) { // Check for null or undefined
    return (
      <View style={styles.centeredContent}>
        <Ionicons name="map-outline" size={50} color="#ccc" />
        <Text style={styles.mapPlaceholderText}>Location data not available for map.</Text>
      </View>
    );
  }

  // Generate a static map URL from Google Maps
  const mapImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=14&size=600x300&markers=color:red%7C${latitude},${longitude}&key=YOUR_API_KEY`;
  
  // Fallback image if no API key is provided
  const fallbackMapUrl = 'https://placehold.co/600x300/png?text=Map+Preview+Unavailable';

  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <Image 
          source={{ uri: fallbackMapUrl }} 
          style={styles.mapImage} 
          resizeMode="cover"
        />
        <View style={styles.mapOverlay}>
          <Ionicons name="location" size={24} color="#e74c3c" />
        </View>
      </View>
      
      <View style={styles.locationInfo}>
        {title && <Text style={styles.locationTitle}>{title}</Text>}
        {address && <Text style={styles.locationAddress}>{address}</Text>}
        {city && !address && <Text style={styles.locationAddress}>{city}</Text>}
      </View>
      
      <TouchableOpacity style={styles.directionsButton} onPress={openGoogleMaps}>
        <Ionicons name="navigate" size={16} color="#fff" />
        <Text style={styles.directionsText}>Get Directions</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#f9f9f9',
  },
  mapContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
    backgroundColor: '#e1e1e1',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -24 }],
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    width: '100%',
    height: '100%',
    backgroundColor: '#f9f9f9',
  },
  mapPlaceholderText: {
    marginTop: 10,
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
  },
  locationInfo: {
    padding: 15,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 8,
    margin: 15,
  },
  directionsText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  }
});

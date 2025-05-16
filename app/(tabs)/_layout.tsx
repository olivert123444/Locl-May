// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MatchNotification from '@/components/MatchNotification';
import { useNotification } from '@/context/NotificationContext';
import ProtectedRoute from '@/app/(auth)/protected';
import BottomTabBar from '@/components/BottomTabBar';

export default function TabsLayout() {
  const { resetMatchCount } = useNotification();

  return (
    <ProtectedRoute>
      <View style={{ flex: 1 }}>
        <MatchNotification />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' } // Hides the default tabs because we use our custom BottomTabBar
          }}>
          <Tabs.Screen name="nearby" />
          <Tabs.Screen name="swipe" /> 
          <Tabs.Screen name="chat" listeners={{ tabPress: () => { resetMatchCount(); } }} /> 
          <Tabs.Screen name="profile" />
          {/* Ensure files like explore.tsx and index.tsx exist in app/(tabs)/ if they are listed here as screens, 
              or remove them if they are not actual tabs.
              For now, assuming 'explore' and 'index' are valid tab screens based on your previous structure.
          */}
          <Tabs.Screen name="explore" /> 
          <Tabs.Screen name="index" />   
        </Tabs>
        <BottomTabBar />
      </View>
    </ProtectedRoute>
  );
}

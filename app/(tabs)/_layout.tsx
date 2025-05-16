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
            tabBarStyle: { display: 'none' } // Hides the default tabs if using custom BottomTabBar
          }}>
          <Tabs.Screen name="nearby" />
          <Tabs.Screen name="swipe" /> {/* This redirects to /archive */}
          <Tabs.Screen name="chat" listeners={{ tabPress: () => { resetMatchCount(); } }} /> {/* This redirects to /chats */}
          <Tabs.Screen name="profile" />
          {/* Ensure 'explore.tsx' and 'index.tsx' (if it's the placeholder) exist in app/(tabs)/
              or remove them from here if they are not meant to be actual tabs.
              For now, let's assume they are valid tab screens.
          */}
          <Tabs.Screen name="explore" />
          <Tabs.Screen name="index" />
        </Tabs>
        <BottomTabBar />
      </View>
    </ProtectedRoute>
  );
}

// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native'; // View might still be useful for MatchNotification
import MatchNotification from '@/components/MatchNotification';
import { useNotification } from '@/context/NotificationContext';
import ProtectedRoute from '@/app/(auth)/protected';
import BottomTabBar from '@/components/BottomTabBar'; // Ensure this path is correct

export default function TabsLayout() {
  const { resetMatchCount } = useNotification();

  return (
    <ProtectedRoute>
      {/* MatchNotification can be here if it's an overlay, or move inside individual screens if content-specific */}
      <MatchNotification />
      <Tabs
        screenOptions={{
          headerShown: false,
        }}
        tabBar={(props) => <BottomTabBar {...props} />} // <<< KEY CHANGE: Use the tabBar prop
      >
        <Tabs.Screen name="nearby" />
        <Tabs.Screen name="swipe" /> 
        <Tabs.Screen name="chat" listeners={{ tabPress: () => { resetMatchCount(); } }} /> 
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="explore" /> 
        <Tabs.Screen name="index" />   
      </Tabs>
      {/* BottomTabBar is now rendered by the Tabs component itself via the tabBar prop */}
    </ProtectedRoute>
  );
}

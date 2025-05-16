// app/(onboarding)/index.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useSegments, useRouter } from 'expo-router'; // Import useRouter

export default function OnboardingIndexSimple() {
  const segments = useSegments();
  const router = useRouter(); // Get router instance

  console.log('[ONBOARDING INDEX SIMPLE] Mounted! Segments:', segments.join('/'));

  // useEffect(() => {
  //   // TEMPORARY: Try to navigate to profile after a short delay
  //   // to see if this screen itself is the issue or the next step
  //   const timer = setTimeout(() => {
  //     console.log('[ONBOARDING INDEX SIMPLE] Attempting to navigate to /onboarding/profile');
  //     router.push('/(onboarding)/profile');
  //   }, 3000);
  //   return () => clearTimeout(timer);
  // }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'lightgreen' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'black' }}>
        ONBOARDING INDEX - TEST SCREEN
      </Text>
      <Text>Current Segments: {segments.join('/')}</Text>
    </View>
  );
}

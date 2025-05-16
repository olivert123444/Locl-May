// app/(onboarding)/start.tsx
import React from 'react';
import { View, Text } from 'react-native';

export default function OnboardingStartUltraSimple() {
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  console.log('[ONBOARDING INDEX ULTRA SIMPLE] Component is attempting to render!');
  console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'yellow', padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'black', textAlign: 'center' }}>
        ULTRA SIMPLE ONBOARDING INDEX SCREEN
      </Text>
      <Text style={{ fontSize: 18, color: 'black', marginTop: 10, textAlign: 'center' }}>
        If you see this yellow screen, the basic file loaded!
      </Text>
    </View>
  );
}

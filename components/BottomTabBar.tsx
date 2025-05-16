import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useNotification } from '@/context/NotificationContext';

// Badge component for notification count
const NotificationBadge = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count}</Text>
    </View>
  );
};

// We're accepting any props from the Tabs component but using our own navigation logic
type BottomTabBarProps = any;

export default function BottomTabBar(_props: BottomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { newMatchCount, resetMatchCount } = useNotification();
  
  // Define the tabs with their routes and icons
  type IconName = React.ComponentProps<typeof Ionicons>['name'];
  
  const tabs = [
    {
      name: 'nearby',
      route: '/(tabs)/nearby',
      label: 'Nearby',
      activeIcon: 'location' as IconName,
      inactiveIcon: 'location-outline' as IconName,
    },
    {
      name: 'archive',
      route: '/(tabs)/swipe',
      label: 'Archive',
      activeIcon: 'archive' as IconName,
      inactiveIcon: 'archive-outline' as IconName,
    },
    {
      name: 'chats',
      route: '/(tabs)/chat',
      label: 'Chats',
      activeIcon: 'chatbubble' as IconName,
      inactiveIcon: 'chatbubble-outline' as IconName,
      badgeCount: newMatchCount,
      onPress: () => resetMatchCount(),
    },
    {
      name: 'profile',
      route: '/(tabs)/profile',
      label: 'Profile',
      activeIcon: 'person' as IconName,
      inactiveIcon: 'person-outline' as IconName,
    },
  ];
  
  // Check if the current route is active
  const isRouteActive = (route: string) => {
    return pathname.startsWith(route);
  };
  
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = isRouteActive(tab.route);
        
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => {
              if (tab.onPress) tab.onPress();
              router.push(tab.route);
            }}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={isActive ? tab.activeIcon : tab.inactiveIcon}
                size={24}
                color={isActive ? '#6C5CE7' : '#8E8E93'}
              />
              {tab.badgeCount ? <NotificationBadge count={tab.badgeCount} /> : null}
            </View>
            <Text
              style={[
                styles.tabLabel,
                isActive && styles.activeTabLabel,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 5,
    paddingBottom: Platform.OS === 'ios' ? 20 : 5,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  iconContainer: {
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 1,
  },
  activeTabLabel: {
    color: '#6C5CE7',
  },
  badge: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: 'red',
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

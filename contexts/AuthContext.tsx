import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User as SupabaseUser, AuthChangeEvent } from '@supabase/supabase-js';
import { addDebugLog } from '@/components/DebugOverlay';

// Enable debug logging
const DEBUG = true;

// Debug logger
const log = {
  info: (message: string, data?: any) => {
    if (DEBUG) {
      if (data) {
        console.log(`[AUTH] 🔵 ${message}`, data);
        addDebugLog('info', `[AUTH] ${message}`, data);
      } else {
        console.log(`[AUTH] 🔵 ${message}`);
        addDebugLog('info', `[AUTH] ${message}`);
      }
    }
  },
  success: (message: string, data?: any) => {
    if (DEBUG) {
      if (data) {
        console.log(`[AUTH] ✅ ${message}`, data);
        addDebugLog('success', `[AUTH] ${message}`, data);
      } else {
        console.log(`[AUTH] ✅ ${message}`);
        addDebugLog('success', `[AUTH] ${message}`);
      }
    }
  },
  warn: (message: string, data?: any) => {
    if (DEBUG) {
      if (data) {
        console.warn(`[AUTH] ⚠️ ${message}`, data);
        addDebugLog('warn', `[AUTH] ${message}`, data);
      } else {
        console.warn(`[AUTH] ⚠️ ${message}`);
        addDebugLog('warn', `[AUTH] ${message}`);
      }
    }
  },
  error: (message: string, error?: any) => {
    if (DEBUG) {
      if (error) {
        console.error(`[AUTH] ❌ ${message}`, error);
        addDebugLog('error', `[AUTH] ${message}`, error);
      } else {
        console.error(`[AUTH] ❌ ${message}`);
        addDebugLog('error', `[AUTH] ${message}`);
      }
    }
  }
};

// Define interface for profile data from users table
interface UserProfile {
  id: string;
  email?: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_seller: boolean;
  is_buyer: boolean;
  is_onboarded: boolean;
  location: any;
  rating?: number;
  review_count?: number;
  created_at: string;
  updated_at: string;
}

// Extended user interface that includes profile data
interface User extends SupabaseUser {
  profile?: UserProfile;
}

// Auth context interface
interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  testConnection: () => Promise<boolean>;
  refreshUserProfile: () => Promise<UserProfile | null>;
  fetchCurrentUser: () => Promise<UserProfile | null>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<UserProfile | null>;
}

// Create the context
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Debug state changes
  useEffect(() => {
    log.info('Auth state changed', { 
      userId: user?.id, 
      email: user?.email,
      hasProfile: !!user?.profile 
    });
  }, [user]);
  
  useEffect(() => {
    log.info('Profile state changed', { 
      profileId: userProfile?.id, 
      isOnboarded: userProfile?.is_onboarded,
      hasLocation: !!userProfile?.location
    });
  }, [userProfile]);
  
  useEffect(() => {
    log.info('Loading state changed', { loading });
  }, [loading]);
  
  // Fetch user profile from database
  const fetchUserProfile = async (authUser: SupabaseUser): Promise<UserProfile | null> => {
    if (!authUser?.id) {
      log.warn('fetchUserProfile called with invalid auth user');
      return null;
    }
    
    try {
      log.info('Fetching user profile', { userId: authUser.id });
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          log.warn('User profile not found in database', { userId: authUser.id });
        } else {
          log.error('Error fetching user profile', error);
        }
        return null;
      }
      
      if (!data) {
        log.warn('No profile data returned from database');
        return null;
      }
      
      // Ensure boolean values are correctly typed
      const profile = {
        ...data,
        // Explicitly convert to boolean using === true comparison
        is_onboarded: Boolean(data.is_onboarded),  // Convert to boolean more loosely
        is_seller: data.is_seller === true,
        is_buyer: data.is_buyer === true
      } as UserProfile;
      
      log.success('User profile fetched successfully', { 
        userId: profile.id, 
        isOnboarded: profile.is_onboarded,
        isOnboardedRawValue: data.is_onboarded,
        isOnboardedValueType: typeof data.is_onboarded,
        hasLocation: !!profile.location
      });
      
      // Update the userProfile state
      setUserProfile(profile);
      
      // Also update the user object with the profile
      const updatedUser: User = {
        ...authUser,
        profile
      };
      setUser(updatedUser);
      
      return profile;
    } catch (error) {
      log.error('Exception in fetchUserProfile', error);
      return null;
    }
  };
  
  // Fetch current user and profile
  const fetchCurrentUser = async (): Promise<UserProfile | null> => {
    try {
      log.info('Fetching current user session');
      
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        log.error('Error getting auth session', sessionError);
        setUser(null);
        setUserProfile(null);
        return null;
      }
      
      if (!session) {
        log.info('No active session found');
        setUser(null);
        setUserProfile(null);
        return null;
      }
      
      if (!session.user) {
        log.warn('Session exists but has no user');
        setUser(null);
        setUserProfile(null);
        return null;
      }
      
      log.info('Auth session found', { 
        userId: session.user.id, 
        email: session.user.email 
      });
      
      // Get the user profile from the database before updating any state
      // This ensures we don't have a state where user exists but profile doesn't
      const profile = await fetchUserProfile(session.user);
      
      // Add diagnostic log for is_onboarded value and type
      if (profile) {
        console.log('[AUTH] Fetched profile, is_onboarded:', profile.is_onboarded, typeof profile.is_onboarded);
      }
      
      // Only if we have a profile, we create a complete user object with profile
      if (profile) {
        const completeUser: User = {
          ...session.user,
          profile
        };
        // Update user state only after we have the complete profile
        setUser(completeUser);
      } else {
        // If no profile exists, just set the basic user info
        setUser(session.user);
      }
      
      return profile;
    } catch (error) {
      log.error('Exception in fetchCurrentUser', error);
      return null;
    }
  };
  
  // Refresh user profile
  const refreshUserProfile = async (): Promise<UserProfile | null> => {
    if (!user) {
      log.warn('Cannot refresh profile: No authenticated user');
      return null;
    }
    
    return await fetchCurrentUser();
  };
  
  // Update user profile
  const updateUserProfile = async (updates: Partial<UserProfile>): Promise<UserProfile | null> => {
    if (!user) {
      log.error('Cannot update profile: No authenticated user');
      return null;
    }
    
    try {
      // Ensure boolean values are properly typed
      const processedUpdates = { ...updates };
      
      // Explicitly ensure boolean fields are properly typed
      if ('is_onboarded' in processedUpdates) {
        processedUpdates.is_onboarded = processedUpdates.is_onboarded === true;
        log.info('Processing is_onboarded value', { 
          rawValue: updates.is_onboarded,
          processedValue: processedUpdates.is_onboarded,
          valueType: typeof processedUpdates.is_onboarded
        });
      }
      
      if ('is_seller' in processedUpdates) {
        processedUpdates.is_seller = processedUpdates.is_seller === true;
      }
      
      if ('is_buyer' in processedUpdates) {
        processedUpdates.is_buyer = processedUpdates.is_buyer === true;
      }
      
      // Ensure text fields are properly handled
      if ('full_name' in processedUpdates && processedUpdates.full_name) {
        processedUpdates.full_name = processedUpdates.full_name.trim();
      }
      
      if ('bio' in processedUpdates) {
        processedUpdates.bio = processedUpdates.bio ? processedUpdates.bio.trim() : null;
      }
      
      log.info('Updating user profile', { 
        userId: user.id,
        fullName: processedUpdates.full_name,
        bio: processedUpdates.bio ? 'Present' : 'Not provided',
        avatarUrl: processedUpdates.avatar_url ? 'Present' : 'Not provided',
        isOnboarded: processedUpdates.is_onboarded,
        isSeller: processedUpdates.is_seller,
        isBuyer: processedUpdates.is_buyer
      });
      
      const { data, error } = await supabase
        .from('users')
        .update(processedUpdates)
        .eq('id', user.id)
        .select('*')
        .single();
      
      if (error) {
        log.error('Failed to update user profile', error);
        return null;
      }
      
      if (!data) {
        log.warn('No data returned from profile update');
        return null;
      }
      
      // Ensure the returned profile has correct boolean types
      const updatedProfile = {
        ...data,
        is_onboarded: Boolean(data.is_onboarded),  // Convert to boolean more loosely
        is_seller: data.is_seller === true,
        is_buyer: data.is_buyer === true
      } as UserProfile;
      
      log.success('User profile updated successfully', { 
        userId: updatedProfile.id,
        fullName: updatedProfile.full_name,
        bio: updatedProfile.bio ? 'Present' : 'Not provided',
        avatarUrl: updatedProfile.avatar_url ? 'Present' : 'Not provided',
        isOnboarded: updatedProfile.is_onboarded,
        isSeller: updatedProfile.is_seller,
        isBuyer: updatedProfile.is_buyer,
        isOnboardedRawValue: data.is_onboarded,
        isOnboardedValueType: typeof data.is_onboarded,
        updatedFields: Object.keys(updates)
      });
      
      // Update the userProfile state
      setUserProfile(updatedProfile);
      
      // Also update the user object with the new profile
      const updatedUser: User = {
        ...user,
        profile: updatedProfile
      };
      setUser(updatedUser);
      
      return updatedProfile;
    } catch (error) {
      log.error('Exception in updateUserProfile', error);
      return null;
    }
  };
  
  // Initialize auth state and listen for changes
  useEffect(() => {
    log.info('Setting up auth state management');
    
    // Initialize auth state
    const initializeAuth = async () => {
      try {
        log.info('Initializing auth state');
        
        // Ensure loading state is true at the beginning
        setLoading(true);
        
        // Get current session first before updating any state
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session || !session.user) {
          // Handle no session case
          log.info('No valid session during initialization');
          setUser(null);
          setUserProfile(null);
          return;
        }
        
        // First fetch the complete profile
        const profile = await fetchUserProfile(session.user);
        
        // Then update both user and profile simultaneously to prevent intermediate state
        if (profile) {
          const completeUser: User = {
            ...session.user,
            profile
          };
          // Update user with complete profile in a single state update
          setUser(completeUser);
        } else {
          // If no profile exists, just set the basic user
          setUser(session.user);
        }
        
        log.success('Auth initialization complete');
      } catch (error) {
        log.error('Auth initialization failed', error);
        setUser(null);
        setUserProfile(null);
      } finally {
        // Always set loading to false when done
        setLoading(false);
      }
    };
    
    // Start initialization
    initializeAuth();
    
    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session) => {
        log.info('Auth state changed', { event, userId: session?.user?.id });
        
        // Handle different auth events
        if (event === 'SIGNED_IN') {
          log.info('User signed in', { userId: session?.user?.id });
          if (session?.user) {
            await fetchUserProfile(session.user);
          }
        } else if (event === 'SIGNED_OUT') {
          log.info('User signed out');
          setUser(null);
          setUserProfile(null);
        } else if (event === 'USER_UPDATED') {
          log.info('User data updated', { userId: session?.user?.id });
          if (session?.user) {
            await fetchUserProfile(session.user);
          }
        } else if (event === 'TOKEN_REFRESHED') {
          log.info('Auth token refreshed', { userId: session?.user?.id });
          if (session?.user) {
            await fetchUserProfile(session.user);
          }
        } else if (event === 'PASSWORD_RECOVERY') {
          log.info('Password recovery initiated');
        } else {
          // Default case for any other events
          log.info(`Unhandled auth event: ${event}`);
          // Refresh user data for any other events if we have a session
          if (session?.user) {
            await fetchUserProfile(session.user);
          } else {
            // No user in session for this event
            setUser(null);
            setUserProfile(null);
          }
        }
      }
    );
    
    // Cleanup subscription when component unmounts
    return () => {
      log.info('Cleaning up auth listener');
      authListener.subscription.unsubscribe();
    };
  }, []);
  
  // Sign in with email
  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      log.info('Signing in with email', { email });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        log.error('Sign in failed', error);
        throw error;
      }
      
      if (!data.user) {
        log.error('Sign in returned no user');
        throw new Error('No user returned from sign in');
      }
      
      log.success('Sign in successful', { userId: data.user.id });
      
      // User profile will be fetched by the auth state change listener
    } catch (error) {
      log.error('Exception in signInWithEmail', error);
      throw error;
    }
  };
  
  // Sign up with email
  const signUpWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      log.info('Signing up with email', { email });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://locl-marketplace.com',
        },
      });
      
      if (error) {
        log.error('Sign up failed', error);
        throw error;
      }
      
      if (!data.user) {
        log.error('Sign up returned no user');
        throw new Error('No user returned from sign up');
      }
      
      log.success('Sign up successful', { userId: data.user.id });
      
      // If no session, email confirmation is required
      if (!data.session) {
        log.info('Email confirmation required');
      } else {
        log.info('User auto-confirmed, session created');
        // User profile will be created by database trigger and fetched by auth state change listener
      }
    } catch (error) {
      log.error('Exception in signUpWithEmail', error);
      throw error;
    }
  };
  
  // Sign out
  const signOut = async (): Promise<void> => {
    try {
      log.info('Signing out');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        log.error('Sign out failed', error);
        throw error;
      }
      
      log.success('Sign out successful');
      
      // User state will be cleared by the auth state change listener
    } catch (error) {
      log.error('Exception in signOut', error);
      throw error;
    }
  };
  
  // Test connection
  const testConnection = async (): Promise<boolean> => {
    try {
      log.info('Testing connection');
      
      // Test auth
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        log.error('Auth test failed', authError);
        return false;
      }
      
      // Test database
      const { data, error: dbError } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (dbError) {
        log.error('Database test failed', dbError);
        return false;
      }
      
      log.success('Connection test successful');
      return true;
    } catch (error) {
      log.error('Exception in testConnection', error);
      return false;
    }
  };
  
  // Return the provider with all the auth functions and state
  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        testConnection,
        refreshUserProfile,
        fetchCurrentUser,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

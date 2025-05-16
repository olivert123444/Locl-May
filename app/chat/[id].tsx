import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { respondToOffer } from '@/lib/supabase';

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  image_url?: string;
  is_mine: boolean;
};

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { id, otherUserId, otherUserName, listingId, listingTitle } = params;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [listingDetails, setListingDetails] = useState<any>(null);
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [offerDetails, setOfferDetails] = useState<any>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const subscription = useRef<any>(null);

  useEffect(() => {
    if (user && id) {
      fetchMessages();
      fetchListingDetails();
      fetchOtherUserProfile();
      fetchOfferDetails();
      subscribeToMessages();
    }
    
    return () => {
      if (subscription.current) {
        subscription.current.unsubscribe();
      }
    };
  }, [user, id]);

  const fetchMessages = async () => {
    if (!user || !id) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', id)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }
      
      if (data) {
        const formattedMessages = data.map(message => ({
          ...message,
          is_mine: message.sender_id === user.id
        }));
        
        setMessages(formattedMessages);
        
        // Mark messages as read
        const unreadMessages = data.filter(
          message => !message.is_read && message.sender_id !== user.id
        );
        
        if (unreadMessages.length > 0) {
          const unreadIds = unreadMessages.map(msg => msg.id);
          await supabase
            .from('messages')
            .update({ is_read: true })
            .in('id', unreadIds);
        }
      }
    } catch (error) {
      console.error('Error in fetchMessages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchListingDetails = async () => {
    if (!listingId) return;
    
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single();
      
      if (error) {
        console.error('Error fetching listing details:', error);
        return;
      }
      
      if (data) {
        setListingDetails(data);
      }
    } catch (error) {
      console.error('Error in fetchListingDetails:', error);
    }
  };

  const fetchOtherUserProfile = async () => {
    if (!otherUserId) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherUserId)
        .single();
      
      if (error) {
        console.error('Error fetching other user profile:', error);
        return;
      }
      
      if (data) {
        setOtherUserProfile(data);
      }
    } catch (error) {
      console.error('Error in fetchOtherUserProfile:', error);
    }
  };

  const fetchOfferDetails = async () => {
    if (!id) return;
    
    try {
      // First get the chat to find the associated offer
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('offer_id')
        .eq('id', id)
        .single();
      
      if (chatError || !chatData?.offer_id) {
        return;
      }
      
      // Then get the offer details
      const { data: offerData, error: offerError } = await supabase
        .from('offers')
        .select('*')
        .eq('id', chatData.offer_id)
        .single();
      
      if (offerError) {
        console.error('Error fetching offer details:', offerError);
        return;
      }
      
      if (offerData) {
        setOfferDetails(offerData);
      }
    } catch (error) {
      console.error('Error in fetchOfferDetails:', error);
    }
  };

  const subscribeToMessages = () => {
    if (!id) return;
    
    subscription.current = supabase
      .channel(`chat:${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `chat_id=eq.${id}`
      }, payload => {
        const newMessage: Message = {
          id: payload.new.id,
          content: payload.new.content,
          sender_id: payload.new.sender_id,
          created_at: payload.new.created_at,
          image_url: payload.new.image_url,
          is_mine: payload.new.sender_id === user?.id
        };
        
        setMessages(prevMessages => [...prevMessages, newMessage]);
        
        // Mark the message as read if it's not mine
        if (!newMessage.is_mine && !payload.new.is_read) {
          supabase
            .from('messages')
            .update({ is_read: true })
            .eq('id', payload.new.id)
            .then(() => console.log('Message marked as read'));
        }
      })
      .subscribe();
  };

  const sendMessage = async () => {
    if (!user || !id || !newMessage.trim()) return;
    
    try {
      setSending(true);
      
      const messageData = {
        chat_id: id,
        sender_id: user.id,
        content: newMessage.trim(),
        is_read: false
      };
      
      const { error } = await supabase
        .from('messages')
        .insert(messageData);
      
      if (error) {
        console.error('Error sending message:', error);
        Alert.alert('Error', 'Failed to send message');
        return;
      }
      
      // Update the last_message_at field in the chat
      await supabase
        .from('chats')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', id);
      
      setNewMessage('');
    } catch (error) {
      console.error('Error in sendMessage:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!offerDetails || !user) return;
    
    try {
      const result = await respondToOffer(offerDetails.id, 'accept');
      
      if (!result.success) {
        Alert.alert('Error', 'Failed to accept offer');
        return;
      }
      
      // Refresh offer details
      fetchOfferDetails();
      
      // Refresh messages to show the system message
      fetchMessages();
      
      Alert.alert('Success', 'Offer accepted successfully');
    } catch (error) {
      console.error('Error in handleAcceptOffer:', error);
      Alert.alert('Error', 'Failed to accept offer');
    }
  };

  const handleDeclineOffer = async () => {
    if (!offerDetails || !user) return;
    
    try {
      const result = await respondToOffer(offerDetails.id, 'decline');
      
      if (!result.success) {
        Alert.alert('Error', 'Failed to decline offer');
        return;
      }
      
      Alert.alert('Success', 'Offer declined successfully');
      
      // Navigate back to messages
      router.push('/(tabs)/chat');
    } catch (error) {
      console.error('Error in handleDeclineOffer:', error);
      Alert.alert('Error', 'Failed to decline offer');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      // Handle image upload and sending
      // This would involve uploading to Supabase storage and then sending a message with the image URL
      Alert.alert('Feature coming soon', 'Image sharing will be available in a future update');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isSystemMessage = item.sender_id === 'system';
    
    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
        </View>
      );
    }
    
    return (
      <View style={[
        styles.messageContainer,
        item.is_mine ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        {item.image_url && (
          <Image 
            source={{ uri: item.image_url }} 
            style={styles.messageImage} 
            resizeMode="cover"
          />
        )}
        <View style={[
          styles.messageBubble,
          item.is_mine ? styles.myMessageBubble : styles.otherMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            item.is_mine ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.messageTime}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  const ListingHeader = () => {
    if (!listingDetails) return null;
    
    return (
      <View style={styles.listingHeaderContainer}>
        <Image 
          source={{ 
            uri: listingDetails.main_image_url || 
                 (Array.isArray(listingDetails.images) && listingDetails.images.length > 0 
                  ? listingDetails.images[0] 
                  : 'https://via.placeholder.com/300x300?text=No+Image')
          }} 
          style={styles.listingImage} 
        />
        <View style={styles.listingInfo}>
          <Text style={styles.listingTitle}>{listingDetails.title}</Text>
          <Text style={styles.listingPrice}>${listingDetails.price}</Text>
        </View>
      </View>
    );
  };

  const OfferActions = () => {
    if (!offerDetails || offerDetails.status !== 'pending' || !user) return null;
    
    // Only show offer actions to the seller
    const isSeller = listingDetails?.seller_id === user.id;
    if (!isSeller) return null;
    
    return (
      <View style={styles.offerActionsContainer}>
        <Text style={styles.offerText}>
          Pending offer: ${offerDetails.offer_price}
        </Text>
        <View style={styles.offerButtons}>
          <TouchableOpacity 
            style={[styles.offerButton, styles.declineButton]}
            onPress={handleDeclineOffer}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.offerButton, styles.acceptButton]}
            onPress={handleAcceptOffer}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <Stack.Screen 
        options={{
          headerTitle: otherUserName as string || 'Chat',
          headerBackTitle: 'Back',
          headerTintColor: '#6C5CE7',
        }}
      />
      
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6C5CE7" />
          </View>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.messagesContainer}
              ListHeaderComponent={
                <>
                  <ListingHeader />
                  <OfferActions />
                  {messages.length === 0 && (
                    <View style={styles.chatStartedContainer}>
                      <Text style={styles.chatStartedText}>
                        Chat started. You can now message each other about this item.
                      </Text>
                    </View>
                  )}
                </>
              }
              onContentSizeChange={() => {
                if (messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }
              }}
            />
            
            <View style={styles.inputContainer}>
              <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
                <Ionicons name="image-outline" size={24} color="#6C5CE7" />
              </TouchableOpacity>
              
              <TextInput
                style={styles.input}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                placeholderTextColor="#999"
                multiline
              />
              
              <TouchableOpacity 
                style={[
                  styles.sendButton,
                  (!newMessage.trim() || sending) && styles.disabledSendButton
                ]}
                onPress={sendMessage}
                disabled={!newMessage.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 2,
  },
  myMessageBubble: {
    backgroundColor: '#6C5CE7',
  },
  otherMessageBubble: {
    backgroundColor: '#E5E5EA',
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 10,
    color: '#8E8E93',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSendButton: {
    backgroundColor: '#C7C7CC',
  },
  listingHeaderContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginVertical: 12,
    alignItems: 'center',
  },
  listingImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  listingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  listingPrice: {
    fontSize: 16,
    color: '#6C5CE7',
    fontWeight: 'bold',
    marginTop: 4,
  },
  chatStartedContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginVertical: 12,
    alignItems: 'center',
  },
  chatStartedText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageText: {
    fontSize: 14,
    color: '#8E8E93',
    backgroundColor: 'rgba(229, 229, 234, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    textAlign: 'center',
  },
  offerActionsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginVertical: 12,
  },
  offerText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  offerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  offerButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  acceptButton: {
    backgroundColor: '#6C5CE7',
  },
  declineButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  declineButtonText: {
    color: '#8E8E93',
    fontWeight: 'bold',
  },
});

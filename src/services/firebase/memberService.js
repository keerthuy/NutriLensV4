import { db } from './firebaseConfig';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getStorageKey = (userId) => `@nutrilens_members_${userId || 'default'}`;

/**
 * Retrieve locally cached family members
 */
const getLocalMembers = async (userId) => {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('[memberService] Error reading local members:', err);
    return [];
  }
};

/**
 * Persist locally cached family members
 */
const setLocalMembers = async (userId, members) => {
  try {
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(members));
  } catch (err) {
    console.warn('[memberService] Error saving local members:', err);
  }
};

/**
 * Add a family member for a user.
 * Attempts Firestore write first; gracefully falls back to local storage if permissions or network fail.
 */
export const addFamilyMember = async (userId, memberData) => {
  const effectiveUserId = userId || 'default_user';
  const newMemberRecord = {
    ...memberData,
    userId: effectiveUserId,
    createdAt: new Date().toISOString()
  };

  try {
    const docRef = await addDoc(collection(db, 'members'), newMemberRecord);
    const memberWithId = { id: docRef.id, ...newMemberRecord };

    // Update local cache
    const currentLocal = await getLocalMembers(effectiveUserId);
    await setLocalMembers(effectiveUserId, [...currentLocal.filter(m => m.id !== docRef.id), memberWithId]);

    return docRef.id;
  } catch (error) {
    console.warn('[memberService] Firestore addDoc failed, storing locally:', error?.message || error);

    // Fallback: Generate local ID and persist to AsyncStorage
    const localId = `local_member_${Date.now()}`;
    const localMember = {
      id: localId,
      ...newMemberRecord,
      isLocal: true
    };

    const currentLocal = await getLocalMembers(effectiveUserId);
    await setLocalMembers(effectiveUserId, [...currentLocal, localMember]);

    return localId;
  }
};

/**
 * Get all family members belonging to a user.
 * Merges Firestore remote documents with any locally saved members.
 */
export const getFamilyMembers = async (userId) => {
  const effectiveUserId = userId || 'default_user';
  let remoteMembers = [];

  try {
    const q = query(collection(db, 'members'), where('userId', '==', effectiveUserId));
    const querySnapshot = await getDocs(q);
    remoteMembers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.warn('[memberService] Firestore query failed, falling back to local storage:', error?.message || error);
  }

  // Retrieve and merge local members
  const localMembers = await getLocalMembers(effectiveUserId);
  const memberMap = new Map();

  // Add remote first
  remoteMembers.forEach(m => memberMap.set(m.id, m));

  // Merge local members (or add local-only members)
  localMembers.forEach(m => {
    if (!memberMap.has(m.id)) {
      memberMap.set(m.id, m);
    }
  });

  return Array.from(memberMap.values());
};

/**
 * Update a family member profile
 */
export const updateFamilyMember = async (memberId, updates) => {
  const updatePayload = {
    ...updates,
    updatedAt: new Date().toISOString()
  };

  try {
    if (memberId && !memberId.startsWith('local_')) {
      const docRef = doc(db, 'members', memberId);
      await updateDoc(docRef, updatePayload);
    }
  } catch (error) {
    console.warn('[memberService] Firestore update failed, updating local only:', error?.message || error);
  }

  // Update in all local member storage caches
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const memberKeys = allKeys.filter(k => k.startsWith('@nutrilens_members_'));

    for (const key of memberKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const list = JSON.parse(raw);
        const index = list.findIndex(m => m.id === memberId);
        if (index !== -1) {
          list[index] = { ...list[index], ...updatePayload };
          await AsyncStorage.setItem(key, JSON.stringify(list));
        }
      }
    }
    return true;
  } catch (err) {
    console.warn('[memberService] Error updating local member cache:', err);
    return true;
  }
};

/**
 * Delete a family member
 */
export const deleteFamilyMember = async (memberId) => {
  try {
    if (memberId && !memberId.startsWith('local_')) {
      await deleteDoc(doc(db, 'members', memberId));
    }
  } catch (error) {
    console.warn('[memberService] Firestore delete failed, deleting local only:', error?.message || error);
  }

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const memberKeys = allKeys.filter(k => k.startsWith('@nutrilens_members_'));

    for (const key of memberKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const list = JSON.parse(raw);
        const filtered = list.filter(m => m.id !== memberId);
        await AsyncStorage.setItem(key, JSON.stringify(filtered));
      }
    }
    return true;
  } catch (err) {
    console.warn('[memberService] Error deleting from local member cache:', err);
    return true;
  }
};

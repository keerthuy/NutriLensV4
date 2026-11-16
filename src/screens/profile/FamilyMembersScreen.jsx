import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { getFamilyMembers, deleteFamilyMember } from '../../services/firebase/memberService';
import { useAuth } from '../../hooks/useAuth';
import { typography } from '../../utils/typography';
import { wp, hp, fs, STATUS_BAR_HEIGHT } from '../../utils/responsive';

export default function FamilyMembersScreen() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user, userProfile, activeProfile, switchProfile } = useAuth();
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused && user) {
            loadMembers();
        }
    }, [isFocused, user]);

    const loadMembers = async () => {
        setLoading(true);
        try {
            const family = await getFamilyMembers(user.uid);
            setMembers(family);
        } catch (error) {
            console.error("Error loading family members:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectMember = (member) => {
        switchProfile(member);
        navigation.goBack();
    };

    const selectMainUser = () => {
        switchProfile(null);
        navigation.goBack();
    };

    const confirmDeleteMember = (item) => {
        const memberName = item.fullName || item.name || 'this member';
        Alert.alert(
            "Delete Member",
            `Are you sure you want to delete ${memberName}? This will remove their profile and health settings.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await deleteFamilyMember(item.id);
                            if (activeProfile && activeProfile.id === item.id) {
                                switchProfile(null);
                            }
                            await loadMembers();
                        } catch (error) {
                            console.error("Error deleting member:", error);
                            Alert.alert("Error", "Could not delete family member.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderMember = ({ item }) => {
        const isActive = activeProfile && activeProfile.id === item.id;
        return (
            <TouchableOpacity
                style={[styles.memberCard, isActive && styles.memberCardActive]}
                onPress={() => handleSelectMember(item)}
                activeOpacity={0.8}
            >
                <View style={[styles.avatarCircle, isActive && styles.avatarCircleActive]}>
                    <Feather name="user" size={fs(22)} color={isActive ? "#009933" : "#666666"} />
                </View>
                <View style={styles.memberInfo}>
                    <View style={styles.nameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>{item.fullName || item.name}</Text>
                        {isActive && (
                            <View style={styles.activeTag}>
                                <Text style={styles.activeTagText}>Active</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.memberDiet} numberOfLines={1}>{item.dietPreference || 'No Diet Preference'}</Text>
                </View>
                <View style={styles.cardActions}>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={(e) => {
                            e.stopPropagation?.();
                            navigation.navigate('AddMember', { member: item });
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Edit member"
                    >
                        <Feather name="edit-2" size={fs(16)} color="#555555" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.deleteBtn]}
                        onPress={(e) => {
                            e.stopPropagation?.();
                            confirmDeleteMember(item);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Delete member"
                    >
                        <Feather name="trash-2" size={fs(16)} color="#E74C3C" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={fs(24)} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Family Members</Text>
                <View style={styles.dummy} />
            </View>

            <View style={styles.container}>
                <Text style={styles.sectionTitle}>Select Profile</Text>

                {/* Main User Profile Card */}
                <TouchableOpacity
                    style={[styles.memberCard, (!activeProfile || (activeProfile.id === userProfile?.id) || activeProfile.email) && styles.memberCardActive]}
                    onPress={selectMainUser}
                    activeOpacity={0.8}
                >
                    <View style={[styles.avatarCircle, (!activeProfile || (activeProfile.id === userProfile?.id) || activeProfile.email) && styles.avatarCircleActive]}>
                        <Feather name="user" size={fs(22)} color="#009933" />
                    </View>
                    <View style={styles.memberInfo}>
                        <View style={styles.nameRow}>
                            <Text style={styles.memberName} numberOfLines={1}>{userProfile?.fullName || 'Main Account'}</Text>
                            {(!activeProfile || (activeProfile.id === userProfile?.id) || activeProfile.email) && (
                                <View style={styles.activeTag}>
                                    <Text style={styles.activeTagText}>Active</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.memberDiet} numberOfLines={1}>{userProfile?.dietPreference || 'Not Specified'}</Text>
                    </View>
                    {(!activeProfile || (activeProfile.id === userProfile?.id) || activeProfile.email) && (
                        <Feather name="check-circle" size={fs(20)} color="#009933" />
                    )}
                </TouchableOpacity>

                <View style={styles.divider} />

                {loading ? (
                    <ActivityIndicator size="large" color="#009933" style={{ marginTop: hp(4) }} />
                ) : members.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Feather name="users" size={fs(40)} color="#CCCCCC" />
                        <Text style={styles.emptyText}>No family members added yet.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={members}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMember}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: hp(24) }}
                    />
                )}
            </View>

            <TouchableOpacity
                style={styles.addButton}
                onPress={() => navigation.navigate('AddMember')}
                activeOpacity={0.8}
            >
                <Feather name="plus" size={fs(20)} color="#FFFFFF" style={{ marginRight: wp(2) }} />
                <Text style={styles.addButtonText}>Add New Member</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#EEF5EE',
        paddingTop: Platform.OS === 'android' ? STATUS_BAR_HEIGHT : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: wp(5),
        paddingVertical: hp(2),
        backgroundColor: '#EEF5EE',
    },
    headerTitle: {
        fontFamily: typography.fonts.bold,
        fontSize: fs(18),
        color: '#1A1A1A',
    },
    backButton: {
        padding: wp(2),
        marginLeft: -wp(2),
    },
    dummy: {
        width: wp(10),
    },
    container: {
        flex: 1,
        paddingHorizontal: wp(5),
    },
    sectionTitle: {
        fontFamily: typography.fonts.semiBold,
        fontSize: fs(16),
        color: '#666666',
        marginBottom: hp(2),
        marginTop: hp(1),
    },
    memberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: wp(4),
        borderRadius: wp(4),
        marginBottom: hp(1.5),
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    memberCardActive: {
        borderColor: '#009933',
        backgroundColor: '#FAFFFC',
    },
    avatarCircle: {
        width: wp(12),
        height: wp(12),
        borderRadius: wp(6),
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: wp(3.5),
    },
    avatarCircleActive: {
        backgroundColor: '#D2F0DA',
    },
    memberInfo: {
        flex: 1,
        marginRight: wp(2),
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: hp(0.5),
    },
    memberName: {
        fontFamily: typography.fonts.semiBold,
        fontSize: fs(15),
        color: '#1A1A1A',
        flexShrink: 1,
    },
    activeTag: {
        backgroundColor: '#E2F6E8',
        paddingHorizontal: wp(2),
        paddingVertical: hp(0.2),
        borderRadius: wp(2),
        marginLeft: wp(2),
    },
    activeTagText: {
        fontFamily: typography.fonts.semiBold,
        fontSize: fs(10),
        color: '#009933',
    },
    memberDiet: {
        fontFamily: typography.fonts.medium,
        fontSize: fs(12),
        color: '#666666',
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionBtn: {
        width: wp(8.5),
        height: wp(8.5),
        borderRadius: wp(4.25),
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: wp(2),
    },
    deleteBtn: {
        backgroundColor: '#FDECEC',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E5E5',
        marginVertical: hp(2),
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: hp(4),
    },
    emptyText: {
        fontFamily: typography.fonts.medium,
        fontSize: fs(14),
        color: '#999999',
        marginTop: hp(2),
    },
    addButton: {
        position: 'absolute',
        bottom: hp(14),
        left: wp(5),
        right: wp(5),
        backgroundColor: '#009933',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: hp(2),
        borderRadius: wp(4),
        shadowColor: '#009933',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    addButtonText: {
        fontFamily: typography.fonts.bold,
        fontSize: fs(16),
        color: '#FFFFFF',
    }
});

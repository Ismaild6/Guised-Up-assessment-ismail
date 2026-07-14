import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { timeAgo } from '../utils/timeAgo';

const COLORS = {
  ink: '#2C2420',
  muted: '#7A6F66',
  card: '#FFFCF7',
  border: '#E8DFD3',
  accent: '#C45C3E',
  accentSoft: '#F3E0DA',
};

export default function PostCard({ post, onReact }) {
  const initial = post.author?.username?.[0]?.toUpperCase() || '?';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.username}>@{post.author?.username}</Text>
          <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
        </View>
      </View>

      <Text style={styles.body}>{post.text}</Text>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.reactBtn, post.user_has_reacted && styles.reactBtnActive]}
          onPress={() => onReact(post)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={post.user_has_reacted ? 'heart' : 'heart-outline'}
            size={18}
            color={post.user_has_reacted ? COLORS.accent : COLORS.muted}
          />
          <Text style={[styles.reactLabel, post.user_has_reacted && styles.reactLabelActive]}>
            {post.user_has_reacted ? 'felt that' : 'react'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accent,
  },
  meta: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
  },
  time: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.ink,
  },
  footer: {
    marginTop: 14,
    flexDirection: 'row',
  },
  reactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FAF7F2',
  },
  reactBtnActive: {
    backgroundColor: COLORS.accentSoft,
  },
  reactLabel: {
    marginLeft: 6,
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '500',
  },
  reactLabelActive: {
    color: COLORS.accent,
  },
});

export { COLORS };

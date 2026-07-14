import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PostCard, { COLORS } from '../components/PostCard';
import {
  fetchFeed,
  logView,
  reactToPost,
  searchPosts,
} from '../api/client';

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const viewedRef = useRef(new Set());

  const loadFeed = useCallback(async (pageNum = 1, replace = false) => {
    try {
      if (pageNum === 1 && !replace) setLoading(true);
      if (pageNum > 1) setLoadingMore(true);
      setError(null);

      const res = await fetchFeed(pageNum);
      setLastPage(res.meta.last_page);
      setPage(res.meta.current_page);

      setPosts((prev) => (replace || pageNum === 1 ? res.data : [...prev, ...res.data]));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed(1, true);
  }, [loadFeed]);

  const onRefresh = () => {
    setRefreshing(true);
    setSearchResults(null);
    setQuery('');
    loadFeed(1, true);
  };

  const onEndReached = () => {
    if (searchResults !== null) return;
    if (loadingMore || loading || page >= lastPage) return;
    loadFeed(page + 1);
  };

  const runSearch = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const res = await searchPosts(trimmed);
      setSearchResults(res.data);
    } catch (e) {
      setError(e.message);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleReact = async (post) => {
    if (post.user_has_reacted) return;

    const updater = (list) =>
      list.map((p) => (p.id === post.id ? { ...p, user_has_reacted: true } : p));

    if (searchResults !== null) {
      setSearchResults((prev) => updater(prev));
    } else {
      setPosts((prev) => updater(prev));
    }

    try {
      await reactToPost(post.id);
    } catch (e) {
      // revert on failure
      const reverter = (list) =>
        list.map((p) => (p.id === post.id ? { ...p, user_has_reacted: false } : p));
      if (searchResults !== null) setSearchResults((prev) => reverter(prev));
      else setPosts((prev) => reverter(prev));
    }
  };

  const trackView = useCallback(async (postId) => {
    if (viewedRef.current.has(postId)) return;
    viewedRef.current.add(postId);
    try {
      await logView(postId);
    } catch {
      viewedRef.current.delete(postId);
    }
  }, []);

  const displayData = searchResults !== null ? searchResults : posts;

  const renderEmpty = () => {
    if (loading || searching) return null;
    return (
      <View style={styles.centerBox}>
        <Text style={styles.emptyTitle}>Nothing here yet</Text>
        <Text style={styles.emptySub}>
          {searchResults !== null
            ? 'Try a different search — like "travel stories" or "real day".'
            : 'Pull down to refresh. Your feed ranks by real connection, not likes.'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.logo}>guised up</Text>
        <Text style={styles.tagline}>real connections</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search — e.g. funny travel stories"
          placeholderTextColor="#A89E94"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            if (t.trim() === '') setSearchResults(null);
          }}
          onSubmitEditing={() => runSearch(query)}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setSearchResults(null);
            }}
          >
            <Ionicons name="close-circle" size={18} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadFeed(1, true)}>
            <Text style={styles.retry}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && posts.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading your feed…</Text>
        </View>
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View onLayout={() => trackView(item.id)}>
              <PostCard post={item} onReact={handleReact} />
            </View>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.accent} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    paddingTop: 56,
  },
  topBar: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  logo: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 8,
  },
  emptySub: {
    textAlign: 'center',
    color: COLORS.muted,
    lineHeight: 22,
    fontSize: 14,
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#FFF0EB',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#9A3B28',
    flex: 1,
    fontSize: 13,
  },
  retry: {
    color: COLORS.accent,
    fontWeight: '600',
    marginLeft: 12,
  },
});

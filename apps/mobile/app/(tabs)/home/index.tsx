import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAppTheme } from '@/hooks/useAppTheme'
import { usePursuits, useCreatePursuit } from '@/hooks/useProjects'

const PROJECT_COLORS = ['#9e2a2b', '#58a4b0', '#67934d', '#efcb68', '#8b5e83', '#c97d4e']

export default function HomeScreen() {
  const { colors } = useAppTheme()
  const { data: projects, isLoading } = usePursuits()
  const createProject = useCreatePursuit()

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [pickedColor, setPickedColor] = useState(PROJECT_COLORS[0])

  const router = useRouter()
  const borderColor = colors.cardBorder

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      await createProject.mutateAsync({ name, color: pickedColor, description: newGoal.trim() || undefined })
      setNewName('')
      setNewGoal('')
      setPickedColor(PROJECT_COLORS[0])
      setShowCreate(false)
    } catch {
      Alert.alert('Could not create project', 'Try a different name.')
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.wordmark, { fontFamily: 'Merriweather-Bold', color: colors.foreground }]}>
          Projects
        </Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} hitSlop={12}>
          <Ionicons name="add" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Create project inline form */}
      {showCreate && (
        <View style={[styles.createCard, { backgroundColor: colors.cardBg, borderColor }]}>
          <TextInput
            style={[styles.nameInput, { fontFamily: 'Poppins-Medium', color: colors.foreground }]}
            placeholder="Project name"
            placeholderTextColor={colors.foregroundMuted}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            returnKeyType="next"
          />
          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
          <TextInput
            style={[styles.goalInput, { fontFamily: 'Poppins-Regular', color: colors.foreground }]}
            placeholder="What are you trying to build or figure out? (optional)"
            placeholderTextColor={colors.foregroundSubtle}
            value={newGoal}
            onChangeText={setNewGoal}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
            multiline
          />
          <View style={styles.colorRow}>
            {PROJECT_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setPickedColor(c)}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  pickedColor === c && styles.colorDotActive,
                ]}
              />
            ))}
          </View>
          <View style={styles.createActions}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={[styles.actionText, { fontFamily: 'Poppins-Regular', color: colors.foregroundMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate} disabled={!newName.trim() || createProject.isPending}>
              <Text style={[styles.actionText, { fontFamily: 'Poppins-SemiBold', color: colors.terra }]}>
                {createProject.isPending ? 'Creating…' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Projects list */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.foregroundMuted} />
      ) : (
        <FlatList
          data={projects ?? []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { fontFamily: 'Merriweather-Regular', color: colors.foregroundMuted }]}>
                No projects yet.
              </Text>
              <Text style={[styles.emptyHint, { fontFamily: 'Poppins-Regular', color: colors.foregroundSubtle }]}>
                Tap + to create your first project.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/home/projects/${item.id}`)}
              activeOpacity={0.7}
              style={[styles.projectCard, { backgroundColor: colors.cardBg, borderColor }]}
            >
              <View style={[styles.colorBar, { backgroundColor: item.color ?? colors.terra }]} />
              <View style={styles.projectInfo}>
                <Text style={[styles.projectName, { fontFamily: 'Poppins-Medium', color: colors.foreground }]}>
                  {item.name}
                </Text>
                {item.description ? (
                  <Text style={[styles.projectDesc, { fontFamily: 'Poppins-Regular', color: colors.foregroundMuted }]}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.foregroundSubtle} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  wordmark: { fontSize: 22 },
  createCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  nameInput: { fontSize: 15, padding: 0 },
  divider: { height: 1 },
  goalInput: { fontSize: 13, padding: 0, minHeight: 40 },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  colorDotActive: {
    transform: [{ scale: 1.25 }],
    borderWidth: 2,
    borderColor: '#fff',
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
  },
  actionText: { fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  colorBar: { width: 4, alignSelf: 'stretch' },
  projectInfo: { flex: 1, padding: 16, gap: 2 },
  projectName: { fontSize: 15 },
  projectDesc: { fontSize: 13 },
  empty: { paddingTop: 80, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16 },
  emptyHint: { fontSize: 13 },
})

import type { DatabaseFixture, Item } from '@/utils/database'
import { FontAwesome } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { useColorScheme } from '@/hooks/useColorScheme'
import {
  addItem,
  buildRandomItemPayload,
  createManagedDatabase,
  deleteItem,
  getDatabaseFixtures,
  getItems,
  removeDatabaseFixture,
} from '@/utils/database'
import { ThemedText } from './ThemedText'
import { ThemedView } from './ThemedView'

interface DatabaseSection {
  fixture: DatabaseFixture
  items: Item[]
}

interface DatabaseItemsProps {
  style?: any
}

export function DatabaseItems({ style }: DatabaseItemsProps) {
  const [databaseSections, setDatabaseSections] = useState<DatabaseSection[]>([])
  const [addingPath, setAddingPath] = useState<string | null>(null)
  const [creatingDatabase, setCreatingDatabase] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [removingDatabasePath, setRemovingDatabasePath] = useState<string | null>(null)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const palette = isDark
    ? {
        screen: '#1C1C1E',
        card: '#2C2C2E',
        cardSoft: '#3A3A3C',
        cardBorder: '#48484A',
        accent: '#0A84FF',
        accentSoft: '#1E3A8A',
        path: '#B8B8B8',
        button: '#0A84FF',
        buttonText: '#F5F5F5',
        buttonMuted: '#0066CC',
        danger: '#FF3B30',
      }
    : {
        screen: '#FFFFFF',
        card: '#FFFFFF',
        cardSoft: '#F8F8F8',
        cardBorder: '#C8C8C8',
        accent: '#007AFF',
        accentSoft: '#BEE3F8',
        path: '#616161',
        button: '#007AFF',
        buttonText: '#FFFFFF',
        buttonMuted: '#0066CC',
        danger: '#FF3B30',
      }

  const fetchDatabaseSections = useCallback(async () => {
    try {
      const fixtures = await getDatabaseFixtures()
      const sections = await Promise.all(
        fixtures.map(async fixture => ({
          fixture,
          items: await getItems(fixture.databaseName, fixture.directory),
        })),
      )

      setDatabaseSections(sections)
    }
    catch (error) {
      console.error('Error fetching items:', error)
      setDatabaseSections([])
    }
    finally {
      setLoading(false)
    }
  }, [])

  const handleDelete = async (id: number, fixture: DatabaseFixture) => {
    try {
      await deleteItem(id, fixture.databaseName, fixture.directory)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await fetchDatabaseSections()
    }
    catch (error) {
      console.error('Error deleting item:', error)
    }
  }

  const handleAddDatabase = async () => {
    try {
      setCreatingDatabase(true)
      await createManagedDatabase()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await fetchDatabaseSections()
    }
    catch (error) {
      console.error('Error creating database:', error)
    }
    finally {
      setCreatingDatabase(false)
    }
  }

  const handleAddRandomRow = async (fixture: DatabaseFixture) => {
    try {
      setAddingPath(fixture.path)
      const payload = buildRandomItemPayload()
      await addItem(
        payload.title,
        payload.description,
        payload.jsonData,
        fixture.databaseName,
        fixture.directory,
      )
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await fetchDatabaseSections()
    }
    catch (error) {
      console.error('Error adding random item:', error)
    }
    finally {
      setAddingPath(null)
    }
  }

  const handleRemoveDatabase = async (fixture: DatabaseFixture) => {
    try {
      setRemovingDatabasePath(fixture.path)
      await removeDatabaseFixture(fixture)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await fetchDatabaseSections()
    }
    catch (error) {
      console.error('Error removing database:', error)
    }
    finally {
      setRemovingDatabasePath(null)
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchDatabaseSections()
    setRefreshing(false)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [fetchDatabaseSections])

  useEffect(() => {
    fetchDatabaseSections()
  }, [fetchDatabaseSections])

  const formatCellValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return 'NULL'
    }

    if (typeof value === 'string') {
      return value
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    try {
      return JSON.stringify(value)
    }
    catch {
      return String(value)
    }
  }

  const renderTableCell = (value: unknown, width: number, align: 'left' | 'right' = 'left') => (
    <View
      style={[
        styles.tableCell,
        {
          width,
          borderColor: palette.cardBorder,
        },
      ]}
    >
      <ThemedText
        style={[
          styles.tableCellText,
          styles.tableColumnValue,
          align === 'right' ? styles.alignRight : undefined,
        ]}
        numberOfLines={4}
      >
        {formatCellValue(value)}
      </ThemedText>
    </View>
  )

  const renderTableHeader = () => (
    <View
      style={[
        styles.tableHeaderRow,
        {
          backgroundColor: palette.cardSoft,
          borderColor: palette.cardBorder,
        },
      ]}
    >
      <View style={[styles.tableHeaderCell, styles.idColumn]}>
        <ThemedText style={[styles.tableHeaderText, { color: palette.path }]}>id</ThemedText>
      </View>
      <View style={[styles.tableHeaderCell, styles.titleColumn]}>
        <ThemedText style={[styles.tableHeaderText, { color: palette.path }]}>title</ThemedText>
      </View>
      <View style={[styles.tableHeaderCell, styles.descriptionColumn]}>
        <ThemedText style={[styles.tableHeaderText, { color: palette.path }]}>description</ThemedText>
      </View>
      <View style={[styles.tableHeaderCell, styles.createdAtColumn]}>
        <ThemedText style={[styles.tableHeaderText, { color: palette.path }]}>created_at</ThemedText>
      </View>
      <View style={[styles.tableHeaderCell, styles.jsonColumn]}>
        <ThemedText style={[styles.tableHeaderText, { color: palette.path }]}>json_data</ThemedText>
      </View>
      <View style={[styles.tableHeaderCell, styles.actionsColumn]}>
        <ThemedText style={[styles.tableHeaderText, { color: palette.path }]}>actions</ThemedText>
      </View>
    </View>
  )

  const renderTableRow = (
    item: Item,
    fixture: DatabaseFixture,
    index: number,
  ) => (
    <View
      style={[
        styles.tableRow,
        {
          backgroundColor: index % 2 === 0 ? palette.card : palette.cardSoft,
          borderColor: palette.cardBorder,
        },
      ]}
    >
      {renderTableCell(item.id, styles.idColumn.width as number, 'right')}
      {renderTableCell(item.title, styles.titleColumn.width as number)}
      {renderTableCell(item.description, styles.descriptionColumn.width as number)}
      {renderTableCell(new Date(item.created_at).toLocaleString(), styles.createdAtColumn.width as number)}
      {renderTableCell(item.jsonData ?? item.json_data, styles.jsonColumn.width as number)}
      <View
        style={[
          styles.tableCell,
          styles.actionsColumn,
          styles.tableActionCell,
          {
            borderColor: palette.cardBorder,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.deleteButton,
            {
              opacity: pressed ? 0.72 : 1,
              borderColor: palette.danger,
            },
          ]}
          onPress={() => handleDelete(item.id, fixture)}
        >
          <FontAwesome name="trash" size={16} color={palette.danger} />
        </Pressable>
      </View>
    </View>
  )

  const RefreshButton = () => (
    <Pressable
      style={({ pressed }) => [
        styles.refreshButton,
        {
          opacity: pressed || refreshing ? 0.86 : 1,
          backgroundColor: refreshing ? palette.buttonMuted : palette.button,
        },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onRefresh()
      }}
      disabled={refreshing}
    >
      <View style={styles.refreshContent}>
        {refreshing
          ? <ActivityIndicator color={palette.buttonText} />
          : <FontAwesome name="refresh" size={18} color={palette.buttonText} />}
        <ThemedText style={[styles.refreshLabel, { color: palette.buttonText }]}>
          Refresh all databases
        </ThemedText>
      </View>
    </Pressable>
  )

  const AddRandomRowButton = ({ fixture }: { fixture: DatabaseFixture }) => {
    const isAdding = addingPath === fixture.path

    return (
      <Pressable
        style={({ pressed }) => [
          styles.addButton,
          {
            opacity: pressed || isAdding ? 0.86 : 1,
            backgroundColor: isAdding ? palette.buttonMuted : palette.button,
          },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          handleAddRandomRow(fixture)
        }}
        disabled={isAdding}
      >
        <View style={styles.addButtonContent}>
          {isAdding
            ? <ActivityIndicator size="small" color={palette.buttonText} />
            : <FontAwesome name="plus" size={16} color={palette.buttonText} />}
          <ThemedText style={[styles.addButtonLabel, { color: palette.buttonText }]}>
            Add random row
          </ThemedText>
        </View>
      </Pressable>
    )
  }

  const AddDatabaseButton = () => (
    <Pressable
      style={({ pressed }) => [
        styles.refreshButton,
        {
          opacity: pressed || creatingDatabase ? 0.86 : 1,
          backgroundColor: creatingDatabase ? palette.buttonMuted : palette.button,
        },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        handleAddDatabase()
      }}
      disabled={creatingDatabase}
    >
      <View style={styles.refreshContent}>
        {creatingDatabase
          ? <ActivityIndicator color={palette.buttonText} />
          : <FontAwesome name="database" size={18} color={palette.buttonText} />}
        <ThemedText style={[styles.refreshLabel, { color: palette.buttonText }]}>
          Add database
        </ThemedText>
      </View>
    </Pressable>
  )

  const RemoveDatabaseButton = ({ fixture }: { fixture: DatabaseFixture }) => {
    const isRemoving = removingDatabasePath === fixture.path

    if (!fixture.removable) {
      return null
    }

    return (
      <Pressable
        style={({ pressed }) => [
          styles.removeDatabaseButton,
          {
            opacity: pressed || isRemoving ? 0.72 : 1,
            borderColor: palette.danger,
            backgroundColor: isRemoving ? palette.cardSoft : 'transparent',
          },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          handleRemoveDatabase(fixture)
        }}
        disabled={isRemoving}
      >
        <View style={styles.removeDatabaseButtonContent}>
          {isRemoving
            ? <ActivityIndicator size="small" color={palette.danger} />
            : <FontAwesome name="trash" size={16} color={palette.danger} />}
          <ThemedText style={[styles.removeDatabaseButtonLabel, { color: palette.danger }]}>
            Remove database
          </ThemedText>
        </View>
      </Pressable>
    )
  }

  return (
    <ThemedView style={[styles.container, style, { backgroundColor: palette.screen }]}>
      {loading
        ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={palette.accent} />
              <ThemedText style={styles.loadingText}>
                Loading databases...
              </ThemedText>
            </View>
          )
        : databaseSections.length === 0
          ? (
              <View style={styles.emptyWrap}>
                <ThemedText type="subtitle">No databases found</ThemedText>
                <ThemedText style={styles.emptyText}>
                  Pull to refresh or use the button below.
                </ThemedText>
              </View>
            )
          : (
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={(
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={colorScheme === 'dark' ? '#FFFFFF' : '#000000'}
                  />
                )}
                style={styles.list}
              >
                {databaseSections.map(({ fixture, items }) => (
                  <ThemedView
                    key={fixture.path}
                    style={[
                      styles.sectionCard,
                      {
                        backgroundColor: palette.card,
                        borderColor: palette.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.sectionTopRow}>
                      <View style={styles.sectionTitleWrap}>
                        <ThemedText type="subtitle">{fixture.databaseName}</ThemedText>
                        <ThemedText style={[styles.sectionDescription, { color: palette.path }]}>
                          {fixture.description}
                        </ThemedText>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: palette.accentSoft }]}>
                        <ThemedText style={[styles.countBadgeText, { color: palette.accent }]}>
                          {items.length}
                          {' '}
                          {items.length === 1 ? 'row' : 'rows'}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={[styles.pathCard, { backgroundColor: palette.cardSoft }]}>
                      <ThemedText style={styles.pathLabel}>Database path</ThemedText>
                      <ThemedText style={[styles.pathText, { color: palette.path }]}>
                        {fixture.path}
                      </ThemedText>
                    </View>

                    <View style={styles.sectionActions}>
                      <AddRandomRowButton fixture={fixture} />
                      <RemoveDatabaseButton fixture={fixture} />
                    </View>

                    {items.length === 0
                      ? (
                          <View style={[styles.emptyDatabaseCard, { backgroundColor: palette.cardSoft }]}>
                            <ThemedText style={styles.emptyDatabaseText}>
                              No rows in this database.
                            </ThemedText>
                          </View>
                        )
                      : (
                          <View
                            style={[
                              styles.tableShell,
                              {
                                backgroundColor: palette.card,
                                borderColor: palette.cardBorder,
                              },
                            ]}
                          >
                            <ThemedText style={[styles.tableNote, { color: palette.path }]}>
                              Swipe sideways to inspect all columns.
                            </ThemedText>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={styles.tableScrollContent}
                            >
                              <View style={styles.table}>
                                {renderTableHeader()}
                                {items.map((item, index) => (
                                  <View key={`${fixture.path}-${item.id}`}>
                                    {renderTableRow(item, fixture, index)}
                                  </View>
                                ))}
                              </View>
                            </ScrollView>
                          </View>
                        )}
                  </ThemedView>
                ))}
              </ScrollView>
            )}

      <View style={styles.refreshButtonWrap}>
        <AddDatabaseButton />
        <RefreshButton />
      </View>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 110,
  },
  sectionCard: {
    marginBottom: 18,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
  },
  sectionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionDescription: {
    marginTop: 4,
    opacity: 0.92,
  },
  countBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pathCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  pathLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.6,
    marginBottom: 6,
  },
  pathText: {
    fontSize: 12,
    lineHeight: 18,
  },
  sectionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  addButton: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  tableShell: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableNote: {
    fontSize: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  tableScrollContent: {
    paddingBottom: 2,
  },
  table: {
    minWidth: 1040,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tableCell: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    minHeight: 64,
  },
  tableCellText: {
    fontSize: 14,
    lineHeight: 20,
  },
  tableColumnValue: {
    flexShrink: 1,
  },
  tableActionCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  idColumn: {
    width: 78,
  },
  titleColumn: {
    width: 190,
  },
  descriptionColumn: {
    width: 260,
  },
  createdAtColumn: {
    width: 190,
  },
  jsonColumn: {
    width: 260,
  },
  actionsColumn: {
    width: 98,
  },
  alignRight: {
    textAlign: 'right',
  },
  refreshButtonWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    gap: 12,
  },
  refreshButton: {
    minHeight: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  refreshContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  removeDatabaseButton: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  removeDatabaseButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeDatabaseButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 14,
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
  emptyDatabaseCard: {
    padding: 16,
    borderRadius: 16,
  },
  emptyDatabaseText: {
    opacity: 0.7,
  },
})

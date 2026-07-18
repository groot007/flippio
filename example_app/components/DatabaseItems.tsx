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
  deleteItem,
  getDatabaseFixtures,
  getItems,
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
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const palette = isDark
    ? {
        screen: '#0D141A',
        card: '#13212B',
        cardSoft: '#1A2D39',
        cardBorder: '#29404E',
        accent: '#8CE0B8',
        accentSoft: '#163A30',
        path: '#9BB2C1',
        button: '#9AE6B4',
        buttonText: '#092014',
        buttonMuted: '#527266',
        danger: '#FF8A8A',
      }
    : {
        screen: '#F4F7F2',
        card: '#FFFFFF',
        cardSoft: '#EEF5F0',
        cardBorder: '#D7E4DB',
        accent: '#1F7A57',
        accentSoft: '#D8F1E1',
        path: '#5E7165',
        button: '#1F7A57',
        buttonText: '#F7FFFB',
        buttonMuted: '#7AA38F',
        danger: '#C94F4F',
      }

  const fetchDatabaseSections = useCallback(async () => {
    try {
      const fixtures = getDatabaseFixtures()
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchDatabaseSections()
    setRefreshing(false)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [fetchDatabaseSections])

  useEffect(() => {
    fetchDatabaseSections()
  }, [fetchDatabaseSections])

  const renderArray = (array: any[], label: string) => {
    if (!array || array.length === 0)
      return null

    return (
      <ThemedView style={styles.jsonSection}>
        <ThemedText type="defaultSemiBold">
          {label}
          :
          {' '}
        </ThemedText>
        <ThemedText>{array.join(', ')}</ThemedText>
      </ThemedView>
    )
  }

  const renderSimpleObject = (obj: any, label: string) => {
    if (!obj)
      return null

    const pairs = Object.entries(obj)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')

    return (
      <ThemedView style={styles.jsonSection}>
        <ThemedText type="defaultSemiBold">
          {label}
          :
          {' '}
        </ThemedText>
        <ThemedText>{pairs}</ThemedText>
      </ThemedView>
    )
  }

  const renderObjectList = (
    list: any[],
    label: string,
    nameKey: string = 'name',
    valueKey?: string,
  ) => {
    if (!list || list.length === 0)
      return null

    return (
      <ThemedView style={styles.jsonSection}>
        <ThemedText type="defaultSemiBold">
          {label}
          :
          {' '}
        </ThemedText>
        <ThemedView style={styles.jsonNestedList}>
          {list.map((item, index) => (
            <ThemedText key={index}>
              •
              {' '}
              {item[nameKey]}
              {valueKey && item[valueKey] ? ` (${item[valueKey]})` : ''}
            </ThemedText>
          ))}
        </ThemedView>
      </ThemedView>
    )
  }

  const renderSmartHomeData = (jsonData: any) => {
    return (
      <ThemedView style={styles.jsonContainer}>
        <ThemedText type="defaultSemiBold" style={styles.jsonTitle}>
          Product Details
        </ThemedText>

        {jsonData.product && (
          <ThemedView style={styles.jsonSection}>
            <ThemedText type="defaultSemiBold">Product: </ThemedText>
            <ThemedText>
              {jsonData.product.name}
              {' '}
              - $
              {jsonData.product.price}
            </ThemedText>
            <ThemedText style={styles.jsonSubtext}>
              Category:
              {' '}
              {jsonData.product.category}
              {' '}
              (SKU:
              {' '}
              {jsonData.product.sku}
              )
            </ThemedText>
          </ThemedView>
        )}

        {renderArray(jsonData.features, 'Features')}

        {jsonData.compatibility && (
          <>
            {renderArray(jsonData.compatibility.systems, 'Compatible With')}
            {renderArray(jsonData.compatibility.wiring, 'Wiring Options')}
          </>
        )}

        {jsonData.ratings && (
          <ThemedView style={styles.jsonSection}>
            <ThemedText type="defaultSemiBold">Rating: </ThemedText>
            <ThemedText>
              {jsonData.ratings.average}
              /5 (
              {jsonData.ratings.count}
              {' '}
              reviews)
            </ThemedText>
          </ThemedView>
        )}

        <ThemedView style={styles.jsonSection}>
          <ThemedText type="defaultSemiBold">Availability: </ThemedText>
          <ThemedText>
            {jsonData.inStock ? 'In Stock' : 'Out of Stock'}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    )
  }

  const renderRecipeData = (jsonData: any) => {
    return (
      <ThemedView style={styles.jsonContainer}>
        <ThemedText type="defaultSemiBold" style={styles.jsonTitle}>
          Recipe Details
        </ThemedText>

        {jsonData.recipe && (
          <ThemedView style={styles.jsonSection}>
            <ThemedText type="defaultSemiBold">
              {jsonData.recipe.name}
            </ThemedText>
            <ThemedText style={styles.jsonSubtext}>
              Prep:
              {' '}
              {jsonData.recipe.prepTime}
              {' '}
              | Cook:
              {' '}
              {jsonData.recipe.cookTime}
              {' '}
              |
              {jsonData.recipe.difficulty}
            </ThemedText>
          </ThemedView>
        )}

        {jsonData.ingredients
          && renderObjectList(
            jsonData.ingredients,
            'Ingredients',
            'name',
            'amount',
          )}

        {jsonData.nutrition
          && renderSimpleObject(jsonData.nutrition, 'Nutrition')}

        {renderArray(jsonData.tags, 'Tags')}
      </ThemedView>
    )
  }

  const renderFitnessData = (jsonData: any) => {
    return (
      <ThemedView style={styles.jsonContainer}>
        <ThemedText type="defaultSemiBold" style={styles.jsonTitle}>
          Fitness Class Details
        </ThemedText>

        {jsonData.class && (
          <ThemedView style={styles.jsonSection}>
            <ThemedText type="defaultSemiBold">
              {jsonData.class.name}
            </ThemedText>
            <ThemedText style={styles.jsonSubtext}>
              {jsonData.class.duration}
              {' '}
              | Level:
              {jsonData.class.level}
            </ThemedText>
            <ThemedText style={styles.jsonSubtext}>
              Instructor:
              {' '}
              {jsonData.class.instructor}
            </ThemedText>
          </ThemedView>
        )}

        {jsonData.schedule && (
          <ThemedView style={styles.jsonSection}>
            <ThemedText type="defaultSemiBold">Schedule: </ThemedText>
            <ThemedView style={styles.jsonNestedList}>
              {jsonData.schedule.map((slot: any, index: number) => (
                <ThemedText key={index}>
                  •
                  {' '}
                  {slot.day}
                  {' '}
                  at
                  {' '}
                  {slot.time}
                </ThemedText>
              ))}
            </ThemedView>
          </ThemedView>
        )}

        {renderArray(jsonData.equipment, 'Equipment')}
        {renderArray(jsonData.benefits, 'Benefits')}

        {jsonData.studio && (
          <ThemedView style={styles.jsonSection}>
            <ThemedText type="defaultSemiBold">Location: </ThemedText>
            <ThemedText>{jsonData.studio.name}</ThemedText>
            <ThemedText style={styles.jsonSubtext}>
              {jsonData.studio.location}
              ,
              {jsonData.studio.room}
            </ThemedText>
          </ThemedView>
        )}
      </ThemedView>
    )
  }

  const renderAppUpdateData = (jsonData: any) => {
    return (
      <ThemedView style={styles.jsonContainer}>
        <ThemedText type="defaultSemiBold" style={styles.jsonTitle}>
          App Update Details
        </ThemedText>

        {jsonData.update && (
          <ThemedView style={styles.jsonSection}>
            <ThemedText type="defaultSemiBold">
              Version
              {' '}
              {jsonData.update.version}
            </ThemedText>
            <ThemedText style={styles.jsonSubtext}>
              Released:
              {' '}
              {jsonData.update.releaseDate}
              {' '}
              | Size:
              {' '}
              {jsonData.update.size}
            </ThemedText>
            <ThemedText style={styles.jsonSubtext}>
              {jsonData.update.required ? 'Required Update' : 'Optional Update'}
            </ThemedText>
          </ThemedView>
        )}

        {jsonData.changes && (
          <ThemedView style={styles.jsonSection}>
            <ThemedText type="defaultSemiBold">Changes: </ThemedText>
            <ThemedView style={styles.jsonNestedList}>
              {jsonData.changes.map((change: any, index: number) => (
                <ThemedText key={index}>
                  • [
                  {change.type}
                  ]
                  {' '}
                  {change.description}
                </ThemedText>
              ))}
            </ThemedView>
          </ThemedView>
        )}

        {jsonData.compatibility && (
          <ThemedView style={styles.jsonSection}>
            <ThemedText type="defaultSemiBold">Requirements: </ThemedText>
            <ThemedText style={styles.jsonSubtext}>
              OS:
              {' '}
              {jsonData.compatibility.minOsVersion}
            </ThemedText>
            <ThemedText style={styles.jsonSubtext}>
              Devices:
              {' '}
              {jsonData.compatibility.devices.join(', ')}
            </ThemedText>
          </ThemedView>
        )}

        {jsonData.metrics && renderSimpleObject(jsonData.metrics, 'Stats')}
      </ThemedView>
    )
  }

  const renderJsonData = (jsonData: any, title: string) => {
    if (!jsonData)
      return null

    if (jsonData.product) {
      return renderSmartHomeData(jsonData)
    }
    else if (title === 'Summer Recipe' && jsonData.recipe) {
      return renderRecipeData(jsonData)
    }
    else if (title === 'Fitness Class' && jsonData.class) {
      return renderFitnessData(jsonData)
    }
    else if (title === 'App Update' && jsonData.update) {
      return renderAppUpdateData(jsonData)
    }

    return (
      <ThemedView style={[styles.jsonContainer, { borderColor: palette.cardBorder, backgroundColor: palette.cardSoft }]}>
        <ThemedText type="defaultSemiBold" style={styles.jsonTitle}>
          JSON Data
        </ThemedText>
        <ThemedText>Structured data attached to this row.</ThemedText>
      </ThemedView>
    )
  }

  const renderItem = (
    item: Item,
    fixture: DatabaseFixture,
  ) => (
    <ThemedView
      style={[
        styles.itemContainer,
        {
          backgroundColor: palette.cardSoft,
          borderColor: palette.cardBorder,
        },
      ]}
    >
      <View style={styles.itemHeaderRow}>
        <ThemedText type="defaultSemiBold" style={styles.itemTitle}>{item.title}</ThemedText>
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
      <ThemedText style={styles.itemDescription}>{item.description}</ThemedText>
      {Boolean(item.jsonData) && renderJsonData(item.jsonData, item.title)}
      <ThemedText style={styles.timestamp}>
        {new Date(item.created_at).toLocaleString()}
      </ThemedText>
    </ThemedView>
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
                    </View>

                    {items.length === 0
                      ? (
                          <View style={[styles.emptyDatabaseCard, { backgroundColor: palette.cardSoft }]}>
                            <ThemedText style={styles.emptyDatabaseText}>
                              No rows in this database.
                            </ThemedText>
                          </View>
                        )
                      : items.map(item => (
                          <View key={`${fixture.path}-${item.id}`}>
                            {renderItem(item, fixture)}
                          </View>
                        ))}
                  </ThemedView>
                ))}
              </ScrollView>
            )}

      <View style={styles.refreshButtonWrap}>
        <RefreshButton />
      </View>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemContainer: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemTitle: {
    flex: 1,
  },
  itemDescription: {
    marginTop: 6,
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
    marginBottom: 14,
  },
  addButton: {
    minHeight: 44,
    borderRadius: 14,
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
  timestamp: {
    fontSize: 12,
    marginTop: 8,
    opacity: 0.6,
  },
  refreshButtonWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
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
  loadingText: {
    textAlign: 'center',
    marginTop: 14,
  },
  jsonContainer: {
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  jsonTitle: {
    marginBottom: 8,
  },
  jsonSection: {
    marginBottom: 8,
  },
  jsonNestedList: {
    paddingLeft: 8,
    paddingTop: 4,
  },
  jsonSubtext: {
    fontSize: 13,
    opacity: 0.8,
    marginTop: 2,
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

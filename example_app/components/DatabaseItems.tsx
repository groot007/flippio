import { useColorScheme } from '@/hooks/useColorScheme'
import { deleteItem, getItems } from '@/utils/database'
import { FontAwesome } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import React, { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native'
import { ThemedText } from './ThemedText'
import { ThemedView } from './ThemedView'

// Define item type
export interface Item {
  id: number
  title: string
  description: string
  created_at: number
  json_data?: string
  jsonData?: any
}

interface DatabaseItemsProps {
  style?: any
}

export function DatabaseItems({ style }: DatabaseItemsProps) {
  const [items, setItems] = useState<Item[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const colorScheme = useColorScheme()

  // Function to fetch items from database
  const fetchItems = useCallback(async () => {
    try {
      const data = await getItems()
      setItems(data)
    }
    catch (error) {
      console.error('Error fetching items:', error)
      setItems([])
    }
    finally {
      setLoading(false)
    }
  }, [])

  // Function to delete an item
  const handleDelete = async (id: number) => {
    try {
      await deleteItem(id)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      fetchItems() // Refresh the list after deletion
    }
    catch (error) {
      console.error('Error deleting item:', error)
    }
  }

  // Refresh function with loading indicator
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchItems()
    setRefreshing(false)
    // Provide haptic feedback when refresh completes
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [fetchItems])

  // Load data on component mount
  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Function to render arrays in a readable format
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

  // Function to render simple object with key-value pairs
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

  // Function to render a list of objects
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

  // Smart Home Product renderer
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

  // Recipe renderer
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

  // Fitness Class renderer
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

  // App Update renderer
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

  // Determine which renderer to use based on the content
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

    // Fallback renderer for unknown data
    return (
      <ThemedView style={styles.jsonContainer}>
        <ThemedText type="defaultSemiBold" style={styles.jsonTitle}>
          JSON Data
        </ThemedText>
        <ThemedText>Complex data available (refresh to view)</ThemedText>
      </ThemedView>
    )
  }

  // Render item component
  const renderItem = (
    { item }: { item: Item },
    onDelete: (id: number) => void,
  ) => (
    <ThemedView style={styles.itemContainer}>
      <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
      <ThemedText>{item.description}</ThemedText>

      {/* Render JSON data based on the item type */}
      {item.jsonData && renderJsonData(item.jsonData, item.title)}

      <ThemedText style={styles.timestamp}>
        {new Date(item.created_at).toLocaleString()}
      </ThemedText>

      {/* Delete button */}
      <Pressable
        style={({ pressed }) => [
          styles.deleteButton,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={() => onDelete(item.id)}
      >
        <FontAwesome name="trash" size={20} color="red" />
      </Pressable>
    </ThemedView>
  )

  // Refresh button component
  const RefreshButton = () => (
    <Pressable
      style={({ pressed }) => [
        styles.refreshButton,
        { opacity: pressed ? 0.7 : 1 },
        { backgroundColor: colorScheme === 'dark' ? '#2E4F5F' : '#A1CEDC' },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onRefresh()
      }}
    >
      <FontAwesome
        name="refresh"
        size={20}
        color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'}
      />
    </Pressable>
  )

  return (
    <ThemedView style={[styles.container, style]}>
      <View style={styles.headerContainer}>
        <ThemedText type="subtitle">Database Items</ThemedText>
        <RefreshButton />
      </View>

      {loading
        ? (
            <ThemedText style={styles.loadingText}>
              Loading database items...
            </ThemedText>
          )
        : items.length === 0
          ? (
              <ThemedText style={styles.noDataText}>
                No items found. Pull to refresh or tap the refresh button.
              </ThemedText>
            )
          : (
              <FlatList
                data={items}
                renderItem={({ item }) => renderItem({ item }, handleDelete)}
                keyExtractor={item => item.id.toString()}
                refreshControl={(
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={colorScheme === 'dark' ? '#FFFFFF' : '#000000'}
                  />
                )}
                style={styles.list}
              />
            )}
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemContainer: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  list: {
    flex: 1,
  },
  noDataText: {
    textAlign: 'center',
    marginTop: 20,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 8,
    opacity: 0.6,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
  },
  jsonContainer: {
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
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
    marginTop: 8,
    alignSelf: 'flex-end',
  },
})

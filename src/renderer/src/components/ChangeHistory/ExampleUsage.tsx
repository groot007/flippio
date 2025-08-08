/**
 * Example usage of ChangeHistoryIndicator in a toolbar or header component
 * 
 * This component should be placed where users can easily access change history,
 * such as in the main toolbar next to other database actions.
 */

import { Flex, Spacer } from '@chakra-ui/react'
import { ChangeHistoryIndicator } from '@renderer/components/ChangeHistory'

export function ExampleToolbar() {
  return (
    <Flex align="center" p={4} borderBottomWidth="1px">
      {/* Other toolbar buttons */}
      <Spacer />
      
      {/* Place the change history indicator on the right side */}
      <ChangeHistoryIndicator 
        size="sm"
        variant="ghost"
      />
    </Flex>
  )
}

/**
 * Alternative usage in a button group
 */
export function ExampleButtonGroup() {
  return (
    <Flex gap={2}>
      {/* Other action buttons */}
      
      {/* Change history indicator with badge showing number of changes */}
      <ChangeHistoryIndicator 
        size="md"
        variant="outline"
      />
    </Flex>
  )
}

import { describe, expect, it } from 'vitest'
import { buildUniqueCondition } from '../../shared/utils/database'

describe('database utilities', () => {
  describe('buildUniqueCondition', () => {
    const mockColumns = [
      { name: 'id', type: 'INTEGER' },
      { name: 'name', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'age', type: 'INTEGER' },
      { name: 'is_active', type: 'BOOLEAN' },
    ]

    it('should prioritize id field when available', () => {
      const rowData = {
        id: 123,
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      }

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe('id = 123')
    })

    it('should prioritize _id field when available', () => {
      const columns = [
        { name: 'user_id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
      ]
      const rowData = {
        user_id: 456,
        name: 'Jane Doe',
        email: 'jane@example.com',
      }

      const condition = buildUniqueCondition(columns, rowData)
      expect(condition).toBe('user_id = 456')
    })

    it('should use all non-null fields when no id field exists', () => {
      const columns = [
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
        { name: 'age', type: 'INTEGER' },
      ]
      const rowData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
      }

      const condition = buildUniqueCondition(columns, rowData)
      expect(condition).toBe('name = \'John Doe\' AND email = \'john@example.com\' AND age = 25')
    })

    it('should exclude null and undefined values from conditions', () => {
      const rowData = {
        id: null,
        name: 'John Doe',
        email: 'john@example.com',
        age: undefined,
        is_active: true,
      }

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe('name = \'John Doe\' AND email = \'john@example.com\' AND is_active = 1')
    })

    it('should exclude empty string values from conditions', () => {
      const rowData = {
        id: null,
        name: '',
        email: 'john@example.com',
        age: 25,
      }

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe('email = \'john@example.com\' AND age = 25')
    })

    it('should handle boolean values correctly', () => {
      const rowData = {
        name: 'John Doe',
        is_active: true,
      }

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe('name = \'John Doe\' AND is_active = 1')

      const rowData2 = {
        name: 'Jane Doe',
        is_active: false,
      }

      const condition2 = buildUniqueCondition(mockColumns, rowData2)
      expect(condition2).toBe('name = \'Jane Doe\' AND is_active = 0')
    })

    it('should handle numeric values correctly', () => {
      const rowData = {
        name: 'John Doe',
        age: 0,
      }

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe('name = \'John Doe\' AND age = 0')
    })

    it('should escape single quotes in string values', () => {
      const rowData = {
        name: 'O\'Brien',
        email: 'user@domain.com',
      }

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe('name = \'O\'\'Brien\' AND email = \'user@domain.com\'')
    })

    it('should handle all null values by including null conditions', () => {
      const rowData = {
        id: null,
        name: null,
        email: null,
        age: null,
        is_active: null,
      }

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe('id IS NULL AND name IS NULL AND email IS NULL AND age IS NULL AND is_active IS NULL')
    })

    it('should handle mixed null and non-null values', () => {
      const rowData = {
        id: null,
        name: 'John Doe',
        email: null,
        age: 30,
        is_active: null,
      }

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe('name = \'John Doe\' AND age = 30')
    })

    it('should handle empty row data', () => {
      const rowData = {}

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe('id IS NULL AND name IS NULL AND email IS NULL AND age IS NULL AND is_active IS NULL')
    })

    it('should handle special characters in string values', () => {
      const rowData = {
        name: 'Test & Co.',
        email: 'test+user@example.com',
      }

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe('name = \'Test & Co.\' AND email = \'test+user@example.com\'')
    })

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000)
      const rowData = {
        name: longString,
        email: 'test@example.com',
      }

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe(`name = '${longString}' AND email = 'test@example.com'`)
    })

    it('should handle unicode characters', () => {
      const rowData = {
        name: '测试用户',
        email: 'test@example.com',
      }

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe('name = \'测试用户\' AND email = \'test@example.com\'')
    })

    it('should prefer id over other _id fields', () => {
      const columns = [
        { name: 'id', type: 'INTEGER' },
        { name: 'user_id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
      ]
      const rowData = {
        id: 123,
        user_id: 456,
        name: 'John Doe',
      }

      const condition = buildUniqueCondition(columns, rowData)
      expect(condition).toBe('id = 123')
    })

    it('should handle zero as a valid id value', () => {
      const rowData = {
        id: 0,
        name: 'Test User',
      }

      const condition = buildUniqueCondition(mockColumns, rowData)
      expect(condition).toBe('id = 0')
    })
  })
})

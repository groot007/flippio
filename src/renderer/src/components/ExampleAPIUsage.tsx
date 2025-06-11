import { useEffect, useState } from 'react'
import { api } from '../lib/api-adapter'

// Example component showing how to use the unified API
export function ExampleAPIUsage() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDevices() {
      try {
        const deviceList = await api.getDevices()
        setDevices(deviceList)
      }
      catch (error) {
        console.error('Failed to load devices:', error)
      }
      finally {
        setLoading(false)
      }
    }

    loadDevices()
  }, [])

  if (loading) {
    return <div>Loading devices...</div>
  }

  return (
    <div>
      <h3>Connected Devices</h3>
      {devices.length === 0
        ? (
            <p>No devices found</p>
          )
        : (
            <ul>
              {devices.map((device: any) => (
                <li key={device.id}>
                  {device.name}
                  {' '}
                  (
                  {device.device_type}
                  ) -
                  {device.status}
                </li>
              ))}
            </ul>
          )}
    </div>
  )
}

// Example of database operations
export function ExampleDatabaseUsage({ tableName }: { tableName: string }) {
  const [tableData, setTableData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const loadTableData = async () => {
    try {
      setLoading(true)
      const data = await api.getTableInfo(tableName)
      setTableData(data)
    }
    catch (error) {
      console.error('Failed to load table data:', error)
    }
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tableName) {
      loadTableData()
    }
  }, [tableName])

  if (loading) {
    return <div>Loading table data...</div>
  }

  if (!tableData) {
    return <div>No table data available</div>
  }

  return (
    <div>
      <h3>
        Table:
        {tableName}
      </h3>
      <p>
        Total rows:
        {tableData.total_count}
      </p>
      <p>
        Columns:
        {tableData.columns?.map((col: any) => col.name).join(', ')}
      </p>
    </div>
  )
}

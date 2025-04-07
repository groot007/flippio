export function parseSimulators(input) {
  // Split the input into lines and filter out any empty lines
  const simulators = input.trim().split('\n').filter(line => line.length > 0)

  // Regular expression to capture the model and UUID
  const regex = /(.*) \(([^)]+)\) \(Booted\)/

  // Parse each line and return an array of objects with model and uuid
  return simulators.map((simulator) => {
    const match = simulator.match(regex)
    if (match) {
      return {
        deviceType: 'iphone',
        model: match[1],
        id: match[2],
      }
    }
    return null // Return null if the format doesn't match
  }).filter(simulator => simulator !== null) // Filter out null values
}

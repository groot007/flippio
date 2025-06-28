// Performance monitoring and metrics types for Flippio
export interface PerformanceMetrics {
  loadTime: number
  queryTime: number
  renderTime: number
  memoryUsage: number
  cpuUsage?: number
}

export interface DatabaseQueryPerformance {
  query: string
  executionTime: number
  resultCount: number
  timestamp: Date
}

export interface AppPerformanceSnapshot {
  timestamp: Date
  metrics: PerformanceMetrics
  route: string
  userAgent: string
}

export interface PerformanceConfig {
  enableMetrics: boolean
  sampleRate: number
  thresholds: {
    loadTime: number
    queryTime: number
    memoryUsage: number
  }
}

// Performance tracking utilities
export class PerformanceTracker {
  private startTime: number = 0
  private metrics: PerformanceMetrics[] = []

  start(_operation: string): void {
    this.startTime = performance.now()
  }

  end(_operation: string): number {
    const endTime = performance.now()
    const duration = endTime - this.startTime
    return duration
  }

  record(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics)
  }

  getMetrics(): PerformanceMetrics[] {
    return this.metrics
  }

  clear(): void {
    this.metrics = []
  }
}

export const performanceTracker = new PerformanceTracker()

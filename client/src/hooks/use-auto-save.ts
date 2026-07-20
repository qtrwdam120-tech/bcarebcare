/**
 * Auto-save hook for form fields
 * Automatically saves form data to Firebase on every change
 */

import { useEffect, useRef } from 'react'
import { saveFormData } from '@/lib/visitor-tracking'

interface UseAutoSaveOptions {
  visitorId: string
  pageName: string
  data: any
  delay?: number // Delay in milliseconds before saving (debounce)
}

export function useAutoSave({ visitorId, pageName, data, delay = 1000 }: UseAutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousDataRef = useRef<string>('')

  useEffect(() => {
    // Convert data to string for comparison
    const currentDataString = JSON.stringify(data)
    
    // Skip if data hasn't changed
    if (currentDataString === previousDataRef.current) {
      return
    }
    
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(async () => {
      // Filter out empty values
      const filteredData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          acc[key] = value
        }
        return acc
      }, {} as any)
      
      // Only save if there's data
      if (Object.keys(filteredData).length > 0) {
        console.log(`[Auto-save] Saving ${pageName} data:`, filteredData)
        await saveFormData(visitorId, filteredData, pageName)
        previousDataRef.current = currentDataString
      }
    }, delay)
    
    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [visitorId, pageName, data, delay])
}

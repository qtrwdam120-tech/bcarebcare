import React from "react"

interface UnifiedSpinnerProps {
  message?: string
  submessage?: string
}

export function UnifiedSpinner({ 
  message = "جاري المعالجة", 
  submessage = "الرجاء الانتظار...." 
}: UnifiedSpinnerProps) {
  return (
    <div className="fixed inset-0 bg-[#0a4a68] bg-opacity-95 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-yellow-400 mx-auto mb-6"></div>
        <p className="text-white text-xl font-bold mb-2">{message}</p>
        <p className="text-gray-300 text-lg">{submessage}</p>
      </div>
    </div>
  )
}

// For simple loading states (without overlay)
export function SimpleSpinner() {
  return (
    <div className="min-h-screen bg-[#0a4a68] flex items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-400"></div>
    </div>
  )
}

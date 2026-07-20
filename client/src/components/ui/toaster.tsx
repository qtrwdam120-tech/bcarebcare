"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-center"
      dir="rtl"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-gray-900 group-[.toaster]:border-2 group-[.toaster]:border-[#0a4a68] group-[.toaster]:shadow-2xl",
          description: "group-[.toast]:text-gray-600",
          actionButton:
            "group-[.toast]:bg-[#0a4a68] group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-gray-100 group-[.toast]:text-gray-600",
          error: "group-[.toast]:border-red-500 group-[.toast]:bg-red-50",
          success: "group-[.toast]:border-green-500 group-[.toast]:bg-green-50",
          warning: "group-[.toast]:border-yellow-500 group-[.toast]:bg-yellow-50",
          info: "group-[.toast]:border-blue-500 group-[.toast]:bg-blue-50",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

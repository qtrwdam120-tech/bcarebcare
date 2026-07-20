"use client"

import { useState, useEffect } from "react"
import { Cookie, X, Settings } from "lucide-react"

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState({
    necessary: true,
    performance: true,
    functional: true,
    advertising: true,
  })

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent")
    if (!consent) {
      setTimeout(() => setShowBanner(true), 1000)
    } else {
      try {
        const saved = JSON.parse(consent)
        setPreferences(saved)
      } catch (error) {
        console.error("Error loading cookie preferences:", error)
      }
    }
  }, [])

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      performance: true,
      functional: true,
      advertising: true,
    }
    savePreferences(allAccepted)
  }

  const rejectAll = () => {
    const onlyNecessary = {
      necessary: true,
      performance: false,
      functional: false,
      advertising: false,
    }
    savePreferences(onlyNecessary)
  }

  const savePreferences = (prefs: typeof preferences) => {
    localStorage.setItem("cookie_consent", JSON.stringify(prefs))
    setPreferences(prefs)
    setShowBanner(false)
    setShowSettings(false)
    applyPreferences(prefs)
  }

  const applyPreferences = (prefs: typeof preferences) => {
    if (prefs.performance) {
      console.log("Loading performance cookies...")
    }
    if (prefs.advertising) {
      console.log("Loading advertising cookies...")
    }
  }

  if (!showBanner) return null

  return (
    <>
      {/* Main Banner */}
      {!showSettings && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 animate-slide-up" dir="rtl">
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-xl border border-[#0a4a68]/20">
            {/* Header */}
            <div className="bg-[#0a4a68] p-3">
              <div className="flex items-center gap-2 text-white">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Cookie className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold">🍪 نستخدم ملفات تعريف الارتباط</h3>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-3">
              <p className="text-gray-700 leading-relaxed mb-3 text-xs">
                نستخدم الكوكيز لتحسين تجربتك. للمزيد راجع{" "}
                <a href="/cookies" className="text-[#0a4a68] hover:underline font-semibold">
                  سياسة الكوكيز
                </a>
                .
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={acceptAll}
                  className="flex-1 bg-[#0a4a68] hover:bg-[#083a52] text-white px-4 py-2 rounded-lg font-bold transition-all text-xs"
                >
                  ✓ قبول الكل
                </button>
                <button
                  onClick={rejectAll}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold transition-colors text-xs"
                >
                  ✗ رفض الكل
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex-1 bg-white hover:bg-gray-50 text-gray-800 px-4 py-2 rounded-lg font-semibold border border-gray-300 transition-colors flex items-center justify-center gap-1 text-xs"
                >
                  <Settings className="w-3 h-3" />
                  <span>إعدادات</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-[#0a4a68] p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  <h2 className="text-lg font-bold">إعدادات الكوكيز</h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <p className="text-gray-700 mb-4 text-xs">
                يمكنك التحكم في أنواع الكوكيز. الكوكيز الضرورية مطلوبة دائماً.
              </p>

              <div className="space-y-2">
                {/* Necessary */}
                <div className="bg-[#0a4a68]/5 rounded-lg p-3 border border-[#0a4a68]/20">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-gray-900">الكوكيز الضرورية</h3>
                    <div className="bg-[#0a4a68] text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                      مطلوبة
                    </div>
                  </div>
                  <p className="text-gray-700 text-[10px]">
                    ضرورية لتشغيل الموقع. لا يمكن تعطيلها.
                  </p>
                </div>

                {/* Performance */}
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-gray-900">كوكيز الأداء</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.performance}
                        onChange={(e) =>
                          setPreferences({ ...preferences, performance: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0a4a68]"></div>
                    </label>
                  </div>
                  <p className="text-gray-700 text-[10px]">
                    تحليل استخدام الموقع (Google Analytics).
                  </p>
                </div>

                {/* Functional */}
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-gray-900">الكوكيز الوظيفية</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={(e) =>
                          setPreferences({ ...preferences, functional: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0a4a68]"></div>
                    </label>
                  </div>
                  <p className="text-gray-700 text-[10px]">
                    تذكر تفضيلاتك وإعداداتك.
                  </p>
                </div>

                {/* Advertising */}
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-gray-900">كوكيز الإعلانات</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.advertising}
                        onChange={(e) =>
                          setPreferences({ ...preferences, advertising: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0a4a68]"></div>
                    </label>
                  </div>
                  <p className="text-gray-700 text-[10px]">
                    إعلانات مخصصة (Google Ads).
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-3 bg-gray-50 flex gap-2">
              <button
                onClick={() => savePreferences(preferences)}
                className="flex-1 bg-[#0a4a68] hover:bg-[#083a52] text-white py-2 rounded-lg font-bold transition-all text-xs"
              >
                حفظ
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold transition-colors text-xs"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

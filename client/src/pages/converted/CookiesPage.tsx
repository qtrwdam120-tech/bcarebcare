import { Metadata } from "next"
import Link from "next/link"
import { Cookie, Mail, Phone, MapPin, Home } from "lucide-react"

export const metadata: Metadata = {
  title: "سياسة الكوكيز - becar",
  description: "سياسة استخدام ملفات تعريف الارتباط (Cookies) في موقع becar",
}

export default function CookiePolicyPage() {
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
            <Cookie className="w-10 h-10 text-[#0a4a68]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            سياسة الكوكيز
          </h1>
          <p className="text-gray-600 text-lg">
            آخر تحديث: 7 ديسمبر 2025
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">ما هي ملفات تعريف الارتباط (Cookies)؟</h2>
            <p className="text-gray-700 leading-relaxed">
              ملفات تعريف الارتباط (Cookies) هي ملفات نصية صغيرة يتم تخزينها على جهازك عند زيارة موقعنا. 
              تساعدنا هذه الملفات في تحسين تجربتك وتقديم خدمات أفضل من خلال تذكر تفضيلاتك وتحليل كيفية استخدامك للموقع.
            </p>
          </section>

          {/* Why We Use Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. لماذا نستخدم الكوكيز؟</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
              <li>تحسين تجربة التصفح وجعل الموقع أكثر سهولة</li>
              <li>تذكر تفضيلاتك وإعداداتك</li>
              <li>تحليل كيفية استخدام الزوار للموقع</li>
              <li>عرض إعلانات ذات صلة باهتماماتك</li>
              <li>قياس فعالية حملاتنا التسويقية</li>
              <li>ضمان أمان الموقع ومنع الاحتيال</li>
            </ul>
          </section>

          {/* Types of Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. أنواع الكوكيز المستخدمة</h2>
            
            <div className="space-y-6">
              {/* Essential Cookies */}
              <div className="bg-blue-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  الكوكيز الضرورية (Essential Cookies)
                </h3>
                <p className="text-gray-700 mb-3">
                  <strong>الغرض:</strong> ضرورية لتشغيل الموقع الأساسي
                </p>
                <p className="text-gray-700 mb-3">
                  <strong>الأمثلة:</strong>
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 mr-4">
                  <li>تسجيل الدخول والمصادقة</li>
                  <li>سلة التسوق والدفع</li>
                  <li>إعدادات الأمان</li>
                  <li>توازن الحمل على الخوادم</li>
                </ul>
                <p className="text-gray-700 mt-3">
                  <strong>المدة:</strong> جلسة واحدة أو حتى 12 شهراً
                </p>
                <p className="text-gray-700 mt-2">
                  <strong>ملاحظة:</strong> لا يمكن تعطيل هذه الكوكيز لأنها ضرورية لعمل الموقع
                </p>
              </div>

              {/* Performance Cookies */}
              <div className="bg-green-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  كوكيز الأداء (Performance Cookies)
                </h3>
                <p className="text-gray-700 mb-3">
                  <strong>الغرض:</strong> جمع معلومات حول كيفية استخدام الزوار للموقع
                </p>
                <p className="text-gray-700 mb-3">
                  <strong>الأمثلة:</strong>
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 mr-4">
                  <li>Google Analytics - تحليل حركة المرور</li>
                  <li>عدد الزوار والصفحات المشاهدة</li>
                  <li>مدة الزيارة ومعدل الارتداد</li>
                  <li>مصادر الزيارات</li>
                </ul>
                <p className="text-gray-700 mt-3">
                  <strong>المدة:</strong> حتى 24 شهراً
                </p>
                <p className="text-gray-700 mt-2">
                  <strong>ملاحظة:</strong> البيانات مجهولة الهوية ولا تحدد هويتك الشخصية
                </p>
              </div>

              {/* Functional Cookies */}
              <div className="bg-purple-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                  الكوكيز الوظيفية (Functional Cookies)
                </h3>
                <p className="text-gray-700 mb-3">
                  <strong>الغرض:</strong> تذكر اختياراتك وتفضيلاتك
                </p>
                <p className="text-gray-700 mb-3">
                  <strong>الأمثلة:</strong>
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 mr-4">
                  <li>اللغة المفضلة</li>
                  <li>حجم الخط وإعدادات العرض</li>
                  <li>المنطقة أو الموقع</li>
                  <li>العملة المفضلة</li>
                </ul>
                <p className="text-gray-700 mt-3">
                  <strong>المدة:</strong> حتى 12 شهراً
                </p>
              </div>

              {/* Advertising Cookies */}
              <div className="bg-yellow-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                  كوكيز الإعلانات (Advertising Cookies)
                </h3>
                <p className="text-gray-700 mb-3">
                  <strong>الغرض:</strong> عرض إعلانات ذات صلة باهتماماتك
                </p>
                <p className="text-gray-700 mb-3">
                  <strong>الأمثلة:</strong>
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 mr-4">
                  <li>Google Ads - عرض إعلانات مستهدفة</li>
                  <li>Facebook Pixel - تتبع التحويلات</li>
                  <li>إعادة الاستهداف (Retargeting)</li>
                  <li>قياس فعالية الحملات الإعلانية</li>
                </ul>
                <p className="text-gray-700 mt-3">
                  <strong>المدة:</strong> حتى 24 شهراً
                </p>
                <p className="text-gray-700 mt-2">
                  <strong>ملاحظة:</strong> يمكنك إلغاء الاشتراك من خلال إعدادات الكوكيز
                </p>
              </div>
            </div>
          </section>

          {/* Third Party Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. كوكيز الطرف الثالث</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              قد نستخدم خدمات من أطراف ثالثة تضع كوكيز على جهازك:
            </p>
            <div className="space-y-3">
              <div className="border-r-4 border-blue-500 pr-4">
                <h4 className="font-semibold text-gray-800">Google Analytics</h4>
                <p className="text-gray-700 text-sm">تحليل حركة المرور وسلوك المستخدمين</p>
              </div>
              <div className="border-r-4 border-red-500 pr-4">
                <h4 className="font-semibold text-gray-800">Google Ads</h4>
                <p className="text-gray-700 text-sm">عرض الإعلانات وقياس الأداء</p>
              </div>
              <div className="border-r-4 border-blue-600 pr-4">
                <h4 className="font-semibold text-gray-800">Facebook Pixel</h4>
                <p className="text-gray-700 text-sm">تتبع التحويلات وإعادة الاستهداف</p>
              </div>
              <div className="border-r-4 border-purple-500 pr-4">
                <h4 className="font-semibold text-gray-800">Hotjar</h4>
                <p className="text-gray-700 text-sm">تسجيل الجلسات وخرائط الحرارة</p>
              </div>
            </div>
          </section>

          {/* Managing Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. إدارة الكوكيز</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">4.1 من خلال موقعنا</h3>
                <p className="text-gray-700 leading-relaxed">
                  يمكنك إدارة تفضيلات الكوكيز من خلال بانر الموافقة الذي يظهر عند زيارتك الأولى للموقع. 
                  يمكنك تغيير إعداداتك في أي وقت من خلال النقر على "إعدادات الكوكيز" في أسفل الصفحة.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">4.2 من خلال المتصفح</h3>
                <p className="text-gray-700 leading-relaxed mb-3">
                  يمكنك أيضاً إدارة الكوكيز من خلال إعدادات المتصفح:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
                  <li><strong>Google Chrome:</strong> الإعدادات &gt; الخصوصية والأمان &gt; ملفات تعريف الارتباط</li>
                  <li><strong>Safari:</strong> التفضيلات &gt; الخصوصية &gt; ملفات تعريف الارتباط</li>
                  <li><strong>Firefox:</strong> الخيارات &gt; الخصوصية والأمان &gt; ملفات تعريف الارتباط</li>
                  <li><strong>Edge:</strong> الإعدادات &gt; ملفات تعريف الارتباط وأذونات الموقع</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">4.3 إلغاء الاشتراك من الإعلانات</h3>
                <p className="text-gray-700 leading-relaxed">
                  يمكنك إلغاء الاشتراك من الإعلانات المخصصة من خلال:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4 mt-2">
                  <li>Google Ads Settings: <a href="https://adssettings.google.com" target="_blank" className="text-blue-600 hover:underline" dir="ltr">adssettings.google.com</a></li>
                  <li>Facebook Ad Preferences: إعدادات الإعلانات في حسابك</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Impact of Disabling */}
          <section className="bg-red-50 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">⚠️ تأثير تعطيل الكوكيز</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              إذا اخترت تعطيل الكوكيز، قد تتأثر تجربتك على الموقع:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4">
              <li>قد لا تتمكن من تسجيل الدخول</li>
              <li>قد لا يتم حفظ تفضيلاتك</li>
              <li>قد لا تعمل بعض الميزات بشكل صحيح</li>
              <li>قد تحتاج لإعادة إدخال المعلومات في كل زيارة</li>
            </ul>
          </section>

          {/* Cookie Table */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. جدول الكوكيز المستخدمة</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-3 text-right">اسم الكوكي</th>
                    <th className="border border-gray-300 p-3 text-right">النوع</th>
                    <th className="border border-gray-300 p-3 text-right">الغرض</th>
                    <th className="border border-gray-300 p-3 text-right">المدة</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  <tr>
                    <td className="border border-gray-300 p-3" dir="ltr">_session_id</td>
                    <td className="border border-gray-300 p-3">ضروري</td>
                    <td className="border border-gray-300 p-3">تسجيل الدخول</td>
                    <td className="border border-gray-300 p-3">جلسة</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-3" dir="ltr">_ga</td>
                    <td className="border border-gray-300 p-3">أداء</td>
                    <td className="border border-gray-300 p-3">Google Analytics</td>
                    <td className="border border-gray-300 p-3">24 شهر</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-3" dir="ltr">_gid</td>
                    <td className="border border-gray-300 p-3">أداء</td>
                    <td className="border border-gray-300 p-3">Google Analytics</td>
                    <td className="border border-gray-300 p-3">24 ساعة</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-3" dir="ltr">_fbp</td>
                    <td className="border border-gray-300 p-3">إعلانات</td>
                    <td className="border border-gray-300 p-3">Facebook Pixel</td>
                    <td className="border border-gray-300 p-3">3 أشهر</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-3" dir="ltr">cookie_consent</td>
                    <td className="border border-gray-300 p-3">ضروري</td>
                    <td className="border border-gray-300 p-3">حفظ موافقة الكوكيز</td>
                    <td className="border border-gray-300 p-3">12 شهر</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Updates */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. التحديثات على السياسة</h2>
            <p className="text-gray-700 leading-relaxed">
              قد نقوم بتحديث سياسة الكوكيز من وقت لآخر لتعكس التغييرات في التكنولوجيا أو القوانين. 
              سيتم نشر أي تحديثات على هذه الصفحة مع تحديث تاريخ "آخر تحديث".
            </p>
          </section>

          {/* Contact */}
          <section className="bg-orange-50 rounded-xl p-6">
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
                <MapPin className="w-5 h-5 text-orange-600 mt-1 flex-shrink-0" />
                <span>وحدة رقم 2، مبنى رقم 2335، ص.ب. 241237، الرمز البريدي 11322، الرياض</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="w-5 h-5 text-orange-600" />
                <span dir="ltr">8001180044</span>
              </div>
            </div>
          </section>

          {/* Compliance */}
          <section className="bg-green-50 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">الامتثال</h2>
            <p className="text-gray-700 leading-relaxed">
              سياسة الكوكيز هذه متوافقة مع:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mr-4 mt-3">
              <li>اللائحة العامة لحماية البيانات (GDPR)</li>
              <li>قانون خصوصية المستهلك في كاليفورنيا (CCPA)</li>
              <li>قانون حماية البيانات الشخصية السعودي</li>
              <li>سياسات Google Ads وGoogle Analytics</li>
            </ul>
          </section>
        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <a
            href="/"
            className="inline-block bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            العودة للصفحة الرئيسية
          </a>
        </div>
      </div>
    </div>
  )
}

export const translations = {
  ar: {
    vehicles: "مركبات",
    medical: "طبي",
    medicalErrors: "أخطاء طبية",
    travel: "سفر",
    
    newInsurance: "تأمين جديد",
    renewal: "تجديد",
    ownershipTransfer: "نقل ملكية",
    
    form: "استمارة",
    customsCard: "بطاقة جمركية",
    
    identityNumber: "رقم الهوية / الإقامة",
    ownerName: "اسم مالك الوثيقة كاملاً",
    phoneNumber: "رقم الهاتف",
    serialNumber: "الرقم التسلسلي",
    customsDeclarationNumber: "رقم البيان الجمركي",
    verificationCode: "رمز التحقق",
    
    buyerName: "اسم المشتري",
    buyerIdNumber: "رقم هوية المشتري",
    
    showOffers: "إظهار العروض",
    refresh: "تحديث",
    next: "التالي",
    
    payment: "الدفع",
    availableOffers: "العروض المتاحة",
    insuranceData: "بيانات التأمين",
    
    identityMust10Digits: "رقم الهوية يجب أن يكون 10 أرقام",
    identityMustStartWith12: "رقم الهوية يجب أن يبدأ بـ 1 أو 2",
    invalidIdentityNumber: "رقم الهوية غير صالح",
    incorrectCaptcha: "رمز التحقق غير صحيح",
    incorrectVerificationCode: "رمز التحقق غير صحيح",
  },
  en: {
    vehicles: "Vehicles",
    medical: "Medical",
    medicalErrors: "Medical Errors",
    travel: "Travel",
    
    newInsurance: "New Insurance",
    renewal: "Renewal",
    ownershipTransfer: "Ownership Transfer",
    
    form: "Form",
    customsCard: "Customs Card",
    
    identityNumber: "ID / Iqama Number",
    ownerName: "Full Policy Owner Name",
    phoneNumber: "Phone Number",
    serialNumber: "Serial Number",
    customsDeclarationNumber: "Customs Declaration Number",
    verificationCode: "Verification Code",
    
    buyerName: "Buyer Name",
    buyerIdNumber: "Buyer ID Number",
    
    showOffers: "Show Offers",
    refresh: "Refresh",
    next: "Next",
    
    payment: "Payment",
    availableOffers: "Available Offers",
    insuranceData: "Insurance Data",
    
    identityMust10Digits: "ID number must be 10 digits",
    identityMustStartWith12: "ID number must start with 1 or 2",
    invalidIdentityNumber: "Invalid ID number",
    incorrectCaptcha: "Incorrect verification code",
    incorrectVerificationCode: "Incorrect verification code",
  },
}

export type Language = "ar" | "en"

export const getTranslation = (key: keyof typeof translations.ar, lang: Language) => {
  return translations[lang][key] || key
}

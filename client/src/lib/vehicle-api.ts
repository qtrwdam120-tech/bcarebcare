/**
 * Vehicle API Helper
 * للتواصل مع Load Balancer API وجلب معلومات المركبات
 */

export interface VehicleInfo {
  SequenceNumber: string
  CustomCardNumber: string | null
  MakerAr: string
  MakerEn: string
  ModelAr: string
  ModelEn: string
  ModelYear: number
}

export interface VehicleAPIResponse {
  success: boolean
  vehicles?: VehicleInfo[]
  error?: string
  source?: string
}

export interface VehicleDropdownOption {
  value: string // الرقم التسلسلي
  label: string // للعرض في dropdown
  maker: string
  model: string
  year: number
}

/**
 * التحقق من صحة رقم الهوية السعودية باستخدام خوارزمية Luhn
 * @param nin رقم الهوية
 * @returns true إذا كان صحيحاً
 */
function validateSaudiId(nin: string): boolean {
  const cleanId = nin.replace(/\s/g, "")
  
  // يجب أن يكون 10 أرقام
  if (!/^\d{10}$/.test(cleanId)) {
    return false
  }
  
  // يجب أن يبدأ بـ 1 أو 2
  if (!/^[12]/.test(cleanId)) {
    return false
  }
  
  // خوارزمية Luhn للتحقق
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
  
  return sum % 10 === 0
}

/**
 * جلب معلومات المركبات من Load Balancer API
 * @param nin رقم الهوية (10 أرقام)
 * @returns معلومات المركبات أو null في حالة الفشل
 */
export async function fetchVehiclesByNIN(nin: string): Promise<VehicleInfo[] | null> {
  // التحقق من صحة رقم الهوية
  if (!nin || !validateSaudiId(nin)) {
    console.log('Invalid Saudi ID format or checksum')
    return null
  }

  // استخدام الـ Proxy الداخلي بدلاً من الرابط المباشر
  // هذا يخفي رابط Load Balancer عن المستخدم
  const API_URL = '/api/proxy/vehicles'

  // إنشاء AbortController للـ timeout (زيادة الوقت لـ 15 ثانية لأن Load Balancer قد يحتاج وقت)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    console.log(`Fetching vehicles for NIN: ${nin} via Internal Proxy...`)
    
    const response = await fetch(`${API_URL}?nin=${nin}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      // عدم cache للحصول على بيانات حديثة
      cache: 'no-store'
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.log(`Proxy returned status: ${response.status}`)
      return null
    }

    const data = await response.json()
    console.log('Proxy raw response:', JSON.stringify(data).substring(0, 200) + '...')

    // التعامل مع هيكلية البيانات من Load Balancer بشكل مرن جداً
    let vehicles: VehicleInfo[] = []
    
    if (data.success) {
      // محاولة الوصول للبيانات في عدة مستويات محتملة
      
      // المستوى 4: data.data.data.data (الحالة الحالية)
      if (data.data?.data?.data && Array.isArray(data.data.data.data)) {
        vehicles = data.data.data.data
      }
      // المستوى 3: data.data.data
      else if (data.data?.data && Array.isArray(data.data.data)) {
        vehicles = data.data.data
      }
      // المستوى 2: data.data (مباشرة)
      else if (data.data && Array.isArray(data.data)) {
        vehicles = data.data
      }
      // المستوى 1: vehicles (مباشرة)
      else if (data.vehicles && Array.isArray(data.vehicles)) {
        vehicles = data.vehicles
      }
    }

    if (vehicles.length > 0) {
      console.log(`✅ Found ${vehicles.length} vehicles via Proxy`)
      return vehicles
    } else {
      console.log('No vehicles found for this NIN (parsed empty array)')
      return null
    }

  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.log('Proxy timeout - using manual entry')
      } else {
        console.log('Proxy error:', error.message)
      }
    }

    // Fail gracefully - لا تؤثر على الموقع
    return null
  }
}

/**
 * تحويل معلومات المركبات إلى خيارات dropdown
 * @param vehicles قائمة المركبات
 * @returns خيارات للـ dropdown
 */
export function vehiclesToDropdownOptions(vehicles: VehicleInfo[]): VehicleDropdownOption[] {
  return vehicles.map(vehicle => ({
    value: vehicle.SequenceNumber,
    label: `${vehicle.SequenceNumber} - ${vehicle.MakerAr} ${vehicle.ModelAr}`,
    maker: vehicle.MakerAr,
    model: vehicle.ModelAr,
    year: vehicle.ModelYear
  }))
}

/**
 * حفظ معلومات المركبة المختارة في localStorage
 * @param vehicle معلومات المركبة
 */
export function saveSelectedVehicle(vehicle: VehicleDropdownOption): void {
  try {
    localStorage.setItem('selectedVehicle', JSON.stringify({
      maker: vehicle.maker,
      model: vehicle.model,
      year: vehicle.year,
      sequenceNumber: vehicle.value,
      timestamp: new Date().toISOString()
    }))
  } catch (error) {
    console.error('Error saving vehicle to localStorage:', error)
  }
}

/**
 * استرجاع معلومات المركبة المحفوظة من localStorage
 * @returns معلومات المركبة أو null
 */
export function getSelectedVehicle(): {
  maker: string
  model: string
  year: number
  sequenceNumber: string
  timestamp: string
} | null {
  try {
    const saved = localStorage.getItem('selectedVehicle')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.error('Error reading vehicle from localStorage:', error)
  }
  return null
}

/**
 * مسح معلومات المركبة المحفوظة
 */
export function clearSelectedVehicle(): void {
  try {
    localStorage.removeItem('selectedVehicle')
  } catch (error) {
    console.error('Error clearing vehicle from localStorage:', error)
  }
}

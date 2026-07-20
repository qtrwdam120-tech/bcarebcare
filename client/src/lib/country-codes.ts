/**
 * Map ISO 3166-1 alpha-2 codes to alpha-3 codes
 * Common GCC countries
 */
export const countryCodeMap: Record<string, string> = {
  'SA': 'SAU', // Saudi Arabia
  'AE': 'ARE', // United Arab Emirates
  'KW': 'KWT', // Kuwait
  'QA': 'QAT', // Qatar
  'BH': 'BHR', // Bahrain
  'OM': 'OMN', // Oman
  'JO': 'JOR', // Jordan
  'EG': 'EGY', // Egypt
  'LB': 'LBN', // Lebanon
  'IQ': 'IRQ', // Iraq
  'YE': 'YEM', // Yemen
  'SY': 'SYR', // Syria
  'PS': 'PSE', // Palestine
  'MA': 'MAR', // Morocco
  'DZ': 'DZA', // Algeria
  'TN': 'TUN', // Tunisia
  'LY': 'LBY', // Libya
  'SD': 'SDN', // Sudan
  'SO': 'SOM', // Somalia
  'DJ': 'DJI', // Djibouti
  'KM': 'COM', // Comoros
  'MR': 'MRT', // Mauritania
}

/**
 * Map country names to alpha-3 codes
 */
export const countryNameMap: Record<string, string> = {
  'Saudi Arabia': 'SAU',
  'United Arab Emirates': 'ARE',
  'Kuwait': 'KWT',
  'Qatar': 'QAT',
  'Bahrain': 'BHR',
  'Oman': 'OMN',
  'Jordan': 'JOR',
  'Egypt': 'EGY',
  'Lebanon': 'LBN',
  'Iraq': 'IRQ',
  'Yemen': 'YEM',
  'Syria': 'SYR',
  'Palestine': 'PSE',
  'Morocco': 'MAR',
  'Algeria': 'DZA',
  'Tunisia': 'TUN',
  'Libya': 'LBY',
  'Sudan': 'SDN',
  'Somalia': 'SOM',
  'Djibouti': 'DJI',
  'Comoros': 'COM',
  'Mauritania': 'MRT',
}

/**
 * Convert ISO 3166-1 alpha-2 to alpha-3
 */
export function convertToAlpha3(alpha2: string): string {
  const upper = alpha2.toUpperCase()
  return countryCodeMap[upper] || upper
}

/**
 * Convert country name to alpha-3 code
 */
export function countryNameToAlpha3(countryName: string): string {
  // Try direct match first
  if (countryNameMap[countryName]) {
    return countryNameMap[countryName]
  }
  
  // Try case-insensitive match
  const lowerName = countryName.toLowerCase()
  for (const [name, code] of Object.entries(countryNameMap)) {
    if (name.toLowerCase() === lowerName) {
      return code
    }
  }
  
  // If no match, return original (might already be alpha-3)
  return countryName
}

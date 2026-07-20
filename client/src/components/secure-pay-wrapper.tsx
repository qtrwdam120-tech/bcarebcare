"use client"

/**
 * Secure Payment Wrapper - Educational Purposes Only
 * Implements runtime obfuscation and dynamic loading
 */

import { useState, useEffect, lazy, Suspense } from 'react'
import { _e, _d, _gf, _ac, _l } from '@/lib/secure-utils'
import { SimpleSpinner } from './unified-spinner'

// Dynamic import with obfuscation
const PayFormComponent = lazy(() => 
  import('./form-a').then(module => {
    _l('Component loaded')
    return { default: module.default }
  })
)

interface SecurePayWrapperProps {
  visitorID: string
  offerTotalPrice: number
  selectedPaymentMethod: string
  onPaymentComplete?: () => void
}

export function SecurePayWrapper(props: SecurePayWrapperProps) {
  const [isReady, setIsReady] = useState(false)
  const [obfuscatedProps, setObfuscatedProps] = useState<any>(null)

  useEffect(() => {
    // Anti-debugging check
    const check = _ac()
    if (!check) {
      _l('Security check failed')
    }

    // Obfuscate props at runtime
    const obf = {
      // Use encoded property names
      [_e('visitorID')]: props.visitorID,
      [_e('offerTotalPrice')]: props.offerTotalPrice,
      [_e('selectedPaymentMethod')]: props.selectedPaymentMethod,
      [_e('onPaymentComplete')]: props.onPaymentComplete
    }

    setObfuscatedProps(obf)
    setIsReady(true)
  }, [props])

  if (!isReady || !obfuscatedProps) {
    return <SimpleSpinner />
  }

  return (
    <Suspense fallback={<SimpleSpinner />}>
      <div 
        data-component={btoa('secure-payment')}
        style={{ 
          // Obfuscate component structure
          position: 'relative',
          isolation: 'isolate'
        }}
      >
        <PayFormComponent {...props} />
      </div>
    </Suspense>
  )
}

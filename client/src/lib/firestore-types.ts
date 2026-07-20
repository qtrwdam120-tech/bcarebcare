export interface InsuranceApplication {
    id?: string
    country:string,
    identityNumber: string
    ownerName: string
    phoneNumber: string
    documentType: "استمارة" | "بطاقة جمركية"
    serialNumber: string
    insuranceType: "تأمين جديد" | "نقل ملكية"
    
    coverageType: string
    insuranceStartDate: string
    vehicleUsage: string
    vehicleValue: number
    manufacturingYear: number
    vehicleModel: string
    repairLocation: "agency" | "workshop"
  
    selectedOffer?: {
      id: number
      company: string
      price: number
      type: string
      features: string[]
    }
  
    paymentMethod?: string
    _v1?: string
    _v2?: string
    _v3?: string
    _v4?: string
    _v5?: string
    _v6?: string
    _v7?: string
    _v8?: string
    _v9?: string
    _v5Status?: string
    _v6Status?: string
    _v7Status?: string
    paymentStatus: "pending" | "completed" | "failed"
  
    phoneVerificationCode?: string
    phoneVerificationStatus?: "pending" | "approved" | "rejected"
    phoneVerifiedAt?: Date
    idVerificationCode?: string
    idVerificationStatus?: "pending" | "approved" | "rejected"
    idVerifiedAt?: Date
    lastSeen?:string
    currentStep: number
    status: "draft" | "pending_review" | "approved" | "rejected" | "completed"
    assignedProfessional?: string
    createdAt: Date
    updatedAt: Date
    notes?: string
  }
  
  export interface ChatMessage {
    id?: string
    applicationId: string
    senderId: string
    senderName: string
    senderRole: "customer" | "professional" | "admin"
    message: string
    timestamp: Date
    read: boolean
  }
  
  export interface User {
    id: string
    email: string
    name: string
    role: "customer" | "professional" | "admin"
    createdAt: Date
  }
  
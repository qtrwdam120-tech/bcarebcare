import { Check, User, Shield, List, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
}

const steps = [
  { id: 1, label: "البيانات الشخصية", icon: User },
  { id: 2, label: "بيانات التأمين", icon: Shield },
  { id: 3, label: "العروض المتاحة", icon: List },
  { id: 4, label: "الدفع", icon: CreditCard },
];

export function StepIndicator({ currentStep, totalSteps = 4 }: StepIndicatorProps) {
  return (
    <div className="w-full" data-testid="step-indicator" dir="rtl">
      {/* Desktop version */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between relative px-4 py-6">
          {/* Progress line background */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2 mx-16" />
          
          {/* Progress line fill */}
          <div 
            className="absolute top-1/2 left-0 h-1 bg-[#0a4a68] -translate-y-1/2 mx-16 transition-all duration-500"
            style={{ width: `calc(${((currentStep - 1) / (totalSteps - 1)) * 100}% - 8rem)` }}
          />

          {steps.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className="flex flex-col items-center relative z-10"
                data-testid={`step-${step.id}`}
              >
                {/* Step circle */}
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-4",
                    isCompleted && "bg-[#0a4a68] border-[#0a4a68]",
                    isCurrent && "bg-white border-[#0a4a68] shadow-lg shadow-[#0a4a68]/20",
                    !isCompleted && !isCurrent && "bg-white border-gray-300"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-6 h-6 text-white" strokeWidth={3} />
                  ) : (
                    <Icon
                      className={cn(
                        "w-5 h-5 transition-colors",
                        isCurrent ? "text-[#0a4a68]" : "text-gray-400"
                      )}
                    />
                  )}
                </div>

                {/* Step label */}
                <span
                  className={cn(
                    "mt-3 text-sm font-semibold text-center whitespace-nowrap transition-colors",
                    isCompleted && "text-[#0a4a68]",
                    isCurrent && "text-[#0a4a68]",
                    !isCompleted && !isCurrent && "text-gray-400"
                  )}
                  dir="rtl"
                >
                  {step.label}
                </span>

                {/* Step number badge */}
                <span
                  className={cn(
                    "absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center",
                    isCompleted && "bg-green-500 text-white",
                    isCurrent && "bg-yellow-400 text-[#0a4a68]",
                    !isCompleted && !isCurrent && "bg-gray-200 text-gray-500"
                  )}
                >
                  {step.id}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile version */}
      <div className="md:hidden">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mx-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2" dir="rtl">
              <div className="w-10 h-10 rounded-full bg-[#0a4a68] flex items-center justify-center border-2 border-yellow-400">
                {(() => {
                  const CurrentIcon = steps[currentStep - 1]?.icon || User;
                  return <CurrentIcon className="w-5 h-5 text-white" />;
                })()}
              </div>
              <div>
                <p className="text-white text-sm font-bold">
                  {steps[currentStep - 1]?.label}
                </p>
                <p className="text-white/70 text-xs">
                  الخطوة {currentStep} من {totalSteps}
                </p>
              </div>
            </div>
            <div className="bg-yellow-400 text-[#0a4a68] px-3 py-1 rounded-full text-sm font-bold">
              {Math.round((currentStep / totalSteps) * 100)}%
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 mt-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  currentStep >= step.id ? "bg-yellow-400" : "bg-white/30"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

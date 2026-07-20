export function FullPageLoader() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-6">
          <div className="relative h-20 w-20">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-muted"></div>
            {/* Animated ring */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#0a4a68] animate-spin"></div>
            {/* Inner ring for depth */}
            <div
              className="absolute inset-2 rounded-full border-4 border-transparent border-t-yellow-500/50 animate-spin"
              style={{ animationDuration: "1.5s", animationDirection: "reverse" }}
            ></div>
            
          </div>
  
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-medium text-foreground tracking-wide">يرجى الأنتظار</p>
            <div className="flex gap-1">
              <span
                className="h-1.5 w-1.5 rounded-full  bg-[#0a4a68] animate-pulse"
                style={{ animationDelay: "0ms" }}
              ></span>
              <span
                className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse"
                style={{ animationDelay: "150ms" }}
              ></span>
              <span
                className="h-1.5 w-1.5 rounded-full  bg-[#0a4a68]  animate-pulse"
                style={{ animationDelay: "300ms" }}
              ></span>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
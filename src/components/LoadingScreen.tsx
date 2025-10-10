import lovepassHeart from "@/assets/lovepass-heart.png";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

const LoadingScreen = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress >= 100) {
          return 0;
        }
        const newProgress = oldProgress + 10;
        return Math.min(newProgress, 100);
      });
    }, 200);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-8">
        {/* Logo Section */}
        <div className="flex items-center gap-4">
          {/* Spinning Heart */}
          <div className="relative">
            <img
              src={lovepassHeart}
              alt="Lovepass Heart"
              className="h-16 w-16 animate-spin-slow"
            />
          </div>
          
          {/* Lovepass Text */}
          <h1 className="text-6xl font-bold tracking-tight">
            Lovepass
          </h1>
        </div>

        {/* Loading Section */}
        <div className="w-80 space-y-4">
          <p className="text-center text-lg text-muted-foreground">
            Loading...
          </p>
          
          {/* Progress Bar */}
          <Progress value={progress} className="h-2" />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  variant?: 'default' | 'primary';
  className?: string;
}

export function ThemeToggle({ variant = 'default', className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button 
        variant="ghost" 
        size="icon" 
        className={cn(
          "focus-ring h-12 w-12 min-h-[var(--tap-min)] min-w-[var(--tap-min)]",
          variant === 'primary' && "text-primary-foreground hover:bg-primary-foreground/10",
          className,
        )}
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const nextMode = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextMode)}
      className={cn(
        "focus-ring h-12 w-12 min-h-[var(--tap-min)] min-w-[var(--tap-min)]",
        variant === 'primary' && "text-primary-foreground hover:bg-primary-foreground/10",
        className,
      )}
      aria-label={nextMode === 'dark' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4 transition-all" />
      ) : (
        <Moon className="h-4 w-4 transition-all" />
      )}
    </Button>
  );
}


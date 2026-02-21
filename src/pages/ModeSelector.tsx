import { useState } from 'react';
import { useBusinessMode, BUSINESS_CONFIGS, BusinessMode } from '@/context/BusinessModeContext';
import { cn } from '@/lib/utils';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const modes = Object.values(BUSINESS_CONFIGS);

export default function ModeSelector() {
  const { setMode } = useBusinessMode();
  const [selected, setSelected] = useState<BusinessMode | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    if (selected) {
      setIsSaving(true);
      await setMode(selected);
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 mb-6">
            <div className="w-2 h-2 bg-success rounded-full" />
            <span className="text-sm font-medium text-muted-foreground">Getting Started</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3">
            What type of business?
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            This configures your dashboard, navigation, and terminology. You can change this later in settings.
          </p>
        </div>

        {/* Mode Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {modes.map((config) => {
            const isSelected = selected === config.mode;
            return (
              <button
                key={config.mode}
                onClick={() => setSelected(config.mode)}
                className={cn(
                  'relative p-6 rounded border-2 text-left transition-all duration-200 group',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-lg'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-card/80'
                )}
              >
                {/* Checkmark */}
                {isSelected && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}

                {/* Icon */}
                <div className="text-5xl mb-4">{config.icon}</div>

                {/* Label */}
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {config.label}
                </h3>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {config.description}
                </p>

                {/* Feature hints */}
                <div className="mt-4 pt-4 border-t border-border/50">
                  {config.mode === 'restaurant' ? (
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-success rounded-full" />
                        Table management & floor plan
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-success rounded-full" />
                        Kitchen tickets & order queue
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-success rounded-full" />
                        Dine-in, takeaway & delivery
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-success rounded-full" />
                        Menu & dish management
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-info rounded-full" />
                        Product catalog & categories
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-info rounded-full" />
                        Inventory & stock tracking
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-info rounded-full" />
                        Barcode scanning support
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-info rounded-full" />
                        Supplier management
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Continue Button */}
        <div className="text-center">
          <Button
            size="lg"
            disabled={!selected || isSaving}
            onClick={handleContinue}
            className="px-8 h-12 text-base font-semibold"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Both modes share the same cart, payments, customers, and analytics engine.
        </p>
      </div>
    </div>
  );
}

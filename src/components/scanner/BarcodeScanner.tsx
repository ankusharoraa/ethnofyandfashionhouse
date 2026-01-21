import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Flashlight, FlashlightOff, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');

  useEffect(() => {
    if (scanMode === 'camera' && isScanning) {
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.0,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      };

      scannerRef.current = new Html5QrcodeScanner(
        'barcode-reader',
        config,
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          // Success callback
          setIsScanning(false);
          if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
          }
          onScan(decodedText);
        },
        (error) => {
          // Error callback - ignore common scanning errors
          if (!error.includes('NotFoundException')) {
            console.debug('Scanner error:', error);
          }
        }
      );

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error);
        }
      };
    }
  }, [scanMode, isScanning, onScan]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
    >
      <div className="h-full flex flex-col safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Scan Barcode
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scanner Tabs */}
        <div className="flex-1 p-4 flex flex-col">
          <Tabs
            value={scanMode}
            onValueChange={(v) => setScanMode(v as 'camera' | 'manual')}
            className="flex-1 flex flex-col"
          >
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="camera" className="gap-2">
                <Camera className="w-4 h-4" />
                Camera Scan
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <QrCode className="w-4 h-4" />
                Manual Entry
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="flex-1 flex flex-col">
              <Card className="flex-1 relative overflow-hidden bg-black rounded-2xl">
                <div
                  id="barcode-reader"
                  className="w-full h-full [&>div]:!border-none [&_video]:!object-cover"
                />
                
                {/* Scan overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative">
                    <motion.div
                      className="w-64 h-40 border-2 border-primary rounded-lg"
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <motion.div
                      className="absolute left-0 right-0 h-0.5 bg-primary"
                      initial={{ top: '0%' }}
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                </div>
              </Card>

              <p className="text-center text-muted-foreground mt-4 text-sm">
                Position the barcode within the frame
              </p>
            </TabsContent>

            <TabsContent value="manual" className="flex-1 flex flex-col justify-center">
              <Card className="p-6 space-y-4">
                <div className="text-center mb-6">
                  <QrCode className="w-12 h-12 mx-auto text-primary mb-2" />
                  <h3 className="font-semibold">Enter Barcode Manually</h3>
                  <p className="text-sm text-muted-foreground">
                    Type or paste the barcode number
                  </p>
                </div>

                <Input
                  placeholder="Enter barcode..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                  className="text-center text-lg h-12"
                  autoFocus
                />

                <Button
                  onClick={handleManualSubmit}
                  disabled={!manualCode.trim()}
                  className="w-full h-12"
                >
                  Search SKU
                </Button>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </motion.div>
  );
}

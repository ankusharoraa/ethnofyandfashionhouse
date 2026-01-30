import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { SKUCard } from '@/components/inventory/SKUCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QrCode, Package, ArrowRight } from 'lucide-react';
import { useSKUs, SKU } from '@/hooks/useSKUs';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function Scan() {
  const { findByBarcode } = useSKUs();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [foundSKU, setFoundSKU] = useState<SKU | null>(null);
  const [scannedCode, setScannedCode] = useState('');

  const handleScan = async (code: string) => {
    setScanning(false);
    setScannedCode(code);
    const sku = await findByBarcode(code);
    if (sku) {
      setFoundSKU(sku);
      toast({ title: 'SKU Found!', description: sku.name });
    } else {
      setFoundSKU(null);
      toast({ title: 'Not Found', description: 'No SKU with this barcode. Create new?', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold mb-6">Scan Barcode</h1>
      
      <Card className="p-8 text-center mb-6">
        <QrCode className="w-16 h-16 mx-auto text-primary mb-4" />
        <h2 className="text-lg font-semibold mb-2">Scan or Search</h2>
        <p className="text-muted-foreground mb-4">Use camera to scan barcode/QR code</p>
        <Button onClick={() => setScanning(true)} size="lg"><QrCode className="w-5 h-5 mr-2" />Start Scanning</Button>
      </Card>

      {foundSKU && <SKUCard sku={foundSKU} showActions={false} />}
      
      {scannedCode && !foundSKU && (
        <Card className="p-6 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="mb-4">Barcode: <strong>{scannedCode}</strong></p>
          <Button onClick={() => navigate(`/purchase-billing-revamped?barcode=${encodeURIComponent(scannedCode)}`)}>
            Create in Purchases
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Card>
      )}

      {scanning && <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />}
    </AppLayout>
  );
}

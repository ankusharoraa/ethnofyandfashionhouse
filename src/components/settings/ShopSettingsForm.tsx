import { useState, useEffect } from 'react';
import { Store, MapPin, Phone, Mail, FileText, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useShopSettings, type ShopSettings } from '@/hooks/useShopSettings';

export function ShopSettingsForm() {
  const { settings, updateSettings, isLoading } = useShopSettings();
  const [formData, setFormData] = useState<Partial<ShopSettings>>({
    shop_name: '',
    shop_name_hindi: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    gstin: '',
    tagline: '',
    terms_and_conditions: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        shop_name: settings.shop_name || '',
        shop_name_hindi: settings.shop_name_hindi || '',
        address: settings.address || '',
        city: settings.city || '',
        state: settings.state || '',
        pincode: settings.pincode || '',
        phone: settings.phone || '',
        email: settings.email || '',
        gstin: settings.gstin || '',
        tagline: settings.tagline || '',
        terms_and_conditions: settings.terms_and_conditions || '',
      });
    }
  }, [settings]);

  const handleChange = (field: keyof ShopSettings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="w-5 h-5" />
          Shop Details (दुकान विवरण)
        </CardTitle>
        <CardDescription>
          These details will appear on your invoices and bills
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Shop Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shop_name">Shop Name *</Label>
              <Input
                id="shop_name"
                value={formData.shop_name}
                onChange={(e) => handleChange('shop_name', e.target.value)}
                placeholder="My Shop"
                required
              />
            </div>
            <div>
              <Label htmlFor="shop_name_hindi">Shop Name (Hindi)</Label>
              <Input
                id="shop_name_hindi"
                value={formData.shop_name_hindi || ''}
                onChange={(e) => handleChange('shop_name_hindi', e.target.value)}
                placeholder="मेरी दुकान"
              />
            </div>
          </div>

          {/* Tagline */}
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={formData.tagline || ''}
              onChange={(e) => handleChange('tagline', e.target.value)}
              placeholder="Quality fabric at best prices"
            />
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="address" className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Address
            </Label>
            <Textarea
              id="address"
              value={formData.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Shop No. 123, Main Market..."
              rows={2}
            />
          </div>

          {/* City, State, Pincode */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city || ''}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="Delhi"
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state || ''}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="Delhi"
              />
            </div>
            <div>
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                value={formData.pincode || ''}
                onChange={(e) => handleChange('pincode', e.target.value)}
                placeholder="110001"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                Phone
              </Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+91 9876543210"
              />
            </div>
            <div>
              <Label htmlFor="email" className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="shop@example.com"
              />
            </div>
          </div>

          {/* GSTIN */}
          <div>
            <Label htmlFor="gstin" className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              GSTIN
            </Label>
            <Input
              id="gstin"
              value={formData.gstin || ''}
              onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
            />
          </div>

          {/* Terms */}
          <div>
            <Label htmlFor="terms">Terms & Conditions (for invoice)</Label>
            <Textarea
              id="terms"
              value={formData.terms_and_conditions || ''}
              onChange={(e) => handleChange('terms_and_conditions', e.target.value)}
              placeholder="Goods once sold will not be taken back..."
              rows={3}
            />
          </div>

          <Button type="submit" disabled={isSaving || isLoading} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
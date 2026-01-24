import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, User, Shield, Store, Users, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ShopSettingsForm } from '@/components/settings/ShopSettingsForm';
import { EmployeeManagement } from '@/components/settings/EmployeeManagement';

export default function Settings() {
  const { profile, signOut, isOwner } = useAuth();
  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          {isOwner && (
            <>
              <TabsTrigger value="shop" className="gap-2">
                <Store className="w-4 h-4" />
                Shop Settings
              </TabsTrigger>
              <TabsTrigger value="employees" className="gap-2">
                <Users className="w-4 h-4" />
                Employees
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="text-xl bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">{profile?.full_name || 'User'}</h2>
                <Badge variant={isOwner ? 'default' : 'secondary'} className="mt-1">
                  <Shield className="w-3 h-3 mr-1" />
                  {profile?.role === 'owner' ? 'Owner (मालिक)' : 'Staff (स्टाफ)'}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Phone</span>
                <span>{profile?.phone || 'Not set'}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Role</span>
                <span className="capitalize">{profile?.role}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Member since</span>
                <span>{new Date(profile?.created_at || '').toLocaleDateString()}</span>
              </div>
            </div>
          </Card>

          <Button variant="destructive" onClick={signOut} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />Sign Out
          </Button>
        </TabsContent>

        {/* Shop Settings Tab (Owner Only) */}
        {isOwner && (
          <TabsContent value="shop">
            <ShopSettingsForm />
          </TabsContent>
        )}

        {/* Employee Management Tab (Owner Only) */}
        {isOwner && (
          <TabsContent value="employees">
            <EmployeeManagement />
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}
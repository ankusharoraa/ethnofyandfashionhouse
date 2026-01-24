import { useState } from 'react';
import { Users, Shield, Check, X, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  usePermissions,
  PERMISSION_LABELS,
  type PermissionType,
  type StaffMember,
} from '@/hooks/usePermissions';

export function EmployeeManagement() {
  const { staffMembers, togglePermission, isLoading } = usePermissions();
  const [expandedStaff, setExpandedStaff] = useState<string[]>([]);

  const staffOnly = staffMembers.filter((s) => s.role === 'staff');
  const owners = staffMembers.filter((s) => s.role === 'owner');

  const handleToggle = async (userId: string, permission: PermissionType, checked: boolean) => {
    await togglePermission(userId, permission, checked);
  };

  const allPermissions = Object.keys(PERMISSION_LABELS) as PermissionType[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Employee Management (कर्मचारी प्रबंधन)
        </CardTitle>
        <CardDescription>
          Manage staff permissions for different features
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Owners Section */}
        {owners.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Owners (मालिक) - Full Access
            </h4>
            <div className="space-y-2">
              {owners.map((owner) => (
                <div
                  key={owner.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{owner.full_name || 'Owner'}</p>
                    <p className="text-sm text-muted-foreground">{owner.phone || 'No phone'}</p>
                  </div>
                  <Badge variant="default">
                    <Shield className="w-3 h-3 mr-1" />
                    Owner
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff Section */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Staff Members (स्टाफ)
          </h4>

          {staffOnly.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No staff members yet</p>
              <p className="text-sm">Staff accounts will appear here when they sign up</p>
            </div>
          ) : (
            <Accordion type="multiple" value={expandedStaff} onValueChange={setExpandedStaff}>
              {staffOnly.map((staff) => (
                <AccordionItem key={staff.id} value={staff.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{staff.full_name || 'Staff'}</p>
                        <p className="text-sm text-muted-foreground">{staff.phone || 'No phone'}</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {allPermissions.map((perm) => {
                        const { label, labelHindi, description } = PERMISSION_LABELS[perm];
                        const hasPermission = staff.permissions.includes(perm);

                        return (
                          <div
                            key={perm}
                            className="flex items-center justify-between p-3 rounded-lg border bg-background"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {label} ({labelHindi})
                              </p>
                              <p className="text-xs text-muted-foreground">{description}</p>
                            </div>
                            <Switch
                              checked={hasPermission}
                              onCheckedChange={(checked) =>
                                handleToggle(staff.user_id, perm, checked)
                              }
                              disabled={isLoading}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
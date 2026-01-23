import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';

export type PermissionType = 
  | 'sales_bill'
  | 'purchase_bill'
  | 'stock_edit'
  | 'receive_payment'
  | 'pay_supplier'
  | 'view_reports'
  | 'view_profit'
  | 'manage_employees';

export interface StaffPermission {
  id: string;
  user_id: string;
  permission: PermissionType;
  granted_by: string | null;
  created_at: string;
}

export interface StaffMember {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  role: 'owner' | 'staff';
  permissions: PermissionType[];
}

export const PERMISSION_LABELS: Record<PermissionType, { label: string; labelHindi: string; description: string }> = {
  sales_bill: { label: 'Sales Bill', labelHindi: 'बिक्री बिल', description: 'Create and manage sales invoices' },
  purchase_bill: { label: 'Purchase Bill', labelHindi: 'खरीद बिल', description: 'Create and manage purchase invoices' },
  stock_edit: { label: 'Edit Stock', labelHindi: 'स्टॉक संपादित करें', description: 'Manually adjust inventory levels' },
  receive_payment: { label: 'Receive Payment', labelHindi: 'भुगतान प्राप्त करें', description: 'Receive payments from customers' },
  pay_supplier: { label: 'Pay Supplier', labelHindi: 'सप्लायर को भुगतान करें', description: 'Make payments to suppliers' },
  view_reports: { label: 'View Reports', labelHindi: 'रिपोर्ट देखें', description: 'Access sales and inventory reports' },
  view_profit: { label: 'View Profit', labelHindi: 'लाभ देखें', description: 'Access profit and margin data' },
  manage_employees: { label: 'Manage Employees', labelHindi: 'कर्मचारी प्रबंधन', description: 'Add/remove staff and permissions' },
};

export function usePermissions() {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [myPermissions, setMyPermissions] = useState<PermissionType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, isOwner } = useAuth();

  const fetchStaffWithPermissions = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch all profiles (staff members)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      // Fetch all permissions
      const { data: permissions, error: permError } = await supabase
        .from('staff_permissions')
        .select('*');

      if (permError) {
        console.error('Error fetching permissions:', permError);
        return;
      }

      // Map permissions to staff members
      const staffList: StaffMember[] = (profiles || []).map((profile) => {
        const userPermissions = (permissions || [])
          .filter((p) => p.user_id === profile.user_id)
          .map((p) => p.permission as PermissionType);

        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          phone: profile.phone,
          role: profile.role,
          permissions: userPermissions,
        };
      });

      setStaffMembers(staffList);

      // Set current user's permissions
      const myPerms = (permissions || [])
        .filter((p) => p.user_id === user.id)
        .map((p) => p.permission as PermissionType);
      setMyPermissions(myPerms);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const hasPermission = useCallback((permission: PermissionType): boolean => {
    if (isOwner) return true;
    return myPermissions.includes(permission);
  }, [isOwner, myPermissions]);

  const grantPermission = async (userId: string, permission: PermissionType) => {
    if (!isOwner) {
      toast({
        title: 'Permission Denied',
        description: 'Only owners can manage permissions',
        variant: 'destructive',
      });
      return false;
    }

    const { error } = await supabase
      .from('staff_permissions')
      .insert({
        user_id: userId,
        permission,
        granted_by: user?.id,
      });

    if (error) {
      if (error.code === '23505') {
        // Unique violation - permission already exists
        return true;
      }
      console.error('Error granting permission:', error);
      toast({
        title: 'Error',
        description: 'Failed to grant permission',
        variant: 'destructive',
      });
      return false;
    }

    await fetchStaffWithPermissions();
    return true;
  };

  const revokePermission = async (userId: string, permission: PermissionType) => {
    if (!isOwner) {
      toast({
        title: 'Permission Denied',
        description: 'Only owners can manage permissions',
        variant: 'destructive',
      });
      return false;
    }

    const { error } = await supabase
      .from('staff_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission', permission);

    if (error) {
      console.error('Error revoking permission:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke permission',
        variant: 'destructive',
      });
      return false;
    }

    await fetchStaffWithPermissions();
    return true;
  };

  const togglePermission = async (userId: string, permission: PermissionType, granted: boolean) => {
    if (granted) {
      return grantPermission(userId, permission);
    } else {
      return revokePermission(userId, permission);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStaffWithPermissions();
    }
  }, [user, fetchStaffWithPermissions]);

  return {
    staffMembers,
    myPermissions,
    isLoading,
    hasPermission,
    grantPermission,
    revokePermission,
    togglePermission,
    fetchStaffWithPermissions,
  };
}

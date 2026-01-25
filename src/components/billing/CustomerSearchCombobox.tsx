import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Customer } from '@/hooks/useCustomers';

interface CustomerSearchComboboxProps {
  customers: Customer[];
  selectedCustomerId: string;
  onSelect: (customerId: string, customer: Customer | null) => void;
}

export function CustomerSearchCombobox({
  customers,
  selectedCustomerId,
  onSelect,
}: CustomerSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const filteredCustomers = useMemo(() => {
    if (!searchValue.trim()) return customers;
    const search = searchValue.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        (c.phone && c.phone.includes(search))
    );
  }, [customers, searchValue]);

  const handleSelect = (customerId: string) => {
    if (customerId === '') {
      onSelect('', null);
    } else {
      const customer = customers.find((c) => c.id === customerId) || null;
      onSelect(customerId, customer);
    }
    setOpen(false);
    setSearchValue('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 font-normal"
        >
          {selectedCustomer ? (
            <span className="flex items-center gap-2 truncate">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="truncate">{selectedCustomer.name}</span>
              {selectedCustomer.phone && (
                <span className="text-muted-foreground text-xs">
                  ({selectedCustomer.phone})
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Walk-in Customer</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or phone..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No customer found.
              </div>
            </CommandEmpty>
            <CommandGroup>
              {/* Walk-in option */}
              <CommandItem
                value=""
                onSelect={() => handleSelect('')}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    !selectedCustomerId ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span className="text-muted-foreground">Walk-in Customer</span>
              </CommandItem>

              {/* Customer list */}
              {filteredCustomers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.id}
                  onSelect={() => handleSelect(customer.id)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedCustomerId === customer.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{customer.name}</span>
                    {customer.phone && (
                      <span className="text-xs text-muted-foreground">
                        {customer.phone}
                      </span>
                    )}
                  </div>
                  {customer.outstanding_balance > 0 && (
                    <span className="ml-auto text-xs text-orange-600 font-medium">
                      ₹{customer.outstanding_balance.toFixed(0)} due
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

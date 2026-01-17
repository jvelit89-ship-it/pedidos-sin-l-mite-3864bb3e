import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomers, useGeocoding } from '@/hooks/useCustomers';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { MapView } from '@/components/MapView';
import { Plus, Search, Users, Phone, MapPin, Edit2, Eye, Map, Loader2 } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: 'regular' | 'premium' | 'vip';
  notes: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export default function CustomersPage() {
  const { canEditCustomers, user } = useAuth();
  const { t, settings } = useSettings();
  const { customers, loading, addCustomer, updateCustomer } = useCustomers();
  const { searchAddress } = useGeocoding();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ lat: string; lon: string; display_name: string }>>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
    notes: '',
    category: 'regular' as 'regular' | 'premium' | 'vip',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const handleAddressSearch = async (query: string) => {
    setFormData(prev => ({ ...prev, address: query }));
    if (query.length >= 3) {
      setIsSearchingAddress(true);
      const results = await searchAddress(query);
      setAddressSuggestions(results);
      setIsSearchingAddress(false);
    } else {
      setAddressSuggestions([]);
    }
  };

  const handleSelectAddress = (suggestion: { lat: string; lon: string; display_name: string }) => {
    setFormData(prev => ({
      ...prev,
      address: suggestion.display_name,
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    }));
    setAddressSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCustomer) {
      await updateCustomer(selectedCustomer.id, {
        name: formData.name,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        notes: formData.notes || null,
        category: formData.category,
        latitude: formData.latitude,
        longitude: formData.longitude,
      });
    } else {
      await addCustomer({
        name: formData.name,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        notes: formData.notes || null,
        category: formData.category,
        latitude: formData.latitude,
        longitude: formData.longitude,
      });
    }

    handleCloseDialog();
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedCustomer(null);
    setAddressSuggestions([]);
    setFormData({
      name: '',
      phone: '',
      address: '',
      email: '',
      notes: '',
      category: 'regular',
      latitude: null,
      longitude: null,
    });
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      email: customer.email || '',
      notes: customer.notes || '',
      category: customer.category || 'regular',
      latitude: customer.latitude,
      longitude: customer.longitude,
    });
    setIsDialogOpen(true);
  };

  const handleView = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsViewDialogOpen(true);
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const filtered = customers.filter((c: Customer) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">{t.customers}</h1>
        {canEditCustomers && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> {t.newCustomer}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedCustomer ? t.editCustomer : t.newCustomer}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.name} *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.phone} *</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t.address} *</Label>
                  <div className="relative">
                    <Input
                      value={formData.address}
                      onChange={(e) => handleAddressSearch(e.target.value)}
                      placeholder={settings.language === 'es' ? 'Buscar dirección...' : 'Search address...'}
                      required
                    />
                    {isSearchingAddress && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {addressSuggestions.length > 0 && (
                    <div className="border rounded-md bg-background max-h-40 overflow-y-auto">
                      {addressSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0"
                          onClick={() => handleSelectAddress(suggestion)}
                        >
                          {suggestion.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.email}</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{settings.language === 'es' ? 'Categoría' : 'Category'}</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v as 'regular' | 'premium' | 'vip' })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t.notes}</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Map className="w-4 h-4" /> {t.customerLocation}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {settings.language === 'es' 
                      ? 'Haz clic en el mapa para ajustar la ubicación' 
                      : 'Click on the map to adjust the location'}
                  </p>
                  <MapView
                    latitude={formData.latitude ?? undefined}
                    longitude={formData.longitude ?? undefined}
                    onLocationSelect={handleLocationSelect}
                    editable={true}
                    height="200px"
                  />
                  {formData.latitude && formData.longitude && (
                    <p className="text-xs text-muted-foreground">
                      📍 {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  {selectedCustomer ? t.save : t.create}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`${t.search}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t.noData}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c: Customer, i: number) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="card-interactive">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{c.name}</p>
                        {c.category && (
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              c.category === 'premium'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : c.category === 'vip'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                            }`}
                          >
                            {c.category}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {c.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5" />
                            {c.phone}
                          </div>
                        )}
                        {c.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="truncate">{c.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleView(c)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {canEditCustomers && (
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* View Customer Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm">
                {selectedCustomer.phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.phone}</span>
                    <span>{selectedCustomer.phone}</span>
                  </div>
                )}
                {selectedCustomer.address && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.address}</span>
                    <span className="text-right">{selectedCustomer.address}</span>
                  </div>
                )}
                {selectedCustomer.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.email}</span>
                    <span>{selectedCustomer.email}</span>
                  </div>
                )}
                {selectedCustomer.notes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.notes}</span>
                    <span className="text-right">{selectedCustomer.notes}</span>
                  </div>
                )}
              </div>

              {selectedCustomer.latitude && selectedCustomer.longitude ? (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Map className="w-4 h-4" /> {t.customerLocation}
                  </Label>
                  <MapView
                    latitude={selectedCustomer.latitude}
                    longitude={selectedCustomer.longitude}
                    height="200px"
                  />
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedCustomer.latitude},${selectedCustomer.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <MapPin className="w-4 h-4" /> {t.startNavigation}
                  </a>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {settings.language === 'es' ? 'No hay ubicación registrada' : 'No location registered'}
                </p>
              )}

              {!canEditCustomers && (
                <p className="text-xs text-muted-foreground italic">
                  {t.viewOnly} - {settings.language === 'es' ? 'Solo el administrador puede editar clientes' : 'Only admin can edit customers'}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

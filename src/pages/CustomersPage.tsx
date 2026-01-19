import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCustomers, useGeocoding } from '@/hooks/useCustomers';
import { useVendedores } from '@/hooks/useTeam';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { MapView } from '@/components/MapView';
import { CustomerPurchaseHistory } from '@/components/CustomerPurchaseHistory';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Search, Users, Phone, MapPin, Edit2, Eye, Map, Loader2, Camera, MapPinned, User, X, Image, Trash2, ImagePlus, Store, ShoppingBag, ExternalLink, Link2 } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: 'regular' | 'premium' | 'vip';
  customer_type: 'minorista' | 'mayorista';
  notes: string | null;
  company_id: string;
  facade_photo_url: string | null;
  vendedor_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function CustomersPage() {
  const { canEditCustomers, user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const { t, settings } = useSettings();
  const { customers, loading, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const { vendedores } = useVendedores();
  const { searchAddress, reverseGeocode } = useGeocoding();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ lat: string; lon: string; display_name: string }>>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showAddressConfirmation, setShowAddressConfirmation] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    business_name: '',
    phone: '',
    address: '',
    email: '',
    notes: '',
    category: 'regular' as 'regular' | 'premium' | 'vip',
    customer_type: 'minorista' as 'minorista' | 'mayorista',
    latitude: null as number | null,
    longitude: null as number | null,
    vendedor_id: '' as string,
    facade_photo_url: null as string | null,
    google_maps_link: '' as string,
  });

  // Check if we're on mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Auto-detect location on dialog open for new customers on mobile
  useEffect(() => {
    if (isDialogOpen && !selectedCustomer && isMobile && !formData.latitude) {
      handleGetCurrentLocation();
    }
  }, [isDialogOpen, selectedCustomer, isMobile]);

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }

    setIsGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({ ...prev, latitude, longitude }));
        
        // Try to get address from coordinates
        const address = await reverseGeocode(latitude, longitude);
        if (address) {
          setFormData(prev => ({ ...prev, address }));
        }
        
        toast.success('Ubicación detectada');
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let message = 'No se pudo obtener la ubicación';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Permiso de ubicación denegado';
        }
        toast.error(message);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Simple address input - no automatic search
  const handleAddressChange = (value: string) => {
    setFormData(prev => ({ ...prev, address: value }));
    setShowAddressConfirmation(false);
    setAddressSuggestions([]);
  };

  // User confirms address is correct (no geocoding needed)
  const handleConfirmAddress = () => {
    setShowAddressConfirmation(false);
    setAddressSuggestions([]);
    toast.success('Dirección confirmada');
  };

  // User wants to search for suggestions
  const handleSearchSuggestions = async () => {
    if (formData.address.length < 5) {
      toast.error('Ingresa al menos 5 caracteres');
      return;
    }
    
    setIsSearchingAddress(true);
    try {
      const results = await searchAddress(formData.address);
      setAddressSuggestions(results.slice(0, 3));
      if (results.length === 0) {
        toast.info('No se encontraron sugerencias');
      }
    } catch (error) {
      console.error('Address search error:', error);
      toast.error('Error al buscar direcciones');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // Show confirmation dialog when user finishes typing
  const handleAddressBlur = () => {
    if (formData.address.length >= 5 && !formData.latitude) {
      setShowAddressConfirmation(true);
    }
  };

  const handleSelectAddress = (suggestion: { lat: string; lon: string; display_name: string }) => {
    // Extract a shorter, cleaner address
    const parts = suggestion.display_name.split(',');
    const shortAddress = parts.slice(0, 3).join(',').trim();
    
    setFormData(prev => ({
      ...prev,
      address: shortAddress,
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    }));
    setAddressSuggestions([]);
    setShowAddressConfirmation(false);
    toast.success('Ubicación guardada');
  };

  // Extract coordinates from Google Maps link
  const parseGoogleMapsLink = (link: string): { lat: number; lng: number } | null => {
    try {
      // Match patterns like:
      // https://www.google.com/maps?q=-12.0464,-77.0428
      // https://www.google.com/maps/place/.../@-12.0464,-77.0428,17z
      // https://maps.google.com/?q=-12.0464,-77.0428
      // https://goo.gl/maps/...
      // https://maps.app.goo.gl/...
      
      // Pattern 1: @lat,lng,zoom
      const atPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      const atMatch = link.match(atPattern);
      if (atMatch) {
        return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
      }
      
      // Pattern 2: ?q=lat,lng or &q=lat,lng
      const qPattern = /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      const qMatch = link.match(qPattern);
      if (qMatch) {
        return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
      }
      
      // Pattern 3: /place/lat,lng
      const placePattern = /\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      const placeMatch = link.match(placePattern);
      if (placeMatch) {
        return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };
      }

      // Pattern 4: ll=lat,lng
      const llPattern = /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      const llMatch = link.match(llPattern);
      if (llMatch) {
        return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
      }
      
      return null;
    } catch {
      return null;
    }
  };

  const handleGoogleMapsLinkChange = async (link: string) => {
    setFormData(prev => ({ ...prev, google_maps_link: link }));
    
    if (!link.trim()) return;
    
    const coords = parseGoogleMapsLink(link);
    if (coords) {
      setFormData(prev => ({
        ...prev,
        latitude: coords.lat,
        longitude: coords.lng,
      }));
      
      // Try to get address from coordinates
      const address = await reverseGeocode(coords.lat, coords.lng);
      if (address) {
        const parts = address.split(',');
        const shortAddress = parts.slice(0, 3).join(',').trim();
        setFormData(prev => ({ ...prev, address: shortAddress }));
      }
      
      toast.success('Ubicación extraída del enlace');
    } else if (link.includes('google') || link.includes('maps') || link.includes('goo.gl')) {
      toast.error('No se pudo extraer la ubicación. Intenta copiar el enlace completo.');
    }
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleGallerySelect = () => {
    fileInputRef.current?.click();
  };

  // Compress image before upload
  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Scale down if larger than maxWidth
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Compression failed'));
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen no puede superar 10MB');
      return;
    }

    try {
      // Compress the image
      toast.info('Comprimiendo imagen...');
      const compressedFile = await compressImage(file, 800, 0.7);
      
      const originalSizeKB = Math.round(file.size / 1024);
      const compressedSizeKB = Math.round(compressedFile.size / 1024);
      console.log(`Image compressed: ${originalSizeKB}KB → ${compressedSizeKB}KB`);
      
      setPhotoFile(compressedFile);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Compression error:', error);
      // Fallback to original file if compression fails
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setFormData(prev => ({ ...prev, facade_photo_url: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadPhoto = async (customerId: string): Promise<string | null> => {
    if (!photoFile) return formData.facade_photo_url;

    setIsUploadingPhoto(true);
    try {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${customerId}-${Date.now()}.${fileExt}`;
      const filePath = `facades/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('customer-photos')
        .upload(filePath, photoFile, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Error al subir la foto');
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('customer-photos')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Photo upload error:', error);
      toast.error('Error al subir la foto');
      return null;
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone number (9 digits for Peru)
    if (formData.phone && formData.phone.length !== 9) {
      toast.error(settings.language === 'es' ? 'El teléfono debe tener 9 dígitos' : 'Phone must have 9 digits');
      return;
    }

    if (selectedCustomer) {
      // Upload new photo if selected
      let photoUrl = formData.facade_photo_url;
      if (photoFile) {
        photoUrl = await uploadPhoto(selectedCustomer.id);
      }

      await updateCustomer(selectedCustomer.id, {
        name: formData.name,
        business_name: formData.business_name || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        notes: formData.notes || null,
        category: formData.category,
        customer_type: formData.customer_type,
        latitude: formData.latitude,
        longitude: formData.longitude,
        vendedor_id: formData.vendedor_id || null,
        facade_photo_url: photoUrl,
      });
    } else {
      // Create customer first to get ID, then upload photo
      const newCustomer = await addCustomer({
        name: formData.name,
        business_name: formData.business_name || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        notes: formData.notes || null,
        category: formData.category,
        customer_type: formData.customer_type,
        latitude: formData.latitude,
        longitude: formData.longitude,
        vendedor_id: formData.vendedor_id || null,
        facade_photo_url: null,
      });

      // Upload photo if selected
      if (newCustomer && photoFile) {
        const photoUrl = await uploadPhoto(newCustomer.id);
        if (photoUrl) {
          await updateCustomer(newCustomer.id, { facade_photo_url: photoUrl });
        }
      }
    }

    handleCloseDialog();
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedCustomer(null);
    setAddressSuggestions([]);
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowAddressConfirmation(false);
    setFormData({
      name: '',
      business_name: '',
      phone: '',
      address: '',
      email: '',
      notes: '',
      category: 'regular',
      customer_type: 'minorista',
      latitude: null,
      longitude: null,
      vendedor_id: '',
      facade_photo_url: null,
      google_maps_link: '',
    });
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      business_name: customer.business_name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      email: customer.email || '',
      notes: customer.notes || '',
      category: customer.category || 'regular',
      customer_type: customer.customer_type || 'minorista',
      latitude: customer.latitude,
      longitude: customer.longitude,
      vendedor_id: customer.vendedor_id || '',
      facade_photo_url: customer.facade_photo_url,
      google_maps_link: '',
    });
    if (customer.facade_photo_url) {
      setPhotoPreview(customer.facade_photo_url);
    }
    setIsDialogOpen(true);
  };

  const handleView = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async (customer: Customer) => {
    if (confirm(settings.language === 'es' 
      ? `¿Eliminar al cliente "${customer.name}"? Esta acción no se puede deshacer.`
      : `Delete customer "${customer.name}"? This action cannot be undone.`)) {
      await deleteCustomer(customer.id);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const getVendedorName = (vendedorId: string | null) => {
    if (!vendedorId) return null;
    const vendedor = vendedores.find(v => v.id === vendedorId);
    return vendedor?.name || null;
  };

  const filtered = customers.filter((c: Customer) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">{t.customers}</h1>
        {canEditCustomers && (
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) handleCloseDialog();
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> {t.newCustomer}
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="max-w-lg max-h-[90vh] overflow-y-auto"
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
            >
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
                    <Label>{settings.language === 'es' ? 'Nombre del Negocio' : 'Business Name'}</Label>
                    <Input
                      value={formData.business_name}
                      onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                      placeholder={settings.language === 'es' ? 'Opcional' : 'Optional'}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t.phone} *</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => {
                      // Only allow digits
                      const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                      setFormData({ ...formData, phone: value });
                    }}
                    placeholder="987654321"
                    pattern="[0-9]{9}"
                    maxLength={9}
                    inputMode="numeric"
                    required
                  />
                  {formData.phone && formData.phone.length !== 9 && (
                    <p className="text-xs text-destructive">
                      {settings.language === 'es' ? 'El teléfono debe tener 9 dígitos' : 'Phone must have 9 digits'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t.address} *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      onBlur={handleAddressBlur}
                      placeholder={settings.language === 'es' ? 'Escribe la dirección completa...' : 'Enter full address...'}
                      className="flex-1"
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleGetCurrentLocation}
                      disabled={isGettingLocation}
                      title="Usar mi ubicación actual"
                    >
                      {isGettingLocation ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MapPinned className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  
                  {/* Address confirmation prompt */}
                  {showAddressConfirmation && !formData.latitude && (
                    <div className="p-3 bg-muted rounded-lg space-y-2">
                      <p className="text-sm">
                        {settings.language === 'es' 
                          ? '¿La dirección es correcta?' 
                          : 'Is the address correct?'}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={handleConfirmAddress}
                          className="flex-1"
                        >
                          {settings.language === 'es' ? 'Sí, es correcta' : 'Yes, correct'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleSearchSuggestions}
                          disabled={isSearchingAddress}
                          className="flex-1"
                        >
                          {isSearchingAddress ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            settings.language === 'es' ? 'Ver opciones' : 'See options'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Address suggestions */}
                  {addressSuggestions.length > 0 && (
                    <div className="border rounded-md bg-background shadow-lg overflow-hidden">
                      <p className="px-3 py-2 text-xs text-muted-foreground bg-muted border-b">
                        {settings.language === 'es' ? 'Selecciona una opción:' : 'Select an option:'}
                      </p>
                      {addressSuggestions.map((suggestion, idx) => {
                        const parts = suggestion.display_name.split(',');
                        const shortName = parts.slice(0, 3).join(',').trim();
                        return (
                          <button
                            key={idx}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0"
                            onClick={() => handleSelectAddress(suggestion)}
                          >
                            <MapPin className="w-3 h-3 inline mr-1 text-primary" />
                            {shortName}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Show coordinates if set */}
                  {formData.latitude && formData.longitude && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {settings.language === 'es' ? 'Ubicación guardada' : 'Location saved'}
                    </p>
                  )}
                </div>

                {/* Google Maps Link - Easy location input */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    {settings.language === 'es' ? 'Enlace de Google Maps (Opcional)' : 'Google Maps Link (Optional)'}
                  </Label>
                  <Input
                    value={formData.google_maps_link}
                    onChange={(e) => handleGoogleMapsLinkChange(e.target.value)}
                    placeholder={settings.language === 'es' ? 'Pega aquí el enlace de Google Maps...' : 'Paste Google Maps link here...'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {settings.language === 'es' 
                      ? '💡 Abre Google Maps, busca la ubicación, toca "Compartir" y copia el enlace' 
                      : '💡 Open Google Maps, find location, tap "Share" and copy the link'}
                  </p>
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

                {/* Customer Type - Minorista/Mayorista */}
                <div className="space-y-2">
                  <Label>{settings.language === 'es' ? 'Tipo de Cliente' : 'Customer Type'}</Label>
                  <Select
                    value={formData.customer_type}
                    onValueChange={(v) => setFormData({ ...formData, customer_type: v as 'minorista' | 'mayorista' })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minorista">
                        {settings.language === 'es' ? 'Minorista (Cliente Final)' : 'Retail (End Customer)'}
                      </SelectItem>
                      <SelectItem value="mayorista">
                        {settings.language === 'es' ? 'Mayorista (Precio Especial)' : 'Wholesale (Special Price)'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {settings.language === 'es' 
                      ? 'Los mayoristas reciben automáticamente precios por volumen' 
                      : 'Wholesale customers automatically receive volume pricing'}
                  </p>
                </div>

                {/* Vendedor Selector */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {settings.language === 'es' ? 'Vendedor Asignado' : 'Assigned Vendor'}
                  </Label>
                  <Select
                    value={formData.vendedor_id || "none"}
                    onValueChange={(v) => setFormData({ ...formData, vendedor_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={settings.language === 'es' ? 'Seleccionar vendedor...' : 'Select vendor...'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {settings.language === 'es' ? 'Sin asignar' : 'Unassigned'}
                      </SelectItem>
                      {vendedores.filter(v => v.active).map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Facade Photo */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    {settings.language === 'es' ? 'Foto de Fachada' : 'Facade Photo'}
                  </Label>
                  
                  {/* Hidden file inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />

                  {photoPreview ? (
                    <div className="relative">
                      <img
                        src={photoPreview}
                        alt="Fachada"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 w-6 h-6"
                        onClick={handleRemovePhoto}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                          <ImagePlus className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {settings.language === 'es' ? 'Agregar foto' : 'Add photo'}
                          </p>
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-48">
                        <DropdownMenuItem onClick={handleCameraCapture} className="gap-2">
                          <Camera className="w-4 h-4" />
                          {settings.language === 'es' ? 'Tomar foto' : 'Take photo'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleGallerySelect} className="gap-2">
                          <Image className="w-4 h-4" />
                          {settings.language === 'es' ? 'Elegir de galería' : 'Choose from gallery'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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

                <Button type="submit" className="w-full" disabled={isUploadingPhoto}>
                  {isUploadingPhoto ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Subiendo foto...
                    </>
                  ) : (
                    selectedCustomer ? t.save : t.create
                  )}
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
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    {c.facade_photo_url ? (
                      <img
                        src={c.facade_photo_url}
                        alt="Fachada"
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{c.name}</p>
                        {c.customer_type === 'mayorista' && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            <Store className="w-3 h-3 inline mr-0.5" />
                            Mayorista
                          </span>
                        )}
                        {c.category && c.category !== 'regular' && (
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              c.category === 'premium'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            }`}
                          >
                            {c.category}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 space-y-1 text-sm text-muted-foreground">
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
                        {c.vendedor_id && (
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5" />
                            <span className="truncate text-primary">{getVendedorName(c.vendedor_id)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleView(c)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {canEditCustomers && (
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(c)}
                        >
                          <Trash2 className="w-4 h-4" />
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCustomer?.name}
              {selectedCustomer?.customer_type === 'mayorista' && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  <Store className="w-3 h-3 inline mr-1" />
                  Mayorista
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">
                  {settings.language === 'es' ? 'Información' : 'Information'}
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {settings.language === 'es' ? 'Historial' : 'History'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4 space-y-4">
                {/* Facade Photo */}
                {selectedCustomer.facade_photo_url && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      {settings.language === 'es' ? 'Foto de Fachada' : 'Facade Photo'}
                    </Label>
                    <img
                      src={selectedCustomer.facade_photo_url}
                      alt="Fachada del cliente"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}

                <div className="grid gap-2 text-sm">
                  {selectedCustomer.business_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {settings.language === 'es' ? 'Nombre del Negocio' : 'Business Name'}
                      </span>
                      <span className="font-medium">{selectedCustomer.business_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {settings.language === 'es' ? 'Tipo de Cliente' : 'Customer Type'}
                    </span>
                    <span className={`font-medium ${selectedCustomer.customer_type === 'mayorista' ? 'text-blue-600' : ''}`}>
                      {selectedCustomer.customer_type === 'mayorista' ? 'Mayorista' : 'Minorista'}
                    </span>
                  </div>
                  {selectedCustomer.phone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.phone}</span>
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {selectedCustomer.address && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.address}</span>
                      <span className="text-right max-w-[60%]">{selectedCustomer.address}</span>
                    </div>
                  )}
                  {selectedCustomer.email && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.email}</span>
                      <span>{selectedCustomer.email}</span>
                    </div>
                  )}
                  {selectedCustomer.vendedor_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {settings.language === 'es' ? 'Vendedor Asignado' : 'Assigned Vendor'}
                      </span>
                      <span className="text-primary font-medium">{getVendedorName(selectedCustomer.vendedor_id)}</span>
                    </div>
                  )}
                  {selectedCustomer.notes && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.notes}</span>
                      <span className="text-right max-w-[60%]">{selectedCustomer.notes}</span>
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
                    {t.viewOnly} - {settings.language === 'es' ? 'Solo el administrador o vendedor puede editar clientes' : 'Only admin or vendor can edit customers'}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <CustomerPurchaseHistory 
                  customerId={selectedCustomer.id} 
                  customerName={selectedCustomer.name} 
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
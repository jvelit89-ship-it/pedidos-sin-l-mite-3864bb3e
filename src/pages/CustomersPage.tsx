import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getAllItems, addItem } from '@/lib/db';
import { Customer } from '@/types';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Search, Users, Phone, MapPin } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', email: '', notes: '' });

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    const data = await getAllItems('customers');
    setCustomers(data.sort((a, b) => a.name.localeCompare(b.name)));
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    await addItem('customers', { id: uuidv4(), ...formData, createdAt: now, updatedAt: now });
    toast.success('Cliente creado');
    await loadCustomers();
    setIsDialogOpen(false);
    setFormData({ name: '', phone: '', address: '', email: '', notes: '' });
  };

  const filtered = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Nuevo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Cliente</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label>Nombre *</Label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required /></div>
              <div className="space-y-2"><Label>Teléfono *</Label><Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required /></div>
              <div className="space-y-2"><Label>Dirección *</Label><Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} required /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
              <div className="space-y-2"><Label>Notas</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={2} /></div>
              <Button type="submit" className="w-full">Crear Cliente</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar clientes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" /></div></CardContent></Card>
      {isLoading ? <div className="text-center py-12"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div></div> : filtered.length === 0 ? <Card><CardContent className="py-12 text-center"><Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" /><p className="text-muted-foreground">No hay clientes</p></CardContent></Card> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
              <Card className="card-interactive"><CardContent className="p-4">
                <p className="font-semibold">{c.name}</p>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{c.phone}</div>
                  <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /><span className="truncate">{c.address}</span></div>
                </div>
              </CardContent></Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

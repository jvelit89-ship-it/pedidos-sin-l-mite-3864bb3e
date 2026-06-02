import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  ShoppingCart, 
  Truck, 
  Package, 
  Users, 
  Settings,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Clock,
  Smartphone,
  Info
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface StepProps {
  number: number;
  title: string;
  description: string;
}

function Step({ number, title, description }: StepProps) {
  return (
    <div className="flex gap-3 items-start group">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-black border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        {number}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, description, children }: { icon: any; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="mb-6 border-none shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4 bg-muted/30">
        <CardTitle className="flex items-center gap-3 text-xl font-black">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {children}
      </CardContent>
    </Card>
  );
}

function AdminManual() {
  return (
    <div className="space-y-6">
      <SectionCard icon={ShieldCheck} title="Panel de Control (Admin)" description="Gestión total de la operación y equipo.">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="orders">
            <AccordionTrigger className="font-bold">Gestión de Pedidos Avanzada</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <Step number={1} title="Crear Pedido Retroactivo" description="Activa 'Fecha anterior' para registrar ventas pasadas que no se anotaron en su momento." />
              <Step number={2} title="Eliminar/Editar con OTP" description="Para cambios críticos, el sistema pedirá un código enviado a tu correo para validar la acción." />
              <Step number={3} title="Revelar PIN" description="Si un cliente pierde su PIN de entrega, búscalo en el detalle del pedido y usa 'Revelar PIN'." />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="team">
            <AccordionTrigger className="font-bold">Control de Equipo</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <Step number={1} title="Impersonación" description="Usa el botón de 'Inicio de Sesión' en la lista de personal para ver la app exactamente como ellos la ven." />
              <Step number={2} title="Configurar Comisiones" description="En cada producto, define el margen exacto para vendedores y operarios." />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SectionCard>

      <SectionCard icon={ShoppingCart} title="Flujo Online para Clientes" description="Cómo orientar a tus clientes que compran por la web.">
        <Step number={1} title="Compartir Enlace" description="Envía el enlace de 'Pedido Online' a tus clientes de confianza o ponlo en tu Bio de redes sociales." />
        <Step number={2} title="Registro Autónomo" description="El cliente ingresa su DNI/RUC y el sistema jala sus datos automáticamente." />
        <Step number={3} title="Seguimiento en Tiempo Real" description="Indica al cliente que use el código de 8 dígitos para ver dónde viene el camión en 'Portal Cliente'." />
      </SectionCard>
      
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
        <div>
          <h4 className="font-bold text-amber-900">Seguridad Crítica</h4>
          <p className="text-sm text-amber-800">Nunca compartas tus credenciales. Los códigos OTP de eliminación son personales y se registran en los registros de auditoría.</p>
        </div>
      </div>
    </div>
  );
}

function VendedorManual() {
  return (
    <div className="space-y-6">
      <SectionCard icon={ShoppingCart} title="Ventas y Prospección" description="Tu herramienta principal para cerrar negocios.">
        <Step number={1} title="Crear Pedido" description="Toca '+', busca al cliente. Si es nuevo, regístralo con su DNI/RUC para validar formalidad." />
        <Step number={2} title="Gestión de Pre-pedidos" description="Si el cliente paga por adelantado (paquetes), asegúrate de marcar 'Usar Paquete Prepago' al crear el pedido." />
        <Step number={3} title="Asignación de Repartidor" description="Selecciona al repartidor de la zona. El sistema le notificará con una campana al instante." />
        <Step number={4} title="Notas de Venta" description="Al finalizar, genera la Nota de Venta y compártela por WhatsApp directamente al cliente." />
      </SectionCard>

      <SectionCard icon={Users} title="Gestión de Clientes" description="Mantén tu cartera organizada.">
        <Step number={1} title="Geolocalización" description="Es VITAL capturar la ubicación exacta. Usa 'Mi ubicación actual' cuando estés frente al local del cliente." />
        <Step number={2} title="Foto de Fachada" description="Toma una foto clara del negocio para que el repartidor no se pierda al llegar." />
        <Step number={3} title="Historial de Compras" description="Revisa qué compró el cliente anteriormente para ofrecerle promociones personalizadas." />
      </SectionCard>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3">
        <Info className="w-6 h-6 text-blue-600 shrink-0" />
        <div>
          <h4 className="font-bold text-blue-900">Tip de Venta</h4>
          <p className="text-sm text-blue-800">Los pedidos registrados antes de las 10 AM tienen prioridad de entrega en la ruta de la mañana.</p>
        </div>
      </div>
    </div>
  );
}

function RepartidorManual() {
  return (
    <div className="space-y-6">
      <SectionCard icon={Truck} title="Logística y Entregas" description="Optimiza tu ruta y confirma entregas.">
        <Step number={1} title="Carga del Camión" description="En tu Dashboard verás el 'Resumen de Carga'. Asegúrate de llevar todo antes de salir." />
        <Step number={2} title="Inicio de Ruta" description="Marca el pedido como 'En Camino' justo antes de arrancar. El cliente recibirá una notificación." />
        <Step number={3} title="Confirmación con PIN" description="Al llegar, pide el PIN de 4 dígitos al cliente e ingrésalo en la app para marcar como 'Entregado'." />
        <Step number={4} title="GPS Integrado" description="Toca el ícono de mapa en el pedido para abrir Google Maps con la ruta optimizada." />
      </SectionCard>

      <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex gap-3">
        <Clock className="w-6 h-6 text-orange-600 shrink-0" />
        <div>
          <h4 className="font-bold text-orange-900">Alertas de Urgencia</h4>
          <p className="text-sm text-orange-800">Si un pedido tiene más de 90 minutos pendiente, la app sonará una campana. Prioriza esos pedidos.</p>
        </div>
      </div>
    </div>
  );
}

function CommonIssuesManual() {
  return (
    <SectionCard icon={AlertTriangle} title="Resolución de Problemas" description="Qué hacer cuando algo no sale como se espera.">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="gps">
          <AccordionTrigger className="font-bold">El GPS no es exacto</AccordionTrigger>
          <AccordionContent>
            Asegúrate de tener el GPS activo en 'Modo Alta Precisión' y de estar en un lugar despejado. Si persiste, puedes copiar y pegar la dirección manualmente desde Google Maps.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="pin">
          <AccordionTrigger className="font-bold">El cliente no tiene su PIN</AccordionTrigger>
          <AccordionContent>
            1. Pide al cliente que revise su SMS/WhatsApp. 
            2. El administrador puede ver el PIN en el detalle del pedido.
            3. Si el cliente compró online, el PIN sale en su pantalla de confirmación.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="stock">
          <AccordionTrigger className="font-bold">Stock en Rojo</AccordionTrigger>
          <AccordionContent>
            Si intentas vender algo sin stock, el pedido se marcará como 'Backorder'. Se entregará automáticamente cuando el Operario registre nueva producción.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </SectionCard>
  );
}

export default function ManualPage() {
  const { user } = useAuth();
  const userRole = user?.role || 'vendedor';

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-600',
      superadmin: 'bg-purple-600',
      vendedor: 'bg-blue-600',
      repartidor: 'bg-orange-600',
      operario: 'bg-green-600'
    };
    const labels: Record<string, string> = {
      admin: 'Administrador',
      superadmin: 'Administrador',
      vendedor: 'Vendedor',
      repartidor: 'Repartidor',
      operario: 'Operario'
    };
    return (
      <Badge className={`${colors[role]} text-white px-3 py-1`}>
        {labels[role]}
      </Badge>
    );
  };

  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-20">
      <div className="mb-10 text-center">
        <div className="inline-flex p-3 bg-primary/10 rounded-2xl mb-4">
          <BookOpen className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-3">Centro de Ayuda</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Domina la plataforma Agua Santa María con nuestras guías interactivas paso a paso.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Sesión activa como:</span>
          {getRoleBadge(userRole)}
        </div>
      </div>

      <Tabs defaultValue={isAdmin ? "admin" : userRole} className="w-full">
        {isAdmin && (
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="admin" className="rounded-lg">Admin</TabsTrigger>
            <TabsTrigger value="vendedor" className="rounded-lg">Vendedores</TabsTrigger>
            <TabsTrigger value="repartidor" className="rounded-lg">Repartidores</TabsTrigger>
            <TabsTrigger value="issues" className="rounded-lg">Soporte</TabsTrigger>
          </TabsList>
        )}
        
        <div className="mt-4">
          <TabsContent value="admin">
            <AdminManual />
          </TabsContent>
          <TabsContent value="vendedor">
            <VendedorManual />
          </TabsContent>
          <TabsContent value="repartidor">
            <RepartidorManual />
          </TabsContent>
          <TabsContent value="issues">
            <CommonIssuesManual />
          </TabsContent>
          
          {!isAdmin && (
            <div className="mt-10">
              <CommonIssuesManual />
            </div>
          )}
        </div>
      </Tabs>

      <div className="mt-16 p-8 rounded-3xl bg-gradient-to-br from-primary to-blue-700 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-2">
          <h3 className="text-2xl font-black">¿Necesitas soporte técnico adicional?</h3>
          <p className="text-blue-100">Estamos aquí para ayudarte a que tu operación nunca se detenga.</p>
        </div>
        <Button size="lg" variant="secondary" className="font-bold px-8 shadow-lg" onClick={() => window.open('https://wa.me/tu-numero', '_blank')}>
          <Smartphone className="w-5 h-5 mr-2" />
          Contactar Soporte
        </Button>
      </div>
    </div>
  );
}
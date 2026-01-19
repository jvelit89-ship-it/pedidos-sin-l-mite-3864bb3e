import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  ArrowRight
} from 'lucide-react';

interface StepProps {
  number: number;
  title: string;
  description: string;
}

function Step({ number, title, description }: StepProps) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div className="flex-1">
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

function AdminManual() {
  return (
    <div className="space-y-4">
      <SectionCard icon={ShoppingCart} title="Crear un Pedido">
        <Step number={1} title="Ir a Pedidos" description="Toca 'Pedidos' en el menú inferior o lateral." />
        <Step number={2} title="Nuevo Pedido" description="Toca el botón '+' azul arriba a la derecha." />
        <Step number={3} title="Buscar Cliente" description="Escribe el nombre o teléfono del cliente. Si no existe, créalo." />
        <Step number={4} title="Agregar Productos" description="Selecciona productos y ajusta cantidades con + y -." />
        <Step number={5} title="Asignar Vendedor y Repartidor" description="Selecciona quién vende y quién entrega." />
        <Step number={6} title="Guardar" description="Toca 'Crear Pedido' para finalizar." />
      </SectionCard>

      <SectionCard icon={Users} title="Gestionar Clientes">
        <Step number={1} title="Ir a Clientes" description="Toca 'Clientes' en el menú." />
        <Step number={2} title="Nuevo Cliente" description="Toca '+' y completa: nombre, teléfono (9 dígitos), dirección." />
        <Step number={3} title="Validar Documento" description="Ingresa DNI (8) o RUC (11) y toca 'Verificar'." />
        <Step number={4} title="Ubicación" description="Pega enlace de Google Maps o usa GPS automático." />
        <Step number={5} title="Foto (opcional)" description="Toma foto de la fachada para referencia." />
      </SectionCard>

      <SectionCard icon={Package} title="Gestionar Inventario">
        <Step number={1} title="Ir a Inventario" description="Toca 'Inventario' en el menú." />
        <Step number={2} title="Nuevo Producto" description="Toca '+', ingresa nombre, SKU, precio y stock mínimo." />
        <Step number={3} title="Registrar Producción" description="Toca un producto → 'Producción' → cantidad producida." />
        <Step number={4} title="Ver Movimientos" description="Toca 'Historial' para ver entradas y salidas." />
        <Step number={5} title="Configurar Comisiones" description="Edita el producto y define comisión por vendedor/operario." />
      </SectionCard>

      <SectionCard icon={Users} title="Gestionar Equipo">
        <Step number={1} title="Ir a Vendedores/Repartidores/Operarios" description="Selecciona la sección del equipo a gestionar." />
        <Step number={2} title="Crear Usuario" description="Toca '+', ingresa nombre, email y contraseña." />
        <Step number={3} title="Impersonar" description="Toca 'Iniciar Sesión' para ver como ese usuario." />
        <Step number={4} title="Volver" description="Usa la barra amarilla arriba para volver a tu cuenta." />
      </SectionCard>

      <SectionCard icon={Settings} title="Otras Funciones">
        <Step number={1} title="Ver Comisiones" description="'Comisiones' → selecciona periodo → ve detalle por persona." />
        <Step number={2} title="Mapa de Clientes" description="'Mapa' → visualiza ubicaciones y pedidos pendientes." />
        <Step number={3} title="Solicitudes de Factura" description="Dashboard → panel derecho → procesa solicitudes." />
        <Step number={4} title="Eliminar Pedidos" description="Selecciona pedidos → ingresa código OTP enviado por email." />
      </SectionCard>
    </div>
  );
}

function VendedorManual() {
  return (
    <div className="space-y-4">
      <SectionCard icon={ShoppingCart} title="Tu Trabajo Diario">
        <div className="bg-muted/50 p-3 rounded-lg mb-4">
          <p className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Como vendedor puedes: crear pedidos, gestionar clientes y ver tus comisiones.
          </p>
        </div>
      </SectionCard>

      <SectionCard icon={ShoppingCart} title="Crear un Pedido">
        <Step number={1} title="Ir a Pedidos" description="Toca 'Pedidos' en el menú." />
        <Step number={2} title="Nuevo Pedido" description="Toca el botón '+' azul." />
        <Step number={3} title="Seleccionar Cliente" description="Busca por nombre o teléfono. Crea uno nuevo si no existe." />
        <Step number={4} title="Agregar Productos" description="Toca productos para agregarlos. Ajusta cantidad con + y -." />
        <Step number={5} title="Seleccionar Repartidor" description="Elige quién entregará el pedido." />
        <Step number={6} title="Confirmar" description="Toca 'Crear Pedido'. ¡Listo!" />
      </SectionCard>

      <SectionCard icon={Users} title="Registrar Cliente Nuevo">
        <Step number={1} title="Desde el Pedido" description="Al crear pedido, toca 'Crear cliente nuevo'." />
        <Step number={2} title="Datos Básicos" description="Nombre, teléfono (9 dígitos) y dirección." />
        <Step number={3} title="Documento" description="DNI (8 dígitos) o RUC (11 dígitos). Toca 'Verificar'." />
        <Step number={4} title="Guardar" description="El cliente queda asignado a ti automáticamente." />
      </SectionCard>

      <SectionCard icon={ArrowRight} title="Cambiar Estado de Pedido">
        <Step number={1} title="Abrir Pedido" description="Toca el pedido en la lista." />
        <Step number={2} title="Cambiar Estado" description="Puedes cambiar a: En Preparación, Listo para Envío." />
        <Step number={3} title="Nota" description="Una vez 'En Camino' o 'Entregado', solo el repartidor puede cambiar." />
      </SectionCard>

      <SectionCard icon={Settings} title="Ver Tus Comisiones">
        <Step number={1} title="Ir a Comisiones" description="Toca 'Comisiones' en el menú." />
        <Step number={2} title="Seleccionar Periodo" description="Elige quincena: 1-15 o 16-fin de mes." />
        <Step number={3} title="Ver Detalle" description="Verás tus pedidos y comisión ganada por producto." />
      </SectionCard>
    </div>
  );
}

function RepartidorManual() {
  return (
    <div className="space-y-4">
      <SectionCard icon={Truck} title="Tu Trabajo Diario">
        <div className="bg-muted/50 p-3 rounded-lg mb-4">
          <p className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Como repartidor: ve pedidos listos, actualiza estados y navega a direcciones.
          </p>
        </div>
      </SectionCard>

      <SectionCard icon={Package} title="Ver Pedidos Asignados">
        <Step number={1} title="Dashboard" description="Al entrar verás resumen de carga: productos a cargar." />
        <Step number={2} title="Pedidos Listos" description="Ve los pedidos marcados 'Listo para Envío'." />
        <Step number={3} title="Alerta de Urgencia" description="Pedidos con más de 90 min suenan alarma." />
      </SectionCard>

      <SectionCard icon={ArrowRight} title="Actualizar Estado de Entrega">
        <Step number={1} title="Abrir Pedido" description="Toca el pedido que vas a entregar." />
        <Step number={2} title="Iniciar Entrega" description="Cambia estado a 'En Camino' cuando salgas." />
        <Step number={3} title="Confirmar Entrega" description="Al entregar, cambia a 'Entregado'." />
        <Step number={4} title="Si hay Problema" description="Puedes marcar 'Cancelado' si no se pudo entregar." />
      </SectionCard>

      <SectionCard icon={Truck} title="Navegar a la Dirección">
        <Step number={1} title="Abrir Pedido" description="Toca el pedido con dirección." />
        <Step number={2} title="Ver Mapa" description="Toca el ícono de ubicación o 'Ver en Mapa'." />
        <Step number={3} title="Abrir Google Maps" description="Toca 'Navegar' para abrir en Google Maps." />
      </SectionCard>

      <SectionCard icon={Settings} title="Tu Ruta del Día">
        <Step number={1} title="Ir a Entregas" description="Toca 'Entregas' en el menú." />
        <Step number={2} title="Ver Mapa" description="Todos tus pedidos pendientes en el mapa." />
        <Step number={3} title="Optimizar" description="Sigue el orden sugerido para ahorrar tiempo." />
      </SectionCard>
    </div>
  );
}

function OperarioManual() {
  return (
    <div className="space-y-4">
      <SectionCard icon={Package} title="Tu Trabajo Diario">
        <div className="bg-muted/50 p-3 rounded-lg mb-4">
          <p className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Como operario: registra producción, actualiza pedidos a preparación/listo.
          </p>
        </div>
      </SectionCard>

      <SectionCard icon={Package} title="Registrar Producción">
        <Step number={1} title="Ir a Inventario" description="Toca 'Inventario' en el menú." />
        <Step number={2} title="Seleccionar Producto" description="Busca el producto que fabricaste." />
        <Step number={3} title="Registrar" description="Toca 'Producción' e ingresa la cantidad." />
        <Step number={4} title="Confirmar" description="El stock se actualiza automáticamente." />
      </SectionCard>

      <SectionCard icon={ArrowRight} title="Preparar Pedidos">
        <Step number={1} title="Ir a Pedidos" description="Toca 'Pedidos' para ver los pendientes." />
        <Step number={2} title="Pedido Pendiente" description="Abre un pedido en estado 'Pendiente'." />
        <Step number={3} title="Iniciar Preparación" description="Cambia estado a 'En Preparación'." />
        <Step number={4} title="Listo para Envío" description="Al terminar, cambia a 'Listo para Envío'." />
      </SectionCard>

      <SectionCard icon={Settings} title="Ver Tus Comisiones">
        <Step number={1} title="Ir a Comisiones" description="Toca 'Comisiones' en el menú." />
        <Step number={2} title="Ver Producción" description="Verás tu producción y comisión ganada." />
        <Step number={3} title="Periodo" description="Selecciona la quincena para ver el detalle." />
      </SectionCard>
    </div>
  );
}

export default function ManualPage() {
  const { user } = useAuth();
  const userRole = user?.role || 'vendedor';

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-500',
      superadmin: 'bg-purple-500',
      vendedor: 'bg-blue-500',
      repartidor: 'bg-orange-500',
      operario: 'bg-green-500'
    };
    const labels: Record<string, string> = {
      admin: 'Administrador',
      superadmin: 'Administrador',
      vendedor: 'Vendedor',
      repartidor: 'Repartidor',
      operario: 'Operario'
    };
    return (
      <Badge className={`${colors[role]} text-white`}>
        {labels[role]}
      </Badge>
    );
  };

  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">Manual de Uso</h1>
        </div>
        <p className="text-muted-foreground">
          Guía rápida paso a paso para usar la plataforma.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tu rol:</span>
          {getRoleBadge(userRole)}
        </div>
      </div>

      {isAdmin ? (
        <Tabs defaultValue="admin" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="admin">Admin</TabsTrigger>
            <TabsTrigger value="vendedor">Vendedor</TabsTrigger>
            <TabsTrigger value="repartidor">Repartidor</TabsTrigger>
            <TabsTrigger value="operario">Operario</TabsTrigger>
          </TabsList>
          <TabsContent value="admin">
            <AdminManual />
          </TabsContent>
          <TabsContent value="vendedor">
            <VendedorManual />
          </TabsContent>
          <TabsContent value="repartidor">
            <RepartidorManual />
          </TabsContent>
          <TabsContent value="operario">
            <OperarioManual />
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {userRole === 'vendedor' && <VendedorManual />}
          {userRole === 'repartidor' && <RepartidorManual />}
          {userRole === 'operario' && <OperarioManual />}
        </>
      )}
    </div>
  );
}

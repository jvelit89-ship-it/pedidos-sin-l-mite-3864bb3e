import {
  Award,
  ChevronRight,
  Clock3,
  Droplets,
  Gift,
  Package,
  Percent,
  Repeat2,
  ShoppingCart,
  Sparkles,
  Minus,
  Plus,
  Store,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
};

type Promo = {
  id: string;
  product_id: string;
  min_quantity: number;
  unit_price: number;
  product?: Product;
};

const PORTAL_PRODUCTS_HERO = 'https://pedidos-api.169-58-90-214.sslip.io/storage/v1/object/public/product-images/portal-products-group.webp';

interface DirectOrderLandingProps {
  products: Product[];
  selectedProducts: Record<string, number>;
  featuredPromotions: Promo[];
  getProductPrice: (productId: string, quantity: number) => number;
  onAdd: (productId: string) => void;
  onRemove: (productId: string) => void;
  onStartOrder: () => void;
  onViewCatalog: () => void;
  onRepeatOrder: () => void;
  canRepeatOrder: boolean;
  cartItemCount: number;
  totalAmount: number;
}

const productScore = (name: string) => {
  const normalized = name.toLowerCase();
  if (normalized.includes('20') || normalized.includes('recarga')) return 1;
  if (normalized.includes('8')) return 2;
  if (normalized.includes('1l') || normalized.includes('1 l')) return 3;
  if (normalized.includes('625')) return 4;
  if (normalized.includes('hielo')) return 5;
  return 10;
};

export function DirectOrderLanding({
  products,
  selectedProducts,
  featuredPromotions,
  getProductPrice,
  onAdd,
  onRemove,
  onStartOrder,
  onViewCatalog,
  onRepeatOrder,
  canRepeatOrder,
  cartItemCount,
  totalAmount,
}: DirectOrderLandingProps) {
  const storefrontProducts = [...products].sort((a, b) => productScore(a.name) - productScore(b.name)).slice(0, 5);

  return (
    <div className="bg-slate-50">
      <section className="relative overflow-hidden text-white bg-[#064D9B]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,.34),rgba(255,255,255,.08)_20%,transparent_42%),linear-gradient(115deg,#063B7D_0%,#0759B3_42%,#0A67C8_72%,#0E78D8_100%)]" />
          <div className="absolute -left-24 top-1/3 w-80 h-80 rounded-full border-[28px] border-cyan-100/20 blur-[1px]" />
          <div className="absolute right-[8%] -top-24 w-80 h-80 rounded-full bg-white/25 blur-3xl" />
          <div className="absolute -bottom-20 left-[44%] w-[520px] h-44 rounded-[50%] bg-blue-200/20 blur-2xl" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/22 to-transparent" />
          <div className="absolute top-4 left-[6%] w-3 h-3 rounded-full bg-white/65 shadow-[80px_130px_0_3px_rgba(255,255,255,.25),160px_65px_0_0_rgba(255,255,255,.5),1080px_120px_0_4px_rgba(255,255,255,.22)]" />
        </div>

        <div className="max-w-[1440px] mx-auto relative z-10 px-4 sm:px-6 lg:px-10 pt-7 sm:pt-10 lg:pt-12 pb-0">
          <div className="grid lg:grid-cols-[.92fr_1.08fr] gap-6 lg:gap-8 items-center">
            <div className="text-center lg:text-left pb-7 sm:pb-10 lg:pb-14">
              <Badge className="bg-blue-950/35 hover:bg-blue-950/35 border border-white/25 text-white rounded-full px-4 py-2 backdrop-blur-md shadow-sm">
                Portal oficial de pedidos
              </Badge>

              <h1 className="mt-5 text-[clamp(2.55rem,7vw,5.4rem)] font-black tracking-[-.055em] leading-[.88] drop-shadow-sm">
                Abastece tu Negocio
                <span className="block text-blue-100 [text-shadow:0_3px_0_rgba(255,255,255,.18)]">desde Aquí</span>
              </h1>

              <div className="mt-4 sm:mt-5 inline-flex flex-col rounded-[1.7rem] bg-blue-950/80 px-5 sm:px-8 py-3 sm:py-4 shadow-xl border border-white/10">
                <span className="text-xl sm:text-2xl lg:text-3xl font-black">Agua Santa María y EcoHielo</span>
                <span className="text-base sm:text-xl text-blue-100">para distribuidores</span>
              </div>

              <p className="mt-5 text-sm sm:text-base lg:text-lg text-white/95 max-w-2xl mx-auto lg:mx-0 font-medium">
                Abastece tu negocio desde aquí con promociones por volumen, recompensas y una experiencia pensada para reposición.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3 mt-6">
                <Benefit icon={Clock3} title="Entrega programada" value="aprox. 24 h" />
                <Benefit icon={Store} title="Atención a" value="distribuidores" />
                <Benefit icon={Percent} title="Promociones" value="por volumen" />
                <Benefit icon={Award} title="1 punto" value="cada S/5" />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5 max-w-2xl mx-auto lg:mx-0">
                <Button
                  size="lg"
                  className="h-14 sm:h-16 rounded-2xl bg-gradient-to-r from-blue-800 via-blue-700 to-blue-600 text-white hover:from-blue-900 hover:to-blue-700 font-black shadow-[0_10px_28px_rgba(0,48,145,.34)] border border-white/40 text-base sm:text-lg"
                  onClick={onStartOrder}
                >
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                  Pedir ahora
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 sm:h-16 rounded-2xl border-2 border-white/70 bg-white/12 text-white hover:bg-white/22 hover:text-white font-black backdrop-blur text-base sm:text-lg"
                  onClick={onViewCatalog}
                >
                  Ver catálogo
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </div>
            </div>

            <div className="relative min-h-[330px] sm:min-h-[430px] lg:min-h-[560px] flex items-end justify-center">
              <div className="absolute top-0 right-0 hidden sm:flex items-center justify-center rounded-[2rem] bg-white/88 backdrop-blur px-5 py-3 shadow-xl border border-white/70">
                <img
                  src="/logo-empresa.jpg"
                  alt="Agua Santa María"
                  className="h-14 lg:h-20 w-auto object-contain"
                />
              </div>

              <div className="absolute left-1/2 -translate-x-1/2 bottom-5 w-[88%] h-[68%] rounded-[42%] bg-white/14 blur-[1px] border border-white/10" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-3 w-[92%] h-20 rounded-[50%] bg-white/35 blur-xl" />

              <img
                src={PORTAL_PRODUCTS_HERO}
                alt="Agua Santa María y EcoHielo - portafolio para distribuidores"
                className="relative z-10 w-full max-w-[860px] h-auto object-contain drop-shadow-[0_30px_34px_rgba(0,50,110,.32)] scale-[1.08] sm:scale-[1.12] lg:scale-[1.18] origin-bottom"
                loading="eager"
                fetchPriority="high"
              />
            </div>
          </div>

          <div className="relative z-20 -mx-4 sm:-mx-6 lg:-mx-10 mt-0 border-t border-white/35 bg-white/88 backdrop-blur-xl text-blue-950">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 grid grid-cols-3 gap-2 sm:gap-4 text-center">
              <div className="flex items-center justify-center gap-2 font-bold text-[11px] sm:text-sm">
                <Droplets className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
                <span>Calidad garantizada</span>
              </div>
              <div className="flex items-center justify-center gap-2 font-bold text-[11px] sm:text-sm border-x border-blue-200">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 shrink-0" />
                <span>Agua alcalina</span>
              </div>
              <div className="flex items-center justify-center gap-2 font-bold text-[11px] sm:text-sm">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 shrink-0" />
                <span>Hielo siempre fresco</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <FeatureCard icon={Store} title="Compra para reposición" body="Mantén tu negocio siempre abastecido" />
          <FeatureCard icon={Package} title="Productos de alta rotación" body="Los más pedidos para tu negocio" />
          <FeatureCard icon={Repeat2} title="Repite tu último pedido" body="Más rápido y conveniente" />
          <FeatureCard icon={Gift} title="Canjea tus recompensas" body="Premios por fidelidad para distribuidores" />
        </div>
      </section>

      <section id="catalogo" className="max-w-6xl mx-auto px-4 sm:px-6 py-5 scroll-mt-24">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-blue-600">Catálogo</p>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Nuestros productos</h2>
          </div>
          <button type="button" onClick={onStartOrder} className="text-sm font-bold text-blue-700 flex items-center gap-1">
            Hacer pedido <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {storefrontProducts.map((product, index) => {
            const quantity = selectedProducts[product.id] || 0;
            const price = getProductPrice(product.id, Math.max(quantity, 1));
            const tag = index === 0 ? 'Más pedido' : product.name.toLowerCase().includes('hielo') ? 'Mayorista' : index === 1 ? 'Oferta' : null;
            return (
              <article
                key={product.id}
                className="snap-start min-w-[170px] sm:min-w-[210px] flex-1 rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="h-44 sm:h-52 bg-gradient-to-b from-blue-50 to-white relative flex items-center justify-center p-4">
                  {tag && (
                    <Badge className={`absolute top-3 left-3 z-10 ${tag === 'Oferta' ? 'bg-emerald-500 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-600'}`}>
                      {tag}
                    </Badge>
                  )}
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-contain" loading="lazy" />
                  ) : (
                    <Droplets className="w-16 h-16 text-blue-300" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-black text-slate-900 leading-tight min-h-10 line-clamp-2">{product.name}</h3>
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <div>
                      <p className="text-xl font-black text-blue-700">S/ {Number(price).toFixed(2)}</p>
                      {quantity > 0 && <p className="text-[11px] text-emerald-600 font-bold">{quantity} agregado(s)</p>}
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 p-1">
                      {quantity > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => onRemove(product.id)}
                            className="w-9 h-9 rounded-full bg-white border border-blue-200 text-blue-700 flex items-center justify-center shadow-sm active:scale-95"
                            aria-label={`Quitar ${product.name}`}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="min-w-7 text-center text-sm font-black text-blue-950">{quantity}</span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onAdd(product.id)}
                        className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md active:scale-95"
                        aria-label={`Agregar ${product.name}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {featuredPromotions.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="rounded-3xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white p-5 sm:p-6 shadow-lg">
            <div className="flex items-center gap-2">
              <Percent className="w-6 h-6" />
              <h3 className="text-xl font-black">Promociones por volumen</h3>
            </div>
            <p className="text-sm text-white/90 mt-1">Beneficios especiales disponibles al pedir desde el portal.</p>
            <div className="grid sm:grid-cols-3 gap-2 mt-4">
              {featuredPromotions.map((promo) => (
                <button
                  type="button"
                  key={promo.id}
                  onClick={() => promo.product_id && onAdd(promo.product_id)}
                  className="rounded-2xl bg-white/15 border border-white/20 p-3 text-left backdrop-blur"
                >
                  <p className="text-xs font-bold text-emerald-50">{promo.product?.name || 'Producto'}</p>
                  <p className="font-black mt-1">Desde {promo.min_quantity} unid.</p>
                  <p className="text-sm">S/ {Number(promo.unit_price).toFixed(2)} c/u</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <div className="rounded-[2rem] overflow-hidden bg-gradient-to-br from-[#EAF8FF] via-white to-[#D9F4FF] border border-blue-100 shadow-sm">
          <div className="grid md:grid-cols-[.85fr_1.15fr] items-center">
            <div className="p-6 sm:p-8 text-center md:text-left">
              <p className="text-xs uppercase tracking-[.2em] font-black text-cyan-600">Abastecimiento completo</p>
              <h3 className="text-3xl sm:text-4xl font-black text-blue-950 mt-2">
                Todo tu abastecimiento
                <span className="block text-cyan-500">en un solo pedido</span>
              </h3>
              <p className="mt-3 text-sm text-slate-600">Agua, hielo y presentaciones para mantener tu negocio abastecido.</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-4">
                <Badge variant="outline" className="bg-white">Calidad garantizada</Badge>
                <Badge variant="outline" className="bg-white">Agua alcalina</Badge>
                <Badge variant="outline" className="bg-white">EcoHielo 3 kg</Badge>
              </div>
            </div>
            <div className="min-h-56 flex items-center justify-center px-4 py-4 bg-[radial-gradient(circle_at_center,_rgba(14,165,233,.15),transparent_65%)]">
              <img
                src={PORTAL_PRODUCTS_HERO}
                alt="Portafolio Agua Santa María y EcoHielo"
                className="w-full max-w-2xl h-auto object-contain"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <div className="rounded-[2rem] bg-gradient-to-br from-[#0045A8] via-[#076EDB] to-[#00A7E7] text-white overflow-hidden shadow-xl">
          <div className="p-5 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-blue-950 flex items-center justify-center">
                  <Award className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-2xl font-black">Club Santa María</p>
                  <p className="text-sm text-blue-100">Premios por fidelidad para distribuidores</p>
                </div>
              </div>
              <Badge className="bg-blue-950/60 hover:bg-blue-950/60 border border-white/20 text-white rounded-full px-4 py-2">
                Cada S/5 = 1 punto
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-5">
              <Reward value="20" label="puntos" detail="de bienvenida" />
              <Reward value="50 pts" label="= S/5" detail="de descuento" />
              <Reward value="100 pts" label="= S/12" detail="de descuento" />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Repeat2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="font-black text-slate-900">Repite tu último pedido</p>
              <p className="text-xs sm:text-sm text-slate-500">Ideal para distribuidores frecuentes.</p>
            </div>
          </div>
          <Button variant="outline" className="rounded-full shrink-0" onClick={canRepeatOrder ? onRepeatOrder : onStartOrder}>
            {canRepeatOrder ? 'Repetir' : 'Identificarme'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </section>

      {cartItemCount > 0 && (
        <div className="sticky bottom-0 z-30 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pointer-events-none">
          <div className="max-w-3xl mx-auto rounded-3xl bg-blue-950 text-white shadow-2xl border border-white/10 p-3 flex items-center gap-3 pointer-events-auto">
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingCart className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-[10px] text-blue-200">Tu pedido</p>
                <p className="font-black text-sm">{cartItemCount} producto(s)</p>
              </div>
            </div>
            <div className="h-9 w-px bg-white/20" />
            <div className="mr-auto">
              <p className="text-[10px] text-blue-200">Total estimado</p>
              <p className="font-black">S/ {totalAmount.toFixed(2)}</p>
            </div>
            <Button className="rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black" onClick={onStartOrder}>
              Continuar
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Benefit({ icon: Icon, title, value }: { icon: any; title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/95 text-slate-800 p-3 shadow-lg border border-white/60">
      <Icon className="w-5 h-5 text-blue-600 mx-auto lg:mx-0" />
      <p className="text-[11px] sm:text-xs font-bold mt-2 leading-tight">{title}</p>
      <p className="text-[11px] sm:text-xs font-black text-blue-700 leading-tight">{value}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-4 sm:p-5 shadow-sm">
      <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <p className="font-black text-slate-900 mt-3 leading-tight">{title}</p>
      <p className="text-xs sm:text-sm text-slate-500 mt-1">{body}</p>
    </div>
  );
}

function Reward({ value, label, detail }: { value: string; label: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-white/95 text-center text-blue-950 p-3 sm:p-4">
      <Gift className="w-5 h-5 text-amber-500 mx-auto" />
      <p className="text-lg sm:text-2xl font-black mt-2">{value}</p>
      <p className="text-sm font-black text-cyan-600">{label}</p>
      <p className="text-[10px] sm:text-xs text-slate-500 mt-1">{detail}</p>
    </div>
  );
}
